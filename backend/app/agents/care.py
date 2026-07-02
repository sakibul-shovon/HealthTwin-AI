"""
Care Agent — medication reminders and caregiver coordination.

SET_REMINDER  → write (goes through confirm flow), creates Reminder row
ASSIGN_CAREGIVER (query) → reads caregiver edge, answers who cares for whom
notify_caregiver → adds an in-app notification (no SMS/push in demo)
"""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy.orm import Session

from app.graph import models
from app.graph.crud import resolve_member
from app.voice.nlu import NluResult


# ── Time normalisation ────────────────────────────────────────────────────────

def _normalise_time(raw: str) -> str:
    """Convert '9 PM', '9:00 PM', '21:00' → '21:00'; keep unknown as-is."""
    if not raw:
        return "—"
    raw = raw.strip()
    # HH:MM already
    if re.match(r"^\d{1,2}:\d{2}$", raw):
        return raw
    # 12-hour: "9 PM", "9:30 AM"
    m = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)", raw, re.IGNORECASE)
    if m:
        hour = int(m.group(1))
        mins = int(m.group(2) or 0)
        period = m.group(3).upper()
        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{mins:02d}"
    # plain hour number e.g. "9" — ambiguous, just return as label
    return raw


# ── SET_REMINDER ─────────────────────────────────────────────────────────────

def set_reminder_from_nlu(db: Session, household_id: int, nlu: NluResult) -> dict:
    lang = nlu.language
    member_ref = nlu.member or ""
    entity = nlu.entity

    member = resolve_member(db, household_id, member_ref)
    if not member:
        spoken = (f"'{member_ref}' নামে কোনো সদস্য পাওয়া যায়নি।" if lang == "bn"
                  else f"Couldn't find member '{member_ref}'.")
        return _error(spoken, lang, member_ref)

    medication_name = entity.name if entity else "medication"
    raw_time = entity.value if entity else ""
    time_str = _normalise_time(raw_time) if raw_time else "daily"
    repeat_rule = "daily"

    # Link to existing medication if name matches
    medication_id: Optional[int] = None
    for med in member.medications:
        if medication_name and med.name.lower() == medication_name.lower():
            medication_id = med.id
            break

    reminder = models.Reminder(
        member_id=member.id,
        medication_id=medication_id,
        time=time_str,
        repeat_rule=repeat_rule,
        active=True,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    if lang == "bn":
        spoken = f"{member.role_label} এর {medication_name} এর জন্য {time_str} রিমাইন্ডার সেট করা হয়েছে।"
    else:
        spoken = f"Reminder set for {member.role_label} to take {medication_name} at {time_str} ({repeat_rule})."

    return {
        "verdict": "CONFIRMED",
        "spoken": spoken,
        "display": {
            "title": "Reminder Set",
            "conflict": None,
            "alternative": None,
            "detail": f"{member.role_label} · {medication_name} · {time_str} · {repeat_rule}",
            "member": member.role_label,
            "interpreted": f"set reminder for {member.role_label}",
            "urgency": None,
            "members": [],
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": member.role_label,
        "language": lang,
        "household_refresh": True,
    }


# ── ASSIGN_CAREGIVER (query) ─────────────────────────────────────────────────

def query_caregiver(db: Session, household_id: int, member_ref: str, language: str) -> dict:
    lang = language
    member = resolve_member(db, household_id, member_ref)
    if not member:
        spoken = (f"'{member_ref}' নামে সদস্য পাওয়া যায়নি।" if lang == "bn"
                  else f"Couldn't find member '{member_ref}'.")
        return _error(spoken, lang, member_ref)

    # Find who cares FOR this member (to_member = this member, caregiver = True)
    rel = (
        db.query(models.Relationship)
        .filter(
            models.Relationship.to_member_id == member.id,
            models.Relationship.caregiver == True,
        )
        .first()
    )

    if rel:
        caregiver = db.query(models.Member).filter(models.Member.id == rel.from_member_id).first()
        cname = caregiver.role_label if caregiver else "Unknown"
        if lang == "bn":
            spoken = f"{cname}, {member.role_label} এর যত্নশীল।"
            detail = f"পরিবারের গ্রাফ অনুযায়ী {cname}, {member.role_label} এর দায়িত্বশীল ব্যক্তি।"
        else:
            spoken = f"{cname} is {member.role_label}'s caregiver."
            detail = f"According to the family graph, {cname} is designated as {member.role_label}'s caregiver."
    else:
        # Try: is this member someone's caregiver?
        rel_out = (
            db.query(models.Relationship)
            .filter(
                models.Relationship.from_member_id == member.id,
                models.Relationship.caregiver == True,
            )
            .first()
        )
        if rel_out:
            target = db.query(models.Member).filter(models.Member.id == rel_out.to_member_id).first()
            tname = target.role_label if target else "another member"
            if lang == "bn":
                spoken = f"{member.role_label}, {tname} এর যত্নশীল।"
                detail = spoken
            else:
                spoken = f"{member.role_label} is {tname}'s caregiver."
                detail = spoken
        else:
            if lang == "bn":
                spoken = f"{member.role_label} এর জন্য কোনো যত্নশীল ব্যক্তি নেই।"
            else:
                spoken = f"No caregiver is assigned for {member.role_label}."
            detail = spoken

    return {
        "verdict": "INFO",
        "spoken": spoken,
        "display": {
            "title": "Caregiver Info",
            "conflict": None,
            "alternative": None,
            "detail": detail,
            "member": member.role_label,
            "interpreted": f"caregiver query for {member.role_label}",
            "urgency": None,
            "members": [],
        },
        "evidence": {"source": "Family graph", "confidence": "HIGH", "grounding_score": 1.0},
        "actions": [],
        "member_focus": member.role_label,
        "language": lang,
    }


# ── notify_caregiver (in-app — no SMS/push in demo) ─────────────────────────

def notify_caregiver_inapp(
    target: str,
    message: str,
    from_label: str,
    language: str,
) -> dict:
    """Creates an in-app notification; does NOT send SMS or push (roadmap)."""
    from app.voice.notifications import add_notification
    notif = add_notification(target=target, message=message, from_member=from_label)

    if language == "bn":
        spoken = f"{target} কে জানানো হয়েছে।"
        detail = f"ইন-অ্যাপ বিজ্ঞপ্তি {target} এর কাছে পাঠানো হয়েছে।"
    else:
        spoken = f"{target} has been notified."
        detail = f"In-app notification sent to {target}. (SMS/push notification is a future roadmap feature.)"

    return {
        "verdict": "CONFIRMED",
        "spoken": spoken,
        "display": {
            "title": "Notification Sent",
            "conflict": None,
            "alternative": None,
            "detail": detail,
            "member": target,
            "interpreted": f"notify {target}",
            "urgency": None,
            "members": [],
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": target,
        "language": language,
        "notification": notif,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _error(spoken: str, lang: str, member: str) -> dict:
    return {
        "verdict": "REFUSE",
        "spoken": spoken,
        "display": {
            "title": "Not Found",
            "conflict": None,
            "alternative": None,
            "detail": spoken,
            "member": member,
            "interpreted": None,
            "urgency": None,
            "members": [],
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": None,
        "language": lang,
    }
