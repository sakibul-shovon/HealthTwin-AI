"""
Step 14: Composer safety-rail tests.
Verifies that no medical verdict ships without evidence.source + evidence.confidence.
"""
from fastapi.testclient import TestClient
from app.main import app
from app.agents.composer import compose

client = TestClient(app)


# ── Unit tests: compose() function ───────────────────────────────────────────

def test_safe_without_evidence_forced_to_refuse():
    """SAFE verdict with no source must be downgraded to REFUSE."""
    raw = {
        "verdict": "SAFE",
        "spoken": "This drug is safe.",
        "display": {"title": "Safe", "detail": "OK.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "REFUSE", f"Expected REFUSE, got {result['verdict']}"


def test_unsafe_without_evidence_forced_to_refuse():
    """UNSAFE verdict with no source must be downgraded to REFUSE."""
    raw = {
        "verdict": "UNSAFE",
        "spoken": "Don't take this.",
        "display": {"title": "Unsafe", "detail": "Danger.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "REFUSE"


def test_caution_without_evidence_forced_to_refuse():
    """CAUTION verdict with no source must be downgraded to REFUSE."""
    raw = {
        "verdict": "CAUTION",
        "spoken": "Use with care.",
        "display": {"title": "Caution", "detail": "Be careful.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "REFUSE"


def test_safe_with_valid_evidence_passes():
    """SAFE verdict with real source + confidence must NOT be downgraded."""
    raw = {
        "verdict": "SAFE",
        "spoken": "This drug is safe.",
        "display": {"title": "Safe", "detail": "OK.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": "WHO Essential Medicines", "confidence": "HIGH", "grounding_score": 0.9},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "SAFE", f"Expected SAFE, got {result['verdict']}"


def test_unsafe_with_valid_evidence_passes():
    """UNSAFE verdict with real source must NOT be downgraded."""
    raw = {
        "verdict": "UNSAFE",
        "spoken": "Don't take this.",
        "display": {"title": "Unsafe", "detail": "Danger.", "conflict": "ibuprofen + warfarin → bleeding", "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": "WHO Fact Sheet", "confidence": "HIGH", "grounding_score": 0.95},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "UNSAFE"


def test_emergency_always_overrides_spoken():
    """EMERGENCY spoken text must always be the emergency escalation message."""
    raw = {
        "verdict": "EMERGENCY",
        "spoken": "custom message",
        "display": {"title": "Emergency", "detail": "chest pain", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert "999" in result["spoken"] or "emergency" in result["spoken"].lower()


def test_emergency_bn_overrides_spoken():
    """Bangla EMERGENCY must use Bengali escalation message."""
    raw = {
        "verdict": "EMERGENCY",
        "spoken": "custom",
        "display": {"title": "Emergency", "detail": "...", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "bn",
    }
    result = compose(raw)
    assert "৯৯৯" in result["spoken"] or "999" in result["spoken"]


def test_info_without_evidence_is_allowed():
    """INFO verdict (companion, pattern, etc.) does not require evidence — should not be downgraded."""
    raw = {
        "verdict": "INFO",
        "spoken": "Here is the information.",
        "display": {"title": "Info", "detail": "Some info.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "INFO", "INFO should not be downgraded when evidence is missing"


def test_confirmed_without_evidence_is_allowed():
    """CONFIRMED (profile/care writes) does not require evidence."""
    raw = {
        "verdict": "CONFIRMED",
        "spoken": "Done.",
        "display": {"title": "Confirmed", "detail": "Write done.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "CONFIRMED"


def test_refuse_without_evidence_stays_refuse():
    """REFUSE verdict never needs evidence."""
    raw = {
        "verdict": "REFUSE",
        "spoken": "I cannot help with that.",
        "display": {"title": "Refused", "detail": "N/A", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw)
    assert result["verdict"] == "REFUSE"


def test_interpreted_text_is_attached():
    """compose() must attach interpreted text to display when provided."""
    raw = {
        "verdict": "INFO",
        "spoken": "Answer.",
        "display": {"title": "Info", "detail": "Detail.", "conflict": None, "alternative": None, "member": None, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "language": "en",
    }
    result = compose(raw, interpreted="check ibuprofen for Baba")
    assert result["display"]["interpreted"] == "check ibuprofen for Baba"


# ── Integration: end-to-end via HTTP ─────────────────────────────────────────

def test_drug_safety_check_has_evidence_in_response():
    """Drug safety check response must always include an evidence source."""
    r = client.post("/api/voice/command", json={"transcript": "Can I give Baba ibuprofen?", "language": "en"})
    assert r.status_code == 200
    data = r.json()
    # UNSAFE or CAUTION must have evidence
    if data["verdict"] in ("UNSAFE", "CAUTION", "SAFE"):
        assert data["evidence"]["source"] is not None, "Medical verdict shipped without evidence source"
        assert data["evidence"]["confidence"] is not None
