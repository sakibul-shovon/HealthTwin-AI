from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.graph.database import get_db
from app.graph.models import Household
from app.graph.schemas import ChatMessageSchema
from app.memory import chat_store

router = APIRouter(prefix="/chat", tags=["chat"])
DEFAULT_HOUSEHOLD_ID = 1


def _get_household_id(db: Session) -> int:
    hh = db.query(Household).filter(Household.name == "Rahman Family").first()
    return hh.id if hh else DEFAULT_HOUSEHOLD_ID


# ── Session schemas ───────────────────────────────────────────────────────────

class SessionOut(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str
    message_count: int

    class Config:
        from_attributes = True


class CreateSessionIn(BaseModel):
    title: str = "New chat"


class RenameSessionIn(BaseModel):
    title: str


# ── Session endpoints ─────────────────────────────────────────────────────────

@router.get("/sessions", response_model=List[SessionOut])
def list_sessions(db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    sessions = chat_store.get_sessions(db, household_id)
    return [
        SessionOut(
            id=s.id,
            title=s.title,
            created_at=s.created_at.isoformat() if s.created_at else "",
            updated_at=s.updated_at.isoformat() if s.updated_at else "",
            message_count=len(s.messages),
        )
        for s in sessions
    ]


@router.post("/sessions", response_model=SessionOut)
def create_session(body: CreateSessionIn, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    s = chat_store.create_session(db, household_id, body.title)
    return SessionOut(
        id=s.id,
        title=s.title,
        created_at=s.created_at.isoformat() if s.created_at else "",
        updated_at=s.updated_at.isoformat() if s.updated_at else "",
        message_count=0,
    )


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def rename_session(session_id: int, body: RenameSessionIn, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    s = chat_store.rename_session(db, session_id, household_id, body.title)
    if not s:
        raise HTTPException(404, "Session not found")
    return SessionOut(
        id=s.id,
        title=s.title,
        created_at=s.created_at.isoformat() if s.created_at else "",
        updated_at=s.updated_at.isoformat() if s.updated_at else "",
        message_count=len(s.messages),
    )


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    ok = chat_store.delete_session(db, session_id, household_id)
    if not ok:
        raise HTTPException(404, "Session not found")
    return {"deleted": session_id}


# ── Message endpoints ─────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageSchema])
def get_session_messages(
    session_id: int,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[int] = None,
    db: Session = Depends(get_db),
):
    household_id = _get_household_id(db)
    return chat_store.get_recent(db, household_id, limit=limit, before_id=before, session_id=session_id)


@router.delete("/sessions/{session_id}/messages")
def clear_session_messages(session_id: int, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    deleted = chat_store.clear(db, household_id, session_id=session_id)
    return {"deleted": deleted}


# ── Legacy global history (kept for backwards compat) ────────────────────────

@router.get("/history", response_model=List[ChatMessageSchema])
def get_chat_history(limit: int = Query(50, ge=1, le=100), before: Optional[int] = None, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    return chat_store.get_recent(db, household_id, limit=limit, before_id=before)


@router.delete("/history")
def clear_chat_history(db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    deleted = chat_store.clear(db, household_id)
    return {"deleted": deleted}
