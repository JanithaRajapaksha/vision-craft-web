"""Tests for PCB Gerber Analysis, STL Generation, and Commercial Order Integration."""
import pytest
from httpx import AsyncClient
from decimal import Decimal
from app.modules.pcb.gerber_engine import GerberEngine


@pytest.mark.asyncio
async def test_gerber_engine_sample_and_analysis():
    # 1. Generate standard 50x50mm benchmark package
    sample_zip = GerberEngine.generate_sample_pcb_package()
    assert len(sample_zip) > 100

    # 2. Extract and classify layers
    extracted = GerberEngine.identify_and_extract_files(sample_zip, "Benchmark_PCB.zip")
    assert "outline" in extracted
    assert "drill" in extracted
    assert "top_copper" in extracted
    assert "bottom_copper" in extracted

    # 3. Analyze package
    analysis = GerberEngine.analyze_pcb_package(
        files=extracted,
        rate_per_cm2_lkr=Decimal("15.00"),
        pcb_thickness_mm=1.6,
    )
    assert analysis["width_mm"] == 50.0
    assert analysis["length_mm"] == 50.0
    assert analysis["area_cm2"] == 25.0
    assert analysis["layer_count"] == 2
    assert analysis["hole_count"] >= 20
    assert analysis["top_pad_count"] >= 10
    # 25 cm² * 15 LKR * 1.25 (2-layer) = 468.75 -> base minimum 500.00 LKR
    assert analysis["calculated_price_lkr"] == Decimal("500.00")

    # 4. Generate 3D binary STL
    stl_bytes = GerberEngine.generate_pcb_stl(
        width_mm=analysis["width_mm"],
        length_mm=analysis["length_mm"],
        thickness_mm=1.6,
        pads=analysis["top_pads"],
    )
    assert len(stl_bytes) >= 84  # 80-byte header + 4-byte triangle count


@pytest.mark.asyncio
async def test_pcb_sample_board_api(async_client: AsyncClient):
    res = await async_client.post(
        "/api/v1/pcb/sample-board",
        params={"rate_per_cm2_lkr": "20.00", "pcb_thickness_mm": 1.6},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["board_name"] == "Benchmark_50x50mm_2Layer"
    assert data["width_mm"] == 50.0
    assert data["length_mm"] == 50.0
    assert data["area_cm2"] == 25.0
    assert data["layer_count"] == 2
    # 25 cm² * 20 LKR * 1.25 = 625.00 LKR
    assert Decimal(str(data["calculated_price_lkr"])) == Decimal("625.00")
    assert len(data["drills"]) > 0
    assert len(data["top_pads"]) > 0


@pytest.mark.asyncio
async def test_pcb_upload_and_analyze_api(async_client: AsyncClient):
    sample_zip = GerberEngine.generate_sample_pcb_package()
    files = [("files", ("benchmark.zip", sample_zip, "application/zip"))]
    data = {"rate_per_cm2_lkr": "15.00", "pcb_thickness_mm": "1.6"}

    res = await async_client.post("/api/v1/pcb/upload-and-analyze", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["width_mm"] == 50.0
    assert body["length_mm"] == 50.0
    assert "outline" in body["identified_layers"]
    assert "drill" in body["identified_layers"]


@pytest.mark.asyncio
async def test_pcb_generate_stl_api(async_client: AsyncClient):
    req_body = {
        "width_mm": 60.0,
        "length_mm": 40.0,
        "thickness_mm": 1.6,
        "drills": [],
        "pads": [{"x": 10.0, "y": 10.0, "shape": "C", "size_x": 1.5, "size_y": 1.5}],
    }
    res = await async_client.post("/api/v1/pcb/generate-stl", json=req_body)
    assert res.status_code == 200
    assert res.headers["content-type"] == "model/stl"
    assert len(res.content) > 100


@pytest.mark.asyncio
async def test_pcb_quotation_and_order_flow(async_client: AsyncClient):
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@visioncraft.lk", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create PCB Quotation
    quote_payload = {
        "board_name": "Sensor_Module_V3",
        "customer_name": "Perera Electronics",
        "customer_phone": "+94 77 123 4567",
        "customer_email": "perera@example.com",
        "width_mm": 50.0,
        "length_mm": 50.0,
        "area_cm2": 25.0,
        "layer_count": 2,
        "thickness_mm": 1.6,
        "solder_mask_color": "Green",
        "quantity": 5,
        "rate_per_cm2_lkr": "15.00",
        "unit_price_lkr": "500.00",
        "notes": "Urgent prototype fabrication",
        "created_by_partner": "Janitha",
    }
    q_res = await async_client.post("/api/v1/pcb/quotation", json=quote_payload, headers=headers)
    assert q_res.status_code == 201
    q_data = q_res.json()
    assert q_data["quotation_number"].startswith("QT-")
    assert Decimal(str(q_data["total_amount_lkr"])) == Decimal("2500.00")
    assert "PCB Fabrication: Sensor_Module_V3" in q_data["items"][0]["title"]

    # 2. Create PCB Order
    order_payload = {
        "board_name": "Sensor_Module_V3",
        "customer_name": "Perera Electronics",
        "customer_phone": "+94 77 123 4567",
        "customer_email": "perera@example.com",
        "width_mm": 50.0,
        "length_mm": 50.0,
        "area_cm2": 25.0,
        "layer_count": 2,
        "thickness_mm": 1.6,
        "solder_mask_color": "Green",
        "quantity": 5,
        "unit_price_lkr": "500.00",
        "assigned_partner": "Melanka",
        "notes": "PCB batch order for testing",
    }
    ord_res = await async_client.post("/api/v1/pcb/order", json=order_payload, headers=headers)
    assert ord_res.status_code == 201
    ord_data = ord_res.json()
    order_id = ord_data["id"]
    assert ord_data["order_number"].startswith("ORD-")
    assert ord_data["status"] == "QUEUED"
    assert ord_data["payment_status"] == "UNPAID"
    assert Decimal(str(ord_data["total_amount_lkr"])) == Decimal("2500.00")

    # 3. Verify order exists in commercial orders list
    list_res = await async_client.get("/api/v1/commercial/orders", headers=headers)
    assert list_res.status_code == 200
    orders = list_res.json()
    matched = [o for o in orders if o["id"] == order_id]
    assert len(matched) == 1
    assert matched[0]["payment_status"] == "UNPAID"
    assert matched[0]["assigned_partner"] == "Melanka"

    # 4. Record payment collected by Lalitha
    pay_res = await async_client.patch(
        f"/api/v1/commercial/orders/{order_id}/payment",
        json={
            "payment_status": "PAID",
            "paid_amount_lkr": "2500.00",
            "payment_method": "Commercial Bank Transfer",
            "payment_collected_by": "Lalitha",
        },
        headers=headers,
    )
    assert pay_res.status_code == 200
    updated_order = pay_res.json()
    assert updated_order["payment_status"] == "PAID"
    assert updated_order["payment_collected_by"] == "Lalitha"

    # 5. Production step: QUEUED -> COMPLETED (Done Printing / Done Fabrication)
    step_res = await async_client.patch(
        f"/api/v1/commercial/orders/{order_id}/status",
        json={"status": "COMPLETED"},
        headers=headers,
    )
    assert step_res.status_code == 200
    assert step_res.json()["status"] == "COMPLETED"
