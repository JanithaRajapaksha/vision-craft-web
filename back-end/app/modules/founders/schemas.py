"""Four-Founder / Partner Pydantic Schemas."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class FounderSummary(BaseModel):
    id: str
    user_id: str
    display_name: str
    ownership_percentage: Decimal
    profit_share_percentage: Decimal
    capital_balance: Decimal
    drawings_balance: Decimal
    amount_due_reimbursement: Decimal

    model_config = ConfigDict(from_attributes=True)


class PersonalExpenseClaimCreate(BaseModel):
    vendor: str
    category_account_id: str
    amount: Decimal = Field(gt=0, description="Amount in LKR paid from personal funds")
    description: str
    purchase_date: Optional[date] = None


class PersonalExpenseClaimResponse(BaseModel):
    id: str
    expense_number: str
    founder_id: str
    founder_name: str
    vendor: str
    category_account_id: str
    category_account_name: Optional[str] = None
    amount: Decimal
    description: str
    receipt_file_path: Optional[str] = None
    status: str
    purchase_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReimbursePaymentRequest(BaseModel):
    payment_account_id: str = Field(description="Company Bank Account ID (e.g. 1011 Commercial Bank)")
    reference_number: Optional[str] = None
