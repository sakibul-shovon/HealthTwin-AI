"""
Grounded answer generator: Gate 2 (retrieval) + optional Groq LLM.
Gate 3 (NLI) is intentionally skipped here — loading three ML models simultaneously
exhausts Windows paging file on the demo host. Gate 1 deterministic rules handle
safety verdicts; Gate 2 relevance scores serve as the grounding proxy for SAFE answers.
"""
import math
from typing import List, Optional
from pydantic import BaseModel
from app.spine.gate2_retrieval import retrieve
from app.spine.doc_retrieval import retrieve_docs
from app.graph.database import SessionLocal
from app.config import settings
from groq import Groq


class EvidenceMeta(BaseModel):
    source: str
    url: str
    confidence: str   # "HIGH" | "MED" | "LOW"
    grounding_score: float


class GroundedAnswer(BaseModel):
    text: str
    evidence: Optional[EvidenceMeta] = None
    band: str  # 'HIGH', 'MED', 'LOW'


def _score_to_band(score: float) -> str:
    # ms-marco scores are log-odds; typical range roughly -10..10.
    # Empirically > 5 = highly relevant, 2-5 = relevant, < 2 = weak.
    if score >= 5.0:
        return "HIGH"
    elif score >= 2.0:
        return "MED"
    return "LOW"


def grounded_explain(question: str, forced_facts: Optional[List[str]] = None, member_id: Optional[int] = None) -> GroundedAnswer:
    # 1. Retrieve supporting evidence
    try:
        retrieval_res = None
        if member_id is not None:
            db = SessionLocal()
            try:
                retrieval_res = retrieve_docs(question, member_id, db)
            finally:
                db.close()
                
            if not retrieval_res.sufficient:
                # Fallback to KB
                retrieval_res = retrieve(question, k=3)
        else:
            retrieval_res = retrieve(question, k=3)
            
    except Exception:
        return GroundedAnswer(
            text="I can't verify this safely based on my trusted medical sources. Please consult a doctor or pharmacist.",
            band="LOW",
        )

    if not retrieval_res.sufficient or not retrieval_res.chunks:
        return GroundedAnswer(
            text="I can't verify this safely based on my trusted medical sources. Please consult a doctor or pharmacist.",
            band="LOW"
        )

    evidence_texts = [c.text for c in retrieval_res.chunks]
    context_block = "\n\n".join(
        f"Source {i + 1}: {c.text}" for i, c in enumerate(retrieval_res.chunks)
    )

    # 2. Generate explanation via Groq Llama (or mock if no key)
    api_key = settings.GROQ_API_KEY
    if not api_key:
        draft_text = evidence_texts[0]
    else:
        try:
            client = Groq(api_key=api_key)
            system_prompt = (
                "You are a medical assistant. Answer the question using ONLY the provided sources. "
                "Do not add outside knowledge. Keep it 1-3 sentences."
            )
            if forced_facts:
                system_prompt += f"\n\nAlso state these facts exactly: {', '.join(forced_facts)}"

            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Sources:\n{context_block}\n\nQuestion: {question}"},
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                max_tokens=150,
            )
            draft_text = response.choices[0].message.content.strip()
        except Exception:
            draft_text = evidence_texts[0]

    # 3. Use retrieval score as grounding proxy (no Gate 3 NLI to avoid OOM)
    top_chunk = retrieval_res.chunks[0]
    top_score = retrieval_res.top_score
    band = _score_to_band(top_score)

    if band == "LOW":
        return GroundedAnswer(
            text="I can't verify this safely based on my trusted medical sources. Please consult a doctor or pharmacist.",
            band="LOW"
        )

    # Normalize ms-marco logit score to 0-1 via sigmoid
    grounding_score = 1.0 / (1.0 + math.exp(-top_score / 3.0))

    return GroundedAnswer(
        text=draft_text,
        evidence=EvidenceMeta(
            source=top_chunk.source,
            url=top_chunk.url,
            confidence=band,
            grounding_score=round(grounding_score, 3),
        ),
        band=band,
    )
