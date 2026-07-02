"""
Companion Agent — grounded general health Q&A.

Uses Gate 2 retrieval + grounding proxy (no Gate 1 drug-safety logic here).
Refuses when the corpus cannot support the answer rather than guessing.
"""
from __future__ import annotations

from sqlalchemy.orm import Session
from groq import Groq

from app.spine.grounded_answer import grounded_explain
from app.graph.models import AgentTrace
from app.config import settings

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


_CLINICAL_KEYWORDS = {
    "safe", "unsafe", "dose", "dosage", "drug", "medicine", "medication",
    "interaction", "side effect", "overdose", "contraindication", "prescription",
    "mg", "mcg", "ml", "warfarin", "ibuprofen", "aspirin", "metformin",
    "paracetamol", "amlodipine", "penicillin", "antibiotic", "tablet",
}


def _is_clinical(question: str) -> bool:
    """Returns True if the question involves drug/dose/safety — requires grounded evidence."""
    lower = question.lower()
    return any(kw in lower for kw in _CLINICAL_KEYWORDS)


def _llm_answer(question: str, language: str, member_context: str = "") -> str | None:
    """Ask Llama directly. member_context injects household profile data when available."""
    if not settings.GROQ_API_KEY:
        return None
    if member_context:
        system = (
            f"You are HealthTwin, a family health assistant with access to the family's health records.\n"
            f"Family member profiles:\n{member_context}\n\n"
            f"Answer questions using this real data. Be specific and personal. "
            f"Keep answers under 100 words. End with: 'Consult a doctor for personal advice.'"
            if language != "bn" else
            f"আপনি HealthTwin। পারিবারিক তথ্য:\n{member_context}\n\n"
            f"এই তথ্য ব্যবহার করে উত্তর দিন। ৮০ শব্দের মধ্যে রাখুন। শেষে: 'ডাক্তার দেখান।'"
        )
    else:
        system = (
            "You are HealthTwin, a knowledgeable family health assistant. "
            "Answer health questions clearly and helpfully using your medical knowledge. "
            "Keep answers under 80 words. End with: 'Consult a doctor for personal advice.'"
            if language != "bn" else
            "আপনি HealthTwin, একটি পারিবারিক স্বাস্থ্য সহকারী। "
            "স্বাস্থ্য প্রশ্নের সহায়ক উত্তর দিন। ৮০ শব্দের মধ্যে রাখুন। "
            "শেষে যোগ করুন: 'ব্যক্তিগত পরামর্শের জন্য ডাক্তার দেখান।'"
        )
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        resp = client.chat.completions.create(
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": question}],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=250,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return None


def run_companion(db: Session, household_id: int, question: str, language: str, member_context: str = "") -> dict:
    lang = language

    # Path A: member context provided
    if member_context:
        if _is_clinical(question):
            # Clinical + member context: Gate 2 first; refuse if insufficient
            answer = grounded_explain(question)
            if answer.band != "LOW" and answer.evidence is not None:
                _write_trace(db, passed=True, source=answer.evidence.source, score=answer.evidence.grounding_score)
                return _build_grounded_response(answer, question, lang)
            spoken = _REFUSE_BN if lang == "bn" else _REFUSE_EN
            _write_trace(db, passed=False)
            return _build_refuse(spoken, question, lang)
        else:
            # Non-clinical + member context: LLM allowed, marked unverified
            llm_text = _llm_answer(question, lang, member_context)
            if llm_text:
                _write_trace(db, passed=True)
                return _build_unverified_info(llm_text, question, lang)

    # Path B: no member context — Gate 2 first
    answer = grounded_explain(question)

    if answer.band != "LOW" and answer.evidence is not None:
        _write_trace(db, passed=True, source=answer.evidence.source, score=answer.evidence.grounding_score)
        return _build_grounded_response(answer, question, lang)

    # Gate 2 insufficient
    if _is_clinical(question):
        # Clinical + no grounding → REFUSE
        spoken = _REFUSE_BN if lang == "bn" else _REFUSE_EN
        _write_trace(db, passed=False)
        return _build_refuse(spoken, question, lang)

    # Non-clinical + no grounding → LLM fallback with disclaimer
    llm_text = _llm_answer(question, lang)
    if llm_text:
        _write_trace(db, passed=True)
        return _build_unverified_info(llm_text, question, lang)

    spoken = _REFUSE_BN if lang == "bn" else _REFUSE_EN
    _write_trace(db, passed=False)
    return _build_refuse(spoken, question, lang)


def _build_grounded_response(answer, question: str, lang: str) -> dict:
    ev = answer.evidence
    disclaimer = _DISCLAIMER_BN if lang == "bn" else _DISCLAIMER_EN
    spoken = answer.text
    words = spoken.split()
    if len(words) > 40:
        spoken = " ".join(words[:40]) + "…"
    return {
        "verdict": "INFO",
        "spoken": spoken,
        "display": {
            "title": "Health Information",
            "conflict": None,
            "alternative": None,
            "detail": f"{answer.text}\n\n{disclaimer}",
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


def _build_refuse(spoken: str, question: str, lang: str) -> dict:
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


def _build_unverified_info(llm_text: str, question: str, lang: str) -> dict:
    disclaimer = _DISCLAIMER_BN if lang == "bn" else _DISCLAIMER_EN
    return {
        "verdict": "INFO",
        "spoken": llm_text,
        "display": {
            "title": "Health Information",
            "conflict": None,
            "alternative": None,
            "detail": f"{llm_text}\n\n{disclaimer}",
            "member": None,
            "interpreted": f"answer: {question[:80]}",
            "urgency": None,
            "members": [],
        },
        "evidence": {
            "source": "General knowledge (unverified)",
            "confidence": "LOW",
            "grounding_score": None,
        },
        "actions": [],
        "member_focus": None,
        "language": lang,
    }


def _write_trace(
    db: Session,
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
