import uuid
import time
import threading
import json
import os
from typing import Optional
from app.voice.nlu import NluResult

_LOCK = threading.Lock()
TTL_SECONDS = 300   # 5 minutes
MAX_ENTRIES = 500
_STORE_FILE = os.path.join(os.path.dirname(__file__), "pending_store.json")

def _load() -> dict:
    if not os.path.exists(_STORE_FILE):
        return {}
    try:
        with open(_STORE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def _save(data: dict):
    try:
        with open(_STORE_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass

def _evict_expired(store: dict) -> None:
    now = time.time()
    expired = [k for k, v in store.items() if now > v.get("expiry", 0)]
    for k in expired:
        del store[k]

def store_pending(nlu: NluResult) -> str:
    pending_id = str(uuid.uuid4())
    with _LOCK:
        store = _load()
        _evict_expired(store)
        if len(store) >= MAX_ENTRIES:
            oldest = min(store, key=lambda k: store[k].get("expiry", 0))
            del store[oldest]
        store[pending_id] = {
            "nlu": nlu.model_dump(),
            "expiry": time.time() + TTL_SECONDS
        }
        _save(store)
    return pending_id

def retrieve_pending(pending_id: str) -> Optional[NluResult]:
    with _LOCK:
        store = _load()
        entry = store.get(pending_id)
        if entry is None:
            return None
        if time.time() > entry.get("expiry", 0):
            del store[pending_id]
            _save(store)
            return None
        return NluResult(**entry["nlu"])

def clear_pending(pending_id: str) -> None:
    with _LOCK:
        store = _load()
        if pending_id in store:
            del store[pending_id]
            _save(store)

