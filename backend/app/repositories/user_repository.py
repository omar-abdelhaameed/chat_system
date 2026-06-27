from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_id(db: Session, user_id):
    result = db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


def get_user_by_email(db: Session, email):
    result = db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


def get_user_by_username(db: Session, username):
    result = db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


def search_users_by_username(db: Session, username, current_user_id, limit=10):
    result = db.execute(
        select(User)
        .where(User.id != current_user_id)
        .where(User.username.ilike(f"%{username}%"))
        .order_by(User.username.asc())
        .limit(limit)
    )
    return result.scalars().all()


def create_user(db: Session, email, username, password_hash, birthday=None, profile_photo_url=None):
    user = User(
        email=email,
        username=username,
        password_hash=password_hash,
        birthday=birthday,
        profile_photo_url=profile_photo_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
