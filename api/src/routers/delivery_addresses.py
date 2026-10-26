import asyncpg
from fastapi import APIRouter, Depends, Query

from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.delivery_address import DeliveryAddressOut
from src.services.location_service import DeliveryAddressService

router = APIRouter(
    prefix="/api/delivery",
    tags=["delivery"],
    dependencies=[Depends(rate_limiter)],
)


@router.get("/cities", response_model=list[str])
async def list_delivery_cities(pool: asyncpg.Pool = Depends(get_pool)):
    """
    Список доступних населених пунктів для доставки.
    Публічний ендпоінт.
    """
    return await DeliveryAddressService.list_delivery_cities(conn_or_pool=pool)


@router.get("/addresses", response_model=list[DeliveryAddressOut])
async def list_active_delivery_addresses(
    city: str = Query(default="Київ", description="Населений пункт"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Список доступних вулиць/адрес для обраного населеного пункту.
    Повертає лише активні адреси (ті, що не в стоплисті).
    """
    return await DeliveryAddressService.list_active_addresses(
        conn_or_pool=pool,
        city=city,
    )
