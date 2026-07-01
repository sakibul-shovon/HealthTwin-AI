from fastapi import APIRouter
from app.api import household

router = APIRouter()
router.include_router(household.router, prefix="/household", tags=["household"])
