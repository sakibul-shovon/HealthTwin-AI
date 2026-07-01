from fastapi import APIRouter
from app.api import household
from app.api import safety_test

router = APIRouter()
router.include_router(household.router, prefix="/household", tags=["household"])
router.include_router(safety_test.router)
