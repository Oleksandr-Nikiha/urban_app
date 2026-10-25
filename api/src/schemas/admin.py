from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

# --- Права поточного користувача ---


class AdminMeOut(BaseModel):
    is_staff: bool
    role: Literal["admin", "manager"] | None = None
    location_id: int | None = None
    location_name: str | None = None


# --- Менеджери (Штат) ---


class ManagerCreateIn(BaseModel):
    telegram_id: int
    role: Literal["admin", "manager"] = "manager"
    location_id: int | None = None


class ManagerUpdateIn(BaseModel):
    role: Literal["admin", "manager"] | None = None
    location_id: int | None = None
    is_active: bool | None = None


class ManagerOut(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    phone: str
    role: str
    location_id: int | None = None
    location_name: str | None = None
    is_active: bool


# --- Категорії ---


class CategoryCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location_id: int
    parent_id: int | None = None
    icon: str | None = None
    sort_order: int = 0
    is_visible: bool = True


class CategoryUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    location_id: int | None = None
    parent_id: int | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_visible: bool | None = None


# --- Варіанти страв (Розміри / ціни) ---


class VariantCreateIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    price: float = Field(..., ge=0)
    weight: str | None = None
    sort_order: int = 0
    is_available: bool = True


class VariantUpdateIn(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=50)
    price: float | None = Field(None, ge=0)
    weight: str | None = None
    sort_order: int | None = None
    is_available: bool | None = None


# --- Страви (Товари) ---


class ProductCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category_id: int
    description: str | None = None
    image_url: str | None = None
    image: str | None = None
    sort_order: int = 0
    is_available: bool = True
    variants: list[VariantCreateIn] = []


class ProductUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    category_id: int | None = None
    description: str | None = None
    image_url: str | None = None
    image: str | None = None
    sort_order: int | None = None
    is_available: bool | None = None


# --- Швидкий стоп-лист ---


class AvailabilityUpdateIn(BaseModel):
    is_available: bool


# --- Додатки (Модифікатори та групи опцій) ---


class OptionGroupCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    sort_order: int = 0


class OptionGroupUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    sort_order: int | None = None


class OptionGroupItemCreateIn(BaseModel):
    variant_id: int
    price_delta: float = 0.0
    sort_order: int = 0
    is_available: bool = True


class OptionGroupItemUpdateIn(BaseModel):
    price_delta: float | None = None
    sort_order: int | None = None
    is_available: bool | None = None


class ProductOptionGroupAttachIn(BaseModel):
    group_id: int
    min_select: int = 1
    max_select: int = 1
    free_count: int = 0
    sort_order: int = 0


class ProductOptionGroupUpdateIn(BaseModel):
    min_select: int | None = None
    max_select: int | None = None
    free_count: int | None = None
    sort_order: int | None = None


class BulkAvailabilityIn(BaseModel):
    product_ids: list[int]
    is_available: bool


class BulkOptionGroupActionIn(BaseModel):
    action: Literal["attach", "detach", "replace", "clear"]
    product_ids: list[int]
    group_id: int | None = None
    min_select: int = 0
    max_select: int = 1
    free_count: int = 0
    groups: list[ProductOptionGroupAttachIn] | None = None


# --- Моделі відповідей для адмінки ---


class VariantAdminOut(BaseModel):
    id: int
    product_id: int
    label: str
    price: float
    weight: str | None = None
    sort_order: int
    is_available: bool


class ProductOptionGroupAdminOut(BaseModel):
    product_id: int
    group_id: int
    group_name: str
    min_select: int
    max_select: int
    free_count: int
    sort_order: int


class ProductAdminOut(BaseModel):
    id: int
    name: str
    category_id: int
    category_name: str | None = None
    location_id: int | None = None
    location_name: str | None = None
    description: str | None = None
    image: str | None = None
    image_url: str | None = None
    sort_order: int
    is_available: bool
    variants: list[VariantAdminOut] = []
    option_groups: list[ProductOptionGroupAdminOut] = []


class CategoryAdminOut(BaseModel):
    id: int
    name: str
    location_id: int
    location_name: str | None = None
    parent_id: int | None = None
    icon: str | None = None
    sort_order: int
    is_visible: bool
    products_count: int = 0


class OptionGroupAdminOut(BaseModel):
    id: int
    name: str
    sort_order: int
    items_count: int = 0
    products_count: int = 0


class OptionGroupItemAdminOut(BaseModel):
    group_id: int
    variant_id: int
    product_id: int
    product_name: str
    variant_label: str
    price_delta: float
    sort_order: int
    is_available: bool


class VariantSelectorOut(BaseModel):
    variant_id: int
    product_id: int
    product_name: str
    variant_label: str
    price: float
    category_name: str | None = None


# --- Налаштування доставки закладів ---


class LocationDeliveryAdminOut(BaseModel):
    id: int
    name: str
    address: str
    is_delivery_enabled: bool
    delivery_start_time: str
    delivery_end_time: str


class LocationDeliveryUpdateIn(BaseModel):
    is_delivery_enabled: bool | None = None
    delivery_start_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    delivery_end_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")


# --- Керування клієнтами (Users) ---


class AdminUserOut(BaseModel):
    id: int
    telegram_id: int | None = None
    full_name: str
    phone: str
    delivery_address: str | None = None
    is_blocked: bool = False
    is_phone_verified: bool = False
    admin_note: str | None = None
    orders_count: int = 0
    bonus_balance: int = 0
    created_at: str


class AdminUserUpdateIn(BaseModel):
    is_blocked: bool | None = None
    admin_note: str | None = None
    is_phone_verified: bool | None = None
    bonus_balance: int | None = None
    bonus_adjustment: int | None = None
    bonus_adjustment_reason: str | None = None


# --- Керування та редагування замовлень (Orders) ---


class AdminOrderItemOptionIn(BaseModel):
    option_group_name: str
    option_name: str
    price_delta: float = 0.0
    qty: int = 1


class AdminOrderItemIn(BaseModel):
    variant_id: int | None = None
    product_name: str
    variant_label: str
    unit_price: float
    qty: int
    options: list[AdminOrderItemOptionIn] = []


class AdminOrderStatusPatchIn(BaseModel):
    status: str
    comment: str | None = None


class AdminOrderStatusPatchOut(BaseModel):
    id: int
    status: str
    bonus_earned: int = 0
    bonus_processed: bool = False


class AdminOrderUpdateIn(BaseModel):
    scheduled_time: str | None = None
    status: str | None = None
    delivery_address: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    comment: str | None = None
    items: list[AdminOrderItemIn] | None = None


class AdminOrderItemOptionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    option_group_name: str = Field(
        ..., validation_alias=AliasChoices("option_group_name", "group_name")
    )
    option_name: str
    price_delta: float
    qty: int


class AdminOrderItemOut(BaseModel):
    id: int
    order_group_id: int
    variant_id: int | None = None
    product_name: str
    variant_label: str
    unit_price: float
    qty: int
    subtotal: float
    options: list[AdminOrderItemOptionOut] = []


class AdminOrderGroupOut(BaseModel):
    id: int
    order_id: int
    location_id: int
    location_name: str | None = None
    status: str
    subtotal: float
    items: list[AdminOrderItemOut] = []


class AdminOrderListItemOut(BaseModel):
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
    created_at: str
    items_summary: str = ""
    location_id: int | None = None
    location_name: str | None = None
    user_is_blocked: bool = False
    user_admin_note: str | None = None
    source: str = "telegram"
    table_number: int | None = None
    staff_name: str | None = None


class AdminOrderDetailOut(BaseModel):
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
    created_at: str
    user_is_blocked: bool = False
    user_admin_note: str | None = None
    source: str = "telegram"
    table_number: int | None = None
    staff_name: str | None = None
    groups: list[AdminOrderGroupOut] = []


# --- Аналітика та статистика ---


class AnalyticsKPI(BaseModel):
    revenue: float
    orders_count: int
    avg_order_value: float
    customers_count: int


class AnalyticsStatusBreakdown(BaseModel):
    status: str
    count: int
    total_amount: float


class AnalyticsFulfillmentBreakdown(BaseModel):
    fulfillment_type: str
    count: int
    total_amount: float


class AnalyticsPaymentBreakdown(BaseModel):
    payment_method: str
    count: int
    total_amount: float


class AnalyticsLocationBreakdown(BaseModel):
    location_id: int
    location_name: str
    orders_count: int
    revenue: float


class AnalyticsDynamicsPoint(BaseModel):
    date: str
    orders_count: int
    revenue: float


class AnalyticsSummaryOut(BaseModel):
    period: str
    kpi: AnalyticsKPI
    by_status: list[AnalyticsStatusBreakdown] = []
    by_fulfillment: list[AnalyticsFulfillmentBreakdown] = []
    by_payment: list[AnalyticsPaymentBreakdown] = []
    by_location: list[AnalyticsLocationBreakdown] = []
    dynamics: list[AnalyticsDynamicsPoint] = []


class AnalyticsTopProductOut(BaseModel):
    product_name: str
    variant_label: str
    total_qty: int
    total_revenue: float


# --- Маркетингові розсилки (Фаза 5.2) ---

BroadcastSegment = Literal["all", "active_30d", "inactive", "top_orders"]


class BroadcastCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    text: str = Field(..., min_length=1, max_length=4000)
    image_url: str | None = None
    button_text: str | None = Field(None, max_length=64)
    button_url: str | None = None
    segment: BroadcastSegment = "all"


class BroadcastOut(BaseModel):
    id: int
    author_id: int
    author_name: str | None = None
    title: str
    text: str
    image_url: str | None = None
    button_text: str | None = None
    button_url: str | None = None
    segment: str
    status: str
    total_recipients: int
    sent_count: int
    failed_count: int
    created_at: str
    completed_at: str | None = None


class BroadcastRecipientsCountOut(BaseModel):
    segment: str
    count: int
