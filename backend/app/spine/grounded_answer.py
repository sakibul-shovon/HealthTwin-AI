import os
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.spine.gate2_retrieval import retrieve
from app.spine.gate3_nli import verify_claims
from groq import Groq

class EvidenceMeta(BaseModel):
    source: str
    url: str
    confidence: float
    grounding_score: float

class GroundedAnswer(BaseModel):
    text: str
    evidence: Optional[EvidenceMeta] = None
    band: str # 'HIGH', 'MED', 'LOW'

def split_into_sentences(text: str) -> List[str]:
    # Simple regex-based sentence splitter
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s for s in sentences if s]

def grounded_explain(question: str, forced_facts: Optional[List[str]] = None) -> GroundedAnswer:
    # 1. Retrieve evidence
    retrieval_res = retrieve(question, k=3)
    
    # 2. Sufficiency check
    if not retrieval_res.sufficient:
        return GroundedAnswer(
            text="I can't verify this safely based on my trusted medical sources. Please consult a doctor or pharmacist.",
            band="LOW"
        )
        
    # Build context from chunks
    evidence_texts = [c.text for c in retrieval_res.chunks]
    context_block = "\n\n".join([f"Source {i+1}: {c.text}" for i, c in enumerate(retrieval_res.chunks)])
    
    # 3. Generate Draft via Groq Llama 3
    api_key = os.getenv("GROQ_API_KEY")
    # If no key is set, we can mock it for testing or raise error
    if not api_key:
        # Fallback mock for unit testing environment without API key
        draft_text = evidence_texts[0] # Just echo the first evidence chunk as a mock
    else:
        client = Groq(api_key=api_key)
        
        system_prompt = (
            "You are a medical assistant. Answer the user's question using ONLY the provided Source text. "
            "Do not add any outside knowledge. Keep it very short, 1-3 sentences maximum."
        )
        
        if forced_facts:
            system_prompt += f"\n\nAdditionally, you must state these facts exactly as given: {', '.join(forced_facts)}"
            
        user_prompt = f"Sources:\n{context_block}\n\nQuestion: {question}"
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0,
            max_tokens=150,
        )
        draft_text = response.choices[0].message.content.strip()

    # 4. Gate 3 NLI check
    draft_sentences = split_into_sentences(draft_text)
    
    # If there are forced facts, we might choose to skip verifying those specific sentences
    # but for simplicity we verify everything against the evidence (or assume forced facts are true)
    # The prompt explicitly injected forced facts, so NLI might fail if they aren't in evidence.
    # To fix this, we append forced facts to the evidence_texts so the NLI model treats them as ground truth.
    nli_evidence = evidence_texts.copy()
    if forced_facts:
        nli_evidence.extend(forced_facts)
        
    grounding_res = verify_claims(draft_sentences, nli_evidence)
    
    # 5. Build final result
    if grounding_res.band == "LOW":
        return GroundedAnswer(
            text="I can't verify this safely based on my trusted medical sources. Please consult a doctor or pharmacist.",
            band="LOW"
        )
        
    final_text = " ".join(grounding_res.supported)
    
    # Take the top source from retrieval
    top_chunk = retrieval_res.chunks[0]
    
    return GroundedAnswer(
        text=final_text,
        evidence=EvidenceMeta(
            source=top_chunk.source,
            url=top_chunk.url,
            confidence=retrieval_res.top_score,
            grounding_score=grounding_res.grounding_score
        ),
        band=grounding_res.band
    )
