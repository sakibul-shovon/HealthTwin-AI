from typing import Optional
from sqlalchemy.orm import Session
from app.graph.crud import resolve_member, get_member_profile
from app.graph.models import AgentTrace
from app.spine.gate1_rules import check_drug_safety
from app.spine.grounded_answer import grounded_explain
from app.agents.safety_copy import get_spoken_verdict

# Simple in-memory cache for the flagship demo to avoid LLM calls
_FLAGSHIP_CACHE = {}

def get_cache_key(household_id: int, member_label: str, drug: str, language: str) -> str:
    return f"{household_id}:{member_label}:{drug.lower()}:{language}"

def run_safety_check(db: Session, household_id: int, member_ref: str, drug: str, dose: Optional[str] = None, purpose: Optional[str] = None, language: str = "en") -> dict:
    # 1. Resolve member
    member = resolve_member(db, household_id, member_ref)
    if not member:
        spoken = "আমি সদস্যটি খুঁজে পাইনি।" if language == "bn" else "I couldn't find that family member — who did you mean?"
        return {
            "verdict": "REFUSE",
            "spoken": spoken,
            "display": {
                "title": "Member Not Found",
                "conflict": None,
                "alternative": None,
                "detail": spoken,
                "member": None
            },
            "evidence": {
                "source": None,
                "confidence": "LOW",
                "grounding_score": 0.0
            },
            "actions": [],
            "member_focus": None,
            "language": language
        }
        
    profile = get_member_profile(db, household_id, member.role_label)
    
    # Check cache for flagship demo
    cache_key = get_cache_key(household_id, profile.role_label, drug, language)
    if cache_key in _FLAGSHIP_CACHE:
        # Log trace from cache
        trace = AgentTrace(
            member_id=member.id,
            intent="DRUG_SAFETY_CHECK",
            gates_passed="1,2,3 (CACHED)",
            grounding_score=_FLAGSHIP_CACHE[cache_key]["evidence"]["grounding_score"],
            source_cited=_FLAGSHIP_CACHE[cache_key]["evidence"]["source"]
        )
        db.add(trace)
        db.commit()
        return _FLAGSHIP_CACHE[cache_key]
        
    # 2. Gate 1 - Deterministic Rule
    gate1_result = check_drug_safety(profile, drug, dose, purpose)
    
    # 3. Gate 2+3 Explanation
    conflict_names = " + ".join([c.detail for c in gate1_result.conflicts]) if gate1_result.conflicts else None
    forced_facts = [c.detail for c in gate1_result.conflicts]
    
    # If it's safe and no conflicts, we don't necessarily need a grounded explanation 
    # but we will ask the LLM for general safety if no deterministic rules triggered.
    if gate1_result.verdict == "SAFE":
        question = f"Is it safe to give {drug} to an adult?" if profile.age >= 18 else f"Is it safe to give {drug} to a {profile.age} year old child?"
    else:
        question = f"Why is {drug} dangerous with these conditions: {', '.join(forced_facts)}?"
        
    explanation = grounded_explain(question, forced_facts=forced_facts if forced_facts else None)
    
    # 4. Compose caregiver action
    actions = []
    caregiver = None
    if gate1_result.verdict in ("UNSAFE", "CAUTION"):
        # Check relationships in the DB directly for caregiver
        for rel in member.relationships_in:
            if rel.caregiver:
                caregiver = rel.from_member.role_label
                actions.append({
                    "type": "notify_caregiver",
                    "label": f"Notify {caregiver}?",
                    "target": caregiver
                })
                break
                
    # 5. Build envelope
    # Create the spoken line
    spoken = get_spoken_verdict(
        verdict=gate1_result.verdict, 
        member=profile.role_label, 
        drug=drug, 
        alternative=gate1_result.alternative,
        caregiver=caregiver,
        language=language
    )
    
    # Detail logic: if grounded_explain was sufficient, use it. Else use deterministic fallback.
    detail = explanation.text
    evidence_source = explanation.evidence.source if explanation.evidence else "Deterministic rule"
    confidence: str = explanation.evidence.confidence if explanation.evidence else "HIGH"
    grounding_score = explanation.evidence.grounding_score if explanation.evidence else 1.0

    if explanation.band == "LOW" or not explanation.evidence:
        if gate1_result.verdict == "SAFE":
            detail = "Absence of warning in our records is not proof of safety. Please consult a doctor."
            evidence_source = "Disclaimer"
            grounding_score = 1.0
        else:
            detail = conflict_names
            evidence_source = gate1_result.conflicts[0].source if gate1_result.conflicts else "Deterministic rule"
            confidence = "HIGH"
            grounding_score = 1.0
            
    # For display conflict UI — name the specific drugs/conditions, not just the type
    short_conflict = None
    if gate1_result.conflicts:
        types = [c.type for c in gate1_result.conflicts]
        if "interaction" in types:
            # Extract drug names from the detail string: "Interaction between X and Y: ..."
            interaction = next(c for c in gate1_result.conflicts if c.type == "interaction")
            parts = interaction.detail.split(":")
            drug_pair = parts[0].replace("Interaction between", "").strip() if parts else ""
            mechanism = parts[1].strip() if len(parts) > 1 else interaction.mechanism if hasattr(interaction, "mechanism") else ""
            short_conflict = f"{drug_pair} → {mechanism}" if drug_pair else "Drug Interaction"
        elif "contraindication" in types:
            contra = next(c for c in gate1_result.conflicts if c.type == "contraindication")
            # e.g. "ibuprofen is contraindicated: NSAIDs worsen renal function"
            reason = contra.detail.split(":")[-1].strip() if ":" in contra.detail else contra.detail
            short_conflict = f"Contraindication — {reason}"
        elif "allergy" in types:
            allergy = next(c for c in gate1_result.conflicts if c.type == "allergy")
            short_conflict = allergy.detail
        else:
            short_conflict = gate1_result.conflicts[0].detail
            
    title_map = {
        "SAFE": "Safe to Proceed",
        "CAUTION": "Proceed with Caution",
        "UNSAFE": "Do Not Proceed",
        "REFUSE": "Cannot Verify"
    }

    envelope = {
        "verdict": gate1_result.verdict,
        "spoken": spoken,
        "display": {
            "title": title_map.get(gate1_result.verdict, "Safety Check"),
            "conflict": short_conflict,
            "alternative": gate1_result.alternative,
            "detail": detail,
            "member": profile.role_label
        },
        "evidence": {
            "source": evidence_source,
            "confidence": confidence,
            "grounding_score": grounding_score
        },
        "actions": actions,
        "member_focus": profile.role_label,
        "language": language
    }
    
    # 6. Log trace
    trace = AgentTrace(
        member_id=member.id,
        intent="DRUG_SAFETY_CHECK",
        gates_passed="1,2,3",
        grounding_score=grounding_score,
        source_cited=evidence_source
    )
    db.add(trace)
    db.commit()
    
    # 7. Cache flagship verdict if UNSAFE to avoid repeating
    if gate1_result.verdict == "UNSAFE":
        _FLAGSHIP_CACHE[cache_key] = envelope
        
    return envelope
