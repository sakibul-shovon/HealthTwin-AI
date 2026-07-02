from sqlalchemy.orm import Session
from typing import Optional
from app.graph.models import ChatMessage

def save_turn(db: Session, household_id: int, role: str, text: str, envelope: dict = None, intent: str = None, member_focus: str = None, language: str = "en") -> ChatMessage:
    msg = ChatMessage(
        household_id=household_id,
        role=role,
        text=text,
        envelope=envelope,
        intent=intent,
        member_focus=member_focus,
        language=language
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_recent(db: Session, household_id: int, limit: int = 20, before_id: Optional[int] = None) -> list[ChatMessage]:
    query = db.query(ChatMessage).filter(ChatMessage.household_id == household_id)
    if before_id is not None:
        query = query.filter(ChatMessage.id < before_id)
    query = query.order_by(ChatMessage.id.desc())
    msgs = query.limit(limit).all()
    return list(reversed(msgs))

def clear(db: Session, household_id: int) -> int:
    deleted = db.query(ChatMessage).filter(ChatMessage.household_id == household_id).delete(synchronize_session=False)
    db.commit()
    return deleted
