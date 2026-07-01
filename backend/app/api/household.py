from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.graph.database import get_db
from app.graph import crud, schemas

router = APIRouter()

# Guest mode household ID
GUEST_HOUSEHOLD_ID = 1

@router.get("/", response_model=schemas.HouseholdSchema)
def read_household(db: Session = Depends(get_db)):
    # Find the Rahman family
    from app.graph.models import Household
    household_record = db.query(Household).filter(Household.name == "Rahman Family").order_by(Household.id.desc()).first()
    if not household_record:
        raise HTTPException(status_code=404, detail="Guest household not found")
        
    household = crud.get_household(db, household_record.id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return household
