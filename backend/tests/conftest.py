import pytest
from app.graph.database import SessionLocal
from app.graph.models import ChatMessage, Household


@pytest.fixture(autouse=True)
def clear_chat_history():
    """
    Wipe chat_messages for the Rahman Family before every test.
    E03 persists every voice command turn to the DB; E04 injects the last-N
    turns as NLU context. Without this, earlier tests' chat history bleeds
    into later tests and changes NLU routing outcomes.
    """
    db = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        if hh:
            db.query(ChatMessage).filter(ChatMessage.household_id == hh.id).delete(
                synchronize_session=False
            )
            db.commit()
    finally:
        db.close()
    yield
