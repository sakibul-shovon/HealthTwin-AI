"""
Groq API key pool with round-robin rotation.

When a key's rate limit (daily quota or per-minute) is exhausted, callers
call rotate() to advance to the next key before retrying.
"""
import threading
from groq import Groq
from app.config import settings

_lock = threading.Lock()
_index = 0


def _all_keys() -> list[str]:
    keys: list[str] = []
    if settings.GROQ_API_KEY:
        keys.append(settings.GROQ_API_KEY)
    if settings.GROQ_API_KEYS:
        for k in settings.GROQ_API_KEYS.split(","):
            k = k.strip()
            if k and k not in keys:
                keys.append(k)
    return keys


def key_count() -> int:
    return max(len(_all_keys()), 1)


def has_keys() -> bool:
    return bool(_all_keys())


def get_client() -> Groq:
    keys = _all_keys()
    if not keys:
        raise ValueError("No Groq API keys configured")
    with _lock:
        key = keys[_index % len(keys)]
    return Groq(api_key=key)


def rotate() -> None:
    global _index
    with _lock:
        _index += 1
