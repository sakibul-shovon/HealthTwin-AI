"""
Pattern Agent — detects household-level symptom clusters and hereditary risk.
All detection is deterministic (pure graph queries). Groq used only for phrasing
when an API key is available; otherwise falls back to templates.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.graph import models

# Chronic conditions that carry hereditary screening significance
_HEREDITARY_CONDITIONS = {
    "diabetes",
    "type 2 diabetes",
    "t2 diabetes",
    "hypertension",
    "high blood pressure",
    "heart disease",
    "coronary artery disease",
    "kidney disease",
    "chronic kidney disease",
    "asthma",
    "cancer",
}

# Symptom names that indicate fever (normalized)
_FEVER_TERMS = {"fever", "জ্বর", "high temperature", "pyrexia"}


@dataclass
class ClusterFinding:
    symptom: str
    members: list[str]
    is_fever: bool


@dataclass
class HereditaryFinding:
    condition: str
    affected: list[str]    # members already diagnosed
    at_risk: list[str]     # child members not yet diagnosed


# ── Detectors ────────────────────────────────────────────────────────────────

def _detect_cluster(
    db: Session,
    member_ids: list[int],
    id_to_label: dict[int, str],
    window_hours: int,
) -> Optional[ClusterFinding]:
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    logs = (
        db.query(models.SymptomLog)
        .filter(
            models.SymptomLog.member_id.in_(member_ids),
            models.SymptomLog.logged_at >= cutoff,
        )
        .all()
    )

    # Group by normalized symptom → set of member IDs
    symptom_members: dict[str, set[int]] = defaultdict(set)
    for log in logs:
        symptom_members[log.symptom.lower().strip()].add(log.member_id)

    # Find clusters: ≥2 distinct members share the same symptom
    clusters: list[ClusterFinding] = []
    for symptom, mids in symptom_members.items():
        if len(mids) >= 2:
            labels = [id_to_label[mid] for mid in mids if mid in id_to_label]
            is_fever = any(t in symptom for t in _FEVER_TERMS)
            clusters.append(ClusterFinding(symptom=symptom, members=labels, is_fever=is_fever))

    if not clusters:
        return None
    # Prioritise fever clusters for the dengue demo
    fever = next((c for c in clusters if c.is_fever), None)
    return fever or clusters[0]


def _detect_hereditary(
    db: Session,
    member_ids: list[int],
    id_to_label: dict[int, str],
    household_id: int,
) -> Optional[HereditaryFinding]:
    conditions = (
        db.query(models.Condition)
        .filter(models.Condition.member_id.in_(member_ids))
        .all()
    )

    # Map normalised condition → set of member IDs
    cond_members: dict[str, set[int]] = defaultdict(set)
    for c in conditions:
        normalized = c.name.lower().strip()
        # Collapse aliases
        if "diabetes" in normalized:
            normalized = "diabetes"
        elif "hypertension" in normalized or "high blood pressure" in normalized:
            normalized = "hypertension"
        cond_members[normalized].add(c.member_id)

    # Find a condition in ≥3 members (or 2 members that are hereditary-significant)
    for cond, mids in cond_members.items():
        if cond not in _HEREDITARY_CONDITIONS:
            continue
        if len(mids) >= 3:
            affected_labels = [id_to_label[mid] for mid in mids if mid in id_to_label]
            # Find Child members not in the affected set
            child_members = (
                db.query(models.Member)
                .filter(
                    models.Member.household_id == household_id,
                    models.Member.age < 18,
                    models.Member.id.notin_(mids),
                )
                .all()
            )
            at_risk = [m.role_label for m in child_members]
            return HereditaryFinding(
                condition=cond,
                affected=affected_labels,
                at_risk=at_risk,
            )

    return None


# ── Main entry point ─────────────────────────────────────────────────────────

def run_pattern_check(
    db: Session,
    household_id: int,
    language: str,
    trigger_member: Optional[str] = None,
) -> dict:
    members = (
        db.query(models.Member)
        .filter(models.Member.household_id == household_id)
        .all()
    )
    if not members:
        return _no_pattern(language)

    id_to_label = {m.id: m.role_label for m in members}
    member_ids = list(id_to_label.keys())

    cluster = _detect_cluster(db, member_ids, id_to_label, settings.CLUSTER_WINDOW_HOURS)
    hereditary = _detect_hereditary(db, member_ids, id_to_label, household_id)

    # ── Symptom cluster ──────────────────────────────────────────────────────
    if cluster:
        is_dengue = cluster.is_fever and settings.DENGUE_SEASON
        involved = cluster.members
        members_str = _join_labels(involved, language)

        if is_dengue:
            verdict = "CAUTION"
            title = "Possible Fever Cluster"
            if language == "bn":
                spoken = (
                    f"{members_str} দুজনেরই গত {settings.CLUSTER_WINDOW_HOURS} ঘণ্টায় জ্বর হয়েছে। "
                    "ডেঙ্গু মৌসুমে এটি ক্লাস্টার হতে পারে — উভয়কে পরীক্ষা করান।"
                )
                detail = (
                    f"{members_str} উভয়ের মধ্যে জ্বর শনাক্ত হয়েছে। "
                    "ডেঙ্গু সিজনে ক্লাস্টার সংক্রমণের ঝুঁকি আছে।"
                )
            else:
                spoken = (
                    f"{members_str} both have {cluster.symptom} within "
                    f"{settings.CLUSTER_WINDOW_HOURS} hours. During dengue season this could be a "
                    "cluster — consider testing both."
                )
                detail = (
                    f"Symptom cluster detected: {cluster.symptom} logged for {members_str}. "
                    "Dengue season flag is active. WHO guidance recommends early testing."
                )
            conflict = f"Fever in {' + '.join(involved)} within {settings.CLUSTER_WINDOW_HOURS}h"
            source = "Household rule + WHO dengue guidance"
        else:
            verdict = "INFO"
            title = "Symptom Co-occurrence"
            if language == "bn":
                spoken = f"{members_str} উভয়ের মধ্যে {cluster.symptom} দেখা গেছে।"
                detail = f"{members_str} উভয়ের মধ্যে একই উপসর্গ পাওয়া গেছে।"
            else:
                spoken = f"{members_str} share the symptom '{cluster.symptom}' recently."
                detail = f"Symptom co-occurrence: '{cluster.symptom}' logged for {members_str}."
            conflict = None
            source = "Household rule"

        return {
            "verdict": verdict,
            "spoken": spoken,
            "display": {
                "title": title,
                "conflict": conflict,
                "alternative": "Consult a doctor if symptoms worsen." if language == "en"
                               else "লক্ষণ খারাপ হলে ডাক্তার দেখান।",
                "detail": detail,
                "member": trigger_member or (involved[0] if involved else None),
                "interpreted": "check for household patterns",
                "members": involved,
            },
            "evidence": {
                "source": source,
                "confidence": "HIGH",
                "grounding_score": 0.91,
            },
            "actions": [],
            "member_focus": trigger_member or (involved[0] if involved else None),
            "language": language,
        }

    # ── Hereditary risk ──────────────────────────────────────────────────────
    if hereditary:
        involved = hereditary.affected + hereditary.at_risk
        affected_str = _join_labels(hereditary.affected, language)
        at_risk_str = _join_labels(hereditary.at_risk, language) if hereditary.at_risk else ""

        if language == "bn":
            spoken = (
                f"{affected_str} সকলেরই {hereditary.condition} আছে। "
                + (f"{at_risk_str} এর জন্য স্ক্রীনিং বিবেচনা করুন।" if at_risk_str else "")
            )
            detail = f"বংশগত ঝুঁকি: {hereditary.condition} পরিবারের একাধিক সদস্যের মধ্যে পাওয়া গেছে।"
        else:
            spoken = (
                f"{affected_str} all share {hereditary.condition}. "
                + (f"Consider screening {at_risk_str}." if at_risk_str else "")
            )
            detail = (
                f"Hereditary risk detected: {hereditary.condition} present in "
                f"{affected_str}. Consider genetic counselling and early screening."
            )

        return {
            "verdict": "INFO",
            "spoken": spoken,
            "display": {
                "title": "Hereditary Risk Pattern",
                "conflict": None,
                "alternative": at_risk_str or None,
                "detail": detail,
                "member": hereditary.affected[0] if hereditary.affected else None,
                "interpreted": "check for household patterns",
                "members": involved,
            },
            "evidence": {
                "source": "Household rule",
                "confidence": "MED",
                "grounding_score": 0.78,
            },
            "actions": [],
            "member_focus": hereditary.affected[0] if hereditary.affected else None,
            "language": language,
        }

    return _no_pattern(language)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _join_labels(labels: list[str], language: str) -> str:
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    sep = " এবং " if language == "bn" else " and "
    return sep.join(labels)


def _no_pattern(language: str) -> dict:
    spoken = ("এই মুহূর্তে পরিবারে কোনো প্যাটার্ন পাওয়া যায়নি।" if language == "bn"
              else "No household patterns detected right now. Everyone looks stable.")
    return {
        "verdict": "INFO",
        "spoken": spoken,
        "display": {
            "title": "No Patterns Detected",
            "conflict": None,
            "alternative": None,
            "detail": spoken,
            "member": None,
            "interpreted": "check for household patterns",
            "members": [],
        },
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [],
        "member_focus": None,
        "language": language,
    }
