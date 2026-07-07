"""
Proactive AI Insights — deterministic, no LLM call.

Scans every member's medications through Gate 1 (drug interactions,
contraindications, allergy checks) and combines with flag/polypharmacy
heuristics to surface the household's live risk picture.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.graph.database import get_db
from app.graph import models, schemas
from app.spine.gate1_rules import check_drug_safety
from app.core.auth import get_current_household_id

router = APIRouter()

_SEV_NORM = {"high": "HIGH", "moderate": "MED", "low": "LOW"}
_SEV_ORDER = {"HIGH": 0, "MED": 1, "LOW": 2}


def _profile(m: models.Member) -> schemas.MemberProfileSchema:
    return schemas.MemberProfileSchema(
        role_label=m.role_label,
        age=m.age,
        sex=m.sex,
        weight_kg=m.weight_kg,
        flags=schemas.MemberFlagsSchema(
            kidney_impaired=m.kidney_impaired,
            liver_impaired=m.liver_impaired,
            pregnant=m.pregnant,
        ),
        medications=[schemas.MedicationBase(name=med.name, dose=med.dose) for med in m.medications],
        conditions=[c.name for c in m.conditions],
        allergies=[schemas.AllergyBase(substance=a.substance, reaction=a.reaction) for a in m.allergies],
    )


def _risk_band(m: models.Member) -> str:
    score = 0.0
    if m.age >= 65:   score += 2.0
    elif m.age >= 50: score += 1.0
    if m.kidney_impaired: score += 2.5
    if m.liver_impaired:  score += 2.0
    if m.pregnant:        score += 1.5
    score += min(len(m.medications), 5) * 0.8
    score += min(len(m.conditions), 4) * 0.5
    score += min(len(m.allergies), 3) * 0.4
    if score >= 5.0: return "HIGH"
    if score >= 2.5: return "MED"
    return "LOW"


@router.get("")
def get_insights(
    household_id: int = Depends(get_current_household_id),
    db: Session = Depends(get_db),
):
    members = (
        db.query(models.Member)
        .options(
            joinedload(models.Member.medications),
            joinedload(models.Member.conditions),
            joinedload(models.Member.allergies),
        )
        .filter(models.Member.household_id == household_id)
        .all()
    )
    if not members:
        return {"insights": [], "risk_bands": {}}

    insights = []
    risk_bands: dict[str, str] = {}
    seen: set[str] = set()

    def add(id_: str, severity: str, category: str, title: str, detail: str, member: str, query: str):
        if id_ not in seen:
            seen.add(id_)
            insights.append({
                "id": id_,
                "severity": severity,
                "category": category,
                "title": title,
                "detail": detail,
                "member": member,
                "action_query": query,
            })

    for m in members:
        risk_bands[m.role_label] = _risk_band(m)
        p = _profile(m)
        rl = m.role_label

        # ── Flag insights ────────────────────────────────────────────────────
        if m.kidney_impaired:
            add(f"flag:kidney:{rl}", "MED", "flag",
                "Kidney Impairment Active",
                "Renally-cleared drugs may accumulate. Dose adjustment required; check CrCl regularly.",
                rl, f"Which of {rl}'s medications need kidney dose adjustment?")

        if m.liver_impaired:
            add(f"flag:liver:{rl}", "MED", "flag",
                "Liver Impairment Active",
                "Hepatically-metabolised drugs may not clear properly. Monitor LFTs.",
                rl, f"Which of {rl}'s medications are processed by the liver?")

        if m.pregnant:
            add(f"flag:pregnant:{rl}", "HIGH", "flag",
                "Pregnancy — Verify All Medications",
                "NSAIDs, ACE inhibitors, and category D/X drugs must be avoided. Immediate pharmacist review needed.",
                rl, f"Which of {rl}'s medications are safe during pregnancy?")

        # ── Elderly polypharmacy ─────────────────────────────────────────────
        if m.age >= 60 and len(m.medications) >= 4:
            add(f"elderly:{rl}", "MED", "poly",
                f"Elderly + {len(m.medications)} Medications",
                f"Patients over 60 with multiple drugs face higher fall risk, cognitive effects, and interaction burden.",
                rl, f"Check for age-related drug risks for {rl}.")

        elif len(m.medications) >= 5:
            add(f"poly:{rl}", "MED", "poly",
                f"Polypharmacy — {len(m.medications)} Medications",
                "Five or more concurrent medications significantly raise interaction risk.",
                rl, f"Check for interactions across all of {rl}'s medications.")

        # ── Gate 1 drug safety scan ──────────────────────────────────────────
        for med in m.medications:
            result = check_drug_safety(p, med.name, med.dose)
            for c in result.conflicts:
                sev = _SEV_NORM.get(c.severity, "MED")
                key = f"conflict:{rl}:{c.type}:{c.detail[:50]}"
                category_label = c.type.replace("_", " ").title()
                add(key, sev, c.type,
                    f"{category_label}: {med.name}",
                    c.detail,
                    rl, f"Is {med.name} safe for {rl}?")

    insights.sort(key=lambda x: _SEV_ORDER.get(x["severity"], 3))
    return {"insights": insights[:12], "risk_bands": risk_bands}
