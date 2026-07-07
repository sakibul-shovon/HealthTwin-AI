"""
Seed the demo user linked to the existing Rahman Family household.
Run once: python seed_demo_user.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.graph.database import SessionLocal
from app.graph.models import User, Household
from app.core.auth import hash_password

DEMO_EMAIL = "demo@healthtwin.ai"
DEMO_PASSWORD = "Demo1234!"

def seed():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if existing:
            print(f"Demo user already exists (household_id={existing.household_id})")
            return

        hh = db.query(Household).filter(Household.name == "Rahman Family").first()
        if not hh:
            print("ERROR: Rahman Family household not found. Run the main seed first.")
            sys.exit(1)

        user = User(
            email=DEMO_EMAIL,
            hashed_password=hash_password(DEMO_PASSWORD),
            household_id=hh.id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✓ Demo user created: {DEMO_EMAIL} → household_id={hh.id} ({hh.name})")
        print(f"  Login: email={DEMO_EMAIL}  password={DEMO_PASSWORD}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
