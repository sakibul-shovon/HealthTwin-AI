import sys
import os
from datetime import datetime, timedelta

# Add the root directory to sys.path so we can run this directly if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.graph.database import SessionLocal, engine, Base
from app.graph.models import (
    Household, Member, Condition, Medication, Allergy, Relationship, RelationshipType,
    SymptomLog, AgentTrace,
)

def seed_rahman_family(db: Session):
    # Idempotent: Wipe previous Rahman household — clear FK-dependent tables first
    existing = db.query(Household).filter(Household.name == "Rahman Family").first()
    if existing:
        member_ids = [m.id for m in existing.members]
        if member_ids:
            db.query(AgentTrace).filter(AgentTrace.member_id.in_(member_ids)).delete(synchronize_session=False)
            db.commit()
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
    
    seed_demo_fever_cluster(db, household.id)
    return household.id

def seed_demo_fever_cluster(db: Session, household_id: int):
    from app.config import settings
    # Find Ma and Child
    household = db.query(Household).filter(Household.id == household_id).first()
    if not household:
        return
    ma = next((m for m in household.members if m.role_label == "Ma"), None)
    child = next((m for m in household.members if m.role_label == "Child"), None)
    
    if not ma or not child:
        return
        
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=settings.CLUSTER_WINDOW_HOURS)
    
    # Guard against double seeding
    existing_logs = db.query(SymptomLog).filter(
        SymptomLog.member_id.in_([ma.id, child.id]),
        SymptomLog.symptom == "fever",
        SymptomLog.logged_at >= cutoff
    ).count()
    
    if existing_logs >= 2:
        return
        
    db.add_all([
        SymptomLog(member_id=ma.id, symptom="fever", severity=7, logged_at=now - timedelta(hours=1)),
        SymptomLog(member_id=child.id, symptom="fever", severity=6, logged_at=now - timedelta(hours=2)),
    ])
    db.commit()

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # Create tables just in case, though alembic is preferred
        Base.metadata.create_all(bind=engine)
        seed_rahman_family(db)
    finally:
        db.close()
