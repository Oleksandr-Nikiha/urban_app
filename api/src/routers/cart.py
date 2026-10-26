import asyncpg
from fastapi import APIRouter, Depends

from src.auth.deps import get_current_user
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.cart import CartItemIn, CartItemUpdateIn, CartOut
from src.services.cart_helpers import build_options_key, options_cost
from src.services.cart_service import CartService, _fetch_cart

__all__ = ["build_options_key", "options_cost", "_fetch_cart", "CartService", "router"]

router = APIRouter(prefix="/api/cart", tags=["Cart"], dependencies=[Depends(rate_limiter)])


@router.get("", response_model=CartOut)
async def get_cart(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримує вміст кошика для поточного користувача."""
    return await CartService.fetch_cart(pool, user["telegram_id"])


@router.post("/items", response_model=CartOut)
async def add_item_to_cart(
    payload: CartItemIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Додає страву з модифікаторами до кошика або оновлює кількість."""
    async with pool.acquire() as conn, conn.transaction():
        return await CartService.add_item_to_cart(conn, user["telegram_id"], payload)


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_cart_item(
    item_id: int,
    payload: CartItemUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Оновлює товар у кошику (кількість, варіант або обрані опції)."""
    async with pool.acquire() as conn, conn.transaction():
        return await CartService.update_cart_item(conn, user["telegram_id"], item_id, payload)


@router.delete("/items/{item_id}", response_model=CartOut)
async def delete_cart_item(
    item_id: int,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Видаляє страву з кошика."""
    async with pool.acquire() as conn:
        return await CartService.delete_cart_item(conn, user["telegram_id"], item_id)


@router.delete("", response_model=CartOut)
async def clear_cart(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Повністю очищає кошик."""
    async with pool.acquire() as conn:
        return await CartService.clear_cart(conn, user["telegram_id"])
