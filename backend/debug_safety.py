import sys
import os
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.graph.database import SessionLocal
from app.graph.models import Household
from app.agents.safety import run_safety_check

def test():
    db = SessionLocal()
    household_record = db.query(Household).filter(Household.name == "Rahman Family").order_by(Household.id.desc()).first()
    if not household_record:
        print("Household not found")
        return
        
    envelope = run_safety_check(
        db=db,
        household_id=household_record.id,
        member_ref="Baba",
        drug="ibuprofen",
        purpose="pain",
        language="en"
    )
    
    print(json.dumps(envelope, indent=2))
    
    # Check safe
    envelope_safe = run_safety_check(
        db=db,
        household_id=household_record.id,
        member_ref="Self",
        drug="paracetamol",
        dose="500mg"
    )
    print(json.dumps(envelope_safe, indent=2))

if __name__ == "__main__":
    test()
