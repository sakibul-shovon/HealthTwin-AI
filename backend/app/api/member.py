from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.graph.database import get_db
from app.graph.models import Member, Relationship, HealthEvent
from app.graph.schemas import MemberTwinSchema
from app.graph.risk import compute_risk

router = APIRouter(prefix="/member", tags=["member"])

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
    
    events = db.query(HealthEvent).filter(HealthEvent.member_id == m.id).order_by(HealthEvent.created_at.desc()).limit(3).all()
    recent_alerts = [{"type": e.event_type, "detail": e.detail, "date": e.created_at.isoformat()} for e in events]
    
    if band == "HIGH":
        ai_summary = f"{m.role_label} is at HIGH risk due to {', '.join(factors) if factors else 'multiple factors'}. Careful monitoring of {len(meds)} medications is advised."
    elif band == "MED":
        ai_summary = f"{m.role_label} is at MODERATE risk. Existing conditions and medications require routine management."
    else:
        ai_summary = f"{m.role_label} is at LOW risk. Maintain general wellness and preventative care."
        
    return {
        "member": m.role_label,
        "age": m.age,
        "sex": m.sex,
        "risk_score": score,
        "risk_band": band,
        "risk_factors": factors,
        "ai_summary": ai_summary,
        "medications": meds,
        "conditions": conds,
        "allergies": allergies,
        "flags": flags,
        "caregiver": caregiver,
        "reminders": reminders,
        "recent_alerts": recent_alerts
    }
