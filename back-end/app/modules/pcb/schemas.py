"""PCB Module Pydantic Schemas."""
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DrillHole(BaseModel):
    x: float
    y: float
    diameter_mm: float


class CopperPad(BaseModel):
    x: float
    y: float
    shape: str
    size_x: float
    size_y: float


class PCBAnalysisResponse(BaseModel):
    board_name: str
    width_mm: float
    length_mm: float
    thickness_mm: float
    area_cm2: float
    layer_count: int
    hole_count: int
    top_pad_count: int
    bottom_pad_count: int
    rate_per_cm2_lkr: Decimal
    calculated_price_lkr: Decimal
    formula_applied: str
    identified_layers: Dict[str, str]
    drills: List[DrillHole] = Field(default_factory=list)
    top_pads: List[CopperPad] = Field(default_factory=list)
    bottom_pads: List[CopperPad] = Field(default_factory=list)


class PCBQuotationRequest(BaseModel):
    board_name: str = Field(..., max_length=200)
    customer_name: str = Field(..., min_length=2, max_length=150)
    customer_phone: Optional[str] = Field(None, max_length=50)
    customer_email: Optional[str] = Field(None, max_length=150)
    width_mm: float = Field(..., gt=0)
    length_mm: float = Field(..., gt=0)
    area_cm2: float = Field(..., gt=0)
    layer_count: int = Field(default=2, ge=1, le=4)
    thickness_mm: float = Field(default=1.6, gt=0)
    solder_mask_color: str = Field(default="Green", max_length=50)
    quantity: int = Field(default=1, ge=1, le=5000)
    rate_per_cm2_lkr: Decimal = Field(default=Decimal("15.00"), gt=0)
    unit_price_lkr: Decimal = Field(..., gt=0)
    notes: Optional[str] = None
    created_by_partner: Optional[str] = "Janitha"


class PCBOrderRequest(BaseModel):
    board_name: str = Field(..., max_length=200)
    customer_name: str = Field(..., min_length=2, max_length=150)
    customer_phone: Optional[str] = Field(None, max_length=50)
    customer_email: Optional[str] = Field(None, max_length=150)
    width_mm: float = Field(..., gt=0)
    length_mm: float = Field(..., gt=0)
    area_cm2: float = Field(..., gt=0)
    layer_count: int = Field(default=2, ge=1, le=4)
    thickness_mm: float = Field(default=1.6, gt=0)
    solder_mask_color: str = Field(default="Green", max_length=50)
    quantity: int = Field(default=1, ge=1, le=5000)
    unit_price_lkr: Decimal = Field(..., gt=0)
    assigned_partner: Optional[str] = "Janitha"
    notes: Optional[str] = None


class GeneratePCBSTLRequest(BaseModel):
    width_mm: float = Field(..., gt=0)
    length_mm: float = Field(..., gt=0)
    thickness_mm: float = Field(default=1.6, gt=0)
    drills: Optional[List[Dict[str, Any]]] = None
    pads: Optional[List[Dict[str, Any]]] = None

