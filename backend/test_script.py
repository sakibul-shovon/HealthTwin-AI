import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

response1 = client.post("/api/voice/command", json={"transcript": "Child has fever", "language": "en"})
data1 = response1.json()

response2 = client.post("/api/voice/command", json={"transcript": "102 since yesterday", "language": "en"})
data2 = response2.json()
print("DATA2:", json.dumps(data2, indent=2))
