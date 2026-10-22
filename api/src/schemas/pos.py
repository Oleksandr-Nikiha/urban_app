from typing import Literal

from pydantic import BaseModel, Field


class PosStaffMemberOut(BaseModel):
    id: int
    staff_name: str
    role: str
    location_id: int | None
    location_name: str | None = None


class PosPinAuthIn(BaseModel):
    staff_id: int | None = None
    pin: str = Field(..., min_length=4, max_length=10)


class PosAuthOut(BaseModel):
    token: str
    staff: PosStaffMemberOut


class PosCustomerLookupOut(BaseModel):
    found: bool
    telegram_id: int | None = None
    first_name: str | None = None
    phone: str | None = None
    bonus_balance: int = 0


class PosOrderItemIn(BaseModel):
    variant_id: int
    qty: int = Field(..., ge=1, le=100)
    option_variant_ids: list[int] = Field(default_factory=list)
    comment: str | None = Field(None, max_length=200)


class PosOrderCreateIn(BaseModel):
    location_id: int
    fulfillment_type: Literal["dine_in", "pickup"] = "dine_in"
    table_number: str | None = Field(None, max_length=32)
    staff_id: int | None = None
    staff_name: str = Field("Персонал", max_length=100)
    customer_phone: str | None = None
    customer_name: str | None = None
    payment_method: Literal["cash", "card", "pending"] = "pending"
    bonus_spent: int = Field(0, ge=0)
    comment: str | None = Field(None, max_length=500)
    items: list[PosOrderItemIn] = Field(..., min_length=1)


class PosAddItemsIn(BaseModel):
    items: list[PosOrderItemIn] = Field(..., min_length=1)


class PosCloseTableIn(BaseModel):
    payment_method: Literal["cash", "card"] = "cash"
    bonus_spent: int = Field(0, ge=0)
    customer_phone: str | None = None
    customer_name: str | None = None
