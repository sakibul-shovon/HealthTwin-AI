from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.graph.database import get_db
from app.graph.models import User, Household
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    family_name: str = "My Family"


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: int
    email: str
    household_id: int
    family_name: str


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    household = Household(name=req.family_name)
    db.add(household)
    db.flush()

    user = User(
        email=email,
        hashed_password=hash_password(req.password),
        household_id=household.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.household_id)
    return AuthResponse(
        token=token,
        user_id=user.id,
        email=user.email,
        household_id=user.household_id,
        family_name=household.name,
    )


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.household_id)
    return AuthResponse(
        token=token,
        user_id=user.id,
        email=user.email,
        household_id=user.household_id,
        family_name=user.household.name,
    )


@router.get("/me")
def get_me(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.id,
        "email": user.email,
        "household_id": user.household_id,
        "family_name": user.household.name,
    }
