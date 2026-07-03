from sqlalchemy.orm import Session
from . import models, schemas
from typing import Optional

def get_household(db: Session, household_id: int) -> Optional[schemas.HouseholdSchema]:
    household = db.query(models.Household).filter(models.Household.id == household_id).first()
    if not household:
        return None
    
    # Relationships aren't loaded natively inside Household, so we fetch them by member
    member_ids = [m.id for m in household.members]
    relationships = db.query(models.Relationship).filter(
        models.Relationship.from_member_id.in_(member_ids)
    ).all()
    
    household_schema = schemas.HouseholdSchema.model_validate(household)
    household_schema.relationships = [schemas.RelationshipSchema.model_validate(r) for r in relationships]
    
    return household_schema

def get_member_profile(db: Session, household_id: int, role_label: str) -> schemas.MemberProfileSchema:
    member = db.query(models.Member).filter(
        models.Member.household_id == household_id,
        models.Member.role_label.ilike(role_label)
    ).first()
    
    if not member:
        return None
        
    return schemas.MemberProfileSchema(
        role_label=member.role_label,
        age=member.age,
        sex=member.sex,
        weight_kg=member.weight_kg,
        flags=schemas.MemberFlagsSchema(
            kidney_impaired=member.kidney_impaired,
            liver_impaired=member.liver_impaired,
            pregnant=member.pregnant
        ),
        medications=[schemas.MedicationBase(name=m.name, dose=m.dose) for m in member.medications],
        conditions=[c.name for c in member.conditions],
        allergies=[schemas.AllergyBase(substance=a.substance, reaction=a.reaction) for a in member.allergies]
    )

def resolve_member(db: Session, household_id: int, spoken_name: str) -> Optional[models.Member]:
    """Matches spoken names/aliases to a role_label."""
    spoken_name_lower = spoken_name.lower().strip()
    
    # Basic alias map (extend as needed)
    aliases = {
        "father": "Baba",
        "dad": "Baba",
        "baba": "Baba",
        "বাবা": "Baba",
        "আব্বা": "Baba",
        "আব্বু": "Baba",
        "mother": "Ma",
        "mom": "Ma",
        "mum": "Ma",
        "mama": "Ma",
        "ma": "Ma",
        "মা": "Ma",
        "আম্মা": "Ma",
        "আম্মু": "Ma",
        "son": "Child",
        "daughter": "Child",
        "child": "Child",
        "kid": "Child",
        "ছেলে": "Child",
        "মেয়ে": "Child",
        "self": "Self",
        "me": "Self",
        "myself": "Self",
        "আমি": "Self",
        "আমার": "Self",
    }
    
    # Direct match first, then fallback to alias
    role_label = aliases.get(spoken_name_lower, spoken_name_lower)
    
    member = db.query(models.Member).filter(
        models.Member.household_id == household_id,
        models.Member.role_label.ilike(role_label)
    ).first()
    
    return member

def member_health_summary(db: Session, household_id: int, spoken_name: str, language: str = "en") -> Optional[dict]:
    """Return a formatted health summary for a named member, or None if not found."""
    member = resolve_member(db, household_id, spoken_name)
    if not member:
        return None

    meds = ", ".join(f"{m.name} {m.dose}" for m in member.medications) if member.medications else "none"
    conditions = ", ".join(c.name for c in member.conditions) if member.conditions else "none"
    flags = []
    if member.kidney_impaired:
        flags.append("kidney impaired")
    if member.liver_impaired:
        flags.append("liver impaired")
    if member.pregnant:
        flags.append("pregnant")
    recent = sorted(member.symptoms, key=lambda s: s.logged_at, reverse=True)[:3]
    symptoms_text = ", ".join(s.symptom for s in recent) if recent else "none recorded"

    if language == "bn":
        spoken = (
            f"{member.role_label} ({member.display_name}), বয়স {member.age}। "
            f"রোগ: {conditions}। ওষুধ: {meds}। সাম্প্রতিক উপসর্গ: {symptoms_text}।"
        )
        if flags:
            spoken += f" বিশেষ তথ্য: {', '.join(flags)}।"
    else:
        spoken = (
            f"{member.role_label} ({member.display_name}), age {member.age}. "
            f"Conditions: {conditions}. Medications: {meds}. Recent symptoms: {symptoms_text}."
        )
        if flags:
            spoken += f" Flags: {', '.join(flags)}."

    detail_lines = [
        f"**{member.role_label}** — {member.display_name}, {member.age} yrs, {member.sex}",
        f"Conditions: {conditions}",
        f"Medications: {meds}",
        f"Recent symptoms: {symptoms_text}",
    ]
    if flags:
        detail_lines.append(f"Flags: {', '.join(flags)}")

    return {
        "verdict": "INFO",
        "spoken": spoken,
        "display": {
            "title": f"{member.role_label}'s Health Summary",
            "conflict": None,
            "alternative": None,
            "detail": "\n".join(detail_lines),
            "member": member.role_label,
        },
        "evidence": {"source": "Household profile", "confidence": 1.0, "grounding_score": 1.0},
        "actions": [],
        "member_focus": member.role_label,
        "language": language,
    }


def add_member(db: Session, household_id: int, data: dict) -> models.Member:
    member = models.Member(
        household_id=household_id,
        display_name=data.get("display_name") or data.get("role_label", "New Member"),
        role_label=data.get("role_label", "New Member"),
        age=int(data.get("age", 0)),
        sex=data.get("sex", "unknown"),
        weight_kg=data.get("weight_kg"),
        kidney_impaired=data.get("kidney_impaired", False),
        liver_impaired=data.get("liver_impaired", False),
        pregnant=data.get("pregnant", False),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

def add_medication(db: Session, member_id: int, name: str, dose: str) -> models.Medication:
    existing = db.query(models.Medication).filter(
        models.Medication.member_id == member_id,
        models.Medication.name.ilike(name.strip()),
    ).first()
    if existing:
        return existing
    med = models.Medication(member_id=member_id, name=name, dose=dose or "—")
    db.add(med)
    db.commit()
    db.refresh(med)
    from app.memory.events import log_event
    log_event(db, member_id, "medication_added", {"name": name, "dose": dose})
    from .risk import recompute_and_store
    recompute_and_store(db, member_id)
    return med

def add_condition(db: Session, member_id: int, name: str) -> models.Condition:
    existing = db.query(models.Condition).filter(
        models.Condition.member_id == member_id,
        models.Condition.name.ilike(name.strip()),
    ).first()
    if existing:
        return existing
    cond = models.Condition(member_id=member_id, name=name)
    db.add(cond)
    db.commit()
    db.refresh(cond)
    from .risk import recompute_and_store
    recompute_and_store(db, member_id)
    return cond

def add_allergy(db: Session, member_id: int, substance: str, reaction: Optional[str] = None) -> models.Allergy:
    allergy = models.Allergy(member_id=member_id, substance=substance, reaction=reaction)
    db.add(allergy)
    db.commit()
    db.refresh(allergy)
    return allergy

def log_symptom(db: Session, member_id: int, symptom: str, severity: Optional[str] = None) -> models.SymptomLog:
    entry = models.SymptomLog(member_id=member_id, symptom=symptom, severity=severity)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    from app.memory.events import log_event
    log_event(db, member_id, "symptom_logged", {"symptom": symptom, "severity": severity})
    return entry

def update_member_flags(db: Session, member_id: int, **flags) -> Optional[models.Member]:
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        return None
    for key, value in flags.items():
        if hasattr(member, key):
            setattr(member, key, value)
    db.commit()
    db.refresh(member)
    from .risk import recompute_and_store
    recompute_and_store(db, member_id)
    return member

def set_caregiver(
    db: Session,
    from_member_id: int,
    to_member_id: int,
    is_caregiver: bool = True,
    relationship_type: models.RelationshipType = models.RelationshipType.parent_of,
):
    rel = db.query(models.Relationship).filter(
        models.Relationship.from_member_id == from_member_id,
        models.Relationship.to_member_id == to_member_id,
    ).first()
    if rel:
        rel.caregiver = is_caregiver
    else:
        rel = models.Relationship(
            from_member_id=from_member_id,
            to_member_id=to_member_id,
            type=relationship_type,
            caregiver=is_caregiver,
        )
        db.add(rel)
    db.commit()

def remove_member(db: Session, member_id: int) -> bool:
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        return False
    # Relationships
    db.query(models.Relationship).filter((models.Relationship.from_member_id == member_id) | (models.Relationship.to_member_id == member_id)).delete()
    # Others cascade or delete manually
    db.query(models.Medication).filter(models.Medication.member_id == member_id).delete()
    db.query(models.Condition).filter(models.Condition.member_id == member_id).delete()
    db.query(models.Allergy).filter(models.Allergy.member_id == member_id).delete()
    db.query(models.SymptomLog).filter(models.SymptomLog.member_id == member_id).delete()
    db.query(models.Reminder).filter(models.Reminder.member_id == member_id).delete()
    db.query(models.HealthEvent).filter(models.HealthEvent.member_id == member_id).delete()
    db.query(models.DocChunk).filter(models.DocChunk.member_id == member_id).delete()
    
    db.delete(member)
    db.commit()
    return True

def remove_medication(db: Session, member_id: int, name: str) -> bool:
    med = db.query(models.Medication).filter(models.Medication.member_id == member_id, models.Medication.name.ilike(name)).first()
    if not med:
        return False
    db.delete(med)
    db.commit()
    from app.memory.events import log_event
    log_event(db, member_id, "medication_removed", {"name": med.name})
    from .risk import recompute_and_store
    recompute_and_store(db, member_id)
    return True

def remove_condition(db: Session, member_id: int, name: str) -> bool:
    cond = db.query(models.Condition).filter(models.Condition.member_id == member_id, models.Condition.name.ilike(name)).first()
    if not cond:
        return False
    db.delete(cond)
    db.commit()
    from .risk import recompute_and_store
    recompute_and_store(db, member_id)
    return True

def remove_allergy(db: Session, member_id: int, substance: str) -> bool:
    allergy = db.query(models.Allergy).filter(models.Allergy.member_id == member_id, models.Allergy.substance.ilike(substance)).first()
    if not allergy:
        return False
    db.delete(allergy)
    db.commit()
    return True

def rename_member(db: Session, member_id: int, display_name: Optional[str] = None, role_label: Optional[str] = None) -> Optional[models.Member]:
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        return None
    if display_name:
        member.display_name = display_name
    if role_label:
        member.role_label = role_label
    db.commit()
    db.refresh(member)
    return member

def update_relationship(db: Session, from_id: int, to_id: int, rel_type: models.RelationshipType, caregiver: bool) -> models.Relationship:
    rel = db.query(models.Relationship).filter(models.Relationship.from_member_id == from_id, models.Relationship.to_member_id == to_id).first()
    if rel:
        rel.type = rel_type
        rel.caregiver = caregiver
    else:
        rel = models.Relationship(from_member_id=from_id, to_member_id=to_id, type=rel_type, caregiver=caregiver)
        db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel

def merge_members(db: Session, keep_id: int, remove_id: int) -> Optional[models.Member]:
    keep_member = db.query(models.Member).filter(models.Member.id == keep_id).first()
    remove_member_obj = db.query(models.Member).filter(models.Member.id == remove_id).first()
    
    if not keep_member or not remove_member_obj:
        return None

    # Move meds
    db.query(models.Medication).filter(models.Medication.member_id == remove_id).update({"member_id": keep_id})
    
    # Move conditions
    db.query(models.Condition).filter(models.Condition.member_id == remove_id).update({"member_id": keep_id})
        
    # Move allergies
    db.query(models.Allergy).filter(models.Allergy.member_id == remove_id).update({"member_id": keep_id})

    # Move symptom logs
    db.query(models.SymptomLog).filter(models.SymptomLog.member_id == remove_id).update({"member_id": keep_id})
        
    # Move reminders
    db.query(models.Reminder).filter(models.Reminder.member_id == remove_id).update({"member_id": keep_id})
        
    # Move health events
    db.query(models.HealthEvent).filter(models.HealthEvent.member_id == remove_id).update({"member_id": keep_id})
    db.query(models.DocChunk).filter(models.DocChunk.member_id == remove_id).update({"member_id": keep_id})

    # Update relationships (be careful of duplicates)
    for rel in db.query(models.Relationship).filter(models.Relationship.from_member_id == remove_id).all():
        if not db.query(models.Relationship).filter(models.Relationship.from_member_id == keep_id, models.Relationship.to_member_id == rel.to_member_id).first():
            rel.from_member_id = keep_id
        else:
            db.delete(rel)
            
    for rel in db.query(models.Relationship).filter(models.Relationship.to_member_id == remove_id).all():
        if not db.query(models.Relationship).filter(models.Relationship.from_member_id == rel.from_member_id, models.Relationship.to_member_id == keep_id).first():
            rel.to_member_id = keep_id
        else:
            db.delete(rel)
    
    # Finally delete the duplicate member
    db.delete(remove_member_obj)
    db.commit()
    
    from .risk import recompute_and_store
    recompute_and_store(db, keep_id)
    
    return keep_member
