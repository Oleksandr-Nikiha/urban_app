import asyncpg
from fastapi import APIRouter, Depends, Header, Query

from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.location import LocationOut
from src.services.location_service import LocationService

router = APIRouter(
    prefix="/api",
    tags=["locations"],
    dependencies=[Depends(rate_limiter)],
)


@router.get("/locations", response_model=list[LocationOut])
async def list_locations(
    bypass_cache: bool = Query(False, description="Отримати свіжі дані повз кеш"),
    x_bypass_cache: str | None = Header(None, alias="X-Bypass-Cache"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Список закладів для вкладки «Контакти».
    Публічний ендпоінт — не потребує initData, бо контакти доступні всім.
    """
    should_bypass = bypass_cache or (x_bypass_cache in ("1", "true", "True"))
    return await LocationService.list_locations(
        conn_or_pool=pool,
        bypass_cache=should_bypass,
    )
