import sys
import os

# Add the root directory to sys.path so we can run this directly if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.graph.database import SessionLocal, engine, Base
from app.graph.models import (
    Household, Member, Condition, Medication, Allergy, Relationship, RelationshipType
)

def seed_rahman_family(db: Session):
    # Idempotent: Wipe previous Rahman household if it exists (assuming household 1 is Rahman for now)
    existing = db.query(Household).filter(Household.name == "Rahman Family").first()
    if existing:
        db.delete(existing)
        db.commit()
    
    # 1. Create Household
    household = Household(name="Rahman Family")
    db.add(household)
    db.commit()
    db.refresh(household)

    # 2. Create Members
    baba = Member(
        household_id=household.id, display_name="Rahman Sr.", role_label="Baba", 
        age=68, sex="M", weight_kg=75.0, kidney_impaired=True
    )
    ma = Member(
        household_id=household.id, display_name="Mrs. Rahman", role_label="Ma", 
        age=61, sex="F", weight_kg=65.0
    )
    self_member = Member(
        household_id=household.id, display_name="Rafiq", role_label="Self", 
        age=34, sex="M", weight_kg=70.0
    )
    child = Member(
        household_id=household.id, display_name="Ayaan", role_label="Child", 
        age=8, sex="M", weight_kg=25.0
    )
    
    db.add_all([baba, ma, self_member, child])
    db.commit()
    db.refresh(baba)
    db.refresh(ma)
    db.refresh(self_member)
    db.refresh(child)

    # 3. Add Conditions
    db.add_all([
        Condition(member_id=baba.id, name="Hypertension"),
        Condition(member_id=baba.id, name="Atrial fibrillation"),
        Condition(member_id=ma.id, name="Type 2 diabetes")
    ])

    # 4. Add Medications
    db.add_all([
        Medication(member_id=baba.id, name="Warfarin", dose="5mg"),
        Medication(member_id=baba.id, name="Amlodipine", dose="5mg"),
        Medication(member_id=ma.id, name="Metformin", dose="500mg")
    ])

    # 5. Add Allergies
    db.add(Allergy(member_id=ma.id, substance="Penicillin", reaction="rash"))

    # 6. Add Relationships
    db.add_all([
        Relationship(from_member_id=self_member.id, to_member_id=baba.id, type=RelationshipType.child_of),
        Relationship(from_member_id=self_member.id, to_member_id=ma.id, type=RelationshipType.child_of),
        Relationship(from_member_id=child.id, to_member_id=self_member.id, type=RelationshipType.child_of),
        Relationship(from_member_id=ma.id, to_member_id=baba.id, type=RelationshipType.spouse_of, caregiver=True)
    ])
    
    db.commit()
    print(f"Successfully seeded the Rahman family into household {household.id}")
    return household.id

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # Create tables just in case, though alembic is preferred
        Base.metadata.create_all(bind=engine)
        seed_rahman_family(db)
    finally:
        db.close()
