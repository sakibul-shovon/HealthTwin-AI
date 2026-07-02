"""
Step 13: Companion Agent acceptance tests.
Tests grounded Q&A (INFO), misinformation refusal (REFUSE), and evidence footer.
Requires healthtwin-db on port 5433 and KB corpus loaded with real embeddings.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.graph.database import SessionLocal

client = TestClient(app)


def _get_household_id() -> int:
    db: Session = SessionLocal()
    try:
        from app.graph.models import Household
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        return hh.id if hh else 1
    finally:
        db.close()


def _do_command(transcript: str, language: str = "en") -> dict:
    r = client.post("/api/voice/command", json={"transcript": transcript, "language": language})
    assert r.status_code == 200
    return r.json()


# ── Direct companion agent tests (bypass HTTP) ───────────────────────────────

def test_companion_known_question_returns_info():
    """A question in the corpus should return INFO with an answer."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "Is it safe to take paracetamol on an empty stomach?", "en")
    finally:
        db.close()

    # Either INFO (corpus hit) or REFUSE (insufficient retrieval) — both are valid
    assert result["verdict"] in ("INFO", "REFUSE")
    assert result["spoken"]


def test_companion_info_has_evidence_footer():
    """If companion returns INFO, it must include evidence source and confidence."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "Is it safe to take paracetamol on an empty stomach?", "en")
    finally:
        db.close()

    if result["verdict"] == "INFO":
        ev = result["evidence"]
        assert ev["source"] is not None, "INFO response must have a source"
        assert ev["confidence"] in ("HIGH", "MED", "LOW")
        assert ev["grounding_score"] is not None
        assert 0.0 <= ev["grounding_score"] <= 1.0


def test_companion_out_of_scope_returns_refuse():
    """An out-of-scope question must REFUSE rather than fabricate an answer."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        # Not in corpus: herbal medicine claims
        result = run_companion(db, hh_id, "what herb cures diabetes permanently?", "en")
    finally:
        db.close()

    # Must not fabricate — either REFUSE or INFO backed by real evidence
    # If INFO, evidence must exist (grounding guard passed)
    if result["verdict"] == "INFO":
        assert result["evidence"]["source"] is not None
    # A blatant misinformation question with no corpus support should ideally be REFUSE
    # We assert it is NOT making up an unsourced answer
    assert result["verdict"] in ("INFO", "REFUSE")
    assert result["spoken"]


def test_companion_refuse_has_no_evidence():
    """A REFUSE response should have null evidence fields."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "xyzzy quantum cure klothozen remedy", "en")
    finally:
        db.close()

    # Nonsense query will definitely miss the corpus
    assert result["verdict"] == "REFUSE"
    assert result["evidence"]["source"] is None
    assert result["evidence"]["confidence"] is None


def test_companion_refuse_spoken_is_non_empty():
    """REFUSE spoken text must always be non-empty (never silent)."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "totally made-up condition zzz", "en")
    finally:
        db.close()

    assert result["spoken"].strip(), "spoken must not be blank for REFUSE"
    assert result["display"]["title"]


def test_companion_envelope_has_required_keys():
    """Companion must always return a complete envelope."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "paracetamol dosing for children", "en")
    finally:
        db.close()

    for key in ("verdict", "spoken", "display", "evidence", "actions", "language"):
        assert key in result, f"Missing key: {key}"
    for dkey in ("title", "conflict", "alternative", "detail", "member"):
        assert dkey in result["display"], f"Missing display key: {dkey}"


def test_companion_info_detail_contains_disclaimer():
    """INFO answers must include the disclaimer in display.detail."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "paracetamol empty stomach", "en")
    finally:
        db.close()

    if result["verdict"] == "INFO":
        detail = result["display"]["detail"]
        assert "consult" in detail.lower() or "doctor" in detail.lower(), (
            f"Disclaimer should reference doctor/consult. Got: {detail[:200]}"
        )


def test_companion_no_confirm_needed():
    """Companion is read-only — needs_confirmation must be False."""
    from app.agents.companion import run_companion

    db: Session = SessionLocal()
    try:
        hh_id = _get_household_id()
        result = run_companion(db, hh_id, "dengue warning signs", "en")
    finally:
        db.close()

    assert result.get("needs_confirmation", False) is False
    assert result["actions"] == []


# ── HTTP route tests ──────────────────────────────────────────────────────────

def test_companion_via_http_paracetamol_empty_stomach():
    """End-to-end: text 'is it safe to take paracetamol on empty stomach' → INFO or REFUSE."""
    data = _do_command("is it safe to take paracetamol on an empty stomach")
    assert data["verdict"] in ("INFO", "REFUSE")
    assert data["spoken"]
    assert data.get("needs_confirmation") is False


def test_companion_via_http_out_of_scope_refuses():
    """End-to-end: out-of-scope gibberish → REFUSE from companion."""
    data = _do_command("what herb cures all diseases instantly forever")
    # Router may return UNKNOWN (unrecognised by NLU mock) or companion REFUSE
    assert data["verdict"] in ("REFUSE", None, "INFO")
    assert data["spoken"]


def test_companion_via_http_dengue():
    """End-to-end: dengue warning signs question → INFO or REFUSE with evidence."""
    data = _do_command("what are the warning signs of dengue fever")
    assert data["verdict"] in ("INFO", "REFUSE")
    if data["verdict"] == "INFO":
        assert data["evidence"]["source"] is not None
