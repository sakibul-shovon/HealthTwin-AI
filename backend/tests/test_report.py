"""
E18 acceptance tests — Report Agent + /api/reports/generate endpoint.
All tests work without a live Groq key (deterministic template floor).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.graph.database import SessionLocal
from app.graph.models import Household, Member
from app.agents.report import generate_report, REPORT_TYPES

client = TestClient(app)


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_household_id() -> int:
    db: Session = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        return hh.id if hh else 1
    finally:
        db.close()


def _get_member_id(role_label: str) -> int:
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        m = db.query(Member).filter(
            Member.household_id == hh_id,
            Member.role_label.ilike(role_label),
        ).first()
        return m.id if m else None
    finally:
        db.close()


# ── direct generate_report() tests ───────────────────────────────────────────

def test_family_summary_returns_markdown():
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "family_summary", language="en")
    finally:
        db.close()

    assert result["title"]
    assert "Family Health Summary" in result["title"]
    md = result["markdown"]
    assert "# " in md
    assert "Baba" in md or "Rahman" in md
    assert "Medications" in md or "medications" in md.lower()
    assert "Always consult a doctor" in md or "consult" in md.lower()


def test_medication_report_has_table():
    db: Session = SessionLocal()
    baba_id = _get_member_id("Baba")
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "medication_report", member_id=baba_id, language="en")
    finally:
        db.close()

    md = result["markdown"]
    assert "Medication Report" in result["title"]
    # Markdown table header
    assert "|" in md
    # Baba is on Warfarin
    assert "warfarin" in md.lower() or "Warfarin" in md


def test_disease_history_contains_conditions():
    db: Session = SessionLocal()
    baba_id = _get_member_id("Baba")
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "disease_history", member_id=baba_id, language="en")
    finally:
        db.close()

    md = result["markdown"]
    assert "Disease History" in result["title"]
    # Baba has Hypertension
    assert "hypertension" in md.lower() or "Hypertension" in md
    assert "Risk" in md


def test_emergency_summary_has_critical_fields():
    db: Session = SessionLocal()
    baba_id = _get_member_id("Baba")
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "emergency_summary", member_id=baba_id, language="en")
    finally:
        db.close()

    md = result["markdown"]
    assert "Emergency" in result["title"]
    assert "Name" in md or "Age" in md
    assert "medications" in md.lower() or "Medications" in md
    assert "Allergies" in md
    assert "🚨" in md


def test_doctor_visit_summary():
    db: Session = SessionLocal()
    baba_id = _get_member_id("Baba")
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "doctor_visit", member_id=baba_id, language="en")
    finally:
        db.close()

    md = result["markdown"]
    assert "Doctor Visit" in result["title"]
    assert "Patient Profile" in md
    assert "Current Medications" in md


def test_monthly_report():
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "monthly", language="en")
    finally:
        db.close()

    md = result["markdown"]
    assert "Monthly Health Report" in result["title"]
    assert "Household Overview" in md


def test_bangla_family_summary():
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "family_summary", language="bn")
    finally:
        db.close()

    md = result["markdown"]
    assert result["title"]
    # Bengali disclaimer
    assert "ডাক্তার" in md or "পরামর্শ" in md


def test_unknown_report_type_falls_back_to_family_summary():
    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = generate_report(db, hh_id, "nonexistent_type", language="en")
    finally:
        db.close()

    # Should default to family_summary
    assert result["markdown"]
    assert "Family Health Summary" in result["title"]


def test_all_report_types_produce_output():
    db: Session = SessionLocal()
    baba_id = _get_member_id("Baba")
    try:
        hh_id = _get_household_id()
        for rtype in REPORT_TYPES:
            result = generate_report(db, hh_id, rtype, member_id=baba_id, language="en")
            assert result["title"], f"No title for {rtype}"
            assert len(result["markdown"]) > 50, f"Markdown too short for {rtype}"
            assert "consult" in result["markdown"].lower(), f"No disclaimer in {rtype}"
    finally:
        db.close()


# ── HTTP endpoint tests ───────────────────────────────────────────────────────

def test_api_family_summary():
    r = client.post("/api/reports/generate", json={"type": "family_summary", "language": "en"})
    assert r.status_code == 200
    data = r.json()
    assert "title" in data
    assert "markdown" in data
    assert len(data["markdown"]) > 100


def test_api_medication_report_for_baba():
    baba_id = _get_member_id("Baba")
    r = client.post("/api/reports/generate", json={
        "type": "medication_report",
        "member_id": baba_id,
        "language": "en",
    })
    assert r.status_code == 200
    data = r.json()
    assert "Medication Report" in data["title"]
    assert "warfarin" in data["markdown"].lower()


def test_api_disease_history_bangla():
    baba_id = _get_member_id("Baba")
    r = client.post("/api/reports/generate", json={
        "type": "disease_history",
        "member_id": baba_id,
        "language": "bn",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["markdown"]
    assert "ইতিহাস" in data["title"] or "History" in data["title"]


def test_api_report_types_list():
    r = client.get("/api/reports/types")
    assert r.status_code == 200
    types = r.json()["types"]
    assert "family_summary" in types
    assert "medication_report" in types
    assert "emergency_summary" in types


# ── Voice command routing tests ───────────────────────────────────────────────

def test_voice_generate_family_report():
    """'generate family health summary' → INFO verdict with report."""
    r = client.post("/api/voice/command", json={
        "transcript": "generate family health summary",
        "language": "en",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "INFO"
    assert data["intent"] == "GENERATE_REPORT"
    assert data["display"]["report_markdown"]
    # download action must be present
    action_types = [a["type"] for a in data.get("actions", [])]
    assert "download_report" in action_types


def test_voice_generate_medication_report():
    """'generate medication report for Baba' → medication_report type."""
    r = client.post("/api/voice/command", json={
        "transcript": "generate medication report for Baba",
        "language": "en",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "INFO"
    assert "Medication" in data["display"]["title"] or "medication" in data["display"]["title"].lower()


def test_voice_bangla_report():
    """Bengali report request."""
    r = client.post("/api/voice/command", json={
        "transcript": "পরিবারের স্বাস্থ্য রিপোর্ট তৈরি করো",
        "language": "bn",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "INFO"
    assert data["language"] == "bn"
