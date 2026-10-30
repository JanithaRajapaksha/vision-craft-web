"""Commercial Module Pydantic Schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class CreateQuoteFromSliceRequest(BaseModel):
    slicing_job_id: str
    customer_name: str = Field(..., min_length=2, max_length=200)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    quantity: int = Field(default=1, ge=1, le=1000)
    custom_title: Optional[str] = None
    notes: Optional[str] = None
    created_by_partner: str = "Janitha"


class CreateOrderFromSliceRequest(BaseModel):
    slicing_job_id: str
    customer_name: str = Field(..., min_length=2, max_length=200)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    quantity: int = Field(default=1, ge=1, le=1000)
    custom_title: Optional[str] = None
    notes: Optional[str] = None
    assigned_partner: str = "Janitha"
    payment_status: str = "UNPAID"
    payment_method: Optional[str] = None


class RecordPaymentRequest(BaseModel):
    payment_status: str = Field(default="PAID", description="UNPAID, PARTIALLY_PAID, PAID")
    paid_amount_lkr: Optional[Decimal] = None
    payment_method: str = "Commercial Bank Transfer"
    payment_collected_by: Optional[str] = "Janitha"


class UpdateOrderStatusRequest(BaseModel):
    status: str = Field(..., description="QUEUED, IN_PROGRESS, COMPLETED, DELIVERED, CANCELLED")


class QuotationItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quotation_id: str
    slicing_job_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    material: str
    layer_height_mm: Decimal
    filament_grams: Decimal
    estimated_hours: Decimal
    quantity: int
    unit_price_lkr: Decimal
    total_price_lkr: Decimal


class QuotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quotation_number: str
    client_id: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    status: str
    subtotal_lkr: Decimal
    discount_lkr: Decimal
    total_amount_lkr: Decimal
    valid_until: datetime
    notes: Optional[str] = None
    created_by_partner: str
    created_at: datetime
    items: List[QuotationItemResponse] = []


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    slicing_job_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    material: str
    layer_height_mm: Decimal
    filament_grams: Decimal
    estimated_hours: Decimal
    quantity: int
    unit_price_lkr: Decimal
    total_price_lkr: Decimal


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    quotation_id: Optional[str] = None
    client_id: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    status: str
    payment_status: str = "UNPAID"
    paid_amount_lkr: Decimal = Decimal("0.00")
    payment_method: Optional[str] = None
    payment_collected_by: Optional[str] = None
    paid_at: Optional[datetime] = None
    total_amount_lkr: Decimal
    notes: Optional[str] = None
    assigned_partner: str
    created_at: datetime
    items: List[OrderItemResponse] = []

