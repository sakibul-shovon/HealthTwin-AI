from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.graph.database import get_db
from app.graph.models import Household
from app.graph.schemas import ChatMessageSchema
from app.memory import chat_store

router = APIRouter(prefix="/chat", tags=["chat"])
DEFAULT_HOUSEHOLD_ID = 1

def _get_household_id(db: Session) -> int:
    hh = db.query(Household).filter(Household.name == "Rahman Family").first()
    return hh.id if hh else DEFAULT_HOUSEHOLD_ID

@router.get("/history", response_model=List[ChatMessageSchema])
def get_chat_history(limit: int = Query(50, ge=1, le=100), before: Optional[int] = None, db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    return chat_store.get_recent(db, household_id, limit=limit, before_id=before)

@router.delete("/history")
def clear_chat_history(db: Session = Depends(get_db)):
    household_id = _get_household_id(db)
    deleted = chat_store.clear(db, household_id)
    return {"deleted": deleted}
