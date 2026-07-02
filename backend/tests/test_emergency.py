import pytest
from sqlalchemy.orm import Session
from app.graph.database import SessionLocal
from app.graph.models import Household
from app.api.voice import voice_command, CommandRequest
from app.api.emergency import get_emergency_card

def _get_household_id() -> int:
    db = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        assert hh is not None, "Rahman Family not seeded"
        return hh.id
    finally:
        db.close()

def _get_baba_id(db: Session, hh_id: int) -> int:
    from app.graph.models import Member
    baba = db.query(Member).filter(Member.household_id == hh_id, Member.role_label == "Baba").first()
    return baba.id

def test_emergency_envelope_critical_block():
    db = SessionLocal()
    try:
        # Send emergency voice command
        req = CommandRequest(transcript="Baba has severe bleeding", language="en")
        env = voice_command(req, db)
        
        assert env["verdict"] == "EMERGENCY"
        assert "critical" in env["display"]
        
        critical = env["display"]["critical"]
        assert "medications" in critical
        assert "caregiver" in critical
        
        # Verify actions
        action_types = [a["type"] for a in env["actions"]]
        assert "call_emergency" in action_types
        assert "notify_caregiver" in action_types
        assert "nearest_hospital" in action_types
        
        # Verify endpoint GET /api/emergency/{id}/card
        hh_id = _get_household_id()
        baba_id = _get_baba_id(db, hh_id)
        card = get_emergency_card(baba_id, db)
        
        assert card["caregiver"] == critical["caregiver"]
        assert card["age"] == critical["age"]
        
    finally:
        db.close()
