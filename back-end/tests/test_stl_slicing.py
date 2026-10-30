"""Tests for STL Parsing, Slicing Engine, and 28 LKR/g Price Estimation."""
import struct
import pytest
from decimal import Decimal
from httpx import AsyncClient
from app.modules.printing_3d.stl_engine import STLEngine
from app.modules.printing_3d.pricing_engine import calculate_fdm_price


def create_test_cube_bytes(size: float = 20.0) -> bytes:
    triangles = [
        ((0,0,0), (size,0,0), (size,size,0)),
        ((0,0,0), (size,size,0), (0,size,0)),
        ((0,0,size), (size,size,size), (size,0,size)),
        ((0,0,size), (0,size,size), (size,size,size)),
        ((0,0,0), (size,0,size), (size,0,0)),
        ((0,0,0), (0,0,size), (size,0,size)),
        ((0,size,0), (size,size,0), (size,size,size)),
        ((0,size,0), (size,size,size), (0,size,size)),
        ((0,0,0), (0,size,0), (0,size,size)),
        ((0,0,0), (0,size,size), (0,0,size)),
        ((size,0,0), (size,size,size), (size,size,0)),
        ((size,0,0), (size,0,size), (size,size,size)),
    ]
    raw = bytearray(b"\x00" * 80)
    raw.extend(struct.pack("<I", len(triangles)))
    for v1, v2, v3 in triangles:
        raw.extend(struct.pack("<3f", 0.0, 0.0, 0.0))
        raw.extend(struct.pack("<3f", *v1))
        raw.extend(struct.pack("<3f", *v2))
        raw.extend(struct.pack("<3f", *v3))
        raw.extend(struct.pack("<H", 0))
    return bytes(raw)


def test_stl_parser_exact_geometry():
    cube_bytes = create_test_cube_bytes(size=20.0)
    meta = STLEngine.parse_stl(cube_bytes)

    assert meta["triangle_count"] == 12
    assert meta["dim_x_mm"] == 20.0
    assert meta["dim_y_mm"] == 20.0
    assert meta["dim_z_mm"] == 20.0
    # 20mm x 20mm x 20mm = 8000 mm^3 = 8.00 cm^3
    assert meta["volume_cm3"] == 8.0


def test_stl_slicing_telemetry_and_hardcoded_pricing():
    cube_bytes = create_test_cube_bytes(size=20.0)
    meta = STLEngine.parse_stl(cube_bytes)

    telemetry = STLEngine.slice_model(
        mesh_meta=meta,
        layer_height_mm=0.20,
        infill_percentage=20,
        material="PLA",
        support_enabled=False,
    )

    assert telemetry["layer_count"] == 100  # 20mm / 0.2mm = 100 layers
    assert telemetry["filament_grams"] > Decimal("1.0")

    # Pricing with hardcoded 28 LKR / 1g
    pricing = calculate_fdm_price(
        filament_grams=telemetry["filament_grams"],
        duration_seconds=telemetry["estimated_duration_seconds"],
        rate_per_gram=Decimal("28.00"),
    )

    expected_price = (telemetry["filament_grams"] * Decimal("28.00")).quantize(Decimal("0.01"))
    assert Decimal(str(pricing["calculated_price_lkr"])) == expected_price
    assert "× 28.00 LKR/g" in pricing["formula_applied"]


@pytest.mark.asyncio
async def test_api_stl_slicing_and_pricing(async_client: AsyncClient):
    login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@visioncraft.lk", "password": "Password123!"},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test sample cube endpoint
    res = await async_client.post(
        "/api/v1/3d-printing/sample-cube?size_mm=20.0&infill_percentage=20&material=PLA&rate_per_gram=28.0",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["filename"] == "Calibration_Cube_20mm.stl"
    assert data["dimensions_mm"]["x"] == 20.0
    assert data["dimensions_mm"]["y"] == 20.0
    assert data["dimensions_mm"]["z"] == 20.0
    assert data["layer_count"] == 100
    assert Decimal(str(data["rate_per_gram_lkr"])) == Decimal("28.00")
    assert Decimal(str(data["calculated_price_lkr"])) == Decimal(str(data["filament_used_grams"])) * Decimal("28.00")
    assert data["gcode_download_url"] is not None
