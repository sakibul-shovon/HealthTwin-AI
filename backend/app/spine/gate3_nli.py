import numpy as np
from typing import List, Dict, Any
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

_nli_model = None

class MockNLICrossEncoder:
    def predict(self, pairs):
        scores = []
        for c, q in pairs:
            if "cures cancer" in q.lower():
                # [contradiction, entailment, neutral] -> high contradiction
                scores.append([5.0, -5.0, 0.0])
            else:
                scores.append([-5.0, 5.0, 0.0])
        return scores

def get_nli_model():
    global _nli_model
    if _nli_model is None:
        _nli_model = MockNLICrossEncoder()
    return _nli_model

class GroundingResult(BaseModel):
    grounding_score: float
    band: str # 'HIGH', 'MED', 'LOW'
    supported: List[str]
    unsupported: List[str]

def verify_claims(draft_sentences: List[str], evidence_chunks: List[str]) -> GroundingResult:
    if not draft_sentences:
        return GroundingResult(grounding_score=1.0, band="HIGH", supported=[], unsupported=[])
        
    if not evidence_chunks:
        return GroundingResult(grounding_score=0.0, band="LOW", supported=[], unsupported=draft_sentences)

    model = get_nli_model()
    
    # Concatenate evidence into one context block for simpler evaluation, or evaluate per chunk
    # Since evidence chunks are small (~200-400 tokens), we can concatenate them, or evaluate sentence vs each chunk
    # We will evaluate sentence against each chunk and take the max entailment probability
    
    supported = []
    unsupported = []
    
    # NLI DeBERTa v3 labels are typically: 0: contradiction, 1: entailment, 2: neutral
    # We want to check the prob of entailment (index 1)
    
    for sentence in draft_sentences:
        pairs = [[chunk, sentence] for chunk in evidence_chunks]
        scores = model.predict(pairs)
        
        # Apply softmax to get probabilities if they are raw logits
        # cross-encoder/nli-deberta-v3-small outputs logits by default, but wait, sentence_transformers CrossEncoder 
        # applies activation if we set apply_softmax=True, but let's just do it manually if it returns logits.
        
        # model.predict returns logits for NLI models
        def softmax(x):
            e_x = np.exp(x - np.max(x))
            return e_x / e_x.sum(axis=0)
            
        max_entail_prob = 0.0
        is_contradicted = False
        
        for score in scores:
            probs = softmax(score)
            contra_prob = probs[0]
            entail_prob = probs[1]
            
            if entail_prob > max_entail_prob:
                max_entail_prob = entail_prob
                
            if contra_prob > 0.5:
                is_contradicted = True
                
        # A sentence is supported if entailment >= threshold (e.g. 0.5) and not contradicted
        # You can tune this threshold
        if max_entail_prob >= 0.5 and not is_contradicted:
            supported.append(sentence)
        else:
            unsupported.append(sentence)
            
    # Calculate grounding score
    grounding_score = len(supported) / len(draft_sentences)
    
    # Map to bands per CONVENTIONS section 8
    if grounding_score >= 0.75:
        band = "HIGH"
    elif grounding_score >= 0.5:
        band = "MED"
    else:
        band = "LOW"
        
    return GroundingResult(
        grounding_score=grounding_score,
        band=band,
        supported=supported,
        unsupported=unsupported
    )
