from sqlalchemy.orm import Session
from app.voice.nlu import NluResult
from app.graph.crud import (
    resolve_member,
    add_member,
    add_medication,
    add_condition,
    log_symptom,
    update_member_flags,
    remove_member,
    remove_medication,
    remove_condition,
    remove_allergy,
    rename_member,
    merge_members,
)

# Condition names that map to boolean flags on Member
_FLAG_MAP: dict[str, str] = {
    "kidney disease": "kidney_impaired",
    "kidney impairment": "kidney_impaired",
    "kidney failure": "kidney_impaired",
    "chronic kidney disease": "kidney_impaired",
    "ckd": "kidney_impaired",
    "liver disease": "liver_impaired",
    "liver failure": "liver_impaired",
    "liver impairment": "liver_impaired",
    "cirrhosis": "liver_impaired",
    "pregnant": "pregnant",
    "pregnancy": "pregnant",
}


def run_profile_write(db: Session, household_id: int, nlu: NluResult) -> dict:
    intent = nlu.intent
    lang = nlu.language
    member_label = nlu.member or ""
    entity = nlu.entity
    entity_name = entity.name if entity else None
    entity_dose = entity.dose if entity else None
    entity_type = entity.type if entity else None
    entity_value = entity.value if entity else None

    # ── ADD_MEMBER ───────────────────────────────────────────────────────────
    if intent == "ADD_MEMBER":
        age = 0
        try:
            age = int(entity_value or 0)
        except (ValueError, TypeError):
            pass
        role = entity_name or "New Member"
        add_member(db, household_id, {
            "display_name": role,
            "role_label": role,
            "age": age,
            "sex": "unknown",
        })
        spoken = _bi(lang,
            bn=f"{role} পরিবারে যোগ হয়েছে।",
            en=f"{role} has been added to the family.")
        detail = f"Added {role}" + (f", age {age}" if age else "") + " to household."
        return _confirmed(spoken, lang, role, detail, household_refresh=True)

    # ── Resolve member for remaining intents ─────────────────────────────────
    member = resolve_member(db, household_id, member_label)
    if not member:
        spoken = _bi(lang,
            bn=f"'{member_label}' নামে কোনো সদস্য পাওয়া যায়নি।",
            en=f"Couldn't find member '{member_label}'.")
        return _error(spoken, lang, member_label)

    # ── REMOVE_MEMBER ────────────────────────────────────────────────────────
    if intent == "REMOVE_MEMBER":
        remove_member(db, member.id)
        spoken = _bi(lang,
            bn=f"{member.role_label} কে পরিবার থেকে মুছে ফেলা হয়েছে।",
            en=f"{member.role_label} has been removed from the family.")
        return _confirmed(spoken, lang, None, f"Removed {member.role_label}.", household_refresh=True)

    # ── MERGE_MEMBERS ────────────────────────────────────────────────────────
    if intent == "MERGE_MEMBERS":
        # we expect entity.value to be the keep_member's label (or vice versa).
        # We will assume nlu.member is the one to KEEP and entity.name is the one to REMOVE.
        remove_label = entity_name
        remove_m = resolve_member(db, household_id, remove_label or "")
        if remove_m:
            merge_members(db, member.id, remove_m.id)
            spoken = _bi(lang,
                bn=f"{remove_m.role_label} কে {member.role_label} এর সাথে মার্জ করা হয়েছে।",
                en=f"Merged {remove_m.role_label} into {member.role_label}.")
            return _confirmed(spoken, lang, member.role_label, f"Merged {remove_m.role_label} into {member.role_label}.", household_refresh=True)
        else:
            return _error(_bi(lang, "সদস্য পাওয়া যায়নি।", "Member to merge not found."), lang, member.role_label)

    # ── UPDATE_MEDICATION ────────────────────────────────────────────────────
    if intent == "UPDATE_MEDICATION":
        drug = entity_name or "medication"
        dose = entity_dose or "—"
        if nlu.action == "remove":
            remove_medication(db, member.id, drug)
            spoken = _bi(lang,
                bn=f"{member.role_label} এর তালিকা থেকে {drug} মুছে ফেলা হয়েছে।",
                en=f"Removed {drug} from {member.role_label}'s medications.")
            return _confirmed(spoken, lang, member.role_label, f"Removed {drug} from {member.role_label}.", household_refresh=True)
        else:
            add_medication(db, member.id, drug, dose)
            spoken = _bi(lang,
                bn=f"{member.role_label} এর জন্য {drug} {dose} যোগ করা হয়েছে।",
                en=f"{drug} {dose} added to {member.role_label}'s medications.")
            return _confirmed(spoken, lang, member.role_label,
                              f"Added {drug} {dose} to {member.role_label}.",
                              household_refresh=True)

    # ── LOG_SYMPTOM ──────────────────────────────────────────────────────────
    if intent == "LOG_SYMPTOM":
        symptom = entity_name or entity_value or "symptom"
        log_symptom(db, member.id, symptom)
        spoken = _bi(lang,
            bn=f"{member.role_label} এর {symptom} রেকর্ড করা হয়েছে।",
            en=f"Logged {symptom} for {member.role_label}.")
        return _confirmed(spoken, lang, member.role_label,
                          f"Logged symptom '{symptom}' for {member.role_label}.")

    # ── UPDATE_MEMBER ────────────────────────────────────────────────────────
    if intent == "UPDATE_MEMBER":
        if nlu.action == "remove":
            if entity_type == "condition" and entity_name:
                remove_condition(db, member.id, entity_name)
                spoken = _bi(lang, bn=f"{entity_name} মুছে ফেলা হয়েছে।", en=f"Removed condition {entity_name}.")
            elif entity_type == "allergy" and entity_name:
                remove_allergy(db, member.id, entity_name)
                spoken = _bi(lang, bn=f"{entity_name} অ্যালার্জি মুছে ফেলা হয়েছে।", en=f"Removed allergy {entity_name}.")
            else:
                spoken = _bi(lang, bn="কী মুছে ফেলব বুঝতে পারিনি।", en="Not sure what to remove.")
            return _confirmed(spoken, lang, member.role_label, spoken, household_refresh=True)
            
        if nlu.action == "rename":
            rename_member(db, member.id, display_name=entity_value)
            spoken = _bi(lang, bn="নাম পরিবর্তন করা হয়েছে।", en="Name changed.")
            return _confirmed(spoken, lang, member.role_label, spoken, household_refresh=True)

        cond_lower = (entity_name or "").lower().strip()
        flag_key = _FLAG_MAP.get(cond_lower)
        if flag_key:
            update_member_flags(db, member.id, **{flag_key: True})
            spoken = _bi(lang,
                bn=f"{member.role_label} এর {entity_name} আপডেট করা হয়েছে।",
                en=f"Updated {member.role_label}'s health profile: {entity_name}.")
        elif entity_type == "condition" and entity_name:
            add_condition(db, member.id, entity_name)
            spoken = _bi(lang,
                bn=f"{member.role_label} এর জন্য {entity_name} যোগ করা হয়েছে।",
                en=f"Added condition '{entity_name}' for {member.role_label}.")
        elif entity_type == "allergy" and entity_name:
            add_allergy(db, member.id, entity_name)
            spoken = _bi(lang,
                bn=f"{member.role_label} এর {entity_name} অ্যালার্জি যোগ করা হয়েছে।",
                en=f"Added allergy '{entity_name}' for {member.role_label}.")
        else:
            spoken = _bi(lang,
                bn=f"{member.role_label} এর তথ্য আপডেট করা হয়েছে।",
                en=f"{member.role_label}'s profile updated.")
        return _confirmed(spoken, lang, member.role_label,
                          f"Updated {member.role_label}.",
                          household_refresh=True)

    spoken = _bi(lang,
        bn="এই লেখার কাজটি এখনো সমর্থিত নয়।",
        en="This write action is not yet supported.")
    return _error(spoken, lang, member_label)


def _bi(lang: str, bn: str, en: str) -> str:
    return bn if lang == "bn" else en


def _confirmed(spoken: str, lang: str, member: str | None,
               detail: str, household_refresh: bool = False) -> dict:
    result: dict = {
        "verdict": "CONFIRMED",
        "spoken": spoken,
        "display": {
            "title": "Done",
            "conflict": None,
            "alternative": None,
            "detail": detail,
            "member": member,
            "interpreted": None,
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": member,
        "language": lang,
    }
    if household_refresh:
        result["household_refresh"] = True
    return result


def _error(spoken: str, lang: str, member: str | None) -> dict:
    return {
        "verdict": "REFUSE",
        "spoken": spoken,
        "display": {
            "title": "Write Failed",
            "conflict": None,
            "alternative": None,
            "detail": spoken,
            "member": member,
            "interpreted": None,
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": member,
        "language": lang,
    }
