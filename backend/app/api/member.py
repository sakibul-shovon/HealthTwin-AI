from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.graph.database import get_db
from app.graph.models import Member, Relationship, HealthEvent
from app.graph.schemas import MemberTwinSchema, HealthEventSchema, MemberSchema, MemberCreateSchema, MemberUpdateSchema
from app.graph.risk import compute_risk
from app.graph.crud import add_member, remove_member, merge_members, add_medication, remove_medication, add_condition, remove_condition, add_allergy, remove_allergy
from app.memory.events import get_timeline
from app.core.auth import get_current_household_id
from typing import List


class ItemPayload(BaseModel):
    name: str
    dose: str = ""
    reaction: str = ""


router = APIRouter(prefix="/member", tags=["member"])


@router.post("", response_model=MemberSchema)
def create_member(
    data: MemberCreateSchema,
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    return add_member(db, household_id, data.model_dump())


@router.patch("/{member_id}", response_model=MemberSchema)
def update_member(member_id: int, data: MemberUpdateSchema, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(m, key, value)
    db.commit()
    db.refresh(m)
    from app.graph.risk import recompute_and_store
    recompute_and_store(db, member_id)
    return m


@router.delete("/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    if not remove_member(db, member_id):
        raise HTTPException(status_code=404, detail="Member not found")
    return {"status": "success"}


@router.post("/{keep_id}/merge")
def merge_member(keep_id: int, remove_id: int = Body(..., embed=True), db: Session = Depends(get_db)):
    m = merge_members(db, keep_id, remove_id)
    if not m:
        raise HTTPException(status_code=400, detail="Merge failed (invalid IDs)")
    return {"status": "success"}


@router.post("/{member_id}/medication")
def add_member_medication(member_id: int, payload: ItemPayload, db: Session = Depends(get_db)):
    add_medication(db, member_id, payload.name, payload.dose)
    return {"status": "success"}


@router.delete("/{member_id}/medication/{name}")
def delete_member_medication(member_id: int, name: str, db: Session = Depends(get_db)):
    remove_medication(db, member_id, name)
    return {"status": "success"}


@router.post("/{member_id}/condition")
def add_member_condition(member_id: int, payload: ItemPayload, db: Session = Depends(get_db)):
    add_condition(db, member_id, payload.name)
    return {"status": "success"}


@router.delete("/{member_id}/condition/{name}")
def delete_member_condition(member_id: int, name: str, db: Session = Depends(get_db)):
    remove_condition(db, member_id, name)
    return {"status": "success"}


@router.post("/{member_id}/allergy")
def add_member_allergy(member_id: int, payload: ItemPayload, db: Session = Depends(get_db)):
    add_allergy(db, member_id, payload.name, payload.reaction)
    return {"status": "success"}


@router.delete("/{member_id}/allergy/{name}")
def delete_member_allergy(member_id: int, name: str, db: Session = Depends(get_db)):
    remove_allergy(db, member_id, name)
    return {"status": "success"}


@router.get("/{member_id}/twin", response_model=MemberTwinSchema)
def get_member_twin(member_id: int, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")

    score, band, factors = compute_risk(m)
    meds = [f"{med.name} {med.dose}" for med in m.medications]
    conds = [c.name for c in m.conditions]
    allergies = [a.substance for a in m.allergies]
    flags = []
    if m.kidney_impaired: flags.append("kidney impaired")
    if m.liver_impaired: flags.append("liver impaired")
    if m.pregnant: flags.append("pregnant")

    rel = db.query(Relationship).filter(Relationship.from_member_id == m.id, Relationship.caregiver == True).first()
    cg = db.query(Member).filter(Member.id == rel.to_member_id).first() if rel else None
    caregiver = cg.role_label if cg else "Family"
    reminders = [{"id": r.id, "time": r.time, "medication_id": r.medication_id} for r in m.reminders]
    events = get_timeline(db, m.id, limit=3)
    recent_alerts = [{"type": e.event_type, "detail": e.detail, "date": e.created_at.isoformat()} for e in events]

    if band == "HIGH":
        ai_summary = f"{m.role_label} is at HIGH risk due to {', '.join(factors) if factors else 'multiple factors'}. Careful monitoring of {len(meds)} medications is advised."
    elif band == "MED":
        ai_summary = f"{m.role_label} is at MODERATE risk. Existing conditions and medications require routine management."
    else:
        ai_summary = f"{m.role_label} is at LOW risk. Maintain general wellness and preventative care."

    return {
        "member": m.role_label, "age": m.age, "sex": m.sex,
        "risk_score": score, "risk_band": band, "risk_factors": factors,
        "ai_summary": ai_summary, "medications": meds, "conditions": conds,
        "allergies": allergies, "flags": flags, "caregiver": caregiver,
        "reminders": reminders, "recent_alerts": recent_alerts,
    }


@router.get("/{member_id}/timeline", response_model=List[HealthEventSchema])
def get_member_timeline(member_id: int, db: Session = Depends(get_db)):
    return get_timeline(db, member_id)
