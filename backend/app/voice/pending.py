import uuid
import time
import threading
from typing import Optional
from app.voice.nlu import NluResult

# In-memory store for write commands awaiting confirmation.
# Entries expire after TTL_SECONDS and the store is capped at MAX_ENTRIES.
_PENDING: dict[str, tuple[NluResult, float]] = {}  # id -> (nlu, expiry_timestamp)
_LOCK = threading.Lock()
TTL_SECONDS = 300   # 5 minutes
MAX_ENTRIES = 500


def _evict_expired() -> None:
    now = time.monotonic()
    expired = [k for k, (_, exp) in _PENDING.items() if now > exp]
    for k in expired:
        del _PENDING[k]


def store_pending(nlu: NluResult) -> str:
    pending_id = str(uuid.uuid4())   # full UUID, not an 8-char prefix
    with _LOCK:
        _evict_expired()
        if len(_PENDING) >= MAX_ENTRIES:
            # Drop oldest entry to stay under cap
            oldest = min(_PENDING, key=lambda k: _PENDING[k][1])
            del _PENDING[oldest]
        _PENDING[pending_id] = (nlu, time.monotonic() + TTL_SECONDS)
    return pending_id


def retrieve_pending(pending_id: str) -> Optional[NluResult]:
    with _LOCK:
        entry = _PENDING.get(pending_id)
        if entry is None:
            return None
        nlu, expiry = entry
        if time.monotonic() > expiry:
            del _PENDING[pending_id]
            return None
        return nlu


def clear_pending(pending_id: str) -> None:
    with _LOCK:
        _PENDING.pop(pending_id, None)
