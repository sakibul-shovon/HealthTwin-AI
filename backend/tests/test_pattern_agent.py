"""
Step 10: Pattern Agent acceptance tests.
Uses the real DB. Seed data is mutated per test; each test that adds
symptoms/conditions cleans up after itself via delete queries.
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.graph.database import SessionLocal
from app.graph.models import Household, Member, SymptomLog, Condition
from app.agents.pattern import run_pattern_check
from app.config import settings


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_household() -> tuple[int, dict[str, int]]:
    """Returns (household_id, {role_label: member_id}) for Rahman Family."""
    db: Session = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        assert hh is not None, "Rahman Family not seeded"
        label_to_id = {m.role_label: m.id for m in hh.members}
        # Clean up any seeded SymptomLogs so tests start from a clean slate
        db.query(SymptomLog).filter(SymptomLog.member_id.in_(label_to_id.values())).delete(synchronize_session=False)
        db.commit()
        return hh.id, label_to_id
    finally:
        db.close()


def _log_symptom(member_id: int, symptom: str, hours_ago: float = 1.0) -> int:
    db: Session = SessionLocal()
    try:
        log = SymptomLog(
            member_id=member_id,
            symptom=symptom,
            logged_at=datetime.utcnow() - timedelta(hours=hours_ago),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log.id
    finally:
        db.close()


def _add_condition(member_id: int, name: str) -> int:
    db: Session = SessionLocal()
    try:
        cond = Condition(member_id=member_id, name=name)
        db.add(cond)
        db.commit()
        db.refresh(cond)
        return cond.id
    finally:
        db.close()


def _delete_symptom_logs(log_ids: list[int]):
    db: Session = SessionLocal()
    try:
        db.query(SymptomLog).filter(SymptomLog.id.in_(log_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _delete_conditions(cond_ids: list[int]):
    db: Session = SessionLocal()
    try:
        db.query(Condition).filter(Condition.id.in_(cond_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _run(household_id: int, language: str = "en") -> dict:
    db: Session = SessionLocal()
    try:
        return run_pattern_check(db, household_id, language)
    finally:
        db.close()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_no_pattern_returns_info():
    """Clean household with no recent symptom logs → INFO / no patterns."""
    hh_id, _ = _get_household()
    result = _run(hh_id)
    assert result["verdict"] == "INFO"
    assert "no" in result["spoken"].lower() or result["display"]["members"] == []


def test_fever_cluster_caution_dengue_season():
    """2 members with fever within window + DENGUE_SEASON=True → CAUTION."""
    hh_id, labels = _get_household()
    assert settings.DENGUE_SEASON is True, "Test requires DENGUE_SEASON=True in config"

    log_ids = [
        _log_symptom(labels["Baba"], "fever", hours_ago=2),
        _log_symptom(labels["Ma"], "fever", hours_ago=4),
    ]
    try:
        result = _run(hh_id)
        assert result["verdict"] == "CAUTION", f"Expected CAUTION, got {result['verdict']}"
        assert "Baba" in result["display"]["members"] or "Ma" in result["display"]["members"]
        assert len(result["display"]["members"]) >= 2
        assert result["member_focus"] is not None
    finally:
        _delete_symptom_logs(log_ids)


def test_fever_cluster_outside_window_no_alert():
    """Fever logs older than the window should NOT trigger a cluster."""
    hh_id, labels = _get_household()
    window = settings.CLUSTER_WINDOW_HOURS
    log_ids = [
        _log_symptom(labels["Baba"], "fever", hours_ago=window + 2),
        _log_symptom(labels["Ma"], "fever", hours_ago=window + 5),
    ]
    try:
        result = _run(hh_id)
        # Should not detect a cluster from these old logs
        assert result["verdict"] != "CAUTION" or len(result["display"].get("members", [])) < 2
    finally:
        _delete_symptom_logs(log_ids)


def test_non_fever_cluster_returns_info_not_caution():
    """Shared symptom that is NOT fever → INFO, not CAUTION (no dengue escalation)."""
    hh_id, labels = _get_household()
    log_ids = [
        _log_symptom(labels["Baba"], "headache", hours_ago=1),
        _log_symptom(labels["Child"], "headache", hours_ago=3),
    ]
    try:
        result = _run(hh_id)
        # Cluster detected but not fever → INFO verdict
        if len(result["display"].get("members", [])) >= 2:
            assert result["verdict"] == "INFO"
    finally:
        _delete_symptom_logs(log_ids)


def test_hereditary_risk_three_members():
    """3 members sharing diabetes → hereditary INFO with Child at-risk."""
    hh_id, labels = _get_household()
    # Ma already has T2 diabetes from seed; add to Baba + Self
    cond_ids = [
        _add_condition(labels["Baba"], "diabetes"),
        _add_condition(labels["Self"], "diabetes"),
    ]
    try:
        result = _run(hh_id)
        # Should detect hereditary pattern (Ma already has it in seed)
        assert result["verdict"] == "INFO"
        assert "hereditary" in result["display"]["title"].lower() or "diabetes" in result["spoken"].lower()
        assert len(result["display"].get("members", [])) >= 2
    finally:
        _delete_conditions(cond_ids)


def test_cluster_members_field_is_list():
    """display.members must always be a list (never None)."""
    hh_id, labels = _get_household()
    log_ids = [
        _log_symptom(labels["Baba"], "fever", hours_ago=1),
        _log_symptom(labels["Child"], "fever", hours_ago=2),
    ]
    try:
        result = _run(hh_id)
        assert isinstance(result["display"].get("members", []), list)
    finally:
        _delete_symptom_logs(log_ids)


def test_bangla_cluster_response():
    """Bengali language → spoken text in Bengali, verdict still CAUTION."""
    hh_id, labels = _get_household()
    log_ids = [
        _log_symptom(labels["Ma"], "fever", hours_ago=1),
        _log_symptom(labels["Child"], "fever", hours_ago=3),
    ]
    try:
        db: Session = SessionLocal()
        try:
            result = run_pattern_check(db, hh_id, language="bn")
        finally:
            db.close()
        assert result["language"] == "bn"
        assert result["verdict"] == "CAUTION"
        # Bangla fever term or member names present in spoken text
        assert "জ্বর" in result["spoken"] or "fever" in result["spoken"].lower()
    finally:
        _delete_symptom_logs(log_ids)


def test_envelope_keys_present():
    """Pattern envelope must have all required keys regardless of finding."""
    hh_id, _ = _get_household()
    result = _run(hh_id)
    for key in ("verdict", "spoken", "display", "evidence", "actions", "member_focus", "language"):
        assert key in result, f"Missing key: {key}"
    for dkey in ("title", "conflict", "alternative", "detail", "member", "members"):
        assert dkey in result["display"], f"Missing display key: {dkey}"
