from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.room_member import RoomMember


def get_room_by_id(db: Session, room_id):
    result = db.execute(select(Room).where(Room.id == room_id))
    return result.scalar_one_or_none()


def get_room_by_name(db: Session, name):
    result = db.execute(select(Room).where(Room.name == name))
    return result.scalar_one_or_none()


def get_room_by_direct_key(db: Session, direct_key):
    result = db.execute(select(Room).where(Room.direct_key == direct_key))
    return result.scalar_one_or_none()


def list_rooms(db: Session, limit=50, offset=0, current_user_id=None):
    membership_exists = (
        select(RoomMember.id)
        .where(
            RoomMember.room_id == Room.id,
            RoomMember.user_id == current_user_id,
        )
        .exists()
    )
    visibility_filter = (
        Room.is_direct.is_(False)
        if current_user_id is None
        else or_(Room.is_direct.is_(False), membership_exists)
    )

    result = db.execute(
        select(Room)
        .where(visibility_filter)
        .order_by(Room.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


def create_room(db: Session, name, created_by_id):
    room = Room(
        name=name,
        created_by_id=created_by_id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def get_room_member(db: Session, room_id, user_id):
    result = db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def list_room_members(db: Session, room_id):
    result = db.execute(
        select(RoomMember)
        .where(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at.asc())
    )
    return result.scalars().all()


def count_room_members(db: Session, room_id):
    result = db.execute(
        select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room_id)
    )
    return result.scalar_one()


def add_room_member(db: Session, room_id, user_id):
    room_member = RoomMember(
        room_id=room_id,
        user_id=user_id,
    )
    db.add(room_member)
    db.commit()
    db.refresh(room_member)
    return room_member
