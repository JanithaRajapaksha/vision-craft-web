"""Double-Entry Ledger Core Engine.

Enforces:
1. Strict balance constraint: Sum(Debits) == Sum(Credits) > 0.
2. Immutability of posted entries.
3. Compensatory reversal mechanics.
4. Correct balance updates based on normal accounting balances:
   - ASSET & EXPENSE: Normal Debit (Balance = Debit - Credit)
   - LIABILITY, EQUITY & REVENUE: Normal Credit (Balance = Credit - Debit)
"""
from decimal import Decimal
from typing import List, Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.exceptions import LedgerBalanceError, DomainException, EntityNotFoundError
from app.modules.accounting.models import (
    Account,
    AccountClassification,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
)


class LedgerService:
    @staticmethod
    async def post_journal_entry(
        db: AsyncSession,
        entry_number: str,
        description: str,
        lines_data: List[dict],
        entry_date: Optional[date] = None,
        source_document: Optional[str] = None,
        posted_by_id: Optional[str] = None,
    ) -> JournalEntry:
        """Create and post a balanced double-entry journal entry in the ledger."""
        if not lines_data or len(lines_data) < 2:
            raise DomainException("A journal entry requires at least two lines (at least one debit and one credit).")

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for line in lines_data:
            debit = Decimal(str(line.get("debit", 0))).quantize(Decimal("0.01"))
            credit = Decimal(str(line.get("credit", 0))).quantize(Decimal("0.01"))
            if debit < Decimal("0.00") or credit < Decimal("0.00"):
                raise DomainException("Debit and Credit amounts must be non-negative.")
            if debit > Decimal("0.00") and credit > Decimal("0.00"):
                raise DomainException("A journal line cannot contain both a debit and a credit amount.")
            total_debit += debit
            total_credit += credit

        # Strict validation: Total Debits == Total Credits > 0
        if total_debit != total_credit or total_debit <= Decimal("0.00"):
            raise LedgerBalanceError(str(total_debit), str(total_credit))

        # Create Journal Entry
        entry = JournalEntry(
            entry_number=entry_number,
            entry_date=entry_date or date.today(),
            description=description,
            status=JournalEntryStatus.POSTED.value,
            source_document=source_document,
            posted_by_id=posted_by_id,
        )
        db.add(entry)
        await db.flush()  # Generate entry.id

        # Attach lines and update account balances
        for line in lines_data:
            account_id = line["account_id"]
            debit = Decimal(str(line.get("debit", 0))).quantize(Decimal("0.01"))
            credit = Decimal(str(line.get("credit", 0))).quantize(Decimal("0.01"))

            # Fetch account
            query = select(Account).where(Account.id == account_id)
            result = await db.execute(query)
            account = result.scalar_one_or_none()
            if not account:
                raise EntityNotFoundError("Account", account_id)

            journal_line = JournalEntryLine(
                journal_entry_id=entry.id,
                account_id=account.id,
                debit=debit,
                credit=credit,
                memo=line.get("memo"),
                partner_id=line.get("partner_id"),
            )
            db.add(journal_line)

            # Update account cached balance based on normal balance classification
            if account.classification in [
                AccountClassification.ASSET.value,
                AccountClassification.EXPENSE.value,
            ]:
                account.current_balance += (debit - credit)
            else:
                account.current_balance += (credit - debit)

        await db.flush()
        return entry

    @staticmethod
    async def create_reversal_entry(
        db: AsyncSession,
        original_entry_id: str,
        reversal_entry_number: str,
        reason: str,
        reversed_by_user_id: Optional[str] = None,
    ) -> JournalEntry:
        """Create a compensatory reversal entry that completely cancels out a posted entry."""
        query = select(JournalEntry).where(JournalEntry.id == original_entry_id)
        result = await db.execute(query)
        original_entry = result.scalar_one_or_none()

        if not original_entry:
            raise EntityNotFoundError("JournalEntry", original_entry_id)

        if original_entry.status == JournalEntryStatus.REVERSED.value:
            raise DomainException(f"Journal entry '{original_entry.entry_number}' is already reversed.")

        # Load lines
        lines_query = select(JournalEntryLine).where(
            JournalEntryLine.journal_entry_id == original_entry.id
        )
        lines_result = await db.execute(lines_query)
        original_lines = lines_result.scalars().all()

        # Invert debits and credits
        reversal_lines = []
        for line in original_lines:
            reversal_lines.append({
                "account_id": line.account_id,
                "debit": line.credit,  # Swap
                "credit": line.debit,  # Swap
                "memo": f"Reversal: {line.memo or ''}",
                "partner_id": line.partner_id,
            })

        # Post the reversal
        reversal = await LedgerService.post_journal_entry(
            db=db,
            entry_number=reversal_entry_number,
            description=f"REVERSAL of {original_entry.entry_number}: {reason}",
            lines_data=reversal_lines,
            entry_date=date.today(),
            source_document=f"REVERSAL:{original_entry.entry_number}",
            posted_by_id=reversed_by_user_id,
        )

        reversal.reversal_of_id = original_entry.id
        original_entry.status = JournalEntryStatus.REVERSED.value
        await db.flush()
        return reversal

