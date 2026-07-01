from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from app.config import settings
from app.api import router as api_router

app = FastAPI(title="HealthTwin", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"app": "HealthTwin", "version": "0.1.0"}

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "db": False, # Placeholder for step 02
        "vector": False, # Placeholder for step 02
        "time": datetime.utcnow().isoformat()
    }
