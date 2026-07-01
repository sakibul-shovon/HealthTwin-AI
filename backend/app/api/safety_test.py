from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.graph.database import get_db
from app.graph.models import Household
from app.agents.safety import run_safety_check

router = APIRouter(prefix="/api/_test", tags=["test"])

class SafetyCheckRequest(BaseModel):
    member: str
    drug: str
    dose: Optional[str] = None
    purpose: Optional[str] = None
    language: Optional[str] = "en"

@router.post("/safety")
def test_safety_agent(req: SafetyCheckRequest, db: Session = Depends(get_db)):
    # Find guest household 
    household_record = db.query(Household).filter(Household.name == "Rahman Family").order_by(Household.id.desc()).first()
    if not household_record:
        raise HTTPException(status_code=404, detail="Rahman family household not found")
        
    envelope = run_safety_check(
        db=db,
        household_id=household_record.id,
        member_ref=req.member,
        drug=req.drug,
        dose=req.dose,
        purpose=req.purpose,
        language=req.language or "en"
    )
    
    return envelope
