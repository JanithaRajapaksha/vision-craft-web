"""Four-Founder / Partner Financial Models."""
import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, Text, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ExpenseClaimStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REIMBURSED = "REIMBURSED"
    CONVERTED_TO_EQUITY = "CONVERTED_TO_EQUITY"
    REJECTED = "REJECTED"


class DistributionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_SIGNATURES = "PENDING_SIGNATURES"
    APPROVED = "APPROVED"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"


class Founder(Base):
    __tablename__ = "founders"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)  # Janitha, Lalitha, etc.
    ownership_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("25.00"), nullable=False
    )
    profit_share_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("25.00"), nullable=False
    )
    capital_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    drawings_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    payable_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="founder_profile")
    personal_expenses: Mapped[list["FounderPersonalExpense"]] = relationship(
        "FounderPersonalExpense", back_populates="founder"
    )
    profit_shares: Mapped[list["FounderProfitShare"]] = relationship(
        "FounderProfitShare", back_populates="founder"
    )


class FounderPersonalExpense(Base):
    __tablename__ = "founder_personal_expenses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    expense_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    founder_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("founders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    vendor: Mapped[str] = mapped_column(String(200), nullable=False)
    category_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    receipt_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default=ExpenseClaimStatus.SUBMITTED.value, nullable=False, index=True
    )
    approved_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    journal_entry_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    founder: Mapped["Founder"] = relationship("Founder", back_populates="personal_expenses")


class ProfitDistributionRun(Base):
    __tablename__ = "profit_distribution_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    run_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    net_operating_profit: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    working_capital_reserve_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("20.00"), nullable=False
    )
    working_capital_reserve_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"), nullable=False
    )
    tax_reserve_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("15.00"), nullable=False
    )
    tax_reserve_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"), nullable=False
    )
    distributable_profit_pool: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default=DistributionStatus.DRAFT.value, nullable=False, index=True
    )
    required_signatures: Mapped[int] = mapped_column(default=4, nullable=False)
    signatures_collected: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    journal_entry_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    shares: Mapped[list["FounderProfitShare"]] = relationship(
        "FounderProfitShare", back_populates="distribution_run", cascade="all, delete-orphan"
    )


class FounderProfitShare(Base):
    __tablename__ = "founder_profit_shares"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    profit_distribution_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profit_distribution_runs.id", ondelete="CASCADE"), nullable=False
    )
    founder_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("founders.id", ondelete="RESTRICT"), nullable=False
    )
    profit_share_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    share_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    distribution_run: Mapped["ProfitDistributionRun"] = relationship(
        "ProfitDistributionRun", back_populates="shares"
    )
    founder: Mapped["Founder"] = relationship("Founder", back_populates="profit_shares")

