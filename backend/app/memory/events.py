from sqlalchemy.orm import Session
from typing import List
from app.graph.models import HealthEvent

def log_event(db: Session, member_id: int, event_type: str, detail: dict) -> None:
    try:
        event = HealthEvent(
            member_id=member_id,
            event_type=event_type,
            detail=detail
        )
        db.add(event)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to log health event: {e}")

def get_timeline(db: Session, member_id: int, limit: int = 50) -> List[HealthEvent]:
    return db.query(HealthEvent).filter(HealthEvent.member_id == member_id).order_by(HealthEvent.created_at.desc()).limit(limit).all()
