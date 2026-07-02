"""
In-memory notification store for demo.
SMS / push notifications are a roadmap feature (not built here).
"""
import uuid
from datetime import datetime
from typing import TypedDict


class Notification(TypedDict):
    id: str
    target: str
    message: str
    from_member: str
    timestamp: str


_NOTIFICATIONS: list[Notification] = []


def add_notification(target: str, message: str, from_member: str = "HealthTwin") -> Notification:
    n: Notification = {
        "id": str(uuid.uuid4())[:8],
        "target": target,
        "message": message,
        "from_member": from_member,
        "timestamp": datetime.utcnow().isoformat(),
    }
    _NOTIFICATIONS.append(n)
    return n


def get_notifications() -> list[Notification]:
    return list(_NOTIFICATIONS)


def clear_notifications() -> None:
    _NOTIFICATIONS.clear()
