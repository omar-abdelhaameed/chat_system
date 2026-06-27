import uuid
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, status
from starlette.datastructures import UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.user_repository import get_user_by_username, search_users_by_username


def _normalize_username(username: str) -> str:
    normalized = username.strip()
    if len(normalized) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username must be at least 3 characters.",
        )
    return normalized


def validate_birthday(birthday):
    if birthday is not None and birthday > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Birthday cannot be in the future.",
        )
    return birthday


def normalize_profile_photo_url(profile_photo_url):
    if not profile_photo_url:
        return None

    normalized = profile_photo_url.strip()
    if not normalized:
        return None

    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Profile photo URL must be an http or https URL.",
        )

    return normalized


def save_profile_photo(user, upload: UploadFile, uploads_root: Path) -> str:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Profile photo must be an image file.",
        )

    extension_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    extension = extension_map.get(upload.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Profile photo must be JPG, PNG, WEBP, or GIF.",
        )

    content = upload.file.read()
    max_size = 2 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Profile photo must be 2MB or smaller.",
        )

    photo_dir = uploads_root / "profile_photos"
    photo_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}_{uuid.uuid4().hex}{extension}"
    path = photo_dir / filename
    path.write_bytes(content)
    return f"/uploads/profile_photos/{filename}"


def update_profile_photo(db: Session, user, upload: UploadFile, uploads_root: Path):
    user.profile_photo_url = save_profile_photo(user, upload, uploads_root)
    db.commit()
    db.refresh(user)
    return user


def update_current_user_profile(
    db: Session,
    user,
    username=None,
    birthday=None,
    profile_photo_url=None,
    fields=None,
):
    fields = fields or set()

    if "username" in fields:
        normalized_username = _normalize_username(username)
        existing = get_user_by_username(db, normalized_username)
        if existing is not None and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already registered",
            )
        user.username = normalized_username

    if "birthday" in fields:
        user.birthday = validate_birthday(birthday)

    if "profile_photo_url" in fields:
        user.profile_photo_url = normalize_profile_photo_url(profile_photo_url)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered",
        )

    db.refresh(user)
    return user


def search_people(db: Session, username: str, current_user, limit: int = 10):
    normalized = username.strip()
    if len(normalized) < 2:
        return []
    bounded_limit = min(max(limit, 1), 50)
    return search_users_by_username(db, normalized, current_user.id, bounded_limit)
