import copy
import threading
from typing import Optional
from sqlalchemy.orm import Session
from app.graph.crud import resolve_member, get_member_profile
from app.graph.models import AgentTrace
from app.spine.gate1_rules import check_drug_safety
from app.spine.grounded_answer import grounded_explain

# In-memory cache for the flagship demo to avoid LLM calls on repeated queries.
# Values stored as deep copies so callers cannot mutate cached state.
_FLAGSHIP_CACHE: dict[str, dict] = {}
_CACHE_LOCK = threading.Lock()


def get_spoken_verdict(
    verdict: str, member: str, drug: str,
    alternative: str = None, caregiver: str = None, language: str = "en",
) -> str:
    if language == "bn":
        if verdict == "UNSAFE":
            msg = f"{member} কে {drug} দেবেন না। এতে ঝুঁকি আছে।"
            if alternative:
                msg += f" এর পরিবর্তে {alternative} দিন।"
            if caregiver:
                msg += f" {caregiver} কে জানাবো?"
            return msg
        elif verdict == "CAUTION":
            msg = f"{member} কে {drug} দেওয়ার ক্ষেত্রে সতর্ক থাকুন।"
            if alternative:
                msg += f" {alternative} একটি ভালো বিকল্প হতে পারে।"
            if caregiver:
                msg += f" {caregiver} কে জানাবো?"
            return msg
        elif verdict == "SAFE":
            return f"{member} এর জন্য {drug} নিরাপদ বলে মনে হচ্ছে।"
        else:
            return "আমি নিশ্চিত নই। দয়া করে একজন ডাক্তারের পরামর্শ নিন।"
    else:
        if verdict == "UNSAFE":
            msg = f"Don't give {member} {drug}. It's unsafe based on their profile."
            if alternative:
                msg += f" Give {alternative} instead."
            if caregiver:
                msg += f" Notify {caregiver}?"
            return msg
        elif verdict == "CAUTION":
            msg = f"Be careful giving {member} {drug}."
            if alternative:
                msg += f" {alternative} might be safer."
            if caregiver:
                msg += f" Notify {caregiver}?"
            return msg
        elif verdict == "SAFE":
            return f"It looks safe to give {member} {drug}."
        else:
            return "I can't verify this safely. Please consult a doctor or pharmacist."


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
    with _CACHE_LOCK:
        cached = _FLAGSHIP_CACHE.get(cache_key)
    if cached is not None:
        # Log trace from cache
        trace = AgentTrace(
            member_id=member.id,
            intent="DRUG_SAFETY_CHECK",
            gates_passed={"gate1": True, "gate2": True, "gate3": False, "cached": True},
            grounding_score=cached["evidence"]["grounding_score"],
            source_cited=cached["evidence"]["source"]
        )
        db.add(trace)
        db.commit()
        return copy.deepcopy(cached)
        
    # 2. Gate 1 - Deterministic Rule
    gate1_result = check_drug_safety(profile, drug, dose, purpose)
    
    # 3. Gate 2+3 Explanation
    # For UNSAFE/CAUTION: Gate 1 deterministic rules provide the verdict + conflict details.
    # Skip grounded_explain for non-SAFE verdicts to avoid loading a 3rd ML model simultaneously
    # (which exhausts Windows paging file on memory-constrained hosts).
    # Gate 2+3 are only needed for SAFE verdicts to generate a grounded KB explanation.
    if gate1_result.verdict == "SAFE":
        question = (f"Is it safe to give {drug} to an adult?"
                    if profile.age >= 18
                    else f"Is it safe to give {drug} to a {profile.age} year old child?")
        explanation = grounded_explain(question, forced_facts=None)
    else:
        explanation = None  # Use deterministic conflict details directly — no NLI model needed
    
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
    
    # Detail logic: SAFE uses grounded KB explanation; UNSAFE/CAUTION uses deterministic conflict details.
    if explanation is not None:
        # SAFE path: use grounded answer
        if explanation.band == "LOW" or not explanation.evidence:
            detail = "No interaction found in our records, but absence of warning is not proof of safety. Please consult a doctor."
            evidence_source = "Disclaimer"
            confidence: str = "MED"
            grounding_score = 1.0
        else:
            detail = explanation.text
            evidence_source = explanation.evidence.source
            confidence = explanation.evidence.confidence
            grounding_score = explanation.evidence.grounding_score
    else:
        # UNSAFE/CAUTION path: deterministic Gate 1 verdict — no LLM needed
        conflict_summary = " | ".join(c.detail for c in gate1_result.conflicts) if gate1_result.conflicts else "Conflict detected"
        detail = conflict_summary
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
        "language": language,
        "gate1_trace": {
            "verdict": gate1_result.verdict,
            "conflicts": [c.model_dump() for c in gate1_result.conflicts],
            "checked": gate1_result.checked.model_dump(),
        },
    }
    
    # 6. Log trace
    trace = AgentTrace(
        member_id=member.id,
        intent="DRUG_SAFETY_CHECK",
        gates_passed={"gate1": True, "gate2": explanation is not None, "gate3": False},
        grounding_score=grounding_score,
        source_cited=evidence_source
    )
    db.add(trace)
    db.commit()

    if gate1_result.verdict in ("UNSAFE", "CAUTION"):
        from app.memory.events import log_event
        log_event(db, member.id, "safety_alert", {
            "drug": drug,
            "verdict": gate1_result.verdict,
            "conflict": short_conflict
        })

    # 7. Cache all verdicts as deep copies to avoid caller mutation corrupting cache
    with _CACHE_LOCK:
        _FLAGSHIP_CACHE[cache_key] = copy.deepcopy(envelope)

    return envelope
