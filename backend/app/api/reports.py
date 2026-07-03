from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.graph.database import get_db
from app.graph.models import Household
from app.agents.report import generate_report, REPORT_TYPES

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportRequest(BaseModel):
    type: str = "family_summary"
    member_id: Optional[int] = None
    language: Optional[str] = "en"


@router.post("/generate")
def generate_report_endpoint(req: ReportRequest, db: Session = Depends(get_db)):
    hh = db.query(Household).filter(Household.name == "Rahman Family").first()
    household_id = hh.id if hh else 1
    report_type = req.type if req.type in REPORT_TYPES else "family_summary"
    result = generate_report(db, household_id, report_type, req.member_id, req.language or "en")
    return result


@router.get("/types")
def list_report_types():
    return {"types": sorted(REPORT_TYPES)}
