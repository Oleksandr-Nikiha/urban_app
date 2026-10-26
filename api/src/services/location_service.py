import asyncpg

from src.schemas.delivery_address import DeliveryAddressOut
from src.schemas.location import LocationOut
from src.services.cache import get_cached_json, set_cached_json


class LocationService:
    """Сервіс для роботи з локаціями/закладами мережі URBAN."""

    @staticmethod
    async def list_locations(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
        bypass_cache: bool = False,
    ) -> list[LocationOut]:
        cache_key = "catalog:locations"

        if not bypass_cache:
            cached = await get_cached_json(cache_key)
            if cached is not None:
                return [LocationOut(**item) for item in cached]

        query = """
            SELECT id, name, address, phones,
                   is_delivery_enabled,
                   to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
                   to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
            FROM locations
            ORDER BY id
        """
        rows = await conn_or_pool.fetch(query)
        result = [LocationOut(**dict(row)) for row in rows]

        if not bypass_cache:
            await set_cached_json(cache_key, [r.model_dump(mode="json") for r in result])

        return result


class DeliveryAddressService:
    """Сервіс для роботи з довідником населених пунктів та вулиць доставки."""

    @staticmethod
    async def list_delivery_cities(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
    ) -> list[str]:
        query = """
            SELECT DISTINCT city
            FROM delivery_addresses
            WHERE is_active = true
            ORDER BY city
        """
        rows = await conn_or_pool.fetch(query)
        cities = [r["city"] for r in rows]
        return cities if cities else ["Київ"]

    @staticmethod
    async def list_active_addresses(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
        city: str = "Київ",
    ) -> list[DeliveryAddressOut]:
        query = """
            SELECT id, city, street
            FROM delivery_addresses
            WHERE lower(city) = lower($1) AND is_active = true
            ORDER BY sort_order ASC, street ASC
        """
        rows = await conn_or_pool.fetch(query, city.strip())
        return [DeliveryAddressOut(**dict(r)) for r in rows]
