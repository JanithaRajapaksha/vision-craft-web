"""Tests for System Resource Monitoring and Per-Module Consumption Telemetry."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_system_resources_endpoint(async_client: AsyncClient):
    """Verify system-level and process-level metrics are returned accurately."""
    res = await async_client.get("/api/v1/system/resources")
    assert res.status_code == 200
    data = res.json()

    # 1. Host Metrics
    assert "host" in data
    host = data["host"]
    assert host["cpu_cores"] >= 1
    assert "cpu_load_percent" in host
    assert host["ram_total_mb"] > 0
    assert "ram_used_percent" in host
    assert host["disk_total_gb"] > 0

    # 2. Process Metrics
    assert "process" in data
    proc = data["process"]
    assert proc["pid"] > 0
    assert proc["uptime_seconds"] >= 0
    assert proc["current_rss_mb"] > 0
    assert proc["peak_rss_mb"] > 0
    assert "total_cpu_time_seconds" in proc

    # 3. Database Metrics
    assert "database" in data
    db = data["database"]
    assert db["status"] == "HEALTHY"
    assert db["dialect"] in ["SQLite", "PostgreSQL"]

    # 4. Modules Breakdown
    assert "modules" in data
    module_ids = [m["id"] for m in data["modules"]]
    assert "3d_printing" in module_ids
    assert "pcb_engineering" in module_ids
    assert "commercial_orders" in module_ids
    assert "accounting_ledger" in module_ids
    assert "founders_hub" in module_ids
    assert "auth_security" in module_ids
    assert "system_telemetry" in module_ids


@pytest.mark.asyncio
async def test_module_resource_consumption_tracking(async_client: AsyncClient):
    """Verify that hitting different parts of the web tracks consumption per module."""
    # Reset counters first
    reset_res = await async_client.post("/api/v1/system/resources/reset")
    assert reset_res.status_code == 200

    # 1. Hit Health / System
    h_res = await async_client.get("/api/v1/health")
    assert h_res.status_code == 200
    assert "x-response-time-ms" in h_res.headers
    assert "x-cpu-time-ms" in h_res.headers

    # 2. Hit Auth
    auth_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@visioncraft.lk", "password": "Password123!"},
    )
    assert auth_res.status_code == 200

    # 3. Hit PCB Module (computational work)
    pcb_res = await async_client.post(
        "/api/v1/pcb/sample-board",
        params={"rate_per_cm2_lkr": "15.00", "pcb_thickness_mm": 1.6},
    )
    assert pcb_res.status_code == 200

    # 4. Inspect Telemetry Breakdown
    telemetry_res = await async_client.get("/api/v1/system/resources")
    assert telemetry_res.status_code == 200
    telemetry = telemetry_res.json()

    modules_by_id = {m["id"]: m for m in telemetry["modules"]}

    # Verify PCB module recorded execution
    pcb_stats = modules_by_id["pcb_engineering"]
    assert pcb_stats["request_count"] >= 1
    assert pcb_stats["total_wall_time_ms"] > 0
    assert pcb_stats["status_2xx"] >= 1

    # Verify Auth module recorded execution
    auth_stats = modules_by_id["auth_security"]
    assert auth_stats["request_count"] >= 1
    assert auth_stats["status_2xx"] >= 1

    # Verify System Telemetry recorded execution
    sys_stats = modules_by_id["system_telemetry"]
    assert sys_stats["request_count"] >= 1


@pytest.mark.asyncio
async def test_get_modules_only_endpoint(async_client: AsyncClient):
    """Verify the /api/v1/system/resources/modules sub-endpoint."""
    res = await async_client.get("/api/v1/system/resources/modules")
    assert res.status_code == 200
    modules = res.json()
    assert isinstance(modules, list)
    assert len(modules) >= 7
    first = modules[0]
    assert "id" in first
    assert "name" in first
    assert "avg_wall_time_ms" in first
    assert "total_cpu_time_ms" in first

