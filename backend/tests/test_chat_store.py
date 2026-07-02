import pytest
from app.graph.database import SessionLocal
from app.graph.models import Household
from app.memory.chat_store import save_turn, get_recent, clear

def _get_household_id() -> int:
    db = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        assert hh is not None, "Rahman Family not seeded"
        return hh.id
    finally:
        db.close()

def test_chat_store_save_get_clear():
    db = SessionLocal()
    try:
        hh_id = _get_household_id()
        
        # clear first
        clear(db, hh_id)
        
        save_turn(db, hh_id, "user", "Hello there")
        save_turn(db, hh_id, "assistant", "Hi! How can I help?", envelope={"verdict": "SAFE"})
        
        msgs = get_recent(db, hh_id, limit=10)
        assert len(msgs) == 2
        assert msgs[0].role == "user"
        assert msgs[0].text == "Hello there"
        assert msgs[1].role == "assistant"
        assert msgs[1].text == "Hi! How can I help?"
        assert msgs[1].envelope == {"verdict": "SAFE"}
        
        # Test pagination
        msgs_before = get_recent(db, hh_id, limit=10, before_id=msgs[1].id)
        assert len(msgs_before) == 1
        assert msgs_before[0].role == "user"
        
        deleted = clear(db, hh_id)
        assert deleted == 2
        
        msgs_after = get_recent(db, hh_id)
        assert len(msgs_after) == 0
    finally:
        db.close()
