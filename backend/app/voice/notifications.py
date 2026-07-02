"""
In-memory notification store for demo.
SMS / push notifications are a roadmap feature (not built here).
"""
import uuid
import threading
import json
import os
from datetime import datetime, timezone
from typing import TypedDict

MAX_NOTIFICATIONS = 100
_LOCK = threading.Lock()
_STORE_FILE = os.path.join(os.path.dirname(__file__), "notifications_store.json")

class Notification(TypedDict):
    id: str
    target: str
    message: str
    from_member: str
    timestamp: str

def _load() -> list[Notification]:
    if not os.path.exists(_STORE_FILE):
        return []
    try:
        with open(_STORE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def _save(data: list[Notification]):
    try:
        with open(_STORE_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass

def add_notification(target: str, message: str, from_member: str = "HealthTwin") -> Notification:
    n: Notification = {
        "id": str(uuid.uuid4())[:8],
        "target": target,
        "message": message,
        "from_member": from_member,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with _LOCK:
        store = _load()
        store.append(n)
        if len(store) > MAX_NOTIFICATIONS:
            del store[0]
        _save(store)
    return n

def get_notifications() -> list[Notification]:
    with _LOCK:
        return _load()

def clear_notifications() -> None:
    with _LOCK:
        _save([])
