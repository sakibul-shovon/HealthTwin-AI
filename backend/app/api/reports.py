from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.graph.database import get_db
from app.agents.report import generate_report, REPORT_TYPES
from app.core.auth import get_current_household_id

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportRequest(BaseModel):
    type: str = "family_summary"
    member_id: Optional[int] = None
    language: Optional[str] = "en"


@router.post("/generate")
def generate_report_endpoint(
    req: ReportRequest,
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    report_type = req.type if req.type in REPORT_TYPES else "family_summary"
    return generate_report(db, household_id, report_type, req.member_id, req.language or "en")


@router.get("/types")
def list_report_types():
    return {"types": sorted(REPORT_TYPES)}
