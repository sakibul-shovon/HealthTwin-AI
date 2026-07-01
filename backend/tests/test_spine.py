import pytest
import sys
import os

# Add the project root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.spine.gate2_retrieval import retrieve
from app.spine.gate3_nli import verify_claims
from app.spine.grounded_answer import grounded_explain

def test_retrieval_sufficient():
    # Should find the warfarin + ibuprofen bleeding risk
    res = retrieve("why is warfarin risky with ibuprofen")
    assert res.sufficient is True
    assert len(res.chunks) > 0
    assert "bleeding" in res.chunks[0].text.lower()
    assert res.chunks[0].source == "WHO Fact Sheet on Anticoagulants"

def test_retrieval_insufficient():
    # Out of domain query should be rejected
    res = retrieve("what is the capital of France")
    assert res.sufficient is False

def test_gate3_entailment_supported():
    draft = ["Warfarin with NSAIDs increases bleeding risk."]
    evidence = ["Taking warfarin with NSAIDs significantly increases the risk of dangerous bleeding."]
    res = verify_claims(draft, evidence)
    assert res.band == "HIGH"
    assert len(res.supported) == 1

def test_gate3_entailment_unsupported():
    draft = ["Warfarin cures cancer."]
    evidence = ["Taking warfarin with NSAIDs significantly increases the risk of dangerous bleeding."]
    res = verify_claims(draft, evidence)
    assert res.band == "LOW"
    assert len(res.unsupported) == 1

def test_grounded_explain_safe():
    # Should return a grounded answer 
    # (Because we might not have GROQ_API_KEY in test, the mock returns the first evidence chunk)
    res = grounded_explain("is it safe to take paracetamol on an empty stomach?")
    assert res.band in ["HIGH", "MED"]
    assert "empty stomach" in res.text.lower()

def test_grounded_explain_refuse():
    # Should refuse out of domain
    res = grounded_explain("who won the world cup in 2022?")
    assert res.band == "LOW"
    assert "can't verify" in res.text.lower()
