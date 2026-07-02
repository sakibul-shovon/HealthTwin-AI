import os
from fastapi.testclient import TestClient
from app.main import app
from app.graph.database import get_db

client = TestClient(app)

def test_upload_and_confirm():
    # We need a member to upload to
    response = client.get("/api/household")
    assert response.status_code == 200
    hh = response.json()
    hh_id = hh["id"]
    
    # Get a member ID (e.g. Child)
    member_id = None
    for m in hh["members"]:
        if m["role_label"] == "Child":
            member_id = m["id"]
            break
            
    assert member_id is not None, "Child member not found in household"

    # 1. Upload file
    # We'll use a mock file
    file_content = b"Mock prescription data"
    files = {"file": ("prescription.jpg", file_content, "image/jpeg")}
    data = {"member_id": str(member_id), "kind": "prescription"}
    
    response = client.post("/api/upload", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()
    assert "pending_id" in res_data
    assert res_data["filename"] == "prescription.jpg"
    assert "medications" in res_data["extracted"]
    
    pending_id = res_data["pending_id"]

    # 2. Confirm upload
    confirm_data = {
        "pending_id": pending_id,
        "edits": None
    }
    response = client.post("/api/upload/confirm", json=confirm_data)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # 3. Verify member has medications
    response = client.get(f"/api/member/{member_id}/twin")
    assert response.status_code == 200
    profile = response.json()
    
    assert any("napa" in m.lower() or "amoxil" in m.lower() for m in profile["medications"])
    
    # Verify conditions
    assert any("fever" in c.lower() or "bacterial" in c.lower() for c in profile["conditions"])
