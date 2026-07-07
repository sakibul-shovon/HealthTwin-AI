from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.graph.database import get_db
from app.graph import crud, schemas
from app.core.auth import get_current_household_id

router = APIRouter()


@router.get("", response_model=schemas.HouseholdSchema)
def read_household(
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    household = crud.get_household(db, household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return household
