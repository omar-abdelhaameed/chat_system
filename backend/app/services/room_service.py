import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.room_member import RoomMember
from app.repositories.room_repository import (
    add_room_member,
    get_room_by_id,
    get_room_by_direct_key,
    get_room_by_name,
    get_room_member,
    list_room_members,
    list_rooms,
)
from app.repositories.user_repository import get_user_by_id


def _normalize_room_name(name: str) -> str:
    normalized = name.strip()
    if len(normalized) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Room name must be at least 3 characters.",
        )
    return normalized


def ensure_room_exists(db: Session, room_id) -> Room:
    room = get_room_by_id(db, room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )
    return room


def ensure_room_member(db: Session, room_id, user_id) -> RoomMember:
    ensure_room_exists(db, room_id)
    membership = get_room_member(db, room_id, user_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this room",
        )
    return membership


def create_chat_room(db: Session, name: str, creator) -> Room:
    normalized_name = _normalize_room_name(name)
    if get_room_by_name(db, normalized_name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room name already exists",
        )

    room = Room(name=normalized_name, created_by_id=creator.id)
    db.add(room)
    db.flush()

    db.add(RoomMember(room_id=room.id, user_id=creator.id))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room name already exists",
        )

    db.refresh(room)
    return room


def get_room_detail_for_member(db: Session, room_id, user) -> Room:
    ensure_room_member(db, room_id, user.id)
    return ensure_room_exists(db, room_id)


def get_room_members_for_member(db: Session, room_id, user) -> list[RoomMember]:
    ensure_room_member(db, room_id, user.id)
    return list_room_members(db, room_id)


def rename_chat_room(db: Session, room_id, user, name: str) -> Room:
    room = ensure_room_exists(db, room_id)
    if room.is_direct:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct rooms cannot be renamed",
        )

    if room.created_by_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the room creator can update this room",
        )

    normalized_name = _normalize_room_name(name)
    if normalized_name == room.name:
        return room

    if get_room_by_name(db, normalized_name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room name already exists",
        )

    room.name = normalized_name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room name already exists",
        )

    db.refresh(room)
    return room


def list_chat_rooms(db: Session, limit: int = 50, offset: int = 0, current_user_id=None) -> list[Room]:
    bounded_limit = min(max(limit, 1), 100)
    bounded_offset = max(offset, 0)
    return list_rooms(
        db,
        limit=bounded_limit,
        offset=bounded_offset,
        current_user_id=current_user_id,
    )


def join_chat_room(db: Session, room_id, user) -> RoomMember:
    room = ensure_room_exists(db, room_id)
    if room.is_direct:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct rooms cannot be joined through the public room endpoint",
        )

    existing = get_room_member(db, room_id, user.id)
    if existing is not None:
        return existing

    try:
        return add_room_member(db, room_id, user.id)
    except IntegrityError:
        db.rollback()
        existing = get_room_member(db, room_id, user.id)
        if existing is not None:
            return existing
        raise


def _direct_key(first_user_id, second_user_id) -> str:
    first, second = sorted([str(first_user_id), str(second_user_id)])
    return f"{first}:{second}"


def _direct_room_name(current_user, target_user, direct_key: str) -> str:
    first, second = sorted([current_user.username, target_user.username])
    suffix = direct_key.replace("-", "")[:8]
    base = f"Direct: {first} & {second}"
    max_base_length = 100 - len(suffix) - 3
    return f"{base[:max_base_length]} ({suffix})"


def _available_direct_room_name(db: Session, current_user, target_user, direct_key: str) -> str:
    name = _direct_room_name(current_user, target_user, direct_key)
    if get_room_by_name(db, name) is None:
        return name

    suffix = uuid.uuid4().hex[:8]
    base = f"Direct chat {suffix}"
    return base[:100]


def create_or_get_direct_room(db: Session, user, target_user_id) -> Room:
    if target_user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot create a direct room with yourself",
        )

    target_user = get_user_by_id(db, target_user_id)
    if target_user is None or not target_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    direct_key = _direct_key(user.id, target_user.id)
    existing = get_room_by_direct_key(db, direct_key)
    if existing is not None:
        return existing

    try:
        room = Room(
            name=_available_direct_room_name(db, user, target_user, direct_key),
            created_by_id=user.id,
            is_direct=True,
            direct_key=direct_key,
        )
        db.add(room)
        db.flush()
        db.add_all(
            [
                RoomMember(room_id=room.id, user_id=user.id),
                RoomMember(room_id=room.id, user_id=target_user.id),
            ]
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = get_room_by_direct_key(db, direct_key)
        if existing is not None:
            return existing
        raise

    db.refresh(room)
    return room
