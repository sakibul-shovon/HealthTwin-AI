import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.graph.database import SessionLocal
from app.graph.models import DocChunk, Member

client = TestClient(app)

def test_doc_retrieval():
    # 1. Ensure we have a household and a member
    response = client.get("/api/household")
    assert response.status_code == 200
    hh = response.json()
    hh_id = hh["id"]
    
    # Get a member ID (e.g. Baba)
    member_id = None
    for m in hh["members"]:
        if m["role_label"] == "Baba":
            member_id = m["id"]
            break
            
    assert member_id is not None, "Baba not found"

    # 2. Upload a lab report for Baba
    # Use mock extraction logic which requires 'lab' in filename
    file_content = b"Mock lab data"
    files = {"file": ("baba_lab_report.pdf", file_content, "application/pdf")}
    data = {"member_id": str(member_id), "kind": "lab_report"}
    
    upload_res = client.post("/api/upload", files=files, data=data)
    assert upload_res.status_code == 200
    pending_id = upload_res.json()["pending_id"]
    
    confirm_data = {"pending_id": pending_id}
    confirm_res = client.post("/api/upload/confirm", json=confirm_data)
    assert confirm_res.status_code == 200
    
    # 3. Verify DocChunks are created
    db = SessionLocal()
    chunks = db.query(DocChunk).filter(DocChunk.member_id == member_id).all()
    db.close()
    assert len(chunks) > 0, "DocChunk was not stored!"

    # 4. Ask a question targeting the uploaded document
    # "what were Baba's last lab values?"
    question_payload = {
        "transcript": "what were Baba's last lab values?",
        "language": "en"
    }
    q_res = client.post("/api/voice/command", json=question_payload)
    assert q_res.status_code == 200
    ans = q_res.json()
    
    # Should be INFO
    assert ans["verdict"] == "INFO"
    # The source should be the uploaded report
    source = ans["evidence"]["source"]
    assert "Uploaded report" in source
    assert "Baba" in source
