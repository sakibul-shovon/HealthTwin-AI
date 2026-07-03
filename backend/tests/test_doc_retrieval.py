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

    member_id = None
    for m in hh["members"]:
        if m["role_label"] == "Baba":
            member_id = m["id"]
            break
    assert member_id is not None, "Baba not found"

    # Clear any accumulated chat history so E04 context injection doesn't bleed in
    client.delete("/api/chat/history")

    # 2. Upload a lab report for Baba
    file_content = b"Mock lab data"
    files = {"file": ("baba_lab_report.pdf", file_content, "application/pdf")}
    data = {"member_id": str(member_id), "kind": "lab_report"}

    upload_res = client.post("/api/upload", files=files, data=data)
    assert upload_res.status_code == 200
    pending_id = upload_res.json()["pending_id"]

    confirm_res = client.post("/api/upload/confirm", json={"pending_id": pending_id})
    assert confirm_res.status_code == 200

    # 3. Verify DocChunks are created
    db = SessionLocal()
    try:
        chunks = db.query(DocChunk).filter(DocChunk.member_id == member_id).all()
        chunk_ids = [c.id for c in chunks]
        assert len(chunks) > 0, "DocChunk was not stored!"
    finally:
        db.close()

    # 4. Ask a question targeting the uploaded document
    q_res = client.post("/api/voice/command", json={
        "transcript": "what were Baba's last lab values?",
        "language": "en"
    })
    assert q_res.status_code == 200
    ans = q_res.json()

    assert ans["verdict"] == "INFO"
    source = ans["evidence"]["source"]
    assert "Uploaded report" in source
    assert "Baba" in source

    # 5. Teardown — remove the doc chunks we created so later test runs start clean
    db = SessionLocal()
    try:
        from app.graph.models import Document
        db.query(DocChunk).filter(DocChunk.id.in_(chunk_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.member_id == member_id).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
