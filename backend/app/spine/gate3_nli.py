import numpy as np
from typing import List
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

_nli_model = None


def get_nli_model() -> CrossEncoder:
    global _nli_model
    if _nli_model is None:
        _nli_model = CrossEncoder("cross-encoder/nli-deberta-v3-small")
    return _nli_model


class GroundingResult(BaseModel):
    grounding_score: float
    band: str  # 'HIGH', 'MED', 'LOW'
    supported: List[str]
    unsupported: List[str]


def verify_claims(draft_sentences: List[str], evidence_chunks: List[str]) -> GroundingResult:
    if not draft_sentences:
        return GroundingResult(grounding_score=1.0, band="HIGH", supported=[], unsupported=[])

    if not evidence_chunks:
        return GroundingResult(grounding_score=0.0, band="LOW", supported=[], unsupported=draft_sentences)

    model = get_nli_model()

    # nli-deberta-v3-small label order: 0=contradiction, 1=entailment, 2=neutral
    supported = []
    unsupported = []

    def softmax(x):
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()

    for sentence in draft_sentences:
        pairs = [[chunk, sentence] for chunk in evidence_chunks]
        raw_scores = model.predict(pairs)

        max_entail_prob = 0.0
        is_contradicted = False

        for score in raw_scores:
            probs = softmax(score)
            contra_prob = float(probs[0])
            entail_prob = float(probs[1])

            if entail_prob > max_entail_prob:
                max_entail_prob = entail_prob

            if contra_prob > 0.5:
                is_contradicted = True

        if max_entail_prob >= 0.5 and not is_contradicted:
            supported.append(sentence)
        else:
            unsupported.append(sentence)

    grounding_score = len(supported) / len(draft_sentences)

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
