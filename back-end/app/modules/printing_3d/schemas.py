"""3D Printing Pydantic Schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict
from pydantic import BaseModel, ConfigDict


class DimensionsMM(BaseModel):
    x: float
    y: float
    z: float


class SliceEstimateResponse(BaseModel):
    job_id: str
    cad_model_id: str
    filename: str
    dimensions_mm: DimensionsMM
    volume_cm3: Decimal
    triangle_count: int
    layer_height_mm: Decimal
    infill_percentage: int
    material: str
    support_enabled: bool
    
    # Telemetry
    filament_used_grams: Decimal
    filament_used_length_mm: Decimal
    estimated_duration_seconds: int
    estimated_duration_formatted: str
    layer_count: int

    # Pricing (Hardcoded 28 LKR/g baseline)
    rate_per_gram_lkr: Decimal
    calculated_price_lkr: Decimal
    formula_applied: str

    gcode_download_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SlicingJobListItem(BaseModel):
    id: str
    filename: str
    material: str
    infill_percentage: int
    filament_grams: Decimal
    duration_formatted: str
    price_lkr: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

