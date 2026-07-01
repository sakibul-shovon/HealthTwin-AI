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

# --- Write Helpers (Signatures for Step 09) ---

def add_member(db: Session, household_id: int, data: dict):
    pass

def add_medication(db: Session, member_id: int, name: str, dose: str):
    pass

def add_condition(db: Session, member_id: int, name: str):
    pass

def add_allergy(db: Session, member_id: int, substance: str, reaction: Optional[str] = None):
    pass

def log_symptom(db: Session, member_id: int, symptom: str, severity: Optional[str] = None):
    pass

def set_caregiver(db: Session, from_member_id: int, to_member_id: int, is_caregiver: bool = True):
    pass
