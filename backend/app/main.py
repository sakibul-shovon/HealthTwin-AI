import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from app.config import settings
from app.api import router as api_router
from fastapi.responses import JSONResponse
import traceback
from fastapi import Request


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async def _warmup():
        # Wait for DB/router init to settle before loading heavy models
        await asyncio.sleep(4)
        loop = asyncio.get_running_loop()
        try:
            from app.api.tts import _load_pipeline_sync
            await loop.run_in_executor(None, _load_pipeline_sync)
        except Exception:
            pass  # kokoro not installed or failed — handled at request time
    asyncio.create_task(_warmup())
    yield


app = FastAPI(title="HealthTwin", version="0.1.0", lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "traceback": traceback.format_exc()}
    )

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
