from fastapi import APIRouter
from app.api import household
from app.api import safety_test
from app.api import voice
from app.api import care
from app.api import chat
from app.api import emergency
from app.api import member
from app.api import tts
from app.config import settings

from app.api import upload
from app.api import reports
from app.api import insights

router = APIRouter()
router.include_router(household.router, prefix="/household", tags=["household"])
router.include_router(voice.router)
router.include_router(tts.router)
router.include_router(care.router)
router.include_router(chat.router)
router.include_router(emergency.router)
router.include_router(member.router)
router.include_router(upload.router, prefix="/upload", tags=["upload"])
router.include_router(reports.router)
router.include_router(insights.router, prefix="/ai/insights", tags=["insights"])

if settings.DEBUG:
    router.include_router(safety_test.router)
