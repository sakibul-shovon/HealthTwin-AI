"""
Companion Agent — grounded general health Q&A.

Uses Gate 2 retrieval + grounding proxy (no Gate 1 drug-safety logic here).
Refuses when the corpus cannot support the answer rather than guessing.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.spine.grounded_answer import grounded_explain
from app.graph.models import AgentTrace

_DISCLAIMER_EN = (
    "This is general health information, not personal medical advice. "
    "Always consult a qualified doctor or pharmacist for your specific situation."
)
_DISCLAIMER_BN = (
    "এটি সাধারণ স্বাস্থ্য তথ্য, ব্যক্তিগত চিকিৎসা পরামর্শ নয়। "
    "আপনার নির্দিষ্ট পরিস্থিতির জন্য সর্বদা একজন যোগ্য ডাক্তার বা ফার্মাসিস্টের পরামর্শ নিন।"
)
_REFUSE_EN = (
    "I can't verify this safely based on my trusted medical sources. "
    "Please consult a doctor or pharmacist."
)
_REFUSE_BN = (
    "আমার বিশ্বস্ত চিকিৎসা উৎস থেকে এটি নিরাপদভাবে যাচাই করা সম্ভব হচ্ছে না। "
    "দয়া করে একজন ডাক্তার বা ফার্মাসিস্টের পরামর্শ নিন।"
)


def run_companion(db: Session, household_id: int, question: str, language: str) -> dict:
    lang = language

    answer = grounded_explain(question)

    # REFUSE if grounding is insufficient
    if answer.band == "LOW" or answer.evidence is None:
        spoken = _REFUSE_BN if lang == "bn" else _REFUSE_EN
        _write_trace(db, question, passed=False)
        return {
            "verdict": "REFUSE",
            "spoken": spoken,
            "display": {
                "title": "Cannot Verify",
                "conflict": None,
                "alternative": "Please consult a doctor or pharmacist.",
                "detail": spoken,
                "member": None,
                "interpreted": f"answer: {question[:80]}",
                "urgency": None,
                "members": [],
            },
            "evidence": {"source": None, "confidence": None, "grounding_score": None},
            "actions": [],
            "member_focus": None,
            "language": lang,
        }

    ev = answer.evidence
    disclaimer = _DISCLAIMER_BN if lang == "bn" else _DISCLAIMER_EN
    detail = f"{answer.text}\n\n_{disclaimer}_"
    spoken = answer.text

    # Keep spoken under ~40 words for TTS comfort
    words = spoken.split()
    if len(words) > 40:
        spoken = " ".join(words[:40]) + "…"

    _write_trace(db, question, passed=True, source=ev.source, score=ev.grounding_score)

    return {
        "verdict": "INFO",
        "spoken": spoken,
        "display": {
            "title": "Health Information",
            "conflict": None,
            "alternative": None,
            "detail": detail,
            "member": None,
            "interpreted": f"answer: {question[:80]}",
            "urgency": None,
            "members": [],
        },
        "evidence": {
            "source": ev.source,
            "confidence": ev.confidence,
            "grounding_score": ev.grounding_score,
        },
        "actions": [],
        "member_focus": None,
        "language": lang,
    }


def _write_trace(
    db: Session,
    question: str,
    passed: bool,
    source: str | None = None,
    score: float | None = None,
) -> None:
    try:
        trace = AgentTrace(
            intent="GENERAL_HEALTH_Q",
            member_id=None,
            gates_passed={"gate2": passed},
            grounding_score=score,
            source_cited=source,
        )
        db.add(trace)
        db.commit()
    except Exception:
        db.rollback()
