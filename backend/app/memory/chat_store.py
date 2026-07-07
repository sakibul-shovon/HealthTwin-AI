from sqlalchemy.orm import Session
from typing import Optional
from app.graph.models import ChatMessage, ChatSession


# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(db: Session, household_id: int, title: str = "New chat") -> ChatSession:
    s = ChatSession(household_id=household_id, title=title)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def get_sessions(db: Session, household_id: int) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.household_id == household_id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


def get_session(db: Session, session_id: int, household_id: int) -> Optional[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.household_id == household_id)
        .first()
    )


def rename_session(db: Session, session_id: int, household_id: int, title: str) -> Optional[ChatSession]:
    s = get_session(db, session_id, household_id)
    if not s:
        return None
    s.title = title
    db.commit()
    db.refresh(s)
    return s


def delete_session(db: Session, session_id: int, household_id: int) -> bool:
    s = get_session(db, session_id, household_id)
    if not s:
        return False
    db.delete(s)
    db.commit()
    return True


def touch_session(db: Session, session_id: int) -> None:
    """Update updated_at so the session floats to the top of the list."""
    from datetime import datetime
    db.query(ChatSession).filter(ChatSession.id == session_id).update(
        {"updated_at": datetime.utcnow()}
    )
    db.commit()


# ── Messages ──────────────────────────────────────────────────────────────────

def save_turn(
    db: Session,
    household_id: int,
    role: str,
    text: str,
    envelope: dict = None,
    intent: str = None,
    member_focus: str = None,
    language: str = "en",
    session_id: Optional[int] = None,
) -> ChatMessage:
    msg = ChatMessage(
        household_id=household_id,
        session_id=session_id,
        role=role,
        text=text,
        envelope=envelope,
        intent=intent,
        member_focus=member_focus,
        language=language,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_recent(
    db: Session,
    household_id: int,
    limit: int = 20,
    before_id: Optional[int] = None,
    session_id: Optional[int] = None,
) -> list[ChatMessage]:
    q = db.query(ChatMessage).filter(ChatMessage.household_id == household_id)
    if session_id is not None:
        q = q.filter(ChatMessage.session_id == session_id)
    if before_id is not None:
        q = q.filter(ChatMessage.id < before_id)
    msgs = q.order_by(ChatMessage.id.desc()).limit(limit).all()
    return list(reversed(msgs))   # return oldest → newest


def clear(db: Session, household_id: int, session_id: Optional[int] = None) -> int:
    q = db.query(ChatMessage).filter(ChatMessage.household_id == household_id)
    if session_id is not None:
        q = q.filter(ChatMessage.session_id == session_id)
    deleted = q.delete(synchronize_session=False)
    db.commit()
    return deleted
