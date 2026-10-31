"""PCB Gerber Analysis, STL Generation, and Commercial Router."""
import io
import uuid
import zipfile
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Annotated, List, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.commercial.models import (
    Quotation,
    QuotationItem,
    QuotationStatus,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
)
from app.modules.commercial.schemas import QuotationResponse, OrderResponse
from app.modules.commercial.router import get_next_quotation_number, get_next_order_number
from app.modules.pcb.gerber_engine import GerberEngine
from app.modules.pcb.schemas import (
    PCBAnalysisResponse,
    PCBQuotationRequest,
    PCBOrderRequest,
    GeneratePCBSTLRequest,
    DrillHole,
    CopperPad,
)

router = APIRouter(prefix="/pcb", tags=["PCB & Gerber Engineering"])


@router.post("/upload-and-analyze", response_model=PCBAnalysisResponse)
async def upload_and_analyze_pcb(
    files: List[UploadFile] = File(...),
    rate_per_cm2_lkr: Decimal = Form(Decimal("15.00")),
    pcb_thickness_mm: float = Form(1.6),
    solder_mask_color: str = Form("Green"),
):
    """
    Accepts one ZIP archive or a set of Gerber files (.gm1/.gko, .gtl, .gbl, .drl).
    Identifies layers, parses contours, drill holes, and copper pads,
    calculates surface area (cm²), and computes pricing.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Gerber or drill files were provided.",
        )

    extracted: Dict[str, Tuple[str, str]] = {}
    primary_name = "PCB_Design"

    for file_item in files:
        raw_bytes = await file_item.read()
        filename = file_item.filename or "unknown.gbr"
        if primary_name == "PCB_Design" and not filename.endswith((".zip", ".tar")):
            primary_name = filename.rsplit(".", 1)[0]

        if zipfile.is_zipfile(io.BytesIO(raw_bytes)):
            primary_name = filename.rsplit(".", 1)[0]
            zip_extracted = GerberEngine.identify_and_extract_files(raw_bytes, filename)
            extracted.update(zip_extracted)
        else:
            try:
                content_str = raw_bytes.decode("utf-8", errors="ignore")
            except Exception:
                continue

            lower_name = filename.lower()
            layer_type = GerberEngine._classify_filename(lower_name, content_str)
            if not layer_type:
                if any(ext in lower_name for ext in [".gm1", ".gm2", ".gko", ".outline", "edge"]):
                    layer_type = "outline"
                elif any(ext in lower_name for ext in [".drl", ".xln", "drill"]):
                    layer_type = "drill"
                elif any(ext in lower_name for ext in [".gtl", ".top", "f_cu"]):
                    layer_type = "top_copper"
                elif any(ext in lower_name for ext in [".gbl", ".bot", "b_cu"]):
                    layer_type = "bottom_copper"
                else:
                    layer_type = "top_copper"

            extracted[layer_type] = (filename, content_str)

    if not extracted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract any valid RS-274X Gerber or Excellon drill layers from the uploaded package.",
        )

    analysis = GerberEngine.analyze_pcb_package(
        files=extracted,
        rate_per_cm2_lkr=rate_per_cm2_lkr,
        pcb_thickness_mm=pcb_thickness_mm,
    )

    return PCBAnalysisResponse(
        board_name=primary_name,
        width_mm=analysis["width_mm"],
        length_mm=analysis["length_mm"],
        thickness_mm=analysis["thickness_mm"],
        area_cm2=analysis["area_cm2"],
        layer_count=analysis["layer_count"],
        hole_count=analysis["hole_count"],
        top_pad_count=analysis["top_pad_count"],
        bottom_pad_count=analysis["bottom_pad_count"],
        rate_per_cm2_lkr=analysis["rate_per_cm2_lkr"],
        calculated_price_lkr=analysis["calculated_price_lkr"],
        formula_applied=analysis["formula_applied"],
        identified_layers=analysis["identified_layers"],
        drills=[DrillHole(**d) for d in analysis["drills"]],
        top_pads=[CopperPad(**p) for p in analysis["top_pads"]],
        bottom_pads=[CopperPad(**p) for p in analysis["bottom_pads"]],
        top_layer_image_base64=analysis.get("top_layer_image_base64"),
        bottom_layer_image_base64=analysis.get("bottom_layer_image_base64"),
        outline_layer_image_base64=analysis.get("outline_layer_image_base64"),
        drill_layer_image_base64=analysis.get("drill_layer_image_base64"),
        drill_drawing_layer_image_base64=analysis.get("drill_drawing_layer_image_base64"),
        slot_count=analysis.get("slot_count", 0),
    )


@router.post("/sample-board", response_model=PCBAnalysisResponse)
async def generate_and_analyze_sample_board(
    rate_per_cm2_lkr: Decimal = Decimal("15.00"),
    pcb_thickness_mm: float = 1.6,
):
    """
    1-Click Benchmark Test: Generates a standard 50x50mm 2-layer PCB package
    with drill hits, SMD pads, and traces, and runs full analysis.
    """
    sample_zip = GerberEngine.generate_sample_pcb_package()
    extracted = GerberEngine.identify_and_extract_files(sample_zip, "Benchmark_PCB.zip")
    analysis = GerberEngine.analyze_pcb_package(
        files=extracted,
        rate_per_cm2_lkr=rate_per_cm2_lkr,
        pcb_thickness_mm=pcb_thickness_mm,
    )

    return PCBAnalysisResponse(
        board_name="Benchmark_50x50mm_2Layer",
        width_mm=analysis["width_mm"],
        length_mm=analysis["length_mm"],
        thickness_mm=analysis["thickness_mm"],
        area_cm2=analysis["area_cm2"],
        layer_count=analysis["layer_count"],
        hole_count=analysis["hole_count"],
        top_pad_count=analysis["top_pad_count"],
        bottom_pad_count=analysis["bottom_pad_count"],
        rate_per_cm2_lkr=analysis["rate_per_cm2_lkr"],
        calculated_price_lkr=analysis["calculated_price_lkr"],
        formula_applied=analysis["formula_applied"],
        identified_layers=analysis["identified_layers"],
        drills=[DrillHole(**d) for d in analysis["drills"]],
        top_pads=[CopperPad(**p) for p in analysis["top_pads"]],
        bottom_pads=[CopperPad(**p) for p in analysis["bottom_pads"]],
        top_layer_image_base64=analysis.get("top_layer_image_base64"),
        bottom_layer_image_base64=analysis.get("bottom_layer_image_base64"),
        outline_layer_image_base64=analysis.get("outline_layer_image_base64"),
        drill_layer_image_base64=analysis.get("drill_layer_image_base64"),
        drill_drawing_layer_image_base64=analysis.get("drill_drawing_layer_image_base64"),
        slot_count=analysis.get("slot_count", 0),
    )


@router.post("/generate-stl")
async def generate_pcb_stl_model(payload: GeneratePCBSTLRequest):
    """
    Generates a 3D binary STL mesh for the PCB substrate and elevated pads.
    """
    stl_bytes = GerberEngine.generate_pcb_stl(
        width_mm=payload.width_mm,
        length_mm=payload.length_mm,
        thickness_mm=payload.thickness_mm,
        drills=payload.drills,
        pads=payload.pads,
    )

    return Response(
        content=stl_bytes,
        media_type="model/stl",
        headers={
            "Content-Disposition": 'attachment; filename="pcb_board.stl"',
            "Content-Length": str(len(stl_bytes)),
        },
    )


@router.post("/quotation", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation_from_pcb(
    payload: PCBQuotationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Generates a formal VisionCraft quotation for custom PCB Fabrication."""
    quote_number = await get_next_quotation_number(db)
    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=14)

    total_price = (payload.unit_price_lkr * Decimal(str(payload.quantity))).quantize(Decimal("0.01"))

    quotation = Quotation(
        id=str(uuid.uuid4()),
        quotation_number=quote_number,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        status=QuotationStatus.DRAFT.value,
        subtotal_lkr=total_price,
        discount_lkr=Decimal("0.00"),
        total_amount_lkr=total_price,
        valid_until=valid_until,
        notes=payload.notes,
        created_by_partner=payload.created_by_partner or current_user.full_name,
        created_at=now,
    )
    db.add(quotation)
    await db.flush()

    item = QuotationItem(
        id=str(uuid.uuid4()),
        quotation_id=quotation.id,
        slicing_job_id=None,
        title=f"PCB Fabrication: {payload.board_name}",
        description=(
            f"Size: {payload.width_mm}×{payload.length_mm} mm ({payload.area_cm2} cm²), "
            f"Layers: {payload.layer_count}, Mask: {payload.solder_mask_color}, FR-4 {payload.thickness_mm}mm"
        ),
        material=f"FR-4 {payload.layer_count}-Layer ({payload.solder_mask_color})",
        layer_height_mm=Decimal(str(payload.thickness_mm)),
        filament_grams=Decimal(str(payload.area_cm2)),
        estimated_hours=Decimal("24.00"),
        quantity=payload.quantity,
        unit_price_lkr=payload.unit_price_lkr,
        total_price_lkr=total_price,
    )
    db.add(item)
    await db.commit()
    await db.refresh(quotation)

    return quotation


@router.post("/order", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order_from_pcb(
    payload: PCBOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Queues a PCB fabrication order into the active production queue."""
    order_number = await get_next_order_number(db)
    now = datetime.now(timezone.utc)

    total_price = (payload.unit_price_lkr * Decimal(str(payload.quantity))).quantize(Decimal("0.01"))

    order = Order(
        id=str(uuid.uuid4()),
        order_number=order_number,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        status=OrderStatus.QUEUED.value,
        payment_status=PaymentStatus.UNPAID.value,
        paid_amount_lkr=Decimal("0.00"),
        payment_method=None,
        paid_at=None,
        total_amount_lkr=total_price,
        notes=payload.notes,
        assigned_partner=payload.assigned_partner or current_user.full_name,
        created_at=now,
    )
    db.add(order)
    await db.flush()

    item = OrderItem(
        id=str(uuid.uuid4()),
        order_id=order.id,
        slicing_job_id=None,
        title=f"PCB Fabrication: {payload.board_name}",
        description=(
            f"Size: {payload.width_mm}×{payload.length_mm} mm ({payload.area_cm2} cm²), "
            f"Layers: {payload.layer_count}, Mask: {payload.solder_mask_color}, FR-4 {payload.thickness_mm}mm"
        ),
        material=f"FR-4 {payload.layer_count}-Layer ({payload.solder_mask_color})",
        layer_height_mm=Decimal(str(payload.thickness_mm)),
        filament_grams=Decimal(str(payload.area_cm2)),
        estimated_hours=Decimal("24.00"),
        quantity=payload.quantity,
        unit_price_lkr=payload.unit_price_lkr,
        total_price_lkr=total_price,
    )
    db.add(item)
    await db.commit()
    await db.refresh(order)

    return order
