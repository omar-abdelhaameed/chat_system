from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.services.user_service import (
    search_people,
    update_current_user_profile,
    update_profile_photo,
)

router = APIRouter(prefix="/users", tags=["users"])
UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"


class UserProfileResponse(BaseModel):
    id: str
    email: str
    username: str
    birthday: date | None
    profile_photo_url: str | None
    created_at: str | None


class UserProfileUpdateRequest(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=50)
    birthday: date | None = None
    profile_photo_url: str | None = Field(None, max_length=500)


class UserSummaryResponse(BaseModel):
    id: str
    username: str
    profile_photo_url: str | None


def user_to_profile_response(user) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        birthday=user.birthday,
        profile_photo_url=user.profile_photo_url,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


def user_to_summary_response(user) -> UserSummaryResponse:
    return UserSummaryResponse(
        id=str(user.id),
        username=user.username,
        profile_photo_url=user.profile_photo_url,
    )


@router.get("/me", response_model=UserProfileResponse)
def get_me(current_user=Depends(get_current_user)):
    return user_to_profile_response(current_user)


@router.patch("/me", response_model=UserProfileResponse)
def update_me(
    payload: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    update_fields = set(payload.model_fields_set)
    updated_user = update_current_user_profile(
        db=db,
        user=current_user,
        username=payload.username,
        birthday=payload.birthday,
        profile_photo_url=payload.profile_photo_url,
        fields=update_fields,
    )
    return user_to_profile_response(updated_user)


@router.post("/me/photo", response_model=UserProfileResponse)
def upload_me_photo(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    updated_user = update_profile_photo(
        db=db,
        user=current_user,
        upload=photo,
        uploads_root=UPLOADS_ROOT,
    )
    return user_to_profile_response(updated_user)


@router.get("/search", response_model=list[UserSummaryResponse])
def search_users(
    username: str = Query(..., min_length=2, max_length=50),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    users = search_people(db=db, username=username, current_user=current_user, limit=limit)
    return [user_to_summary_response(user) for user in users]
