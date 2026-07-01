from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.graph.database import get_db
from app.graph.models import Household
from app.voice.nlu import parse_command
from app.voice.pending import store_pending, retrieve_pending, clear_pending
from app.agents.router import route
from app.agents.composer import compose
from app.agents.profile import run_profile_write

router = APIRouter(prefix="/voice", tags=["voice"])

DEFAULT_HOUSEHOLD_ID = 1  # Rahman Family from seed


def _get_household_id(db: Session) -> int:
    hh = db.query(Household).filter(Household.name == "Rahman Family").first()
    return hh.id if hh else DEFAULT_HOUSEHOLD_ID


class CommandRequest(BaseModel):
    transcript: str
    language: Optional[str] = None


class ConfirmRequest(BaseModel):
    pending_id: str
    confirmed: bool


@router.post("/command")
def voice_command(req: CommandRequest, db: Session = Depends(get_db)):
    nlu = parse_command(req.transcript, language_hint=req.language)
    household_id = _get_household_id(db)

    raw = route(db, household_id, nlu, nlu.language)

    # Store pending write commands before composing
    pending_id = None
    if nlu.needs_confirmation:
        pending_id = store_pending(nlu)
        raw.setdefault("actions", [])
        # Patch existing confirm_write action with pending_id
        for action in raw["actions"]:
            if action.get("type") == "confirm_write":
                action["pending_id"] = pending_id
        raw["pending_id"] = pending_id
        raw["needs_confirmation"] = True

    envelope = compose(raw, interpreted=raw.get("display", {}).get("interpreted"))
    envelope["intent"] = nlu.intent
    envelope["needs_confirmation"] = nlu.needs_confirmation
    if pending_id:
        envelope["pending_id"] = pending_id

    return envelope


@router.post("/confirm")
def voice_confirm(req: ConfirmRequest, db: Session = Depends(get_db)):
    nlu = retrieve_pending(req.pending_id)
    if not nlu:
        raise HTTPException(status_code=404, detail="Pending command not found or already resolved")

    clear_pending(req.pending_id)

    if not req.confirmed:
        lang = nlu.language
        return {
            "verdict": "CANCELLED",
            "spoken": "Cancelled." if lang == "en" else "বাতিল করা হয়েছে।",
            "display": {"title": "Cancelled", "detail": "Command cancelled by user.",
                        "conflict": None, "alternative": None, "member": nlu.member, "interpreted": None},
            "evidence": {"source": None, "confidence": None, "grounding_score": None},
            "actions": [],
            "member_focus": None,
            "language": lang,
        }

    household_id = _get_household_id(db)
    return run_profile_write(db, household_id, nlu)
