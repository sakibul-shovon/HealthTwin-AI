import os
import sys

# Add the project root directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.graph.database import SessionLocal
from app.graph.crud import get_household, get_member_profile, resolve_member
from app.graph.models import Household

def test_db():
    db = SessionLocal()
    try:
        household_record = db.query(Household).filter(Household.name == "Rahman Family").order_by(Household.id.desc()).first()
        if not household_record:
            print("Household not found!")
            return
            
        hh_id = household_record.id
        print(f"Guest Household ID: {hh_id}")
        
        household = get_household(db, hh_id)
        print(f"Household Name: {household.name}")
        print(f"Members: {[m.display_name for m in household.members]}")
        
        baba_profile = get_member_profile(db, hh_id, "Baba")
        print("\nBaba Profile Schema:")
        print(baba_profile.model_dump_json(indent=2))
        
        resolved = resolve_member(db, hh_id, "বাবা")
        print(f"\nResolved 'বাবা': {resolved.role_label} (ID: {resolved.id})")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_db()
