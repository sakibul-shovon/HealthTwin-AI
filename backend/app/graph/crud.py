from sqlalchemy.orm import Session
from . import models, schemas
from typing import Optional

def get_household(db: Session, household_id: int) -> schemas.HouseholdSchema:
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
        "baba": "Baba",
        "বাবা": "Baba",
        "mother": "Ma",
        "ma": "Ma",
        "মা": "Ma",
        "son": "Child",
        "child": "Child",
        "ছেলে": "Child",
        "self": "Self",
        "me": "Self",
        "আমি": "Self"
    }
    
    # Direct match first, then fallback to alias
    role_label = aliases.get(spoken_name_lower, spoken_name_lower)
    
    member = db.query(models.Member).filter(
        models.Member.household_id == household_id,
        models.Member.role_label.ilike(role_label)
    ).first()
    
    return member

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
    med = models.Medication(member_id=member_id, name=name, dose=dose or "—")
    db.add(med)
    db.commit()
    db.refresh(med)
    return med

def add_condition(db: Session, member_id: int, name: str) -> models.Condition:
    cond = models.Condition(member_id=member_id, name=name)
    db.add(cond)
    db.commit()
    db.refresh(cond)
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
    return member

def set_caregiver(db: Session, from_member_id: int, to_member_id: int, is_caregiver: bool = True):
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
            type=models.RelationshipType.parent_of,
            caregiver=is_caregiver,
        )
        db.add(rel)
    db.commit()
