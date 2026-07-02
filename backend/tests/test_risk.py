import pytest
from sqlalchemy.orm import Session
from app.graph.database import SessionLocal
from app.graph.models import Household, Member, Medication, Condition
from app.graph.risk import compute_risk, recompute_and_store
from app.api.member import get_member_twin

def test_risk_computation():
    db = SessionLocal()
    try:
        # Get Baba
        baba = db.query(Member).join(Household).filter(Household.name == "Rahman Family", Member.role_label == "Baba").first()
        assert baba is not None

        # Clean slate
        baba.kidney_impaired = False
        baba.liver_impaired = False
        db.commit()

        # Age is 68 -> score = 0.2
        # Conditions = Hypertension, Type 2 Diabetes -> 2 * 0.15 = 0.3
        # Total = 0.5 (MED)
        score, band, factors = compute_risk(baba)
        assert band == "MED"
        assert score == pytest.approx(0.5, 0.01)
        
        # Now add kidney_impaired and anticoagulant
        baba.kidney_impaired = True
        db.add(Medication(member_id=baba.id, name="Warfarin", dose="5mg"))
        db.commit()
        db.refresh(baba)
        
        # score = 0.5 + 0.3 (kidney) + 0.4 (anticoag + kidney) = 1.2 -> capped at 1.0 (HIGH)
        score, band, factors = compute_risk(baba)
        assert band == "HIGH"
        assert score == 1.0
        assert "anticoagulant + kidney impairment" in factors
        
        # Test recompute
        recompute_and_store(db, baba.id)
        baba = db.query(Member).filter(Member.id == baba.id).first()
        assert baba.risk_score == 1.0
        assert "anticoagulant + kidney impairment" in baba.risk_factors
        
        # Test endpoint
        twin = get_member_twin(baba.id, db)
        assert twin["risk_band"] == "HIGH"
        assert "HIGH risk due to" in twin["ai_summary"]
        
    finally:
        db.close()
