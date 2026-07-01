from sqlalchemy.orm import Session
from app.voice.nlu import NluResult
from app.agents.safety import run_safety_check
from app.graph.crud import get_household

WRITE_INTENTS = {"ADD_MEMBER", "UPDATE_MEMBER", "UPDATE_MEDICATION", "LOG_SYMPTOM", "SET_REMINDER", "ASSIGN_CAREGIVER"}


def _interpreted_text(nlu: NluResult) -> str:
    entity_name = nlu.entity.name if nlu.entity else None
    m = nlu.member or "member"
    if nlu.intent == "DRUG_SAFETY_CHECK":
        return f"check if {entity_name or 'that drug'} is safe for {m}"
    if nlu.intent in ("UPDATE_MEDICATION", "ADD_MEMBER", "UPDATE_MEMBER"):
        return f"{nlu.action or 'update'} {entity_name or 'item'} for {m}"
    if nlu.intent == "LOG_SYMPTOM":
        return f"log symptom for {m}"
    if nlu.intent == "TRIAGE_CHECK":
        return f"triage check for {m}"
    if nlu.intent == "PATTERN_CHECK":
        return "check for household patterns"
    if nlu.intent == "HOUSEHOLD_STATUS":
        return "show family status"
    if nlu.intent == "GENERAL_HEALTH_Q":
        return "answer health question"
    if nlu.intent in ("SET_REMINDER", "ASSIGN_CAREGIVER"):
        return f"{nlu.intent.replace('_', ' ').lower()} for {m}"
    return nlu.intent.replace("_", " ").lower()


def _stub(title: str, spoken: str, detail: str, language: str, nlu: NluResult, actions=None) -> dict:
    return {
        "verdict": None,
        "spoken": spoken,
        "display": {
            "title": title,
            "conflict": None,
            "alternative": None,
            "detail": detail,
            "member": nlu.member,
            "interpreted": _interpreted_text(nlu),
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": actions or [],
        "member_focus": nlu.member,
        "language": language,
    }


def _refuse(spoken: str, language: str, nlu: NluResult) -> dict:
    return {
        "verdict": "REFUSE",
        "spoken": spoken,
        "display": {
            "title": "Not Understood",
            "conflict": None,
            "alternative": None,
            "detail": spoken,
            "member": None,
            "interpreted": _interpreted_text(nlu),
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": None,
        "language": language,
    }


def route(db: Session, household_id: int, nlu: NluResult, language: str) -> dict:
    intent = nlu.intent
    entity = nlu.entity

    # ── LIVE: Drug safety check ──────────────────────────────────────────────
    if intent == "DRUG_SAFETY_CHECK":
        drug = entity.name if entity else None
        if not drug:
            spoken = "কোন ওষুধের কথা বলছেন?" if language == "bn" else "Which medicine did you want to check?"
            return _refuse(spoken, language, nlu)
        dose = entity.dose if entity else None
        envelope = run_safety_check(db, household_id, nlu.member or "", drug, dose=dose, language=language)
        if isinstance(envelope, dict):
            envelope.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
        return envelope

    # ── LIVE: Profile writes with confirm-before-commit ──────────────────────
    if intent in ("ADD_MEMBER", "UPDATE_MEMBER", "UPDATE_MEDICATION", "LOG_SYMPTOM"):
        entity_name = entity.name if entity else "that"
        dose_hint = f" {entity.dose}" if (entity and entity.dose) else ""
        action = nlu.action or "add"
        m = nlu.member or "the member"
        if language == "bn":
            spoken = f"{m} এর জন্য {entity_name}{dose_hint} {action} করবো — নিশ্চিত করুন?"
        else:
            spoken = f"I'll {action} {entity_name}{dose_hint} for {m} — confirm?"
        detail = (f"This will {action} {entity_name}{dose_hint} for {m}. "
                  "Say 'yes' or tap Confirm to save.")
        return _stub("Confirm Action", spoken, detail, language, nlu,
                     actions=[{"type": "confirm_write", "label": "Confirm", "target": nlu.member}])

    # ── STUB: Triage — Step 11 ──────────────────────────────────────────────
    if intent == "TRIAGE_CHECK":
        spoken = "ট্রিয়াজ শীঘ্রই আসছে।" if language == "bn" else "Triage assessment is coming soon."
        return _stub("Triage Check", spoken, "(Triage Agent — Step 11)", language, nlu)

    # ── STUB: Pattern — Step 10 ─────────────────────────────────────────────
    if intent == "PATTERN_CHECK":
        spoken = "পরিবার প্যাটার্ন শীঘ্রই আসছে।" if language == "bn" else "Household pattern detection is coming soon."
        return _stub("Pattern Check", spoken, "(Pattern Agent — Step 10)", language, nlu)

    # ── STUB: Care — Step 12 ────────────────────────────────────────────────
    if intent in ("SET_REMINDER", "ASSIGN_CAREGIVER"):
        spoken = "রিমাইন্ডার শীঘ্রই আসছে।" if language == "bn" else "Reminders and caregiver features are coming soon."
        return _stub("Care", spoken, "(Care Agent — Step 12)", language, nlu)

    # ── STUB: Companion — Step 13 ───────────────────────────────────────────
    if intent == "GENERAL_HEALTH_Q":
        spoken = "সাধারণ প্রশ্নের উত্তর শীঘ্রই আসছে।" if language == "bn" else "General health Q&A is coming soon."
        return _stub("Health Question", spoken, "(Companion Agent — Step 13)", language, nlu)

    # ── HOUSEHOLD_STATUS: simple summary ────────────────────────────────────
    if intent == "HOUSEHOLD_STATUS":
        hh = get_household(db, household_id)
        count = len(hh.members) if hh else 0
        spoken = f"আপনার পরিবারে {count} জন সদস্য আছেন।" if language == "bn" else f"Your family has {count} members."
        return {
            "verdict": "INFO",
            "spoken": spoken,
            "display": {"title": "Family Status", "conflict": None, "alternative": None,
                        "detail": spoken, "member": None, "interpreted": _interpreted_text(nlu)},
            "evidence": {"source": None, "confidence": None, "grounding_score": None},
            "actions": [],
            "member_focus": None,
            "language": language,
        }

    # ── UNKNOWN fallback ────────────────────────────────────────────────────
    spoken = ("বুঝতে পারিনি — সদস্যের নাম আর ওষুধের নাম বলুন।" if language == "bn"
              else "I didn't catch that — try saying the member's name and the medicine.")
    return _refuse(spoken, language, nlu)
