from sqlalchemy.orm import Session
from app.voice.nlu import NluResult
from app.agents.safety import run_safety_check
from app.agents.pattern import run_pattern_check
from app.agents.triage import run_triage
from app.agents.care import query_caregiver
from app.agents.companion import run_companion
from app.graph.crud import get_household
from app.graph.models import Member
from app.spine.emergency import scan_red_flags, build_emergency_envelope

WRITE_INTENTS = {"ADD_MEMBER", "UPDATE_MEMBER", "UPDATE_MEDICATION", "LOG_SYMPTOM", "SET_REMINDER", "ASSIGN_CAREGIVER"}

# Words in a transcript that map to a household role_label
_MEMBER_ALIASES: dict[str, str] = {
    "baba": "Baba", "father": "Baba", "dad": "Baba",
    "বাবা": "Baba", "আব্বা": "Baba", "আব্বু": "Baba",
    "ma": "Ma", "mom": "Ma", "mum": "Ma", "mother": "Ma", "mama": "Ma",
    "মা": "Ma", "আম্মা": "Ma", "আম্মু": "Ma",
    "child": "Child", "son": "Child", "daughter": "Child", "kid": "Child",
    "ছেলে": "Child", "মেয়ে": "Child",
    "self": "Self", "me": "Self", "myself": "Self",
    "আমি": "Self",
}


def _extract_members_from_text(text: str) -> list[str]:
    """Return all unique role_labels found as whole words in the text (excludes common pronouns)."""
    import re
    _SKIP = {"me", "my", "myself"}  # too common as English pronouns
    lower = text.lower()
    found: list[str] = []
    seen: set[str] = set()
    for alias, label in _MEMBER_ALIASES.items():
        if alias in _SKIP:
            continue
        if re.search(r'\b' + re.escape(alias) + r'\b', lower) and label not in seen:
            found.append(label)
            seen.add(label)
    return found


def _build_member_context(db: Session, household_id: int, role_labels: list[str]) -> str:
    """Fetch member profiles from DB and format them as LLM context (eager-loads relationships)."""
    from sqlalchemy.orm import joinedload
    from app.graph.models import Medication, Condition
    lines = []
    for label in role_labels:
        m = (
            db.query(Member)
            .options(joinedload(Member.medications), joinedload(Member.conditions))
            .filter(Member.household_id == household_id, Member.role_label.ilike(label))
            .first()
        )
        if not m:
            continue
        meds = ", ".join(f"{med.name} {med.dose}" for med in m.medications) or "none"
        conditions = ", ".join(c.name for c in m.conditions) or "none"
        flags = [f for f, v in [("kidney impaired", m.kidney_impaired),
                                  ("liver impaired", m.liver_impaired),
                                  ("pregnant", m.pregnant)] if v]
        line = f"- {m.role_label} ({m.display_name}), age {m.age}: conditions={conditions}; meds={meds}"
        if flags:
            line += f"; flags={', '.join(flags)}"
        lines.append(line)
    return "\n".join(lines)


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


_TRIAGE_SECONDARY_KEYWORDS = {
    "fever", "pain", "breath", "chest", "dizzy", "nausea", "vomiting",
    "headache", "rash", "swelling", "জ্বর", "ব্যথা", "শ্বাস",
}
_DRUG_SECONDARY_KEYWORDS = {
    "ibuprofen", "aspirin", "paracetamol", "warfarin", "metformin",
    "amlodipine", "medicine", "medication", "drug", "tablet", "ওষুধ",
}


def _secondary_intent(transcript: str, primary: str) -> str | None:
    lower = transcript.lower()
    if primary == "DRUG_SAFETY_CHECK" and any(k in lower for k in _TRIAGE_SECONDARY_KEYWORDS):
        return "TRIAGE_CHECK"
    if primary == "TRIAGE_CHECK" and any(k in lower for k in _DRUG_SECONDARY_KEYWORDS):
        return "DRUG_SAFETY_CHECK"
    return None


def _merge_responses(primary: dict, secondary: dict, language: str) -> dict:
    _SEVERITY = {"EMERGENCY": 5, "UNSAFE": 4, "CAUTION": 3, "REFUSE": 2, "SAFE": 1, "INFO": 0}
    p = _SEVERITY.get(primary.get("verdict", "INFO"), 0)
    s = _SEVERITY.get(secondary.get("verdict", "INFO"), 0)
    dominant, sub = (secondary, primary) if s > p else (primary, secondary)
    sub_spoken = sub.get("spoken", "")
    combined = dominant.get("spoken", "")
    if sub_spoken and sub_spoken not in combined:
        sep = " — আরও: " if language == "bn" else " — Also: "
        combined = combined + sep + sub_spoken
    return {**dominant, "spoken": combined}


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


def _clarify(title: str, spoken: str, detail: str, language: str, nlu: NluResult) -> dict:
    return {
        "verdict": "CLARIFY",
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
        "actions": [],
        "member_focus": nlu.member,
        "language": language,
    }

def route(db: Session, household_id: int, nlu: NluResult, language: str, is_followup: bool = False) -> dict:
    intent = nlu.intent
    entity = nlu.entity

    # ── Cross-cutting emergency pre-filter ───────────────────────────────────
    # Runs before any intent dispatch — catches red flags regardless of intent.
    red_flag = scan_red_flags(nlu.raw_transcript or "")
    if red_flag:
        return build_emergency_envelope(db, household_id, red_flag, nlu.member, language)

    secondary = _secondary_intent(nlu.raw_transcript or "", intent)

    if not is_followup and nlu.confidence < 0.6:
        spoken = "আপনি কী বলেছেন তা আমি ঠিক বুঝতে পারিনি। দয়া করে আবার বলবেন?" if language == "bn" else "I didn't quite catch that. Could you clarify?"
        return _clarify("Needs Clarification", spoken, "Confidence low. Please rephrase.", language, nlu)

    # ── LIVE: Drug safety check ──────────────────────────────────────────────
    if intent == "DRUG_SAFETY_CHECK":
        drug = entity.name if entity else None
        if not drug:
            spoken = "কোন ওষুধের কথা বলছেন?" if language == "bn" else "Which medicine did you want to check?"
            return _refuse(spoken, language, nlu)
        # No member specified → general drug question, route to Companion
        if not nlu.member:
            question = nlu.raw_transcript or f"Is {drug} safe?"
            result = run_companion(db, household_id, question, language, member_id=None)
            result.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
            return result
        dose = entity.dose if entity else None
        envelope = run_safety_check(db, household_id, nlu.member, drug, dose=dose, language=language)
        if isinstance(envelope, dict):
            envelope.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
        if secondary == "TRIAGE_CHECK":
            symptom_text = nlu.raw_transcript or ""
            triage_result = run_triage(db, household_id, nlu.member or "", symptom_text, language=language)
            envelope = _merge_responses(envelope, triage_result, language)
        return envelope

    # ── LIVE: Profile writes with confirm-before-commit ──────────────────────
    if intent in ("ADD_MEMBER", "UPDATE_MEMBER", "UPDATE_MEDICATION", "LOG_SYMPTOM"):
        if intent != "ADD_MEMBER" and not nlu.member and not is_followup:
            spoken = "এটি কার জন্য?" if language == "bn" else "Who is this for?"
            return _clarify("Missing Member", spoken, "Please specify who this is for.", language, nlu)
            
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

    # ── LIVE: Triage Agent ───────────────────────────────────────────────────
    if intent == "TRIAGE_CHECK":
        if not nlu.member and not is_followup:
            spoken = "কার জন্য লক্ষণ চেক করতে চান?" if language == "bn" else "Who is experiencing these symptoms?"
            return _clarify("Missing Member", spoken, "Please specify who this is for.", language, nlu)
            
        symptom_text = " ".join(filter(None, [
            entity.name if entity else None,
            entity.value if entity else None,
            nlu.raw_transcript
        ])).strip()
        
        if ("fever" in symptom_text.lower() or "জ্বর" in symptom_text) and not is_followup:
            import re
            if not re.search(r'\d+', symptom_text):
                spoken = "জ্বর কত এবং কতক্ষণ ধরে?" if language == "bn" else "How high is the fever, and since when?"
                return _clarify("Missing Details", spoken, "Please provide temperature and duration.", language, nlu)

        result = run_triage(db, household_id, nlu.member or "", symptom_text, language=language)
        result.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
        if secondary == "DRUG_SAFETY_CHECK" and entity and entity.name and nlu.member:
            safety_result = run_safety_check(db, household_id, nlu.member, entity.name, language=language)
            result = _merge_responses(result, safety_result, language)
        return result

    # ── LIVE: Pattern Agent ──────────────────────────────────────────────────
    if intent == "PATTERN_CHECK":
        result = run_pattern_check(db, household_id, language, trigger_member=nlu.member)
        result.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
        return result

    # ── LIVE: Care Agent ─────────────────────────────────────────────────────
    if intent == "ASSIGN_CAREGIVER":
        # Query-only path (no entity name = asking who cares for member)
        result = query_caregiver(db, household_id, nlu.member or "", language)
        result.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
        return result

    if intent == "SET_REMINDER":
        if not nlu.member and not is_followup:
            spoken = "এটি কার জন্য?" if language == "bn" else "Who is this for?"
            return _clarify("Missing Member", spoken, "Please specify who this is for.", language, nlu)
            
        entity_name = entity.name if entity else "medication"
        time_hint = entity.value if entity else ""
        m = nlu.member or "the member"
        if language == "bn":
            spoken = f"{m} এর {entity_name} এর জন্য {time_hint} রিমাইন্ডার সেট করবো — নিশ্চিত করুন?"
        else:
            spoken = f"I'll set a reminder for {m} to take {entity_name}" + (f" at {time_hint}" if time_hint else "") + " — confirm?"
        detail = f"This will create a daily reminder for {m}: {entity_name}" + (f" at {time_hint}." if time_hint else ".")
        return _stub("Confirm Reminder", spoken, detail, language, nlu,
                     actions=[{"type": "confirm_write", "label": "Set Reminder", "target": nlu.member}])

    # ── LIVE: Companion Agent ────────────────────────────────────────────────
    if intent == "GENERAL_HEALTH_Q":
        question = nlu.raw_transcript or (
            ((entity.name or "") + " " + (entity.value or "")).strip() if entity else ""
        ) or "health question"

        # Inject household member profiles as LLM context when members are mentioned
        candidates = ([nlu.member] if nlu.member else []) or _extract_members_from_text(nlu.raw_transcript or "")
        ctx = _build_member_context(db, household_id, candidates) if candidates else ""
        
        target_member_id = None
        if candidates:
            target_m = db.query(Member).filter(Member.household_id == household_id, Member.role_label.ilike(candidates[0])).first()
            if target_m:
                target_member_id = target_m.id

        result = run_companion(db, household_id, question, language, member_context=ctx, member_id=target_member_id)
        result.setdefault("display", {})["interpreted"] = _interpreted_text(nlu)
        if result.get("verdict") == "REFUSE":
            spoken = (
                "আমি HealthTwin — আপনার পারিবারিক স্বাস্থ্য সহকারী। "
                "জিজ্ঞেস করুন: ওষুধ নিরাপদ কিনা, উপসর্গ, বা পারিবারিক স্বাস্থ্য প্যাটার্ন।"
            ) if language == "bn" else (
                "I'm HealthTwin, your family health assistant. "
                "Try: 'Is ibuprofen safe for Baba?', 'Check for household patterns', "
                "or 'Is paracetamol safe for children?'"
            )
            return {
                "verdict": "INFO",
                "spoken": spoken,
                "display": {"title": "HealthTwin Assistant", "conflict": None,
                            "alternative": None, "detail": spoken, "member": None,
                            "interpreted": question},
                "evidence": {"source": None, "confidence": None, "grounding_score": None},
                "actions": [], "member_focus": None, "language": language,
            }
        return result

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

    # ── UNKNOWN fallback: Companion with member context → friendly intro ─────
    question = nlu.raw_transcript or ""

    if question.strip():
        candidates = ([nlu.member] if nlu.member else []) or _extract_members_from_text(question)
        ctx = _build_member_context(db, household_id, candidates) if candidates else ""
        
        target_member_id = None
        if candidates:
            target_m = db.query(Member).filter(Member.household_id == household_id, Member.role_label.ilike(candidates[0])).first()
            if target_m:
                target_member_id = target_m.id
                
        result = run_companion(db, household_id, question, language, member_context=ctx, member_id=target_member_id)
        if result.get("verdict") != "REFUSE":
            result.setdefault("display", {})["interpreted"] = question
            return result

    # Truly unknown — return a helpful intro instead of a cryptic error
    if language == "bn":
        spoken = (
            "আমি HealthTwin — আপনার পারিবারিক স্বাস্থ্য সহকারী। "
            "আমাকে জিজ্ঞেস করুন: ওষুধ নিরাপদ কিনা, উপসর্গ কেমন, "
            "বা পরিবারের কোনো সদস্যের জন্য কী করা উচিত।"
        )
    else:
        spoken = (
            "I'm HealthTwin, your family health assistant. "
            "Try asking: 'Is ibuprofen safe for Baba?', "
            "'Check for household patterns', or 'Who is Baba's caregiver?'"
        )
    return {
        "verdict": "INFO",
        "spoken": spoken,
        "display": {
            "title": "HealthTwin Assistant",
            "conflict": None,
            "alternative": None,
            "detail": spoken,
            "member": None,
            "interpreted": nlu.raw_transcript or "",
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": None,
        "language": language,
    }
