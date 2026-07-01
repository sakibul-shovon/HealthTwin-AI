import pytest
import sys
import os

# Add the project root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.graph.database import SessionLocal
from app.graph.models import Household, AgentTrace
from app.agents.safety import run_safety_check

@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture(scope="module")
def rahman_household_id(db):
    household = db.query(Household).filter(Household.name == "Rahman Family").order_by(Household.id.desc()).first()
    return household.id

def test_safety_agent_flagship_unsafe_en(db, rahman_household_id):
    # Record starting trace count
    initial_traces = db.query(AgentTrace).count()
    
    envelope = run_safety_check(
        db=db,
        household_id=rahman_household_id,
        member_ref="Baba",
        drug="ibuprofen",
        purpose="pain",
        language="en"
    )
    
    assert envelope["verdict"] == "UNSAFE"
    assert "Warfarin" in envelope["display"]["conflict"] or "Kidney" in envelope["display"]["conflict"] or "Interaction" in envelope["display"]["conflict"] or "Contraindication" in envelope["display"]["conflict"]
    assert "Paracetamol" in envelope["display"]["alternative"]
    
    # Check action "Notify Ma"
    actions = [a["label"] for a in envelope["actions"]]
    assert any("Ma" in label for label in actions)
    
    assert envelope["member_focus"] == "Baba"
    assert envelope["evidence"]["source"] is not None
    assert envelope["evidence"]["confidence"] in ["HIGH", "MED"]
    assert "Don't give Baba ibuprofen" in envelope["spoken"]
    
    # Check trace was written
    assert db.query(AgentTrace).count() == initial_traces + 1

def test_safety_agent_flagship_unsafe_bn(db, rahman_household_id):
    envelope = run_safety_check(
        db=db,
        household_id=rahman_household_id,
        member_ref="Baba",
        drug="ibuprofen",
        purpose="pain",
        language="bn"
    )
    
    assert envelope["verdict"] == "UNSAFE"
    # Basic check for Bengali string
    assert "কে" in envelope["spoken"] or "না" in envelope["spoken"]
    assert envelope["language"] == "bn"

def test_safety_agent_safe(db, rahman_household_id):
    envelope = run_safety_check(
        db=db,
        household_id=rahman_household_id,
        member_ref="Self",
        drug="paracetamol",
        dose="500mg"
    )
    
    assert envelope["verdict"] == "SAFE"
    assert "safe" in envelope["display"]["detail"].lower()
    
def test_safety_agent_caching(db, rahman_household_id):
    # Call the flagship again, it should use cache
    envelope = run_safety_check(
        db=db,
        household_id=rahman_household_id,
        member_ref="Baba",
        drug="ibuprofen",
        purpose="pain",
        language="en"
    )
    
    assert envelope["verdict"] == "UNSAFE"
    # We can check trace to see it says CACHED
    last_trace = db.query(AgentTrace).order_by(AgentTrace.id.desc()).first()
    assert "CACHED" in last_trace.gates_passed
