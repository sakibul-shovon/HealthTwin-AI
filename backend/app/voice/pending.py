import uuid
from typing import Optional
from app.voice.nlu import NluResult

# In-memory store for write commands awaiting confirmation.
# Keys expire on confirm or cancel; no persistence needed for demo.
_PENDING: dict[str, NluResult] = {}


def store_pending(nlu: NluResult) -> str:
    pending_id = str(uuid.uuid4())[:8]
    _PENDING[pending_id] = nlu
    return pending_id


def retrieve_pending(pending_id: str) -> Optional[NluResult]:
    return _PENDING.get(pending_id)


def clear_pending(pending_id: str):
    _PENDING.pop(pending_id, None)
