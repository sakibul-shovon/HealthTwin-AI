from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

from app.voice.notifications import get_notifications, clear_notifications
from app.agents.care import notify_caregiver_inapp

router = APIRouter(prefix="/care", tags=["care"])


class NotifyRequest(BaseModel):
    target: str = Field(..., max_length=100)
    message: str = Field(..., max_length=500)
    from_member: Optional[str] = "HealthTwin"
    language: Optional[str] = "en"


@router.post("/notify")
def care_notify(req: NotifyRequest):
    return notify_caregiver_inapp(
        target=req.target,
        message=req.message,
        from_label=req.from_member or "HealthTwin",
        language=req.language or "en",
    )


@router.get("/notifications")
def care_get_notifications():
    return {"notifications": get_notifications()}


@router.delete("/notifications")
def care_clear_notifications():
    clear_notifications()
    return {"cleared": True}
