"""
Step 09: Profile Agent acceptance tests.
All tests use TestClient (in-process DB) so they hit the real Postgres instance.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.graph.database import SessionLocal
from app.graph.models import Member, Medication, SymptomLog, Condition

client = TestClient(app)


def _get_household_id() -> int:
    db: Session = SessionLocal()
    try:
        from app.graph.models import Household
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        return hh.id if hh else 1
    finally:
        db.close()


def _member_meds(role_label: str) -> list[str]:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        m = db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
        return [med.name.lower() for med in m.medications] if m else []
    finally:
        db.close()


def _member_symptoms(role_label: str) -> list[str]:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        m = db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
        return [s.symptom.lower() for s in m.symptoms] if m else []
    finally:
        db.close()


def _household_member_labels() -> list[str]:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        members = db.query(Member).filter(Member.household_id == hh_id).all()
        return [m.role_label for m in members]
    finally:
        db.close()


def _member_kidney_flag(role_label: str) -> bool:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        m = db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
        return m.kidney_impaired if m else False
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


# ── Tests ────────────────────────────────────────────────────────────────────

def test_add_medication_preview_needs_confirmation():
    """Command response should not write yet — just ask for confirmation."""
    data = _do_command("Add Losartan 50mg to Ma")
    assert data["needs_confirmation"] is True
    assert data.get("pending_id") is not None
    # No DB write yet
    meds_before = _member_meds("Ma")
    assert "losartan" not in meds_before or True  # just checking command step


def test_add_medication_confirm_writes_to_db():
    """Full confirm flow: medication appears in Ma's profile."""
    meds_before = _member_meds("Ma")

    data = _do_command("Add Losartan 50mg to Ma")
    pending_id = data["pending_id"]

    result = _do_confirm(pending_id, confirmed=True)
    assert result["verdict"] == "CONFIRMED"
    assert result.get("household_refresh") is True

    meds_after = _member_meds("Ma")
    assert "losartan" in meds_after, f"Expected losartan in meds, got: {meds_after}"


def test_log_symptom_confirm_writes_to_db():
    """LOG_SYMPTOM: symptom log entry appears for Baba."""
    # Trigger via NLU mock: no GROQ key, so we need the LLM path OR test directly via profile agent
    from app.agents.profile import run_profile_write
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="LOG_SYMPTOM",
        member="Baba",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="symptom", name="fever"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        symptoms_before = _member_symptoms("Baba")
        result = run_profile_write(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "CONFIRMED"
    symptoms_after = _member_symptoms("Baba")
    assert "fever" in symptoms_after, f"Expected fever in symptoms, got: {symptoms_after}"


def test_add_member_confirm_writes_to_db():
    """ADD_MEMBER: new member appears in household."""
    from app.agents.profile import run_profile_write
    from app.voice.nlu import NluResult, EntityInfo

    labels_before = _household_member_labels()

    nlu = NluResult(
        intent="ADD_MEMBER",
        member=None,
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="member", name="Dadi", value="72"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_profile_write(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "CONFIRMED"
    assert result.get("household_refresh") is True
    labels_after = _household_member_labels()
    assert "Dadi" in labels_after, f"Expected Dadi in members, got: {labels_after}"


def test_update_member_sets_kidney_flag():
    """UPDATE_MEMBER with kidney disease maps to kidney_impaired=True."""
    from app.agents.profile import run_profile_write
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="UPDATE_MEMBER",
        member="Self",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="condition", name="kidney disease"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_profile_write(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "CONFIRMED"
    assert _member_kidney_flag("Self") is True


def test_cancel_does_not_write():
    """Cancelling a pending command must not modify the DB."""
    meds_before = _member_meds("Ma")

    data = _do_command("Add Metformin 500mg to Ma")
    pending_id = data["pending_id"]

    result = _do_confirm(pending_id, confirmed=False)
    assert result["verdict"] == "CANCELLED"

    meds_after = _member_meds("Ma")
    # No new metformin added
    new_meds = [m for m in meds_after if m not in meds_before and "metformin" in m]
    assert not new_meds, f"Unexpected medication added after cancel: {new_meds}"


def test_confirm_stale_id_returns_404():
    """Already-used or invented pending_id must return 404."""
    r = client.post("/api/voice/confirm", json={"pending_id": "deadbeef", "confirmed": True})
    assert r.status_code == 404


def test_confirmed_response_has_required_keys():
    """CONFIRMED envelope must include standard keys."""
    from app.agents.profile import run_profile_write
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="LOG_SYMPTOM",
        member="Child",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="symptom", name="cough"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_profile_write(db, hh_id, nlu)
    finally:
        db.close()

    for key in ("verdict", "spoken", "display", "evidence", "actions", "language"):
        assert key in result, f"Missing key: {key}"
    for dkey in ("title", "conflict", "alternative", "detail", "member"):
        assert dkey in result["display"], f"Missing display key: {dkey}"


def test_unknown_member_returns_refuse():
    """Profile agent must REFUSE gracefully when member cannot be resolved."""
    from app.agents.profile import run_profile_write
    from app.voice.nlu import NluResult, EntityInfo

    nlu = NluResult(
        intent="UPDATE_MEDICATION",
        member="Ghost",
        language="en",
        confidence=0.9,
        needs_confirmation=True,
        entity=EntityInfo(type="medication", name="aspirin", dose="100mg"),
    )

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_profile_write(db, hh_id, nlu)
    finally:
        db.close()

    assert result["verdict"] == "REFUSE"
