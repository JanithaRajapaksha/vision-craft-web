"""Four-Founder / Partner API Router."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, List
from fastapi import APIRouter, Depends, status
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.exceptions import DomainException, EntityNotFoundError
from app.modules.auth.models import User, UserRole
from app.modules.accounting.models import Account
from app.modules.accounting.ledger_service import LedgerService
from app.modules.founders.models import (
    Founder,
    FounderPersonalExpense,
    ExpenseClaimStatus,
)
from app.modules.founders.schemas import (
    FounderSummary,
    PersonalExpenseClaimCreate,
    PersonalExpenseClaimResponse,
    ReimbursePaymentRequest,
)

router = APIRouter(prefix="/founders", tags=["Four-Founder Financial Management"])


@router.get("", response_model=List[FounderSummary])
async def list_founders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    List the 4 partners (Janitha, Lalitha, Thakshila, Melanka)
    with their live Capital balance, Drawings, and Reimbursement liabilities.
    """
    founders_query = select(Founder).order_by(Founder.created_at)
    result = await db.execute(founders_query)
    founders = result.scalars().all()

    summaries = []
    for f in founders:
        # Load account balances
        cap_acc = (await db.execute(select(Account).where(Account.id == f.capital_account_id))).scalar_one_or_none()
        draw_acc = (await db.execute(select(Account).where(Account.id == f.drawings_account_id))).scalar_one_or_none()
        due_acc = (await db.execute(select(Account).where(Account.id == f.payable_account_id))).scalar_one_or_none()

        summaries.append(
            FounderSummary(
                id=f.id,
                user_id=f.user_id,
                display_name=f.display_name,
                ownership_percentage=f.ownership_percentage,
                profit_share_percentage=f.profit_share_percentage,
                capital_balance=cap_acc.current_balance if cap_acc else Decimal("0.00"),
                drawings_balance=draw_acc.current_balance if draw_acc else Decimal("0.00"),
                amount_due_reimbursement=due_acc.current_balance if due_acc else Decimal("0.00"),
            )
        )
    return summaries


@router.get("/expenses", response_model=List[PersonalExpenseClaimResponse])
async def list_personal_expense_claims(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List out-of-pocket expense claims submitted by partners."""
    query = (
        select(FounderPersonalExpense)
        .options(selectinload(FounderPersonalExpense.founder))
        .order_by(desc(FounderPersonalExpense.created_at))
    )
    result = await db.execute(query)
    claims = result.scalars().all()

    response = []
    for c in claims:
        category_acc = (await db.execute(select(Account).where(Account.id == c.category_account_id))).scalar_one_or_none()
        response.append(
            PersonalExpenseClaimResponse(
                id=c.id,
                expense_number=c.expense_number,
                founder_id=c.founder_id,
                founder_name=c.founder.display_name if c.founder else "Unknown",
                vendor=c.vendor,
                category_account_id=c.category_account_id,
                category_account_name=category_acc.name if category_acc else None,
                amount=c.amount,
                description=c.description,
                receipt_file_path=c.receipt_file_path,
                status=c.status,
                purchase_date=c.purchase_date,
                created_at=c.created_at,
            )
        )
    return response


@router.post("/expenses", response_model=PersonalExpenseClaimResponse, status_code=status.HTTP_201_CREATED)
async def submit_personal_expense_claim(
    payload: PersonalExpenseClaimCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FOUNDER, UserRole.SUPER_ADMIN))],
):
    """Partner submits a personal out-of-pocket expense paid from personal funds."""
    # Find founder profile for current user
    founder_res = await db.execute(select(Founder).where(Founder.user_id == current_user.id))
    founder = founder_res.scalar_one_or_none()

    if not founder:
        # If super admin without founder profile, pick first founder for testing
        first_founder = (await db.execute(select(Founder))).scalars().first()
        if not first_founder:
            raise DomainException("No founder profile associated with this account.")
        founder = first_founder

    expense_number = f"FEXP-{date.today().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

    claim = FounderPersonalExpense(
        expense_number=expense_number,
        founder_id=founder.id,
        purchase_date=payload.purchase_date or date.today(),
        vendor=payload.vendor,
        category_account_id=payload.category_account_id,
        amount=payload.amount,
        description=payload.description,
        status=ExpenseClaimStatus.SUBMITTED.value,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)

    category_acc = (await db.execute(select(Account).where(Account.id == claim.category_account_id))).scalar_one_or_none()

    return PersonalExpenseClaimResponse(
        id=claim.id,
        expense_number=claim.expense_number,
        founder_id=claim.founder_id,
        founder_name=founder.display_name,
        vendor=claim.vendor,
        category_account_id=claim.category_account_id,
        category_account_name=category_acc.name if category_acc else None,
        amount=claim.amount,
        description=claim.description,
        receipt_file_path=claim.receipt_file_path,
        status=claim.status,
        purchase_date=claim.purchase_date,
        created_at=claim.created_at,
    )


@router.post("/expenses/{claim_id}/approve", response_model=PersonalExpenseClaimResponse)
async def approve_personal_expense_claim(
    claim_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FOUNDER, UserRole.SUPER_ADMIN))],
):
    """
    Approve an out-of-pocket expense claim.
    Posts double-entry:
    - DEBIT: Expense / Inventory Asset
    - CREDIT: Due to Partner (Current Liability)
    """
    claim_res = await db.execute(
        select(FounderPersonalExpense)
        .options(selectinload(FounderPersonalExpense.founder))
        .where(FounderPersonalExpense.id == claim_id)
    )
    claim = claim_res.scalar_one_or_none()
    if not claim:
        raise EntityNotFoundError("FounderPersonalExpense", claim_id)

    if claim.status != ExpenseClaimStatus.SUBMITTED.value:
        raise DomainException(f"Cannot approve claim in '{claim.status}' state.")

    founder = claim.founder
    entry_number = f"JE-FEXP-{claim.expense_number}"
    description = f"Partner Expense Approval ({founder.display_name}): {claim.description}"

    lines = [
        {
            "account_id": claim.category_account_id,
            "debit": claim.amount,
            "credit": Decimal("0.00"),
            "memo": f"Purchase from {claim.vendor} by {founder.display_name}",
        },
        {
            "account_id": founder.payable_account_id,  # Due to Partner
            "debit": Decimal("0.00"),
            "credit": claim.amount,
            "memo": f"Reimbursement payable to {founder.display_name} for {claim.expense_number}",
            "partner_id": founder.id,
        },
    ]

    entry = await LedgerService.post_journal_entry(
        db=db,
        entry_number=entry_number,
        description=description,
        lines_data=lines,
        source_document=claim.expense_number,
        posted_by_id=current_user.id,
    )

    claim.status = ExpenseClaimStatus.APPROVED.value
    claim.approved_by_id = current_user.id
    claim.approved_at = datetime.now(timezone.utc)
    claim.journal_entry_id = entry.id
    await db.commit()
    await db.refresh(claim)

    category_acc = (await db.execute(select(Account).where(Account.id == claim.category_account_id))).scalar_one_or_none()

    return PersonalExpenseClaimResponse(
        id=claim.id,
        expense_number=claim.expense_number,
        founder_id=claim.founder_id,
        founder_name=founder.display_name,
        vendor=claim.vendor,
        category_account_id=claim.category_account_id,
        category_account_name=category_acc.name if category_acc else None,
        amount=claim.amount,
        description=claim.description,
        receipt_file_path=claim.receipt_file_path,
        status=claim.status,
        purchase_date=claim.purchase_date,
        created_at=claim.created_at,
    )


@router.post("/expenses/{claim_id}/reimburse", response_model=PersonalExpenseClaimResponse)
async def reimburse_personal_expense_claim(
    claim_id: str,
    payload: ReimbursePaymentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.FOUNDER, UserRole.SUPER_ADMIN))],
):
    """
    Reimburse partner for approved out-of-pocket claim via company bank transfer.
    Posts double-entry:
    - DEBIT: Due to Partner (Liability reduced to 0)
    - CREDIT: Company Bank Account
    """
    claim_res = await db.execute(
        select(FounderPersonalExpense)
        .options(selectinload(FounderPersonalExpense.founder))
        .where(FounderPersonalExpense.id == claim_id)
    )
    claim = claim_res.scalar_one_or_none()
    if not claim:
        raise EntityNotFoundError("FounderPersonalExpense", claim_id)

    if claim.status != ExpenseClaimStatus.APPROVED.value:
        raise DomainException(f"Cannot reimburse claim in '{claim.status}' state. It must be APPROVED first.")

    founder = claim.founder
    entry_number = f"JE-REIMB-{claim.expense_number}"
    description = f"Bank Reimbursement to {founder.display_name} for {claim.expense_number}"

    lines = [
        {
            "account_id": founder.payable_account_id,  # Due to Partner
            "debit": claim.amount,
            "credit": Decimal("0.00"),
            "memo": f"Settlement of {claim.expense_number} to {founder.display_name}",
            "partner_id": founder.id,
        },
        {
            "account_id": payload.payment_account_id,  # Company Bank
            "debit": Decimal("0.00"),
            "credit": claim.amount,
            "memo": f"Disbursement from Bank (Ref: {payload.reference_number or 'N/A'})",
        },
    ]

    await LedgerService.post_journal_entry(
        db=db,
        entry_number=entry_number,
        description=description,
        lines_data=lines,
        source_document=f"REIMBURSE:{claim.expense_number}",
        posted_by_id=current_user.id,
    )

    claim.status = ExpenseClaimStatus.REIMBURSED.value
    await db.commit()
    await db.refresh(claim)

    category_acc = (await db.execute(select(Account).where(Account.id == claim.category_account_id))).scalar_one_or_none()

    return PersonalExpenseClaimResponse(
        id=claim.id,
        expense_number=claim.expense_number,
        founder_id=claim.founder_id,
        founder_name=founder.display_name,
        vendor=claim.vendor,
        category_account_id=claim.category_account_id,
        category_account_name=category_acc.name if category_acc else None,
        amount=claim.amount,
        description=claim.description,
        receipt_file_path=claim.receipt_file_path,
        status=claim.status,
        purchase_date=claim.purchase_date,
        created_at=claim.created_at,
    )
