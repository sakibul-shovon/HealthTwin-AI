from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_clarify_fever():
    # Force mock NLU for this test only — restore key afterwards
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = ""
    try:
        # 1. Ask about fever without temp
        response1 = client.post("/api/voice/command", json={"transcript": "Child has fever", "language": "en"})
        data1 = response1.json()
        print("DATA1:", data1)
        assert data1["verdict"] == "CLARIFY"
        assert "temperature" in data1["display"]["detail"].lower()

        # 2. Provide the temperature in a follow-up
        response2 = client.post("/api/voice/command", json={"transcript": "102 since yesterday", "language": "en"})
        data2 = response2.json()
        assert data2["verdict"] == "CAUTION", f"Expected CAUTION, got {data2}"
    finally:
        settings.GROQ_API_KEY = original_key
