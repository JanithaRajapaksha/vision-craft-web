"""Database seeding script: Initializes Standard Chart of Accounts (starting at 0.00 LKR) and the 4 Partners."""
import asyncio
from decimal import Decimal
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.core.logging import setup_logging, logger
from app.modules.auth.models import User, UserRole
from app.modules.accounting.models import Account, AccountClassification
from app.modules.founders.models import Founder
import app.modules.printing_3d.models

DEFAULT_PASSWORD = "Password123!"  # In production, forced to change on first login

STANDARD_COA = [
    # 1000 Assets
    ("1010", "Cash on Hand", AccountClassification.ASSET.value),
    ("1011", "Commercial Bank - Primary Operating Account", AccountClassification.ASSET.value),
    ("1012", "Commercial Bank - Tax & Reserve Escrow Account", AccountClassification.ASSET.value),
    ("1020", "Accounts Receivable", AccountClassification.ASSET.value),
    ("1050", "Inventory Asset - FDM 3D Filaments", AccountClassification.ASSET.value),
    ("1060", "Inventory Asset - Electronic Components & PCBs", AccountClassification.ASSET.value),
    ("1070", "Inventory Asset - Consumables & Spare Parts", AccountClassification.ASSET.value),
    ("1510", "Fixed Assets - FDM 3D Printers & Equipment", AccountClassification.ASSET.value),
    ("1519", "Accumulated Depreciation - FDM 3D Printers", AccountClassification.ASSET.value),
    ("1520", "Fixed Assets - Electronics Lab Instruments", AccountClassification.ASSET.value),
    ("1529", "Accumulated Depreciation - Lab Instruments", AccountClassification.ASSET.value),

    # 2000 Liabilities
    ("2010", "Accounts Payable (Suppliers & Vendors)", AccountClassification.LIABILITY.value),
    ("2020", "Sales Tax / VAT Payable", AccountClassification.LIABILITY.value),
    ("2030", "Customer Advance Deposits (Unearned Revenue)", AccountClassification.LIABILITY.value),
    ("2051", "Due to Janitha (Personal Out-of-Pocket Claims)", AccountClassification.LIABILITY.value),
    ("2052", "Due to Lalitha (Personal Out-of-Pocket Claims)", AccountClassification.LIABILITY.value),
    ("2053", "Due to Thakshila (Personal Out-of-Pocket Claims)", AccountClassification.LIABILITY.value),
    ("2054", "Due to Melanka (Personal Out-of-Pocket Claims)", AccountClassification.LIABILITY.value),
    ("2061", "Profit Payable - Janitha", AccountClassification.LIABILITY.value),
    ("2062", "Profit Payable - Lalitha", AccountClassification.LIABILITY.value),
    ("2063", "Profit Payable - Thakshila", AccountClassification.LIABILITY.value),
    ("2064", "Profit Payable - Melanka", AccountClassification.LIABILITY.value),

    # 3000 Equity
    ("3011", "Capital - Janitha", AccountClassification.EQUITY.value),
    ("3012", "Capital - Lalitha", AccountClassification.EQUITY.value),
    ("3013", "Capital - Thakshila", AccountClassification.EQUITY.value),
    ("3014", "Capital - Melanka", AccountClassification.EQUITY.value),
    ("3020", "Retained Earnings", AccountClassification.EQUITY.value),
    ("3021", "Drawings - Janitha", AccountClassification.EQUITY.value),
    ("3022", "Drawings - Lalitha", AccountClassification.EQUITY.value),
    ("3023", "Drawings - Thakshila", AccountClassification.EQUITY.value),
    ("3024", "Drawings - Melanka", AccountClassification.EQUITY.value),

    # 4000 Revenue
    ("4010", "FDM 3D Printing Manufacturing Services", AccountClassification.REVENUE.value),
    ("4020", "PCB Design & Prototyping Services", AccountClassification.REVENUE.value),
    ("4030", "Electronics Assembly & Fabrication", AccountClassification.REVENUE.value),
    ("4040", "Engineering Consultation & Custom Projects", AccountClassification.REVENUE.value),
    ("4090", "Miscellaneous Revenue", AccountClassification.REVENUE.value),

    # 5000 Direct Costs (COGS)
    ("5010", "COGS - FDM Filaments Consumed", AccountClassification.EXPENSE.value),
    ("5020", "COGS - Electronic Components Consumed", AccountClassification.EXPENSE.value),
    ("5030", "COGS - Subcontracted PCB Fabrication & Stencils", AccountClassification.EXPENSE.value),
    ("5040", "Direct Workshop Electricity Allocation", AccountClassification.EXPENSE.value),
    ("5050", "Machine Wear & Maintenance Allocation", AccountClassification.EXPENSE.value),

    # 6000 Operating Expenses (OPEX)
    ("6010", "Workshop Rent & Utilities", AccountClassification.EXPENSE.value),
    ("6020", "Tools, Consumables & Small Hardware", AccountClassification.EXPENSE.value),
    ("6030", "Software Licenses & Subscriptions", AccountClassification.EXPENSE.value),
    ("6040", "Office & Logistics Expenses", AccountClassification.EXPENSE.value),
    ("6050", "Equipment Depreciation Expense", AccountClassification.EXPENSE.value),
    ("6090", "Bank Fees & Charges", AccountClassification.EXPENSE.value),
]

PARTNERS = [
    {
        "name": "Janitha",
        "email": "janitha@visioncraft.lk",
        "capital_code": "3011",
        "drawings_code": "3021",
        "payable_code": "2051",
    },
    {
        "name": "Lalitha",
        "email": "lalitha@visioncraft.lk",
        "capital_code": "3012",
        "drawings_code": "3022",
        "payable_code": "2052",
    },
    {
        "name": "Thakshila",
        "email": "thakshila@visioncraft.lk",
        "capital_code": "3013",
        "drawings_code": "3023",
        "payable_code": "2053",
    },
    {
        "name": "Melanka",
        "email": "melanka@visioncraft.lk",
        "capital_code": "3014",
        "drawings_code": "3024",
        "payable_code": "2054",
    },
]


async def seed_database():
    setup_logging()
    logger.info("Initializing database schema...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Seed Chart of Accounts with starting balance 0.00 LKR
        account_map = {}
        for code, name, classification in STANDARD_COA:
            res = await session.execute(select(Account).where(Account.code == code))
            existing = res.scalar_one_or_none()
            if not existing:
                account = Account(
                    code=code,
                    name=name,
                    classification=classification,
                    current_balance=Decimal("0.00"),
                )
                session.add(account)
                await session.flush()
                account_map[code] = account
            else:
                account_map[code] = existing

        # 2. Seed Super Admin
        admin_res = await session.execute(select(User).where(User.email == "admin@visioncraft.lk"))
        if not admin_res.scalar_one_or_none():
            admin = User(
                email="admin@visioncraft.lk",
                password_hash=get_password_hash(DEFAULT_PASSWORD),
                full_name="Super Administrator",
                role=UserRole.SUPER_ADMIN.value,
            )
            session.add(admin)

        # 3. Seed 4 Partners (Janitha, Lalitha, Thakshila, Melanka)
        for p in PARTNERS:
            u_res = await session.execute(select(User).where(User.email == p["email"]))
            user = u_res.scalar_one_or_none()
            if not user:
                user = User(
                    email=p["email"],
                    password_hash=get_password_hash(DEFAULT_PASSWORD),
                    full_name=p["name"],
                    role=UserRole.FOUNDER.value,
                )
                session.add(user)
                await session.flush()

            f_res = await session.execute(select(Founder).where(Founder.user_id == user.id))
            if not f_res.scalar_one_or_none():
                founder = Founder(
                    user_id=user.id,
                    display_name=p["name"],
                    ownership_percentage=Decimal("25.00"),
                    profit_share_percentage=Decimal("25.00"),
                    capital_account_id=account_map[p["capital_code"]].id,
                    drawings_account_id=account_map[p["drawings_code"]].id,
                    payable_account_id=account_map[p["payable_code"]].id,
                )
                session.add(founder)

        await session.commit()
        logger.info("Database seeding successfully completed with 0.00 starting balances for all 4 partners!")


if __name__ == "__main__":
    asyncio.run(seed_database())

