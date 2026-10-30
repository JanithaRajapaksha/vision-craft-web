"""Accounting & General Ledger API Router."""
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.accounting.models import Account, JournalEntry, JournalEntryLine
from app.modules.accounting.schemas import (
    AccountResponse,
    JournalEntryResponse,
    JournalLineResponse,
    QuickCompanyExpenseRequest,
    ReversalRequest,
)
from app.modules.accounting.ledger_service import LedgerService

router = APIRouter(prefix="/accounting", tags=["Accounting & General Ledger"])


@router.get("/accounts", response_model=List[AccountResponse])
async def list_chart_of_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List all accounts in the Chart of Accounts with live balances in LKR."""
    query = select(Account).order_by(Account.code)
    result = await db.execute(query)
    accounts = result.scalars().all()
    return [AccountResponse.model_validate(a) for a in accounts]


@router.get("/journal", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=200),
):
    """List General Journal entries with lines ordered by most recent."""
    query = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account))
        .order_by(desc(JournalEntry.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    entries = result.scalars().all()

    response = []
    for entry in entries:
        lines = [
            JournalLineResponse(
                id=line.id,
                account_id=line.account_id,
                account_code=line.account.code if line.account else None,
                account_name=line.account.name if line.account else None,
                debit=line.debit,
                credit=line.credit,
                memo=line.memo,
            )
            for line in entry.lines
        ]
        response.append(
            JournalEntryResponse(
                id=entry.id,
                entry_number=entry.entry_number,
                entry_date=entry.entry_date,
                description=entry.description,
                status=entry.status,
                source_document=entry.source_document,
                lines=lines,
                created_at=entry.created_at,
            )
        )
    return response


@router.post("/expenses/quick", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def record_quick_company_expense(
    payload: QuickCompanyExpenseRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FOUNDER, UserRole.ACCOUNTANT))],
):
    """
    Record an ongoing business expense directly as it occurs.
    Automatically creates and posts a balanced double-entry:
    - DEBIT: Expense Account (OPEX or COGS)
    - CREDIT: Cash or Bank Account
    """
    entry_number = f"JE-EXP-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    description = f"Expense to {payload.vendor}: {payload.description}"

    lines = [
        {
            "account_id": payload.expense_account_id,
            "debit": payload.amount,
            "credit": Decimal("0.00"),
            "memo": f"Paid to {payload.vendor} - {payload.description}",
        },
        {
            "account_id": payload.payment_account_id,
            "debit": Decimal("0.00"),
            "credit": payload.amount,
            "memo": f"Payment for {payload.vendor} (Ref: {payload.receipt_reference or 'N/A'})",
        },
    ]

    entry = await LedgerService.post_journal_entry(
        db=db,
        entry_number=entry_number,
        description=description,
        lines_data=lines,
        source_document=f"DIRECT-EXPENSE:{payload.vendor}",
        posted_by_id=current_user.id,
    )
    await db.commit()

    # Reload with lines
    query = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account))
        .where(JournalEntry.id == entry.id)
    )
    res = await db.execute(query)
    saved_entry = res.scalar_one()

    lines_res = [
        JournalLineResponse(
            id=line.id,
            account_id=line.account_id,
            account_code=line.account.code if line.account else None,
            account_name=line.account.name if line.account else None,
            debit=line.debit,
            credit=line.credit,
            memo=line.memo,
        )
        for line in saved_entry.lines
    ]

    return JournalEntryResponse(
        id=saved_entry.id,
        entry_number=saved_entry.entry_number,
        entry_date=saved_entry.entry_date,
        description=saved_entry.description,
        status=saved_entry.status,
        source_document=saved_entry.source_document,
        lines=lines_res,
        created_at=saved_entry.created_at,
    )


@router.post("/journal/{entry_id}/reverse", response_model=JournalEntryResponse)
async def reverse_journal_entry(
    entry_id: str,
    payload: ReversalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FOUNDER, UserRole.ACCOUNTANT))],
):
    """Create an audited compensatory reversal for an erroneous journal entry."""
    reversal_number = f"JE-REV-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    reversal = await LedgerService.create_reversal_entry(
        db=db,
        original_entry_id=entry_id,
        reversal_entry_number=reversal_number,
        reason=payload.reason,
        reversed_by_user_id=current_user.id,
    )
    await db.commit()

    query = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account))
        .where(JournalEntry.id == reversal.id)
    )
    res = await db.execute(query)
    saved_entry = res.scalar_one()

    lines_res = [
        JournalLineResponse(
            id=line.id,
            account_id=line.account_id,
            account_code=line.account.code if line.account else None,
            account_name=line.account.name if line.account else None,
            debit=line.debit,
            credit=line.credit,
            memo=line.memo,
        )
        for line in saved_entry.lines
    ]

    return JournalEntryResponse(
        id=saved_entry.id,
        entry_number=saved_entry.entry_number,
        entry_date=saved_entry.entry_date,
        description=saved_entry.description,
        status=saved_entry.status,
        source_document=saved_entry.source_document,
        lines=lines_res,
        created_at=saved_entry.created_at,
    )

