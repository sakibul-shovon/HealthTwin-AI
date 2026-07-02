"""
In-memory notification store for demo.
SMS / push notifications are a roadmap feature (not built here).
"""
import uuid
import threading
from datetime import datetime, timezone
from typing import TypedDict

MAX_NOTIFICATIONS = 100


class Notification(TypedDict):
    id: str
    target: str
    message: str
    from_member: str
    timestamp: str


_NOTIFICATIONS: list[Notification] = []
_LOCK = threading.Lock()


def add_notification(target: str, message: str, from_member: str = "HealthTwin") -> Notification:
    n: Notification = {
        "id": str(uuid.uuid4())[:8],
        "target": target,
        "message": message,
        "from_member": from_member,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with _LOCK:
        _NOTIFICATIONS.append(n)
        # Drop oldest entries if over cap
        if len(_NOTIFICATIONS) > MAX_NOTIFICATIONS:
            del _NOTIFICATIONS[0]
    return n


def get_notifications() -> list[Notification]:
    with _LOCK:
        return list(_NOTIFICATIONS)


def clear_notifications() -> None:
    with _LOCK:
        _NOTIFICATIONS.clear()
