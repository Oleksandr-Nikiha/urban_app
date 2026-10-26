from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from src.schemas.user import normalize_phone


class OrderCreateIn(BaseModel):
    fulfillment_type: Literal["delivery", "pickup"]
    location_id: int | None = None
    delivery_address: str | None = None
    contact_name: str = Field(..., min_length=1, max_length=100)
    contact_phone: str = Field(..., min_length=5, max_length=30)
    payment_method: Literal["cash", "card", "qr"]
    scheduled_time: str | None = Field(None, max_length=50)
    comment: str | None = Field(None, max_length=500)
    bonus_spent: int = 0
    bonus_to_spend: int | None = Field(None, ge=0, description="Кількість бонусів для списання")

    @model_validator(mode="after")
    def validate_fulfillment(self) -> "OrderCreateIn":
        if self.fulfillment_type == "delivery":
            if not self.delivery_address or not self.delivery_address.strip():
                raise ValueError("Адреса доставки обов'язкова для кур'єрської доставки")
        elif self.fulfillment_type == "pickup" and not self.location_id:
            raise ValueError("Локація обов'язкова для самовивозу")
        if self.payment_method == "qr" and self.fulfillment_type != "delivery":
            raise ValueError("Оплата по QR-коду доступна лише при доставці")
        return self

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, v: str) -> str:
        return normalize_phone(v)


class OrderItemOptionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    option_group_name: str = Field(
        ..., validation_alias=AliasChoices("option_group_name", "group_name")
    )
    option_name: str
    price_delta: float
    qty: int


class OrderItemOut(BaseModel):
    id: int
    variant_id: int | None = None
    product_name: str
    variant_label: str
    unit_price: float
    qty: int
    subtotal: float
    options: list[OrderItemOptionOut] = []


class OrderGroupOut(BaseModel):
    id: int
    location_id: int
    location_name: str
    status: str
    subtotal: float
    items: list[OrderItemOut] = []


class WebOrderItemIn(BaseModel):
    variant_id: int
    qty: int = Field(..., ge=1, le=50)
    option_variant_ids: list[int] = Field(default_factory=list)


class WebOrderCreateIn(BaseModel):
    telegram_id: int | None = None
    location_id: int = 2
    fulfillment_type: Literal["delivery", "pickup"]
    delivery_address: str | None = None
    contact_name: str = Field(..., min_length=1, max_length=100)
    contact_phone: str = Field(..., min_length=5, max_length=30)
    payment_method: Literal["cash", "card"]
    scheduled_time: str | None = Field(None, max_length=50)
    comment: str | None = Field(None, max_length=500)
    source: str = "web_croissants"
    bonus_spent: int = 0
    items: list[WebOrderItemIn] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_fulfillment(self) -> "WebOrderCreateIn":
        if self.fulfillment_type == "delivery" and (
            not self.delivery_address or not self.delivery_address.strip()
        ):
            raise ValueError("Адреса доставки обов'язкова для кур'єрської доставки")
        return self

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, v: str) -> str:
        return normalize_phone(v)


class OrderOut(BaseModel):
    id: int
    telegram_id: int | None = None
    status: str
    fulfillment_type: str
    delivery_address: str | None = None
    contact_name: str
    contact_phone: str
    payment_method: str
    scheduled_time: str | None = None
    comment: str | None = None
    total_price: float
    bonus_spent: int = 0
    bonus_earned: int = 0
    created_at: datetime
    source: str = "telegram"
    groups: list[OrderGroupOut] = []


class RepeatOrderIn(BaseModel):
    replace_cart: bool = True


class RepeatOrderOut(BaseModel):
    added_count: int
    unavailable_items: list[str] = []
    price_changed: bool = False
    old_total: float
    new_total: float
