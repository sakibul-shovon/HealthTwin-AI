from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.graph.database import get_db
from app.graph.models import Member
from app.spine.emergency import build_emergency_envelope

router = APIRouter(prefix="/emergency", tags=["emergency"])

@router.get("/{member_id}/card")
def get_emergency_card(member_id: int, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
        
    env = build_emergency_envelope(db, m.household_id, "EMERGENCY CARD", m.role_label, "en")
    return env.get("display", {}).get("critical", {})
