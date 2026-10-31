"""System Resource & Per-Module Telemetry Router."""
from typing import List, Dict, Any
from fastapi import APIRouter, status
from app.modules.system.tracker import tracker
from app.modules.system.schemas import SystemResourcesResponse, ModuleResourceMetrics

router = APIRouter(prefix="/system", tags=["System & Resource Monitoring"])


@router.get("/resources", response_model=SystemResourcesResponse)
async def get_system_and_module_resources():
    """
    Measure and return real-time system resources and computational consumption
    broken down per module (3D Printing, PCB Engineering, Commercial Orders,
    Double-Entry Ledger, Founders Hub, Auth, and System Telemetry).
    """
    return await tracker.get_full_telemetry()


@router.get("/resources/modules", response_model=List[ModuleResourceMetrics])
async def get_module_resource_breakdown():
    """
    Returns only the per-module computational breakdown comparison table.
    """
    telemetry = await tracker.get_full_telemetry()
    return telemetry["modules"]


@router.post("/resources/reset", status_code=status.HTTP_200_OK)
async def reset_resource_counters():
    """
    Resets request and computation counters for benchmark testing.
    """
    tracker.reset_counters()
    return {"message": "Resource telemetry counters reset successfully."}

