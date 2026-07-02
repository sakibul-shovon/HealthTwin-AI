from fastapi import APIRouter
from app.api import household
from app.api import safety_test
from app.api import voice
from app.api import care
from app.api import chat
from app.config import settings

router = APIRouter()
router.include_router(household.router, prefix="/household", tags=["household"])
router.include_router(voice.router)
router.include_router(care.router)
router.include_router(chat.router)

if settings.DEBUG:
    router.include_router(safety_test.router)
