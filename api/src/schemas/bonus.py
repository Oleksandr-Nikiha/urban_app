"""Схеми для транзакцій бонусів та аналітики лояльності URBAN CLUB."""
from datetime import datetime

from pydantic import BaseModel, Field


class BonusTransactionOut(BaseModel):
    id: int
    user_id: int
    order_id: int | None = None
    amount: int
    balance_after: int
    transaction_type: str
    description: str | None = None
    created_at: datetime


class BonusAdjustmentIn(BaseModel):
    amount: int = Field(..., description="Кількість бонусів (позитивне або негативне число)")
    reason: str = Field(..., min_length=2, max_length=255, description="Причина коригування")


class BonusAnalyticsSummary(BaseModel):
    total_users_with_bonuses: int
    total_bonus_pool: int
    total_bonuses_issued: int
    total_bonuses_redeemed: int
    total_orders_with_cashback: int
