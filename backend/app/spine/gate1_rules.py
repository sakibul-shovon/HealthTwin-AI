import json
import os
import re
from typing import List, Optional
from pydantic import BaseModel
from app.graph.schemas import MemberProfileSchema

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

def _load_json(filename: str):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# Load data files once at module level
DRUG_INTERACTIONS = _load_json("drug_interactions.json")
DRUG_SYNONYMS = _load_json("drug_synonyms.json")
DOSE_RANGES = _load_json("dose_ranges.json")
CONTRAINDICATIONS = _load_json("contraindications.json")
SAFE_ALTERNATIVES = _load_json("safe_alternatives.json")

class ConflictDetail(BaseModel):
    type: str # 'interaction', 'contraindication', 'allergy', 'dose'
    detail: str
    severity: str # 'high', 'moderate', 'low'
    source: str

class CheckedFlags(BaseModel):
    interactions: bool = False
    contraindications: bool = False
    dose: bool = False
    allergy: bool = False

class Gate1Result(BaseModel):
    verdict: str # 'SAFE', 'CAUTION', 'UNSAFE'
    conflicts: List[ConflictDetail] = []
    alternative: Optional[str] = None
    checked: CheckedFlags

def _normalize_drug(drug: str) -> str:
    drug = drug.lower().strip()
    return DRUG_SYNONYMS.get(drug, drug)

def _parse_dose_mg(dose_str: str) -> Optional[float]:
    if not dose_str:
        return None
    # Basic parsing: extract numbers before "mg"
    match = re.search(r"(\d+(\.\d+)?)\s*mg", dose_str.lower())
    if match:
        return float(match.group(1))
    return None

def check_drug_safety(profile: MemberProfileSchema, drug: str, dose: Optional[str] = None, purpose: Optional[str] = None) -> Gate1Result:
    canonical_drug = _normalize_drug(drug)
    conflicts: List[ConflictDetail] = []
    checked = CheckedFlags()
    
    # 1. Allergy check
    checked.allergy = True
    for allergy in profile.allergies:
        norm_allergy = _normalize_drug(allergy.substance)
        if norm_allergy == canonical_drug:
            conflicts.append(ConflictDetail(
                type="allergy",
                detail=f"Patient is allergic to {canonical_drug} ({allergy.reaction or 'unspecified reaction'})",
                severity="high",
                source="Patient Profile"
            ))

    # 2. Interaction check
    checked.interactions = True
    current_meds = [_normalize_drug(m.name) for m in profile.medications]
    for interaction in DRUG_INTERACTIONS:
        if not isinstance(interaction, dict):
            continue
        d_a, d_b = interaction.get("drug_a"), interaction.get("drug_b")
        if (canonical_drug == d_a and d_b in current_meds) or (canonical_drug == d_b and d_a in current_meds):
            other_drug = d_b if canonical_drug == d_a else d_a
            conflicts.append(ConflictDetail(
                type="interaction",
                detail=f"Interaction between {canonical_drug} and {other_drug}: {interaction.get('mechanism')}",
                severity=interaction.get("severity", "moderate"),
                source=interaction.get("source", "DrugBank subset")
            ))
            
    # 3. Contraindication check
    checked.contraindications = True
    flags_dict = profile.flags.model_dump()
    active_conditions = [c.lower().strip() for c in profile.conditions]
    
    for contra in CONTRAINDICATIONS:
        if contra.get("drug") == canonical_drug:
            for condition in contra.get("contraindicated_if", []):
                # Check if it's a flag (e.g. kidney_impaired) or in the active conditions list
                if flags_dict.get(condition) is True or condition.lower() in active_conditions:
                    conflicts.append(ConflictDetail(
                        type="contraindication",
                        detail=f"{canonical_drug} is contraindicated: {contra.get('reason')}",
                        severity=contra.get("severity", "high"),
                        source=contra.get("source", "WHO fact sheet")
                    ))
                    break  # one conflict per contra entry is enough
                    
    # 4. Dose check
    if dose:
        parsed_mg = _parse_dose_mg(dose)
        if parsed_mg and canonical_drug in DOSE_RANGES:
            checked.dose = True
            limits = DOSE_RANGES[canonical_drug]
            is_pediatric = profile.age < 12
            
            if is_pediatric:
                if profile.weight_kg:
                    max_dose = limits.get("peds_mg_per_kg_per_dose", 0) * profile.weight_kg
                    if parsed_mg > max_dose:
                        conflicts.append(ConflictDetail(
                            type="dose",
                            detail=f"Pediatric dose {parsed_mg}mg exceeds max recommended dose ({max_dose}mg) for weight {profile.weight_kg}kg",
                            severity="high",
                            source=limits.get("source", "WHO EML")
                        ))
                # Without weight, we cannot safely calculate pediatric dose here.
            else:
                # Naive adult check (assumes dose_str is a single dose, limits is daily max - simplifies for demo)
                # A more robust engine would differentiate per-dose vs daily max based on frequency.
                if parsed_mg > limits.get("adult_max_daily_mg", float('inf')):
                    conflicts.append(ConflictDetail(
                        type="dose",
                        detail=f"Dose {parsed_mg}mg exceeds adult max daily limit ({limits.get('adult_max_daily_mg')}mg)",
                        severity="high",
                        source=limits.get("source", "WHO EML")
                    ))

    # 5. Verdict aggregation
    verdict = "SAFE"
    if any(c.severity == "high" for c in conflicts):
        verdict = "UNSAFE"
    elif any(c.severity == "moderate" for c in conflicts):
        verdict = "CAUTION"

    # 6. Alternative lookup — match on purpose if provided, else any purpose
    alternative = None
    if verdict in ("UNSAFE", "CAUTION"):
        purpose_norm = purpose.lower().strip() if purpose else None
        active_risks = current_meds + [k for k, v in flags_dict.items() if v] + active_conditions
        for alt in SAFE_ALTERNATIVES:
            if alt.get("risky_drug") != canonical_drug:
                continue
            if purpose_norm and alt.get("purpose") != purpose_norm:
                continue
            if alt.get("condition_or_drug") in active_risks:
                alternative = alt.get("alternative")
                break

    return Gate1Result(
        verdict=verdict,
        conflicts=conflicts,
        alternative=alternative,
        checked=checked
    )
