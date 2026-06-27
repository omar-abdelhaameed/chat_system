import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_token
from app.db.session import get_db
from app.repositories.user_repository import get_user_by_id
from app.services.auth_service import (
    authenticate_user,
    issue_token_pair,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=72)
    birthday: date | None = None
    profile_photo_url: str | None = Field(None, max_length=500)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=72)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    birthday: date | None
    profile_photo_url: str | None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str


def user_to_response(user) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        birthday=user.birthday,
        profile_photo_url=user.profile_photo_url,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(
        db=db,
        email=payload.email,
        username=payload.username,
        password=payload.password,
        birthday=payload.birthday,
        profile_photo_url=payload.profile_photo_url,
    )
    return user_to_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(
        db=db,
        email=payload.email,
        password=payload.password,
    )
    return issue_token_pair(user)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_payload = decode_token(payload.refresh_token)
        if token_payload.get("type") != "refresh":
            raise ValueError("Invalid token type")
        user_id = uuid.UUID(token_payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise credentials_error

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise credentials_error

    return {
        "access_token": create_access_token(str(user.id)),
        "token_type": "bearer",
    }
