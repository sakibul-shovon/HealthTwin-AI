"""
Full demo data seed — medications, conditions, allergies for Rahman Family.
Run ONCE: python seed_demo_full.py  (from backend/ folder)
Safe to re-run; skips if data already exists.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.graph.database import SessionLocal
from datetime import datetime, timedelta
from app.graph.models import Household, Medication, Condition, Allergy, SymptomLog

def seed(db):
    hh = db.query(Household).filter(Household.name == "Rahman Family").first()
    if not hh:
        print("Rahman Family not found — log in once to create the family first.")
        return

    members = {m.role_label: m for m in hh.members}

    def has_med(member, name):
        return any(m.name.lower() == name.lower() for m in member.medications)

    def has_condition(member, name):
        return any(c.name.lower() == name.lower() for c in member.conditions)

    def has_allergy(member, substance):
        return any(a.substance.lower() == substance.lower() for a in member.allergies)

    added = 0

    # ── Baba (68y) ────────────────────────────────────────────────────────────
    baba = members.get("Baba")
    if baba:
        for name, dose in [
            ("Warfarin", "5mg"),
            ("Amlodipine", "5mg"),
            ("Atorvastatin", "20mg"),
            ("Metoprolol", "50mg"),
            ("Losartan", "50mg"),
        ]:
            if not has_med(baba, name):
                db.add(Medication(member_id=baba.id, name=name, dose=dose))
                added += 1

        for cond in ["Atrial Fibrillation", "Hypertension", "Chronic Kidney Disease Stage 2"]:
            if not has_condition(baba, cond):
                db.add(Condition(member_id=baba.id, name=cond))
                added += 1

    # ── Ma (61y) ──────────────────────────────────────────────────────────────
    ma = members.get("Ma")
    if ma:
        for name, dose in [
            ("Metformin", "500mg"),
            ("Lisinopril", "10mg"),
        ]:
            if not has_med(ma, name):
                db.add(Medication(member_id=ma.id, name=name, dose=dose))
                added += 1

        for cond in ["Type 2 Diabetes", "Hypertension"]:
            if not has_condition(ma, cond):
                db.add(Condition(member_id=ma.id, name=cond))
                added += 1

        if not has_allergy(ma, "Penicillin"):
            db.add(Allergy(member_id=ma.id, substance="Penicillin", reaction="Rash and hives"))
            added += 1

    # ── Self (34y) ────────────────────────────────────────────────────────────
    self_ = members.get("Self")
    if self_:
        for cond in ["Seasonal Allergies"]:
            if not has_condition(self_, cond):
                db.add(Condition(member_id=self_.id, name=cond))
                added += 1

    # ── SymptomLog — fever cluster for dengue detection ───────────────────────
    # Pattern agent reads SymptomLog table (not HealthEvents) for cluster detection.
    now = datetime.utcnow()
    for member_label, severity, hours_ago in [
        ("Ma",    "7", 1),
        ("Child", "6", 2),
    ]:
        m = members.get(member_label)
        if not m:
            continue
        cutoff = now - timedelta(hours=hours_ago)
        existing = db.query(SymptomLog).filter(
            SymptomLog.member_id == m.id,
            SymptomLog.symptom == "fever",
            SymptomLog.logged_at >= now - timedelta(hours=48),
        ).first()
        if not existing:
            db.add(SymptomLog(member_id=m.id, symptom="fever", severity=severity, logged_at=cutoff))
            added += 1

    db.commit()
    print(f"Seeded {added} new records into Rahman Family.")
    print("\nBaba medications:", [m.name for m in members["Baba"].medications] if baba else "—")
    print("Ma medications:  ", [m.name for m in members["Ma"].medications] if ma else "—")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
