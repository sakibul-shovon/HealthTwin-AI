import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.graph.database import SessionLocal, engine, Base
from app.graph.models import Household, Member, Medication, Condition, Relationship

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Create household
    h = Household(name="Test Family")
    db.add(h)
    db.commit()
    db.refresh(h)
    
    # Create members
    m1 = Member(household_id=h.id, role_label="Baba", display_name="Abdur", age=65, sex="male")
    m2 = Member(household_id=h.id, role_label="Ma", display_name="Fatema", age=55, sex="female")
    m3 = Member(household_id=h.id, role_label="DuplicateBaba", display_name="Abdur", age=65, sex="male")
    db.add_all([m1, m2, m3])
    db.commit()
    
    # Add meds
    db.add(Medication(member_id=m1.id, name="aspirin", dose="100mg"))
    db.add(Medication(member_id=m1.id, name="losartan", dose="50mg"))
    
    # Add conditions
    db.add(Condition(member_id=m3.id, name="diabetes"))
    db.commit()
    
    # Capture plain ints now — ORM objects can go stale after cross-session deletes
    h_id = h.id
    m_ids = [m1.id, m2.id, m3.id]

    yield db, h, m1, m2, m3

    # Teardown — use plain ints so we never touch detached ORM instances
    from app.graph.models import HealthEvent, ChatMessage, Document, DocChunk
    db.query(Condition).filter(Condition.member_id.in_(m_ids)).delete(synchronize_session=False)
    db.query(Medication).filter(Medication.member_id.in_(m_ids)).delete(synchronize_session=False)
    db.query(Relationship).filter(
        (Relationship.from_member_id.in_(m_ids)) | (Relationship.to_member_id.in_(m_ids))
    ).delete(synchronize_session=False)
    db.query(HealthEvent).filter(HealthEvent.member_id.in_(m_ids)).delete(synchronize_session=False)
    doc_ids = [d.id for d in db.query(Document).filter(Document.household_id == h_id).all()]
    if doc_ids:
        db.query(DocChunk).filter(DocChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.household_id == h_id).delete(synchronize_session=False)
    db.query(Member).filter(Member.household_id == h_id).delete(synchronize_session=False)
    db.query(ChatMessage).filter(ChatMessage.household_id == h_id).delete(synchronize_session=False)
    db.query(Household).filter(Household.id == h_id).delete(synchronize_session=False)
    db.commit()
    db.close()

def test_api_remove_member(setup_db):
    db, h, m1, m2, m3 = setup_db
    # Add a member just to delete
    res = client.post(f"/api/member?household_id={h.id}", json={
        "display_name": "Temporary",
        "role_label": "Temp",
        "age": 20
    })
    assert res.status_code == 200
    temp_id = res.json()["id"]
    
    # Delete it
    res = client.delete(f"/api/member/{temp_id}")
    assert res.status_code == 200
    
    # Verify gone
    member = db.query(Member).filter(Member.id == temp_id).first()
    assert member is None

def test_api_merge_members(setup_db):
    db, h, m1, m2, m3 = setup_db
    
    # m1 has aspirin, m3 has diabetes. Merge m3 into m1.
    res = client.post(f"/api/member/{m1.id}/merge", json={"remove_id": m3.id})
    assert res.status_code == 200
    
    # m3 should be gone
    deleted = db.query(Member).filter(Member.id == m3.id).first()
    assert deleted is None
    
    # m1 should have diabetes condition now
    conds = db.query(Condition).filter(Condition.member_id == m1.id).all()
    cond_names = [c.name for c in conds]
    assert "diabetes" in cond_names

def test_nlu_remove_medication(setup_db, monkeypatch):
    db, h, m1, m2, m3 = setup_db
    import app.api.voice
    monkeypatch.setattr(app.api.voice, "_get_household_id", lambda x: h.id)
    
    # Voice command: Remove aspirin from Baba
    res = client.post("/api/voice/command", json={
        "transcript": "Remove aspirin from Baba",
        "language": "en"
    })
    assert res.status_code == 200
    data = res.json()
    print("COMMAND DATA:", data)
    assert data["verdict"] == "CONFIRM" or data.get("needs_confirmation") == True
    
    # Commit the voice command through confirm
    pending_id = data["pending_id"]
    res_conf = client.post("/api/voice/confirm", json={"pending_id": pending_id, "confirmed": True})
    print("CONFIRM DATA:", res_conf.json())
    assert res_conf.status_code == 200
    
    # Verify aspirin is gone
    db.expire_all()
    med_objs = db.query(Medication).filter(Medication.member_id == m1.id).all()
    meds = [m.name for m in med_objs]
    assert "aspirin" not in meds
    assert "losartan" in meds
