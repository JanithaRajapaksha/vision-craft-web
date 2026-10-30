"""Tests for Commercial Module: Quotations and Orders from Sliced Models."""
import struct
from decimal import Decimal
import pytest
from httpx import AsyncClient


def create_cube_bytes(size: float = 20.0) -> bytes:
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


@pytest.mark.asyncio
async def test_create_quotation_and_order_from_sliced_stl(async_client: AsyncClient):
    # 1. Login
    login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@visioncraft.lk", "password": "Password123!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Slice a model
    cube = create_cube_bytes(20.0)
    upload_res = await async_client.post(
        "/api/v1/3d-printing/upload-and-slice",
        files={"file": ("bracket_v1.stl", cube, "application/octet-stream")},
        data={"layer_height": "0.20", "infill_percentage": "20", "material": "PLA+", "rate_per_gram": "25.0"},
        headers=headers,
    )
    assert upload_res.status_code == 200
    sliced = upload_res.json()
    job_id = sliced["job_id"]
    unit_price = Decimal(str(sliced["calculated_price_lkr"]))

    # 3. Create Quotation from Slicing Job with Quantity 3
    quote_payload = {
        "slicing_job_id": job_id,
        "customer_name": "Kasun Perera",
        "customer_phone": "+94 77 123 4567",
        "customer_email": "kasun@robotics.lk",
        "quantity": 3,
        "notes": "Urgent prototype bracket, black PLA+.",
        "created_by_partner": "Janitha",
    }
    quote_res = await async_client.post(
        "/api/v1/commercial/quotations/from-slice",
        json=quote_payload,
        headers=headers,
    )
    assert quote_res.status_code == 201, f"Failed: {quote_res.text}"
    quote = quote_res.json()
    assert quote["quotation_number"].startswith("QT-")
    assert quote["customer_name"] == "Kasun Perera"
    assert Decimal(str(quote["total_amount_lkr"])) == unit_price * 3
    assert len(quote["items"]) == 1
    assert quote["items"][0]["quantity"] == 3
    assert Decimal(str(quote["items"][0]["unit_price_lkr"])) == unit_price
    assert quote["status"] == "DRAFT"

    # 4. List Quotations
    quotes_list = await async_client.get("/api/v1/commercial/quotations", headers=headers)
    assert quotes_list.status_code == 200
    assert len(quotes_list.json()) >= 1

    # 5. Create Order directly from Slicing Job with Quantity 2
    order_payload = {
        "slicing_job_id": job_id,
        "customer_name": "Kasun Perera",
        "customer_phone": "+94 77 123 4567",
        "quantity": 2,
        "notes": "Immediate production run",
        "assigned_partner": "Janitha",
    }
    order_res = await async_client.post(
        "/api/v1/commercial/orders/from-slice",
        json=order_payload,
        headers=headers,
    )
    assert order_res.status_code == 201, f"Failed: {order_res.text}"
    order = order_res.json()
    assert order["order_number"].startswith("ORD-")
    assert order["status"] == "QUEUED"
    assert Decimal(str(order["total_amount_lkr"])) == unit_price * 2
    assert len(order["items"]) == 1
    assert order["items"][0]["quantity"] == 2

    # 6. List Orders
    orders_list = await async_client.get("/api/v1/commercial/orders", headers=headers)
    assert orders_list.status_code == 200
    assert len(orders_list.json()) >= 1

