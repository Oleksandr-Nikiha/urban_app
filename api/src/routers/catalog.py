import asyncpg
from fastapi import APIRouter, Depends, Header, Query

from src.auth.deps import admin_token_header
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.catalog import (
    CategoryOut,
    ProductDetailOut,
    ProductListItemOut,
)
from src.services.catalog_service import CatalogService

router = APIRouter(
    prefix="/api",
    tags=["catalog"],
    dependencies=[Depends(rate_limiter)],
)


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(
    location_id: int | None = Query(None, description="Фільтр закладу"),
    bypass_cache: bool = Query(False, description="Отримати свіжі дані повз кеш (тільки персонал)"),
    x_bypass_cache: str | None = Header(None, alias="X-Bypass-Cache"),
    admin_token: str | None = Depends(admin_token_header),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримати список активних категорій страв з урахуванням наявності товарів."""
    should_bypass = bool(admin_token) and (
        bypass_cache or (x_bypass_cache in ("1", "true", "True"))
    )
    return await CatalogService.list_categories(
        conn_or_pool=pool,
        location_id=location_id,
        bypass_cache=should_bypass,
    )


@router.get("/categories/{category_id}/products", response_model=list[ProductListItemOut])
async def list_products_by_category(
    category_id: int,
    bypass_cache: bool = Query(False, description="Отримати свіжі дані повз кеш (тільки персонал)"),
    x_bypass_cache: str | None = Header(None, alias="X-Bypass-Cache"),
    admin_token: str | None = Depends(admin_token_header),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримати список доступних страв для обраної категорії."""
    should_bypass = bool(admin_token) and (
        bypass_cache or (x_bypass_cache in ("1", "true", "True"))
    )
    return await CatalogService.list_products_by_category(
        conn_or_pool=pool,
        category_id=category_id,
        bypass_cache=should_bypass,
    )


@router.get("/products/{product_id}", response_model=ProductDetailOut)
async def get_product(
    product_id: int,
    bypass_cache: bool = Query(False, description="Отримати свіжі дані повз кеш (тільки персонал)"),
    x_bypass_cache: str | None = Header(None, alias="X-Bypass-Cache"),
    admin_token: str | None = Depends(admin_token_header),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримати повну картку страви з варіантами та групами модифікаторів."""
    should_bypass = bool(admin_token) and (
        bypass_cache or (x_bypass_cache in ("1", "true", "True"))
    )
    return await CatalogService.get_product_detail(
        conn_or_pool=pool,
        product_id=product_id,
        bypass_cache=should_bypass,
    )
