from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.graph.database import get_db
from app.graph.models import Household
from app.voice.nlu import detect_bengali
from app.voice.pending import retrieve_pending, clear_pending
from app.agents.brain import run_brain
from app.agents.composer import compose
from app.agents.profile import run_profile_write
from app.agents.care import set_reminder_from_nlu
from app.agents.pattern import run_pattern_check
from app.spine.emergency import scan_red_flags, build_emergency_envelope
from app.memory.chat_store import save_turn, get_recent

_CARE_WRITE_INTENTS = {"SET_REMINDER"}

router = APIRouter(prefix="/voice", tags=["voice"])

DEFAULT_HOUSEHOLD_ID = 1  # Rahman Family from seed


def _get_household_id(db: Session) -> int:
    hh = db.query(Household).filter(Household.name == "Rahman Family").first()
    return hh.id if hh else DEFAULT_HOUSEHOLD_ID


class CommandRequest(BaseModel):
    transcript: str = Field(..., max_length=1000)
    language: Optional[str] = None


class ConfirmRequest(BaseModel):
    pending_id: str
    confirmed: bool


@router.post("/command")
def voice_command(req: CommandRequest, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    language = "bn" if (req.language == "bn" or detect_bengali(req.transcript)) else "en"

    # ── Recent turns → chat history for the brain (oldest→newest) ─────────────
    recent_turns = get_recent(db, household_id, limit=6)
    history = [
        {"role": t.role, "content": t.text}
        for t in reversed(recent_turns)
        if t.role in ("user", "assistant") and t.text
    ]

    # ── Hard emergency pre-filter (never trust the LLM to catch a red flag) ───
    red_flag = scan_red_flags(req.transcript or "")
    if red_flag:
        raw = build_emergency_envelope(db, household_id, red_flag, None, language)
    else:
        try:
            raw = run_brain(db, household_id, req.transcript, language, history=history)
        except Exception:
            return {
                "verdict": "REFUSE",
                "spoken": ("একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।" if language == "bn"
                           else "Something went wrong processing your request. Please try again."),
                "display": {"title": "Error", "conflict": None, "alternative": None,
                            "detail": "Internal error", "member": None, "interpreted": None},
                "evidence": {"source": None, "confidence": None, "grounding_score": None},
                "actions": [],
                "member_focus": None,
                "language": language,
            }

    envelope = compose(raw, interpreted=raw.get("display", {}).get("interpreted"))
    # The brain sets needs_confirmation/pending_id itself for prepare_* writes.
    envelope.setdefault("needs_confirmation", raw.get("needs_confirmation", False))
    if raw.get("pending_id"):
        envelope["pending_id"] = raw["pending_id"]

    try:
        save_turn(db=db, household_id=household_id, role="user",
                  text=req.transcript, language=language)
        save_turn(db=db, household_id=household_id, role="assistant",
                  text=envelope.get("spoken", ""), envelope=envelope,
                  intent=envelope.get("intent"), member_focus=envelope.get("member_focus"),
                  language=envelope.get("language", "en"))
    except Exception as e:
        print(f"Persistence error: {e}")

    return envelope



@router.get("/briefing")
def daily_briefing(db: Session = Depends(get_db)):
    """Deterministic daily family health snapshot — no LLM call, pure DB + pattern check."""
    from sqlalchemy.orm import joinedload
    from app.graph.models import Member as MemberModel

    household_id = _get_household_id(db)
    language = "en"

    members = (
        db.query(MemberModel)
        .options(
            joinedload(MemberModel.medications),
            joinedload(MemberModel.conditions),
            joinedload(MemberModel.allergies),
        )
        .filter(MemberModel.household_id == household_id)
        .all()
    )

    if not members:
        return {
            "verdict": "INFO",
            "spoken": "No family members on record yet. Add your family to get started.",
            "display": {
                "title": "Family Briefing",
                "conflict": None, "alternative": None,
                "detail": "Add family members to begin tracking.", "member": None,
                "interpreted": "daily briefing", "members": [],
            },
            "evidence": {"source": "Household records", "confidence": "HIGH", "grounding_score": 1.0},
            "actions": [], "member_focus": None, "language": language,
        }

    # Per-member watch flags
    watch_flags = []
    for m in members:
        flags = []
        if m.kidney_impaired:
            flags.append("kidney impairment — avoid NSAIDs")
        if m.liver_impaired:
            flags.append("liver impairment — check dosing")
        if m.allergies:
            subs = ", ".join(a.substance for a in m.allergies)
            flags.append(f"allergy to {subs}")
        if flags:
            watch_flags.append(f"{m.role_label}: {'; '.join(flags)}")

    # Household pattern check
    pattern = run_pattern_check(db, household_id, language)
    pattern_conflict = pattern["display"].get("conflict")
    pattern_members = pattern["display"].get("members", [])

    # Compose spoken summary
    total_meds = sum(len(m.medications) for m in members)
    parts = [f"Family health briefing: {len(members)} members, {total_meds} active medications."]
    if watch_flags:
        parts.append(f"Watch flags — {'; '.join(watch_flags[:2])}.")
    if pattern_conflict:
        parts.append(f"Pattern alert: {pattern_conflict}.")
    else:
        parts.append("No household patterns detected.")
    spoken = " ".join(parts)

    # Detail card (one bullet per member)
    detail_lines = []
    for m in members:
        meds_str = ", ".join(med.name for med in m.medications) or "no medications"
        detail_lines.append(f"• {m.role_label} ({m.age}y): {meds_str}")
    if watch_flags:
        detail_lines.append("")
        detail_lines.extend(f"⚠ {f}" for f in watch_flags)
    detail = "\n".join(detail_lines)

    return {
        "verdict": "CAUTION" if pattern_conflict else "INFO",
        "spoken": spoken,
        "display": {
            "title": "Daily Family Briefing",
            "conflict": pattern_conflict,
            "alternative": None,
            "detail": detail,
            "member": None,
            "interpreted": "daily briefing",
            "members": pattern_members,
        },
        "evidence": {
            "source": "Household records + pattern analysis",
            "confidence": "HIGH",
            "grounding_score": 1.0,
        },
        "actions": [],
        "member_focus": None,
        "language": language,
    }


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
    if nlu.intent in _CARE_WRITE_INTENTS:
        return set_reminder_from_nlu(db, household_id, nlu)
    return run_profile_write(db, household_id, nlu)
