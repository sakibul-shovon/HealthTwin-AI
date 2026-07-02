from fastapi import APIRouter
from app.api import household
from app.api import safety_test
from app.api import voice
from app.api import care

router = APIRouter()
router.include_router(household.router, prefix="/household", tags=["household"])
router.include_router(safety_test.router)
router.include_router(voice.router)
router.include_router(care.router)
