from fastapi import APIRouter

from .analytics import router as analytics_router
from .broadcasts import router as broadcasts_router
from .categories import router as categories_router
from .delivery_addresses import router as delivery_addresses_router
from .locations_delivery import router as locations_delivery_router
from .managers import router as managers_router
from .me import router as me_router
from .option_groups import router as option_groups_router
from .orders import router as orders_router
from .products import router as products_router
from .upload import router as upload_router
from .users import router as users_router
from .variants import router as variants_router

router = APIRouter(prefix="/api/admin", tags=["admin"])

router.include_router(me_router)
router.include_router(upload_router)
router.include_router(managers_router)
router.include_router(categories_router)
router.include_router(products_router)
router.include_router(variants_router)
router.include_router(option_groups_router)
router.include_router(locations_delivery_router)
router.include_router(users_router)
router.include_router(orders_router)
router.include_router(delivery_addresses_router)
router.include_router(analytics_router)
router.include_router(broadcasts_router)
