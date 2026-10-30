"""Double-Entry Accounting Ledger Engine Tests."""
import pytest
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import LedgerBalanceError
from app.modules.accounting.models import Account, JournalEntryStatus
from app.modules.accounting.ledger_service import LedgerService


@pytest.mark.asyncio
async def test_ledger_rejects_unbalanced_entry(db_session: AsyncSession):
    # Retrieve Bank and Revenue accounts
    bank = (await db_session.execute(select(Account).where(Account.code == "1011"))).scalar_one()
    revenue = (await db_session.execute(select(Account).where(Account.code == "4010"))).scalar_one()

    # Attempt an unbalanced journal entry: Debit 5,000, Credit 4,000
    unbalanced_lines = [
        {"account_id": bank.id, "debit": Decimal("5000.00"), "credit": Decimal("0.00")},
        {"account_id": revenue.id, "debit": Decimal("0.00"), "credit": Decimal("4000.00")},
    ]

    with pytest.raises(LedgerBalanceError) as exc_info:
        await LedgerService.post_journal_entry(
            db=db_session,
            entry_number="JE-TEST-UNBALANCED",
            description="Unbalanced test entry",
            lines_data=unbalanced_lines,
        )

    assert "Journal entry is out of balance" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ledger_posts_balanced_entry_and_updates_balances(db_session: AsyncSession):
    bank = (await db_session.execute(select(Account).where(Account.code == "1011"))).scalar_one()
    revenue = (await db_session.execute(select(Account).where(Account.code == "4010"))).scalar_one()

    assert bank.current_balance == Decimal("0.00")
    assert revenue.current_balance == Decimal("0.00")

    balanced_lines = [
        {"account_id": bank.id, "debit": Decimal("25000.00"), "credit": Decimal("0.00")},
        {"account_id": revenue.id, "debit": Decimal("0.00"), "credit": Decimal("25000.00")},
    ]

    entry = await LedgerService.post_journal_entry(
        db=db_session,
        entry_number="JE-TEST-0001",
        description="FDM 3D printing batch payment received",
        lines_data=balanced_lines,
    )
    await db_session.commit()

    assert entry.status == JournalEntryStatus.POSTED.value

    # Refresh accounts
    await db_session.refresh(bank)
    await db_session.refresh(revenue)

    # Bank (Asset: normal debit) increases by 25,000
    assert bank.current_balance == Decimal("25000.00")
    # Revenue (Revenue: normal credit) increases by 25,000
    assert revenue.current_balance == Decimal("25000.00")


@pytest.mark.asyncio
async def test_ledger_compensatory_reversal(db_session: AsyncSession):
    bank = (await db_session.execute(select(Account).where(Account.code == "1011"))).scalar_one()
    expense = (await db_session.execute(select(Account).where(Account.code == "6010"))).scalar_one()

    # Original expense: LKR 10,000 for workshop rent
    lines = [
        {"account_id": expense.id, "debit": Decimal("10000.00"), "credit": Decimal("0.00")},
        {"account_id": bank.id, "debit": Decimal("0.00"), "credit": Decimal("10000.00")},
    ]

    entry = await LedgerService.post_journal_entry(
        db=db_session,
        entry_number="JE-RENT-01",
        description="Workshop Rent Paid",
        lines_data=lines,
    )
    await db_session.commit()

    await db_session.refresh(bank)
    await db_session.refresh(expense)
    assert expense.current_balance == Decimal("10000.00")
    assert bank.current_balance == Decimal("-10000.00")

    # Execute Reversal
    reversal = await LedgerService.create_reversal_entry(
        db=db_session,
        original_entry_id=entry.id,
        reversal_entry_number="JE-REV-RENT-01",
        reason="Erroneous charge correction",
    )
    await db_session.commit()

    await db_session.refresh(entry)
    await db_session.refresh(bank)
    await db_session.refresh(expense)

    assert entry.status == JournalEntryStatus.REVERSED.value
    assert reversal.status == JournalEntryStatus.POSTED.value
    # Balances are restored precisely back to 0.00!
    assert expense.current_balance == Decimal("0.00")
    assert bank.current_balance == Decimal("0.00")

