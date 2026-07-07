"""
Resets the Rahman Family data to the original seeded state.
Run from the backend folder:
    python reset_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.graph.database import SessionLocal
from app.graph.models import User
from app.core.auth import hash_password
from app.graph.seed import seed_rahman_family
from sqlalchemy import text

DEMO_EMAIL    = "demo@healthtwin.ai"
DEMO_PASSWORD = "Demo1234!"

_HH = "SELECT id FROM households WHERE name = 'Rahman Family'"
_MB = f"SELECT id FROM members WHERE household_id IN ({_HH})"
_DC = f"SELECT id FROM documents WHERE household_id IN ({_HH})"

def reset():
    db = SessionLocal()
    try:
        # Delete all FK-dependent rows in strict dependency order so that
        # seed_rahman_family() can safely drop the household and its members.
        db.execute(text(f"DELETE FROM doc_chunks    WHERE document_id IN ({_DC})"))
        db.execute(text(f"DELETE FROM documents     WHERE household_id IN ({_HH})"))
        db.execute(text(f"DELETE FROM health_events WHERE member_id IN ({_MB})"))
        db.execute(text(f"DELETE FROM agent_traces  WHERE member_id IN ({_MB})"))
        db.execute(text(f"DELETE FROM chat_messages WHERE household_id IN ({_HH})"))
        db.execute(text(f"DELETE FROM chat_sessions WHERE household_id IN ({_HH})"))
        # users.household_id FK would block household deletion — drop demo user
        # now; it is recreated below pointing at the fresh household.
        db.execute(text(f"DELETE FROM users WHERE household_id IN ({_HH})"))
        db.commit()

        # Re-seed the Rahman Family (drops old household + ORM-cascaded rows,
        # then creates fresh household, members, conditions, medications, etc.)
        new_household_id = seed_rahman_family(db)
        print(f"Rahman Family re-seeded -> household_id={new_household_id}")

        # Update (or create) the demo user to point at the new household
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if user:
            user.household_id = new_household_id
            db.commit()
            print(f"Demo user updated -> household_id={new_household_id}")
        else:
            user = User(
                email=DEMO_EMAIL,
                hashed_password=hash_password(DEMO_PASSWORD),
                household_id=new_household_id,
            )
            db.add(user)
            db.commit()
            print(f"Demo user created -> household_id={new_household_id}")

        print("\nDone! Login with:")
        print(f"  Email:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
    finally:
        db.close()

if __name__ == "__main__":
    reset()
