from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from app.config import settings
from app.api import router as api_router

app = FastAPI(title="HealthTwin", version="0.1.0")

# Guard: allow_credentials=True with wildcard origin is a security error
_allowed_origins = [o for o in settings.ALLOWED_ORIGINS if o != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"app": "HealthTwin", "version": "0.1.0"}

from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import Depends
from app.graph.database import get_db

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_ok = False
    vector_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    try:
        db.execute(text("SELECT 1 FROM kb_chunks LIMIT 1"))
        vector_ok = True
    except Exception:
        pass

    return {
        "status": "ok",
        "db": db_ok,
        "vector": vector_ok,
        "time": datetime.utcnow().isoformat()
    }
