"""
Run once to add demo HealthEvents for all family members.
Usage:  python seed_events.py   (from inside backend/ folder)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from app.graph.database import SessionLocal
from app.graph.models import Household, Member, HealthEvent

def main():
    db = SessionLocal()
    try:
        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        if not hh:
            print("Rahman Family not found — run the app once to seed the family first.")
            return

        members = {m.role_label: m for m in hh.members}
        now = datetime.utcnow()

        events = [
            # Baba — warfarin + ibuprofen conflict flagged
            HealthEvent(
                member_id=members["Baba"].id,
                event_type="safety_alert",
                detail={"drug": "Ibuprofen", "conflict": "interacts with Warfarin", "verdict": "UNSAFE"},
                created_at=now - timedelta(hours=3),
            ),
            # Baba — new med added
            HealthEvent(
                member_id=members["Baba"].id,
                event_type="medication_added",
                detail={"name": "Amlodipine", "dose": "5mg"},
                created_at=now - timedelta(days=2),
            ),
            # Ma — metformin added
            HealthEvent(
                member_id=members["Ma"].id,
                event_type="medication_added",
                detail={"name": "Metformin", "dose": "500mg"},
                created_at=now - timedelta(days=5),
            ),
            # Ma — fever symptom
            HealthEvent(
                member_id=members["Ma"].id,
                event_type="symptom_logged",
                detail={"symptom": "fever", "severity": 7},
                created_at=now - timedelta(hours=1),
            ),
            # Child — fever
            HealthEvent(
                member_id=members["Child"].id,
                event_type="symptom_logged",
                detail={"symptom": "fever", "severity": 6},
                created_at=now - timedelta(hours=2),
            ),
            # Self — condition added
            HealthEvent(
                member_id=members["Self"].id,
                event_type="condition_added",
                detail={"name": "Seasonal allergies"},
                created_at=now - timedelta(days=1),
            ),
        ]

        db.add_all(events)
        db.commit()
        print(f"Seeded {len(events)} demo HealthEvents:")
        for e in events:
            m = next(m for m in hh.members if m.id == e.member_id)
            print(f"  [{m.role_label}] {e.event_type} — {e.detail}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
