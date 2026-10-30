"""3D Printing Domain Models."""
import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class SlicerEngineType(str, enum.Enum):
    PRUSA_SLICER = "PRUSA_SLICER"
    ORCA_SLICER = "ORCA_SLICER"
    VISIONCRAFT_INTERNAL = "VISIONCRAFT_INTERNAL"


class CadModel(Base):
    __tablename__ = "cad_models"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_format: Mapped[str] = mapped_column(String(20), default="STL", nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    
    # 3D Dimensions & Geometry
    bounding_box_x_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    bounding_box_y_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    bounding_box_z_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    mesh_volume_cm3: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    triangle_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    slicing_jobs: Mapped[list["SlicingJob"]] = relationship(
        "SlicingJob", back_populates="cad_model", cascade="all, delete-orphan"
    )


class SlicingJob(Base):
    __tablename__ = "slicing_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    cad_model_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cad_models.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slicer_engine: Mapped[str] = mapped_column(
        String(50), default=SlicerEngineType.VISIONCRAFT_INTERNAL.value, nullable=False
    )
    
    # Slicing Parameters
    layer_height_mm: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("0.20"), nullable=False)
    infill_percentage: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    material_type: Mapped[str] = mapped_column(String(50), default="PLA", nullable=False)
    support_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Telemetry Output
    filament_used_grams: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    filament_used_length_mm: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    estimated_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    layer_count: Mapped[int] = mapped_column(Integer, nullable=False)
    gcode_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Pricing
    rate_per_gram_lkr: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("28.00"), nullable=False)
    calculated_price_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    pricing_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(String(50), default="COMPLETED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    cad_model: Mapped["CadModel"] = relationship("CadModel", back_populates="slicing_jobs")
