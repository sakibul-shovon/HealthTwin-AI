"""
Step 11: Triage Agent acceptance tests.
All tests call run_triage directly (no NLU pipeline needed).
"""
import pytest
from sqlalchemy.orm import Session

from app.graph.database import SessionLocal
from app.graph.models import Household
from app.agents.triage import run_triage, _scan_red_flags, _extract_temp_fahrenheit


def _get_household_id() -> int:
    db: Session = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        return hh.id if hh else 1
    finally:
        db.close()


def _triage(symptom: str, member: str = "Baba", language: str = "en") -> dict:
    db: Session = SessionLocal()
    try:
        return run_triage(db, _get_household_id(), member, symptom, language=language)
    finally:
        db.close()


# ── Red-flag detection unit tests ─────────────────────────────────────────────

def test_chest_pain_red_flag():
    assert _scan_red_flags("Baba has chest pain and can't breathe") is not None

def test_stroke_red_flag():
    assert _scan_red_flags("Ma's face is drooping and her speech is slurred") is not None

def test_seizure_red_flag():
    assert _scan_red_flags("the child is having a seizure") is not None

def test_unconscious_red_flag():
    assert _scan_red_flags("he is unconscious and not waking up") is not None

def test_no_red_flag_for_mild_symptom():
    assert _scan_red_flags("mild headache since morning") is None

def test_no_red_flag_for_fever_alone():
    assert _scan_red_flags("fever 102") is None


# ── Temperature extraction unit tests ────────────────────────────────────────

def test_temp_extract_fahrenheit_explicit():
    assert _extract_temp_fahrenheit("fever 102°F") == pytest.approx(102.0)

def test_temp_extract_celsius_converts():
    f = _extract_temp_fahrenheit("temperature is 39°C")
    assert f is not None and f == pytest.approx(39 * 9/5 + 32, abs=0.1)

def test_temp_extract_near_keyword():
    f = _extract_temp_fahrenheit("fever 101")
    assert f is not None and f == pytest.approx(101.0)

def test_temp_extract_none_for_no_temp():
    assert _extract_temp_fahrenheit("headache and fatigue") is None


# ── Triage Agent integration tests ───────────────────────────────────────────

def test_chest_pain_returns_emergency():
    result = _triage("Baba has chest pain and can't breathe")
    assert result["verdict"] == "EMERGENCY"
    assert result["display"]["urgency"] == "Emergency"
    assert "999" in result["spoken"] or "hospital" in result["spoken"].lower()

def test_stroke_signs_returns_emergency():
    result = _triage("Ma's face is drooping and her speech is slurred", member="Ma")
    assert result["verdict"] == "EMERGENCY"
    assert result["display"]["urgency"] == "Emergency"

def test_seizure_returns_emergency():
    result = _triage("the child is having a seizure", member="Child")
    assert result["verdict"] == "EMERGENCY"

def test_emergency_has_call_action():
    result = _triage("Baba is unconscious and unresponsive")
    assert result["verdict"] == "EMERGENCY"
    action_types = [a["type"] for a in result.get("actions", [])]
    assert "call_emergency" in action_types

def test_fever_102_child_urgent_or_moderate():
    """Fever 102°F in a child — should be Urgent or at least Moderate, not Low."""
    result = _triage("son has fever 102", member="Child")
    assert result["display"]["urgency"] in ("Urgent", "Moderate")
    assert result["verdict"] in ("CAUTION", "INFO")

def test_high_fever_103_urgent():
    result = _triage("Baba has fever 103°F")
    assert result["display"]["urgency"] == "Urgent"
    assert result["verdict"] == "CAUTION"

def test_mild_symptom_low_urgency():
    result = _triage("slight runny nose since this morning")
    assert result["display"]["urgency"] == "Low"
    assert result["verdict"] == "INFO"

def test_bangla_emergency_returns_bn_spoken():
    """বাবার বুকে ব্যথা → EMERGENCY in Bengali."""
    result = _triage("বাবার বুকে ব্যথা, শ্বাস নিতে পারছেন না", member="Baba", language="bn")
    assert result["verdict"] == "EMERGENCY"
    assert result["language"] == "bn"
    assert "999" in result["spoken"] or "হাসপাতাল" in result["spoken"]

def test_bangla_fever_non_emergency():
    """Bengali triage without red flag → non-emergency, language=bn."""
    result = _triage("ছেলের জ্বর ১০২, কতটা সিরিয়াস", member="Child", language="bn")
    assert result["verdict"] != "EMERGENCY"
    assert result["language"] == "bn"

def test_emergency_never_diagnoses():
    """Emergency response must NOT include a diagnosis — just escalate."""
    result = _triage("Baba has chest pain")
    assert result["verdict"] == "EMERGENCY"
    # No diagnostic language — response should tell user to call / go to hospital
    spoken_lower = result["spoken"].lower()
    assert any(w in spoken_lower for w in ["call", "hospital", "emergency", "ফোন", "হাসপাতাল"])

def test_envelope_keys_present():
    result = _triage("headache")
    for key in ("verdict", "spoken", "display", "evidence", "actions", "member_focus", "language"):
        assert key in result, f"Missing key: {key}"
    for dkey in ("title", "urgency", "detail", "conflict", "alternative", "member"):
        assert dkey in result["display"], f"Missing display key: {dkey}"

def test_non_emergency_has_disclaimer():
    result = _triage("mild headache")
    combined = result["display"]["detail"].lower()
    assert "consult" in combined or "professional" in combined or "doctor" in combined
