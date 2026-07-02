"""
Step 12: Care Agent acceptance tests.
Covers SET_REMINDER (write), ASSIGN_CAREGIVER (query), notify, and cancel flows.
Requires the healthtwin-db container on port 5433.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.graph.database import SessionLocal
from app.graph.models import Member, Reminder, Relationship, RelationshipType
from app.voice.notifications import clear_notifications, get_notifications

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_household_id() -> int:
    db: Session = SessionLocal()
    try:
        from app.graph.models import Household
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        return hh.id if hh else 1
    finally:
        db.close()


def _get_member(role_label: str) -> Member | None:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        return db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
    finally:
        db.close()


def _member_reminders(role_label: str) -> list[Reminder]:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        m = db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
        if not m:
            return []
        return db.query(Reminder).filter(Reminder.member_id == m.id, Reminder.active == True).all()
    finally:
        db.close()


def _delete_reminders(role_label: str) -> None:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        m = db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
        if m:
            db.query(Reminder).filter(Reminder.member_id == m.id).delete()
            db.commit()
    finally:
        db.close()


def _ensure_caregiver_seed() -> None:
    """Seed Ma→Baba caregiver edge if not present."""
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        ma = db.query(Member).filter(Member.household_id == hh_id, Member.role_label == "Ma").first()
        baba = db.query(Member).filter(Member.household_id == hh_id, Member.role_label == "Baba").first()
        if not ma or not baba:
            return
        existing = db.query(Relationship).filter(
            Relationship.from_member_id == ma.id,
            Relationship.to_member_id == baba.id,
            Relationship.caregiver == True,
        ).first()
        if not existing:
            rel = Relationship(
                from_member_id=ma.id,
                to_member_id=baba.id,
                type=RelationshipType.spouse_of,
                caregiver=True,
            )
            db.add(rel)
            db.commit()
    finally:
        db.close()


def _do_command(transcript: str, language: str = "en") -> dict:
    r = client.post("/api/voice/command", json={"transcript": transcript, "language": language})
    assert r.status_code == 200
    return r.json()


def _do_confirm(pending_id: str, confirmed: bool = True) -> dict:
    r = client.post("/api/voice/confirm", json={"pending_id": pending_id, "confirmed": confirmed})
    assert r.status_code == 200
    return r.json()


# ── SET_REMINDER tests ────────────────────────────────────────────────────────

def test_set_reminder_preview_needs_confirmation():
    """Command for SET_REMINDER should return needs_confirmation without writing."""
    data = _do_command("Remind Ma to take losartan at 9 PM")
    assert data.get("needs_confirmation") is True
    assert data.get("pending_id") is not None


def test_set_reminder_confirm_writes_to_db():
    """Confirming a SET_REMINDER creates a Reminder row in the DB."""
    _delete_reminders("Ma")
    reminders_before = _member_reminders("Ma")

    from app.agents.care import set_reminder_from_nlu
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="SET_REMINDER",
        member="Ma",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="time", name="losartan", value="9 PM"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = set_reminder_from_nlu(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "CONFIRMED"
    assert result.get("household_refresh") is True

    reminders_after = _member_reminders("Ma")
    assert len(reminders_after) > len(reminders_before)
    times = [r.time for r in reminders_after]
    assert "21:00" in times, f"Expected 21:00 reminder, got: {times}"


def test_set_reminder_normalises_time_am():
    """9 AM should normalise to 09:00."""
    _delete_reminders("Baba")

    from app.agents.care import set_reminder_from_nlu
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="SET_REMINDER",
        member="Baba",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="time", name="aspirin", value="9 AM"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = set_reminder_from_nlu(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "CONFIRMED"
    reminders = _member_reminders("Baba")
    assert any(r.time == "09:00" for r in reminders)


def test_set_reminder_unknown_member_returns_refuse():
    """SET_REMINDER for an unknown member should return REFUSE."""
    from app.agents.care import set_reminder_from_nlu
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="SET_REMINDER",
        member="Ghost",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="time", name="aspirin", value="8 AM"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = set_reminder_from_nlu(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "REFUSE"


def test_cancel_reminder_does_not_write():
    """Cancelling a SET_REMINDER pending command must not create any reminder row."""
    _delete_reminders("Ma")
    reminders_before = _member_reminders("Ma")

    data = _do_command("Remind Ma to take losartan at 9 PM")
    pending_id = data["pending_id"]

    result = _do_confirm(pending_id, confirmed=False)
    assert result["verdict"] == "CANCELLED"

    reminders_after = _member_reminders("Ma")
    assert len(reminders_after) == len(reminders_before), (
        f"Expected no new reminders after cancel, got {len(reminders_after)}"
    )


# ── ASSIGN_CAREGIVER / query tests ───────────────────────────────────────────

def test_query_caregiver_baba_returns_ma():
    """Who is Baba's caregiver? → Ma (seeded relationship)."""
    _ensure_caregiver_seed()

    from app.agents.care import query_caregiver

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = query_caregiver(db, hh_id, "Baba", "en")
    finally:
        db.close()

    assert result["verdict"] == "INFO"
    assert "Ma" in result["spoken"], f"Expected Ma in spoken: {result['spoken']}"


def test_query_caregiver_ma_is_caregiver_of_baba():
    """Querying Ma's caregiver role should say she cares for Baba."""
    _ensure_caregiver_seed()

    from app.agents.care import query_caregiver

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = query_caregiver(db, hh_id, "Ma", "en")
    finally:
        db.close()

    assert result["verdict"] == "INFO"
    assert "Baba" in result["spoken"], f"Expected Baba in spoken: {result['spoken']}"


def test_query_caregiver_no_caregiver():
    """A member with no caregiver edge returns graceful INFO, not an error."""
    from app.agents.care import query_caregiver

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = query_caregiver(db, hh_id, "Child", "en")
    finally:
        db.close()

    assert result["verdict"] == "INFO"
    assert result["spoken"]  # non-empty


def test_query_caregiver_unknown_member_returns_refuse():
    from app.agents.care import query_caregiver

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = query_caregiver(db, hh_id, "Nobody", "en")
    finally:
        db.close()

    assert result["verdict"] == "REFUSE"


# ── notify_caregiver_inapp tests ─────────────────────────────────────────────

def test_notify_caregiver_inapp_stores_notification():
    """notify_caregiver_inapp should return CONFIRMED and add to notification store."""
    clear_notifications()

    from app.agents.care import notify_caregiver_inapp

    result = notify_caregiver_inapp(
        target="Ma",
        message="Baba skipped his medication.",
        from_label="HealthTwin",
        language="en",
    )

    assert result["verdict"] == "CONFIRMED"
    assert "notification" in result
    assert result["notification"]["target"] == "Ma"

    notifs = get_notifications()
    assert len(notifs) == 1
    assert notifs[0]["message"] == "Baba skipped his medication."


def test_notify_caregiver_via_api():
    """POST /api/care/notify should return a notification object."""
    clear_notifications()

    r = client.post("/api/care/notify", json={
        "target": "Ma",
        "message": "Test alert",
        "from_member": "HealthTwin",
        "language": "en",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "CONFIRMED"
    assert data["notification"]["target"] == "Ma"


def test_get_notifications_api():
    """GET /api/care/notifications should return accumulated notifications."""
    clear_notifications()

    from app.agents.care import notify_caregiver_inapp
    notify_caregiver_inapp("Ma", "Alert 1", "HealthTwin", "en")
    notify_caregiver_inapp("Baba", "Alert 2", "HealthTwin", "en")

    r = client.get("/api/care/notifications")
    assert r.status_code == 200
    data = r.json()
    notifs = data if isinstance(data, list) else data.get("notifications", data)
    assert len(notifs) == 2


def test_delete_notifications_api():
    """DELETE /api/care/notifications should clear the store."""
    from app.agents.care import notify_caregiver_inapp
    notify_caregiver_inapp("Ma", "Alert", "HealthTwin", "en")

    r = client.delete("/api/care/notifications")
    assert r.status_code == 200

    notifs = get_notifications()
    assert len(notifs) == 0


def test_notify_bilingual_bn():
    """Bilingual: Bengali language should produce a Bengali spoken response."""
    from app.agents.care import notify_caregiver_inapp

    result = notify_caregiver_inapp("Ma", "সতর্কতা বার্তা", "HealthTwin", "bn")
    assert result["language"] == "bn"
    assert "Ma" in result["spoken"] or "মা" in result["spoken"]
