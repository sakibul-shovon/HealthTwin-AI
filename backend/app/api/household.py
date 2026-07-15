from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.graph.database import get_db
from app.graph import crud, schemas
from app.graph.models import Member, HealthEvent
from app.core.auth import get_current_household_id
from fastapi import HTTPException

router = APIRouter()


@router.get("", response_model=schemas.HouseholdSchema)
def read_household(
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    household = crud.get_household(db, household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return household


@router.get("/risk-scan")
def risk_scan(
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    """
    Proactively scan all members' current medications for interactions,
    contraindications, allergies, and dose issues — no user prompt needed.
    Uses Gate 1 deterministic rules only (zero LLM, fast).
    """
    from app.spine.gate1_rules import check_drug_safety
    from app.graph.crud import get_member_profile

    members = (
        db.query(Member)
        .options(
            joinedload(Member.medications),
            joinedload(Member.conditions),
            joinedload(Member.allergies),
        )
        .filter(Member.household_id == household_id)
        .all()
    )

    results = []
    for member in members:
        if not member.medications:
            results.append({
                "member": member.role_label,
                "display_name": member.display_name,
                "risk_level": "SAFE",
                "conflicts": [],
                "checked_meds": 0,
            })
            continue

        profile = get_member_profile(db, household_id, member.role_label)
        seen_conflicts: set[tuple] = set()
        all_conflicts = []

        for med in member.medications:
            gate1 = check_drug_safety(profile, med.name, med.dose)
            if gate1.verdict != "SAFE":
                for c in gate1.conflicts:
                    key = (c.type, c.detail)
                    if key not in seen_conflicts:
                        seen_conflicts.add(key)
                        all_conflicts.append({
                            "drug": med.name,
                            "type": c.type,
                            "detail": c.detail,
                            "severity": c.severity,
                        })

        if any(c["severity"] == "high" for c in all_conflicts):
            risk_level = "UNSAFE"
        elif all_conflicts:
            risk_level = "CAUTION"
        else:
            risk_level = "SAFE"

        results.append({
            "member": member.role_label,
            "display_name": member.display_name,
            "risk_level": risk_level,
            "conflicts": all_conflicts[:3],
            "checked_meds": len(member.medications),
        })

    return {"scan": results, "scanned_at": datetime.utcnow().isoformat()}


@router.get("/events")
def household_events(
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
    limit: int = 15,
):
    """Aggregate health events for all members in the household, newest first."""
    member_ids = [
        row[0]
        for row in db.query(Member.id).filter(Member.household_id == household_id).all()
    ]
    if not member_ids:
        return {"events": []}

    events = (
        db.query(HealthEvent)
        .filter(HealthEvent.member_id.in_(member_ids))
        .order_by(HealthEvent.created_at.desc())
        .limit(limit)
        .all()
    )

    members = db.query(Member).filter(Member.household_id == household_id).all()
    id_to_label = {m.id: m.role_label for m in members}
    id_to_name = {m.id: m.display_name for m in members}

    return {
        "events": [
            {
                "id": e.id,
                "member": id_to_label.get(e.member_id, "Unknown"),
                "display_name": id_to_name.get(e.member_id, "Unknown"),
                "event_type": e.event_type,
                "detail": e.detail or {},
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ]
    }
