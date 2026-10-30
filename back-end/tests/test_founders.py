"""Four-Founder / Partner Management & Expense Claims Tests."""
import pytest
from decimal import Decimal
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_list_all_four_founders_with_zero_balances(async_client: AsyncClient):
    # Log in as Janitha
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "janitha@workshop-os.local", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await async_client.get("/api/v1/founders", headers=headers)
    assert response.status_code == 200
    founders = response.json()

    assert len(founders) == 4
    founder_names = [f["display_name"] for f in founders]
    assert "Janitha" in founder_names
    assert "Lalitha" in founder_names
    assert "Thakshila" in founder_names
    assert "Melanka" in founder_names

    # Check that initial starting balances are all strictly 0.00 LKR
    for f in founders:
        assert Decimal(str(f["capital_balance"])) == Decimal("0.00")
        assert Decimal(str(f["drawings_balance"])) == Decimal("0.00")
        assert Decimal(str(f["amount_due_reimbursement"])) == Decimal("0.00")
        assert Decimal(str(f["ownership_percentage"])) == Decimal("25.00")
        assert Decimal(str(f["profit_share_percentage"])) == Decimal("25.00")


@pytest.mark.asyncio
async def test_founder_personal_expense_and_reimbursement_lifecycle(async_client: AsyncClient):
    # Log in as Thakshila
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "thakshila@workshop-os.local", "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch Chart of Accounts to find category (5010 Filaments) and bank (1011 Commercial Bank)
    coa_resp = await async_client.get("/api/v1/accounting/accounts", headers=headers)
    accounts = coa_resp.json()
    acc_map = {a["code"]: a["id"] for a in accounts}

    filament_acc_id = acc_map["5010"]
    bank_acc_id = acc_map["1011"]

    # 2. Thakshila submits out-of-pocket claim for 3 rolls of PLA: LKR 12,000
    claim_resp = await async_client.post(
        "/api/v1/founders/expenses",
        headers=headers,
        json={
            "vendor": "3D Print Supplies LK",
            "category_account_id": filament_acc_id,
            "amount": 12000.00,
            "description": "3 Spools of Black PLA Filament for urgent customer project",
        },
    )
    assert claim_resp.status_code == 201
    claim = claim_resp.json()
    assert claim["founder_name"] == "Thakshila"
    assert claim["status"] == "SUBMITTED"
    claim_id = claim["id"]

    # 3. Approve claim -> Posts journal entry (DR Filaments 5010, CR Due to Thakshila 2053)
    approve_resp = await async_client.post(
        f"/api/v1/founders/expenses/{claim_id}/approve",
        headers=headers,
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    # Verify Thakshila's due reimbursement balance is now LKR 12,000.00
    founders_resp = await async_client.get("/api/v1/founders", headers=headers)
    thakshila = next(f for f in founders_resp.json() if f["display_name"] == "Thakshila")
    assert Decimal(str(thakshila["amount_due_reimbursement"])) == Decimal("12000.00")

    # 4. Company reimburses Thakshila via Commercial Bank transfer
    reimb_resp = await async_client.post(
        f"/api/v1/founders/expenses/{claim_id}/reimburse",
        headers=headers,
        json={
            "payment_account_id": bank_acc_id,
            "reference_number": "TXN-BANK-998822",
        },
    )
    assert reimb_resp.status_code == 200
    assert reimb_resp.json()["status"] == "REIMBURSED"

    # Verify Thakshila's due reimbursement balance has cleanly returned to 0.00 LKR!
    founders_resp2 = await async_client.get("/api/v1/founders", headers=headers)
    thakshila2 = next(f for f in founders_resp2.json() if f["display_name"] == "Thakshila")
    assert Decimal(str(thakshila2["amount_due_reimbursement"])) == Decimal("0.00")
