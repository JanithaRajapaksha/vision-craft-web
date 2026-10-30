"""Commercial Module: Quotations, Orders, and Client Management."""
import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, DateTime, Numeric, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class QuotationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class OrderStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    quotations: Mapped[List["Quotation"]] = relationship("Quotation", back_populates="client")
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="client")


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    quotation_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    client_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    status: Mapped[str] = mapped_column(String(30), default=QuotationStatus.DRAFT.value, nullable=False)
    subtotal_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    discount_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_amount_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_partner: Mapped[str] = mapped_column(String(100), default="Janitha", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    client: Mapped[Optional["Client"]] = relationship("Client", back_populates="quotations")
    items: Mapped[List["QuotationItem"]] = relationship(
        "QuotationItem", back_populates="quotation", cascade="all, delete-orphan", lazy="selectin"
    )
    order: Mapped[Optional["Order"]] = relationship("Order", back_populates="quotation", uselist=False)


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    quotation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slicing_job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("slicing_jobs.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 3D specs
    material: Mapped[str] = mapped_column(String(50), default="PLA+", nullable=False)
    layer_height_mm: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("0.20"), nullable=False)
    filament_grams: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    estimated_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0.00"), nullable=False)
    
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_price_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="items")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    order_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    quotation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True
    )
    client_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    status: Mapped[str] = mapped_column(String(30), default=OrderStatus.QUEUED.value, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(30), default=PaymentStatus.UNPAID.value, nullable=False)
    paid_amount_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_collected_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_amount_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_partner: Mapped[str] = mapped_column(String(100), default="Janitha", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    client: Mapped[Optional["Client"]] = relationship("Client", back_populates="orders")
    quotation: Mapped[Optional["Quotation"]] = relationship("Quotation", back_populates="order")
    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slicing_job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("slicing_jobs.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    material: Mapped[str] = mapped_column(String(50), default="PLA+", nullable=False)
    layer_height_mm: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("0.20"), nullable=False)
    filament_grams: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    estimated_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0.00"), nullable=False)
    
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_price_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")

