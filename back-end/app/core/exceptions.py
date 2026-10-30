"""Domain exceptions and error models."""
from fastapi import HTTPException, status


class DomainException(Exception):
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class EntityNotFoundError(DomainException):
    def __init__(self, entity_name: str, identifier: str):
        super().__init__(f"{entity_name} with identifier '{identifier}' not found.", code="NOT_FOUND")


class LedgerBalanceError(DomainException):
    def __init__(self, debit_sum: str, credit_sum: str):
        super().__init__(
            f"Journal entry is out of balance. Total Debits: {debit_sum}, Total Credits: {credit_sum}.",
            code="LEDGER_UNBALANCED"
        )


class InsufficientLiquidityError(DomainException):
    def __init__(self, requested: str, available: str):
        super().__init__(
            f"Cannot execute profit distribution of LKR {requested}. Safe liquid cash buffer is only LKR {available}.",
            code="INSUFFICIENT_LIQUIDITY"
        )


class AuthenticationError(HTTPException):
    def __init__(self, detail: str = "Invalid credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthorizationError(HTTPException):
    def __init__(self, detail: str = "Access denied: insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )
