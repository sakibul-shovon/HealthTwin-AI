"""
Step 06 acceptance tests — voice command pipeline at text level (no STT/TTS).
All tests use the TestClient; no live Groq key needed (NLU falls back to mock).
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ── helpers ─────────────────────────────────────────────────────────────────

def post_command(transcript: str, language: str | None = None) -> dict:
    body = {"transcript": transcript}
    if language:
        body["language"] = language
    r = client.post("/api/voice/command", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ── 1. Flagship English: ibuprofen + Baba → UNSAFE ──────────────────────────

def test_flagship_english_unsafe():
    res = post_command("Can I give Baba ibuprofen for back pain?")
    assert res["verdict"] == "UNSAFE"
    assert res["language"] == "en"
    spoken = res["spoken"].lower()
    assert any(w in spoken for w in ["ibuprofen", "unsafe", "do not", "avoid", "warfarin", "dangerous"])
    # evidence must be populated for a medical verdict
    ev = res["evidence"]
    assert ev["source"], "evidence source must be present for UNSAFE verdict"
    assert ev["confidence"] in ("HIGH", "MED", "LOW")
    # display should have interpreted text
    assert res["display"].get("interpreted")


# ── 2. Flagship Bangla: same catch, language=bn ──────────────────────────────

def test_flagship_bangla_unsafe():
    res = post_command("বাবার পিঠে ব্যথা, কী ওষুধ দেব?", language="bn")
    # NLU mock triggers on "ওষুধ" → DRUG_SAFETY_CHECK for Baba/ibuprofen
    assert res["verdict"] == "UNSAFE"
    assert res["language"] == "bn"
    assert res["member_focus"] == "Baba"


# ── 3. Write command: Add Losartan for Ma → needs confirmation ───────────────

def test_write_command_needs_confirmation():
    res = post_command("Add Losartan 50 to Ma")
    assert res["needs_confirmation"] is True
    assert "pending_id" in res
    assert res["intent"] == "UPDATE_MEDICATION"
    # Should NOT have an UNSAFE/SAFE/CAUTION verdict yet
    assert res["verdict"] is None or res["verdict"] not in ("UNSAFE", "SAFE", "CAUTION")


# ── 4. Write command confirm flow ────────────────────────────────────────────

def test_confirm_flow_yes():
    # First POST the write command to get a pending_id
    cmd = post_command("Add Losartan 50 to Ma")
    pending_id = cmd.get("pending_id")
    assert pending_id, "Write command must return pending_id"

    r = client.post("/api/voice/confirm", json={"pending_id": pending_id, "confirmed": True})
    assert r.status_code == 200
    res = r.json()
    assert res["verdict"] == "CONFIRMED"


def test_confirm_flow_no():
    cmd = post_command("Add Losartan 50 to Ma")
    pending_id = cmd.get("pending_id")
    assert pending_id

    r = client.post("/api/voice/confirm", json={"pending_id": pending_id, "confirmed": False})
    assert r.status_code == 200
    res = r.json()
    assert res["verdict"] == "CANCELLED"


def test_confirm_stale_id_returns_404():
    r = client.post("/api/voice/confirm", json={"pending_id": "deadbeef", "confirmed": True})
    assert r.status_code == 404


# ── 5. Gibberish / UNKNOWN → REFUSE ─────────────────────────────────────────

def test_gibberish_returns_refuse():
    # NLU mock returns UNKNOWN for anything not matching ibuprofen/losartan
    res = post_command("asdfghjklqwertyuiop")
    assert res["verdict"] == "REFUSE"


# ── 6. Response envelope shape ───────────────────────────────────────────────

def test_envelope_keys_present():
    res = post_command("Can I give Baba ibuprofen?")
    for key in ("verdict", "spoken", "display", "evidence", "actions", "language", "intent"):
        assert key in res, f"missing key: {key}"
    for key in ("title", "conflict", "alternative", "detail", "member", "interpreted"):
        assert key in res["display"], f"missing display.{key}"
    for key in ("source", "confidence", "grounding_score"):
        assert key in res["evidence"], f"missing evidence.{key}"


# ── 7. Safe alternative present for flagship check ──────────────────────────

def test_flagship_includes_alternative():
    res = post_command("Can I give Baba ibuprofen?")
    assert res["verdict"] == "UNSAFE"
    assert res["display"]["alternative"] is not None
    alt = res["display"]["alternative"].lower()
    assert "paracetamol" in alt or "acetaminophen" in alt
