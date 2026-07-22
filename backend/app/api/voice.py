from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.graph.database import get_db
from app.voice.nlu import detect_bengali
from app.voice.pending import retrieve_pending, clear_pending
from app.agents.brain import run_brain
from app.agents.composer import compose
from app.agents.profile import run_profile_write
from app.agents.care import set_reminder_from_nlu
from app.agents.pattern import run_pattern_check
from app.spine.emergency import scan_red_flags, build_emergency_envelope
from app.memory.chat_store import save_turn, get_recent
from app.core.auth import get_current_household_id

_CARE_WRITE_INTENTS = {"SET_REMINDER"}

_MEMBER_ALIASES: dict[str, str] = {
    "baba": "Baba", "father": "Baba", "dad": "Baba", "বাবা": "Baba", "আব্বা": "Baba", "আব্বু": "Baba",
    "ma": "Ma", "mom": "Ma", "mother": "Ma", "mum": "Ma", "mama": "Ma", "মা": "Ma", "আম্মা": "Ma", "আম্মু": "Ma",
    "child": "Child", "son": "Child", "daughter": "Child", "kid": "Child", "ছেলে": "Child", "মেয়ে": "Child",
    "self": "Self", "me": "Self", "myself": "Self", "আমি": "Self",
}

def _extract_member_from_transcript(transcript: str, db: "Session", household_id: int) -> Optional[str]:
    """Scan transcript for member alias words; return role_label if found."""
    from app.graph.crud import resolve_member
    lower = transcript.lower()
    for alias, role_label in _MEMBER_ALIASES.items():
        if alias in lower:
            m = resolve_member(db, household_id, alias)
            if m:
                return m.role_label
    return None

router = APIRouter(prefix="/voice", tags=["voice"])


class CommandRequest(BaseModel):
    transcript: str = Field(..., max_length=1000)
    language: Optional[str] = None
    session_id: Optional[int] = None
    member_focus: Optional[list[str]] = None


class ConfirmRequest(BaseModel):
    pending_id: str
    confirmed: bool


@router.post("/command")
def voice_command(
    req: CommandRequest,
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    language = "bn" if (req.language == "bn" or detect_bengali(req.transcript)) else "en"

    recent_turns = get_recent(db, household_id, limit=20, session_id=req.session_id)
    history = [
        {"role": t.role, "content": t.text}
        for t in recent_turns
        if t.role in ("user", "assistant") and t.text
    ]

    red_flag = scan_red_flags(req.transcript or "")
    if red_flag:
        member_ref = _extract_member_from_transcript(req.transcript or "", db, household_id)
        raw = build_emergency_envelope(db, household_id, red_flag, member_ref, language)
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
    envelope.setdefault("needs_confirmation", raw.get("needs_confirmation", False))
    if raw.get("pending_id"):
        envelope["pending_id"] = raw["pending_id"]

    try:
        save_turn(db=db, household_id=household_id, role="user",
                  text=req.transcript, language=language, session_id=req.session_id)
        save_turn(db=db, household_id=household_id, role="assistant",
                  text=envelope.get("spoken", ""), envelope=envelope,
                  intent=envelope.get("intent"), member_focus=envelope.get("member_focus"),
                  language=envelope.get("language", "en"), session_id=req.session_id)
        if req.session_id:
            from app.memory.chat_store import touch_session
            touch_session(db, req.session_id)
    except Exception as e:
        print(f"Persistence error: {e}")

    return envelope


@router.get("/briefing")
def daily_briefing(
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    from sqlalchemy.orm import joinedload
    from app.graph.models import Member as MemberModel

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

    pattern = run_pattern_check(db, household_id, language)
    pattern_conflict = pattern["display"].get("conflict")
    pattern_members = pattern["display"].get("members", [])

    total_meds = sum(len(m.medications) for m in members)
    parts = [f"Family health briefing: {len(members)} members, {total_meds} active medications."]
    if watch_flags:
        parts.append(f"Watch flags — {'; '.join(watch_flags[:2])}.")
    if pattern_conflict:
        parts.append(f"Pattern alert: {pattern_conflict}.")
    else:
        parts.append("No household patterns detected.")
    spoken = " ".join(parts)

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
def voice_confirm(
    req: ConfirmRequest,
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
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

    if nlu.intent in _CARE_WRITE_INTENTS:
        return set_reminder_from_nlu(db, household_id, nlu)
    return run_profile_write(db, household_id, nlu)
