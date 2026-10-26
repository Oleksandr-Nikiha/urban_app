from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str | None = None
    location_id: int
    location_name: str
    parent_id: int | None = None
    sort_order: int = 0


class ProductVariantOut(BaseModel):
    id: int
    label: str
    weight: str | None = None
    price: float


class ProductListItemOut(BaseModel):
    """Скорочена картка товару для списку категорії — без повного опису."""

    id: int
    name: str
    image_url: str | None = None
    price_from: float
    category_id: int
    category_name: str


class OptionItemOut(BaseModel):
    variant_id: int
    name: str
    price_delta: float


class OptionGroupOut(BaseModel):
    group_id: int
    name: str
    min_select: int
    max_select: int
    # Скільки порцій у цій групі безкоштовні. Потрібне фронтенду, щоб він
    # показав ту саму суму, яку порахує бекенд при додаванні в кошик.
    free_count: int
    items: list[OptionItemOut]


class ProductDetailOut(BaseModel):
    """Повна картка товару — з описом і усіма варіантами розмірів/цін."""

    id: int
    name: str
    description: str | None = None
    image_url: str | None = None
    variants: list[ProductVariantOut]
    option_groups: list[OptionGroupOut] = []
