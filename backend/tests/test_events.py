import pytest
from sqlalchemy.orm import Session
from app.graph.database import SessionLocal
from app.graph.models import Household, Member, HealthEvent
from app.graph.crud import add_medication, log_symptom
from app.memory.events import get_timeline
from app.api.member import get_member_timeline

def test_events_timeline():
    db = SessionLocal()
    try:
        ma = db.query(Member).join(Household).filter(Household.name == "Rahman Family", Member.role_label == "Ma").first()
        assert ma is not None
        
        # Clear existing events for Ma
        db.query(HealthEvent).filter(HealthEvent.member_id == ma.id).delete()
        db.commit()

        # Add medication
        add_medication(db, ma.id, "Lisinopril", "10mg")
        
        # Log symptom
        log_symptom(db, ma.id, "Headache", "Mild")
        
        # Check timeline
        events = get_timeline(db, ma.id)
        assert len(events) == 2
        
        # Newest first, so symptom is first
        assert events[0].event_type == "symptom_logged"
        assert events[0].detail["symptom"] == "Headache"
        
        assert events[1].event_type == "medication_added"
        assert events[1].detail["name"] == "Lisinopril"
        
        # Check endpoint
        timeline_data = get_member_timeline(ma.id, db)
        assert len(timeline_data) == 2
        assert timeline_data[0].event_type == "symptom_logged"

    finally:
        db.close()
