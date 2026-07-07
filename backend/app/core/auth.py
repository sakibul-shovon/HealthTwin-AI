from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import bcrypt

from app.config import settings

_bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, household_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "household_id": household_id,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def _decode(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])


def get_current_household_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = _decode(credentials.credentials)
        return int(payload["household_id"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please log in again")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = _decode(credentials.credentials)
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
