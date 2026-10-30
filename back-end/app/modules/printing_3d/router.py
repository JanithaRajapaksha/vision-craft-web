"""3D Printing API Router for STL Slicing and Price Estimation."""
import hashlib
import uuid
import struct
from decimal import Decimal
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from fastapi.responses import Response, PlainTextResponse
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.storage import get_storage
from app.modules.auth.models import User
from app.modules.printing_3d.models import CadModel, SlicingJob
from app.modules.printing_3d.schemas import (
    DimensionsMM,
    SliceEstimateResponse,
    SlicingJobListItem,
)
from app.modules.printing_3d.stl_engine import STLEngine
from app.modules.printing_3d.pricing_engine import calculate_fdm_price, DEFAULT_RATE_PER_GRAM_LKR

router = APIRouter(prefix="/3d-printing", tags=["FDM 3D Printing & STL Slicing"])


@router.post("/upload-and-slice", response_model=SliceEstimateResponse)
async def upload_and_slice_stl(
    file: UploadFile = File(...),
    layer_height: float = Form(0.20),
    infill_percentage: int = Form(20),
    material: str = Form("PLA+"),
    support_enabled: bool = Form(False),
    rate_per_gram: float = Form(25.0),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
):
    """
    Upload an .STL file, slice it with FDM parameters, and calculate estimated price
    using the hardcoded 25 LKR / 1g rate.
    """
    if not file.filename.lower().endswith(".stl"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .stl 3D model files are supported by this endpoint.",
        )

    file_bytes = await file.read()
    if len(file_bytes) < 84:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is too small or not a valid STL file.",
        )

    # Compute SHA-256
    sha256 = hashlib.sha256(file_bytes).hexdigest()

    # Save to storage
    storage = get_storage()
    file_id = str(uuid.uuid4())
    stored_path = f"cad_models/{file_id}_{file.filename}"
    await storage.save(stored_path, file_bytes)

    # 1. Parse STL geometry (Dimensions, Volume, Surface Area)
    try:
        geometry = STLEngine.parse_stl(file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse 3D mesh: {str(e)}",
        )

    # 2. Slice Model with FDM Kinematics
    telemetry = STLEngine.slice_model(
        mesh_meta=geometry,
        layer_height_mm=layer_height,
        infill_percentage=infill_percentage,
        material=material,
        support_enabled=support_enabled,
    )

    # 3. Calculate Price with Hardcoded 28 LKR/g Rate
    pricing = calculate_fdm_price(
        filament_grams=telemetry["filament_grams"],
        duration_seconds=telemetry["estimated_duration_seconds"],
        rate_per_gram=Decimal(str(rate_per_gram)),
    )

    # 4. Generate G-Code Preview & Save
    gcode_str = STLEngine.generate_gcode_preview(
        filename=file.filename,
        telemetry=telemetry,
        dimensions=geometry,
    )
    gcode_path = f"gcodes/{file_id}_{file.filename}.gcode"
    await storage.save(gcode_path, gcode_str.encode("utf-8"))

    # 5. Persist to Database
    cad_model = CadModel(
        id=file_id,
        original_filename=file.filename,
        stored_file_path=stored_path,
        file_format="STL",
        file_size_bytes=len(file_bytes),
        sha256_hash=sha256,
        bounding_box_x_mm=Decimal(str(geometry["dim_x_mm"])),
        bounding_box_y_mm=Decimal(str(geometry["dim_y_mm"])),
        bounding_box_z_mm=Decimal(str(geometry["dim_z_mm"])),
        mesh_volume_cm3=Decimal(str(geometry["volume_cm3"])),
        triangle_count=geometry["triangle_count"],
    )
    db.add(cad_model)
    await db.flush()

    job_id = str(uuid.uuid4())
    slicing_job = SlicingJob(
        id=job_id,
        cad_model_id=cad_model.id,
        layer_height_mm=Decimal(str(layer_height)),
        infill_percentage=infill_percentage,
        material_type=material,
        support_enabled=support_enabled,
        filament_used_grams=telemetry["filament_grams"],
        filament_used_length_mm=telemetry["filament_length_mm"],
        estimated_duration_seconds=telemetry["estimated_duration_seconds"],
        layer_count=telemetry["layer_count"],
        gcode_file_path=gcode_path,
        rate_per_gram_lkr=Decimal(str(rate_per_gram)),
        calculated_price_lkr=pricing["calculated_price_lkr"],
        pricing_breakdown=pricing,
        status="COMPLETED",
    )
    db.add(slicing_job)
    await db.commit()

    return SliceEstimateResponse(
        job_id=slicing_job.id,
        cad_model_id=cad_model.id,
        filename=cad_model.original_filename,
        dimensions_mm=DimensionsMM(
            x=geometry["dim_x_mm"],
            y=geometry["dim_y_mm"],
            z=geometry["dim_z_mm"],
        ),
        volume_cm3=Decimal(str(geometry["volume_cm3"])),
        triangle_count=geometry["triangle_count"],
        layer_height_mm=Decimal(str(layer_height)),
        infill_percentage=infill_percentage,
        material=material,
        support_enabled=telemetry.get("has_supports", False),
        has_supports=telemetry.get("has_supports", False),
        support_grams=telemetry.get("support_grams", Decimal("0.00")),
        support_volume_cm3=Decimal(str(telemetry.get("support_volume_cm3", 0.0))),
        filament_used_grams=telemetry["filament_grams"],
        filament_used_length_mm=telemetry["filament_length_mm"],
        estimated_duration_seconds=telemetry["estimated_duration_seconds"],
        estimated_duration_formatted=pricing["duration_formatted"],
        layer_count=telemetry["layer_count"],
        rate_per_gram_lkr=Decimal(str(rate_per_gram)),
        calculated_price_lkr=pricing["calculated_price_lkr"],
        formula_applied=pricing["formula_applied"],
        gcode_download_url=f"/api/v1/3d-printing/gcode/{slicing_job.id}",
        created_at=slicing_job.created_at,
    )


@router.post("/sample-cube", response_model=SliceEstimateResponse)
async def generate_and_slice_sample_cube(
    size_mm: float = 20.0,
    layer_height: float = 0.20,
    infill_percentage: int = 20,
    material: str = "PLA+",
    rate_per_gram: float = 25.0,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
):
    """
    Generate and slice a standard 20mm calibration cube STL directly on the server.
    Allows testing STL slicing and pricing with a single click!
    """
    # Build standard 20mm cube binary STL in memory
    triangles = [
        ((0,0,0), (size_mm,0,0), (size_mm,size_mm,0)),
        ((0,0,0), (size_mm,size_mm,0), (0,size_mm,0)),
        ((0,0,size_mm), (size_mm,size_mm,size_mm), (size_mm,0,size_mm)),
        ((0,0,size_mm), (0,size_mm,size_mm), (size_mm,size_mm,size_mm)),
        ((0,0,0), (size_mm,0,size_mm), (size_mm,0,0)),
        ((0,0,0), (0,0,size_mm), (size_mm,0,size_mm)),
        ((0,size_mm,0), (size_mm,size_mm,0), (size_mm,size_mm,size_mm)),
        ((0,size_mm,0), (size_mm,size_mm,size_mm), (0,size_mm,size_mm)),
        ((0,0,0), (0,size_mm,0), (0,size_mm,size_mm)),
        ((0,0,0), (0,size_mm,size_mm), (0,0,size_mm)),
        ((size_mm,0,0), (size_mm,size_mm,size_mm), (size_mm,size_mm,0)),
        ((size_mm,0,0), (size_mm,0,size_mm), (size_mm,size_mm,size_mm)),
    ]

    header = b"VisionCraft 20mm Calibration Cube STL" + b"\x00" * (80 - len("VisionCraft 20mm Calibration Cube STL"))
    cube_bytes = bytearray(header)
    cube_bytes.extend(struct.pack("<I", len(triangles)))
    for v1, v2, v3 in triangles:
        cube_bytes.extend(struct.pack("<3f", 0.0, 0.0, 0.0))
        cube_bytes.extend(struct.pack("<3f", *v1))
        cube_bytes.extend(struct.pack("<3f", *v2))
        cube_bytes.extend(struct.pack("<3f", *v3))
        cube_bytes.extend(struct.pack("<H", 0))

    file_bytes = bytes(cube_bytes)
    file_id = str(uuid.uuid4())
    filename = f"Calibration_Cube_{int(size_mm)}mm.stl"
    sha256 = hashlib.sha256(file_bytes).hexdigest()

    storage = get_storage()
    stored_path = f"cad_models/{file_id}_{filename}"
    await storage.save(stored_path, file_bytes)

    geometry = STLEngine.parse_stl(file_bytes)
    telemetry = STLEngine.slice_model(
        mesh_meta=geometry,
        layer_height_mm=layer_height,
        infill_percentage=infill_percentage,
        material=material,
        support_enabled=False,
    )
    pricing = calculate_fdm_price(
        filament_grams=telemetry["filament_grams"],
        duration_seconds=telemetry["estimated_duration_seconds"],
        rate_per_gram=Decimal(str(rate_per_gram)),
    )
    gcode_str = STLEngine.generate_gcode_preview(
        filename=filename,
        telemetry=telemetry,
        dimensions=geometry,
    )
    gcode_path = f"gcodes/{file_id}_{filename}.gcode"
    await storage.save(gcode_path, gcode_str.encode("utf-8"))

    cad_model = CadModel(
        id=file_id,
        original_filename=filename,
        stored_file_path=stored_path,
        file_format="STL",
        file_size_bytes=len(file_bytes),
        sha256_hash=sha256,
        bounding_box_x_mm=Decimal(str(geometry["dim_x_mm"])),
        bounding_box_y_mm=Decimal(str(geometry["dim_y_mm"])),
        bounding_box_z_mm=Decimal(str(geometry["dim_z_mm"])),
        mesh_volume_cm3=Decimal(str(geometry["volume_cm3"])),
        triangle_count=geometry["triangle_count"],
    )
    db.add(cad_model)
    await db.flush()

    job_id = str(uuid.uuid4())
    slicing_job = SlicingJob(
        id=job_id,
        cad_model_id=cad_model.id,
        layer_height_mm=Decimal(str(layer_height)),
        infill_percentage=infill_percentage,
        material_type=material,
        support_enabled=False,
        filament_used_grams=telemetry["filament_grams"],
        filament_used_length_mm=telemetry["filament_length_mm"],
        estimated_duration_seconds=telemetry["estimated_duration_seconds"],
        layer_count=telemetry["layer_count"],
        gcode_file_path=gcode_path,
        rate_per_gram_lkr=Decimal(str(rate_per_gram)),
        calculated_price_lkr=pricing["calculated_price_lkr"],
        pricing_breakdown=pricing,
        status="COMPLETED",
    )
    db.add(slicing_job)
    await db.commit()

    return SliceEstimateResponse(
        job_id=slicing_job.id,
        cad_model_id=cad_model.id,
        filename=cad_model.original_filename,
        dimensions_mm=DimensionsMM(
            x=geometry["dim_x_mm"],
            y=geometry["dim_y_mm"],
            z=geometry["dim_z_mm"],
        ),
        volume_cm3=Decimal(str(geometry["volume_cm3"])),
        triangle_count=geometry["triangle_count"],
        layer_height_mm=Decimal(str(layer_height)),
        infill_percentage=infill_percentage,
        material=material,
        support_enabled=telemetry.get("has_supports", False),
        has_supports=telemetry.get("has_supports", False),
        support_grams=telemetry.get("support_grams", Decimal("0.00")),
        support_volume_cm3=Decimal(str(telemetry.get("support_volume_cm3", 0.0))),
        filament_used_grams=telemetry["filament_grams"],
        filament_used_length_mm=telemetry["filament_length_mm"],
        estimated_duration_seconds=telemetry["estimated_duration_seconds"],
        estimated_duration_formatted=pricing["duration_formatted"],
        layer_count=telemetry["layer_count"],
        rate_per_gram_lkr=Decimal(str(rate_per_gram)),
        calculated_price_lkr=pricing["calculated_price_lkr"],
        formula_applied=pricing["formula_applied"],
        gcode_download_url=f"/api/v1/3d-printing/gcode/{slicing_job.id}",
        created_at=slicing_job.created_at,
    )


@router.get("/jobs", response_model=List[SlicingJobListItem])
async def list_slicing_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List recent slicing jobs with their filament usage and calculated price."""
    query = (
        select(SlicingJob)
        .options(selectinload(SlicingJob.cad_model))
        .order_by(desc(SlicingJob.created_at))
        .limit(20)
    )
    res = await db.execute(query)
    jobs = res.scalars().all()

    items = []
    for j in jobs:
        hours = j.estimated_duration_seconds // 3600
        mins = (j.estimated_duration_seconds % 3600) // 60
        duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"

        items.append(
            SlicingJobListItem(
                id=j.id,
                filename=j.cad_model.original_filename if j.cad_model else "Model.stl",
                material=j.material_type,
                infill_percentage=j.infill_percentage,
                filament_grams=j.filament_used_grams,
                duration_formatted=duration_str,
                price_lkr=j.calculated_price_lkr,
                created_at=j.created_at,
            )
        )
    return items


@router.get("/models/{cad_model_id}/stl")
async def get_model_stl(
    cad_model_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Serve the raw .stl binary for interactive WebGL 3D rendering."""
    res = await db.execute(select(CadModel).where(CadModel.id == cad_model_id))
    model = res.scalar_one_or_none()
    if not model or not model.stored_file_path:
        raise HTTPException(status_code=404, detail="CAD Model file not found.")

    storage = get_storage()
    if not await storage.exists(model.stored_file_path):
        raise HTTPException(status_code=404, detail="STL file does not exist in storage.")

    content = await storage.read(model.stored_file_path)
    return Response(
        content=content,
        media_type="application/sla",
        headers={"Content-Disposition": f'inline; filename="{model.original_filename}"'},
    )


@router.get("/gcode/{job_id}")
async def download_gcode(
    job_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Download the generated G-code file for a slicing job."""
    res = await db.execute(
        select(SlicingJob)
        .options(selectinload(SlicingJob.cad_model))
        .where(SlicingJob.id == job_id)
    )
    job = res.scalar_one_or_none()
    if not job or not job.gcode_file_path:
        raise HTTPException(status_code=404, detail="G-code file not found for this job.")

    storage = get_storage()
    if not await storage.exists(job.gcode_file_path):
        raise HTTPException(status_code=404, detail="G-code file does not exist on disk.")

    content = await storage.read(job.gcode_file_path)
    filename = f"{job.cad_model.original_filename if job.cad_model else 'model'}.gcode"

    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

