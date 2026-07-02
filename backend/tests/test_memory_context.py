import pytest
from app.graph.database import SessionLocal
from app.graph.models import Household
from app.api.voice import voice_command, CommandRequest
from app.memory.chat_store import clear

def _get_household_id() -> int:
    db = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        assert hh is not None, "Rahman Family not seeded"
        return hh.id
    finally:
        db.close()

def test_memory_context_pronoun_resolution():
    db = SessionLocal()
    hh_id = _get_household_id()
    
    # 1. Clear chat store to ensure clean slate
    clear(db, hh_id)
    
    # 2. Turn 1: "Is ibuprofen safe for Baba?"
    req1 = CommandRequest(transcript="Is ibuprofen safe for Baba?", language="en")
    env1 = voice_command(req1, db)
    
    # member_focus should be Baba
    assert env1["member_focus"] == "Baba"
    
    # 3. Turn 2: "Can I give him paracetamol instead?" -> should resolve to Baba
    req2 = CommandRequest(transcript="Can I give him paracetamol instead?", language="en")
    env2 = voice_command(req2, db)
    
    # In mock, "paracetamol" triggers DRUG_SAFETY_CHECK and pronoun "him" resolves to last focus
    assert env2["member_focus"] == "Baba"
    assert env2["intent"] == "DRUG_SAFETY_CHECK"

    db.close()
