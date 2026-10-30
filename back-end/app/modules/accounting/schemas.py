"""Accounting Pydantic Schemas."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class AccountResponse(BaseModel):
    id: str
    code: str
    name: str
    classification: str
    description: Optional[str] = None
    is_active: bool
    current_balance: Decimal

    model_config = ConfigDict(from_attributes=True)


class QuickCompanyExpenseRequest(BaseModel):
    expense_account_id: str = Field(description="Debit Account (OPEX or COGS)")
    payment_account_id: str = Field(description="Credit Account (1010 Cash or 1011 Bank)")
    amount: Decimal = Field(gt=0, description="Amount in LKR")
    vendor: str
    description: str
    receipt_reference: Optional[str] = None


class JournalLineResponse(BaseModel):
    id: str
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    debit: Decimal
    credit: Decimal
    memo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JournalEntryResponse(BaseModel):
    id: str
    entry_number: str
    entry_date: date
    description: str
    status: str
    source_document: Optional[str] = None
    lines: List[JournalLineResponse]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReversalRequest(BaseModel):
    reason: str
