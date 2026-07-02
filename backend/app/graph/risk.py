from sqlalchemy.orm import Session
from app.graph.models import Member

def compute_risk(member: Member) -> tuple[float, str, list[str]]:
    score = 0.0
    factors = []
    
    # 1. Age extremes
    if member.age > 65:
        score += 0.2
        factors.append("elderly")
    elif member.age < 2:
        score += 0.15
        factors.append("infant")

    # 2. Conditions
    conditions = [c.name.lower() for c in member.conditions]
    score += len(conditions) * 0.15
    if conditions:
        factors.append("chronic_conditions")

    # 3. Flags
    if member.kidney_impaired:
        score += 0.3
        factors.append("kidney_impaired")
    if member.liver_impaired:
        score += 0.3
        factors.append("liver_impaired")
    if member.pregnant:
        score += 0.2
        factors.append("pregnant")

    # 4. Polypharmacy
    med_names = [m.name.lower() for m in member.medications]
    if len(med_names) >= 4:
        score += 0.2
        factors.append("polypharmacy")
        
    # 5. Dangerous combos (e.g., anticoagulant + renal impairment)
    has_anticoagulant = any(kw in n for n in med_names for kw in ["warfarin", "heparin", "apixaban", "rivaroxaban", "dabigatran", "enoxaparin", "aspirin", "clopidogrel", "anticoagulant"])
    if has_anticoagulant and member.kidney_impaired:
        score += 0.4
        factors.append("anticoagulant + kidney impairment")
        
    score = min(1.0, score)
    
    if score >= 0.6:
        band = "HIGH"
    elif score >= 0.3:
        band = "MED"
    else:
        band = "LOW"
        
    return score, band, factors

def recompute_and_store(db: Session, member_id: int) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        return None
    score, band, factors = compute_risk(member)
    member.risk_score = score
    member.risk_factors = factors
    db.commit()
    db.refresh(member)
    return member
