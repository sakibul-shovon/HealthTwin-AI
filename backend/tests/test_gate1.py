import pytest
import sys
import os

# Add the project root directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.graph.schemas import MemberProfileSchema, MemberFlagsSchema, MedicationBase, AllergyBase
from app.spine.gate1_rules import check_drug_safety

@pytest.fixture
def baba_profile():
    return MemberProfileSchema(
        role_label="Baba",
        age=68,
        sex="M",
        weight_kg=75.0,
        flags=MemberFlagsSchema(kidney_impaired=True, liver_impaired=False, pregnant=False),
        medications=[MedicationBase(name="Warfarin", dose="5mg"), MedicationBase(name="Amlodipine", dose="5mg")],
        conditions=["Hypertension", "Atrial fibrillation"],
        allergies=[]
    )

@pytest.fixture
def ma_profile():
    return MemberProfileSchema(
        role_label="Ma",
        age=61,
        sex="F",
        weight_kg=65.0,
        flags=MemberFlagsSchema(kidney_impaired=False, liver_impaired=False, pregnant=False),
        medications=[MedicationBase(name="Metformin", dose="500mg")],
        conditions=["Type 2 diabetes"],
        allergies=[AllergyBase(substance="Penicillin", reaction="rash")]
    )

@pytest.fixture
def self_profile():
    return MemberProfileSchema(
        role_label="Self",
        age=34,
        sex="M",
        weight_kg=70.0,
        flags=MemberFlagsSchema(kidney_impaired=False, liver_impaired=False, pregnant=False),
        medications=[],
        conditions=[],
        allergies=[]
    )

@pytest.fixture
def child_profile():
    return MemberProfileSchema(
        role_label="Child",
        age=8,
        sex="M",
        weight_kg=25.0, # 25kg * 15mg/kg = 375mg max dose
        flags=MemberFlagsSchema(kidney_impaired=False, liver_impaired=False, pregnant=False),
        medications=[],
        conditions=[],
        allergies=[]
    )

def test_baba_ibuprofen_flagship(baba_profile):
    result = check_drug_safety(baba_profile, "ibuprofen", purpose="pain")
    assert result.verdict == "UNSAFE"
    
    # Must have both interaction and contraindication conflicts
    conflict_types = [c.type for c in result.conflicts]
    assert "interaction" in conflict_types
    assert "contraindication" in conflict_types
    
    # Must suggest alternative
    assert result.alternative == "Paracetamol 500 mg"

def test_baba_brufen_synonym(baba_profile):
    # 'brufen' should resolve to 'ibuprofen'
    result = check_drug_safety(baba_profile, "brufen", purpose="pain")
    assert result.verdict == "UNSAFE"
    assert any(c.type == "interaction" for c in result.conflicts)

def test_ma_amoxicillin_allergy(ma_profile):
    # 'amoxicillin' resolves to 'penicillin' via synonyms or matches directly if logic handled it
    result = check_drug_safety(ma_profile, "amoxicillin")
    assert result.verdict == "UNSAFE"
    assert any(c.type == "allergy" for c in result.conflicts)

def test_self_paracetamol_safe(self_profile):
    result = check_drug_safety(self_profile, "paracetamol", dose="500mg")
    assert result.verdict == "SAFE"
    assert len(result.conflicts) == 0

def test_child_paracetamol_overdose(child_profile):
    # max dose should be 25 * 15 = 375mg, providing 500mg should trigger warning
    result = check_drug_safety(child_profile, "paracetamol", dose="500mg")
    assert result.verdict == "UNSAFE"
    assert any(c.type == "dose" for c in result.conflicts)
