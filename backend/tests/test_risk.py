import pytest
from sqlalchemy.orm import Session
from app.graph.database import SessionLocal
from app.graph.models import Household, Member, Medication, Condition
from app.graph.risk import compute_risk, recompute_and_store
from app.api.member import get_member_twin

def test_risk_computation():
    db = SessionLocal()
    baba = db.query(Member).join(Household).filter(
        Household.name == "Rahman Family", Member.role_label == "Baba"
    ).first()
    assert baba is not None

    # Snapshot original flags so we can restore them
    orig_kidney = baba.kidney_impaired
    orig_liver = baba.liver_impaired
    added_med_id = None

    try:
        # Clean slate: remove any leftover test medications from prior runs
        # (keep only the seeded ones — name "Warfarin" with dose "5mg" is seeded;
        #  extras added by previous test runs have the same name but we can remove dupes)
        warfarins = [m for m in baba.medications if "warfarin" in m.name.lower()]
        for extra in warfarins[1:]:          # keep the first (seeded), delete any extras
            db.delete(extra)
        baba.kidney_impaired = False
        baba.liver_impaired = False
        db.commit()
        db.refresh(baba)

        # Age 68 → +0.2; 2 conditions (Hypertension, AF) → +0.3; Warfarin+Amlodipine present
        # but kidney_impaired=False so anticoag combo doesn't fire. Total = 0.5 → MED
        score, band, factors = compute_risk(baba)
        assert band == "MED", f"Expected MED, got {band} (score={score}, factors={factors})"
        assert score == pytest.approx(0.5, abs=0.01)

        # Add kidney impairment and an extra anticoagulant med
        baba.kidney_impaired = True
        extra_med = Medication(member_id=baba.id, name="warfarin_test", dose="5mg")
        db.add(extra_med)
        db.commit()
        db.refresh(baba)
        added_med_id = extra_med.id

        # score = 0.5 + 0.3 (kidney) + 0.4 (anticoag + kidney) = 1.2 → capped 1.0 → HIGH
        score, band, factors = compute_risk(baba)
        assert band == "HIGH", f"Expected HIGH, got {band} (score={score})"
        assert score == 1.0
        assert "anticoagulant + kidney impairment" in factors

        # recompute_and_store persists to DB
        recompute_and_store(db, baba.id)
        baba = db.query(Member).filter(Member.id == baba.id).first()
        assert baba.risk_score == 1.0
        assert "anticoagulant + kidney impairment" in baba.risk_factors

        # Twin endpoint
        twin = get_member_twin(baba.id, db)
        assert twin["risk_band"] == "HIGH"
        assert "HIGH risk due to" in twin["ai_summary"]

    finally:
        # Restore Baba to original seeded state
        if added_med_id:
            med = db.query(Medication).filter(Medication.id == added_med_id).first()
            if med:
                db.delete(med)
        baba = db.query(Member).filter(Member.id == baba.id).first()
        if baba:
            baba.kidney_impaired = orig_kidney
            baba.liver_impaired = orig_liver
        db.commit()
        db.close()
