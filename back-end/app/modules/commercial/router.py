"""Commercial Router: Quotations, Orders, and Slicing integration."""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.printing_3d.models import SlicingJob, CadModel
from app.modules.commercial.models import (
    Quotation,
    QuotationItem,
    QuotationStatus,
    Order,
    OrderItem,
    OrderStatus,
)
from app.modules.commercial.schemas import (
    CreateQuoteFromSliceRequest,
    CreateOrderFromSliceRequest,
    RecordPaymentRequest,
    UpdateOrderStatusRequest,
    QuotationResponse,
    OrderResponse,
)

router = APIRouter(prefix="/commercial", tags=["Commercial: Quotations & Orders"])


async def get_next_quotation_number(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"QT-{year}-"
    query = select(func.count(Quotation.id)).where(Quotation.quotation_number.like(f"{prefix}%"))
    result = await db.execute(query)
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"


async def get_next_order_number(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"ORD-{year}-"
    query = select(func.count(Order.id)).where(Order.order_number.like(f"{prefix}%"))
    result = await db.execute(query)
    count = result.scalar() or 0
    return f"{prefix}{count + 1:04d}"


@router.post("/quotations/from-slice", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation_from_slice(
    payload: CreateQuoteFromSliceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a formal VisionCraft quotation directly from an FDM Slicing Job."""
    job_query = select(SlicingJob).options(selectinload(SlicingJob.cad_model)).where(SlicingJob.id == payload.slicing_job_id)
    job_res = await db.execute(job_query)
    job = job_res.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slicing job '{payload.slicing_job_id}' not found.",
        )

    quote_number = await get_next_quotation_number(db)
    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=14)

    unit_price = Decimal(str(job.calculated_price_lkr))
    total_price = (unit_price * Decimal(str(payload.quantity))).quantize(Decimal("0.01"))
    hours = (Decimal(str(job.estimated_duration_seconds)) / Decimal("3600.0")).quantize(Decimal("0.01"))

    item_title = payload.custom_title or f"3D Print: {job.cad_model.original_filename}"

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
        slicing_job_id=job.id,
        title=item_title,
        description=f"Layer Height: {job.layer_height_mm}mm, Material: {job.material_type}, Infill: {job.infill_percentage}%",
        material=job.material_type,
        layer_height_mm=job.layer_height_mm,
        filament_grams=Decimal(str(job.filament_used_grams)),
        estimated_hours=hours,
        quantity=payload.quantity,
        unit_price_lkr=unit_price,
        total_price_lkr=total_price,
    )
    db.add(item)
    await db.commit()
    await db.refresh(quotation)

    return quotation


@router.post("/orders/from-slice", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order_from_slice(
    payload: CreateOrderFromSliceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Add a sliced model directly to an active production Order."""
    job_query = select(SlicingJob).options(selectinload(SlicingJob.cad_model)).where(SlicingJob.id == payload.slicing_job_id)
    job_res = await db.execute(job_query)
    job = job_res.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slicing job '{payload.slicing_job_id}' not found.",
        )

    order_number = await get_next_order_number(db)
    now = datetime.now(timezone.utc)

    unit_price = Decimal(str(job.calculated_price_lkr))
    total_price = (unit_price * Decimal(str(payload.quantity))).quantize(Decimal("0.01"))
    hours = (Decimal(str(job.estimated_duration_seconds)) / Decimal("3600.0")).quantize(Decimal("0.01"))

    item_title = payload.custom_title or f"3D Print: {job.cad_model.original_filename}"

    is_paid = payload.payment_status == "PAID"
    order = Order(
        id=str(uuid.uuid4()),
        order_number=order_number,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        status=OrderStatus.QUEUED.value,
        payment_status="PAID" if is_paid else "UNPAID",
        paid_amount_lkr=total_price if is_paid else Decimal("0.00"),
        payment_method=payload.payment_method or ("Commercial Bank Transfer" if is_paid else None),
        paid_at=now if is_paid else None,
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
        slicing_job_id=job.id,
        title=item_title,
        description=f"Layer Height: {job.layer_height_mm}mm, Material: {job.material_type}, Infill: {job.infill_percentage}%",
        material=job.material_type,
        layer_height_mm=job.layer_height_mm,
        filament_grams=Decimal(str(job.filament_used_grams)),
        estimated_hours=hours,
        quantity=payload.quantity,
        unit_price_lkr=unit_price,
        total_price_lkr=total_price,
    )
    db.add(item)
    await db.commit()
    await db.refresh(order)

    return order


@router.get("/quotations", response_model=List[QuotationResponse])
async def list_quotations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(25, ge=1, le=100),
):
    query = (
        select(Quotation)
        .options(selectinload(Quotation.items))
        .order_by(desc(Quotation.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
async def get_quotation_by_id(
    quotation_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    query = (
        select(Quotation)
        .options(selectinload(Quotation.items))
        .where(Quotation.id == quotation_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found.",
        )
    return quote


@router.get("/orders", response_model=List[OrderResponse])
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
):
    query = (
        select(Order)
        .options(selectinload(Order.items))
        .order_by(desc(Order.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    payload: UpdateOrderStatusRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Update order manufacturing status (QUEUED, IN_PROGRESS, COMPLETED, DELIVERED, CANCELLED)."""
    valid_statuses = [s.value for s in OrderStatus]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Allowed: {valid_statuses}",
        )

    query = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    res = await db.execute(query)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    order.status = payload.status
    await db.commit()
    await db.refresh(order)
    return order


@router.patch("/orders/{order_id}/payment", response_model=OrderResponse)
async def record_order_payment(
    order_id: str,
    payload: RecordPaymentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Update payment status (UNPAID, PARTIALLY_PAID, PAID) and record receipt method."""
    query = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    res = await db.execute(query)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    order.payment_status = payload.payment_status
    if payload.payment_status == "PAID":
        order.paid_amount_lkr = payload.paid_amount_lkr or order.total_amount_lkr
        order.payment_method = payload.payment_method or "Commercial Bank Transfer"
        order.payment_collected_by = payload.payment_collected_by or current_user.full_name
        order.paid_at = datetime.now(timezone.utc)
    elif payload.payment_status == "UNPAID":
        order.paid_amount_lkr = Decimal("0.00")
        order.payment_collected_by = None
        order.paid_at = None
    else:
        order.paid_amount_lkr = payload.paid_amount_lkr or Decimal("0.00")
        order.payment_method = payload.payment_method
        order.payment_collected_by = payload.payment_collected_by

    await db.commit()
    await db.refresh(order)
    return order



