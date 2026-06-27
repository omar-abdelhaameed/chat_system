import uuid

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.repositories.room_repository import count_room_members, get_room_member
from app.services.receipt_service import (
    read_state_to_event,
    update_room_read_state,
)
from app.services.room_service import (
    create_chat_room,
    create_or_get_direct_room,
    get_room_detail_for_member,
    get_room_members_for_member,
    join_chat_room,
    list_chat_rooms,
    rename_chat_room,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


class RoomCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)


class RoomRenameRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)


class DirectRoomRequest(BaseModel):
    user_id: uuid.UUID


class RoomDetailMemberResponse(BaseModel):
    room_id: str
    user_id: str
    username: str
    profile_photo_url: str | None
    joined_at: str | None


class RoomResponse(BaseModel):
    id: str
    name: str
    created_by_id: str | None
    created_by_username: str | None
    created_by_profile_photo_url: str | None
    last_sequence_number: int
    created_at: str | None
    member_count: int
    is_member: bool
    is_direct: bool


class RoomDetailResponse(RoomResponse):
    members: list[RoomDetailMemberResponse]


class RoomMemberResponse(BaseModel):
    room_id: str
    user_id: str
    joined_at: str | None


class ReadStateRequest(BaseModel):
    last_read_sequence_number: int = Field(..., ge=0)


class ReadStateResponse(BaseModel):
    type: str
    room_id: str
    user_id: str
    user_username: str
    user_profile_photo_url: str | None
    last_read_sequence_number: int
    read_at: str | None


def room_to_response(db: Session, room, current_user) -> RoomResponse:
    creator = room.created_by
    return RoomResponse(
        id=str(room.id),
        name=room.name,
        created_by_id=str(room.created_by_id) if room.created_by_id else None,
        created_by_username=creator.username if creator else None,
        created_by_profile_photo_url=creator.profile_photo_url if creator else None,
        last_sequence_number=room.last_sequence_number,
        created_at=room.created_at.isoformat() if room.created_at else None,
        member_count=count_room_members(db, room.id),
        is_member=get_room_member(db, room.id, current_user.id) is not None,
        is_direct=room.is_direct,
    )


def membership_to_response(membership) -> RoomMemberResponse:
    return RoomMemberResponse(
        room_id=str(membership.room_id),
        user_id=str(membership.user_id),
        joined_at=membership.joined_at.isoformat() if membership.joined_at else None,
    )


def detail_members_to_response(members) -> list[RoomDetailMemberResponse]:
    return [
        RoomDetailMemberResponse(
            room_id=str(member.room_id),
            user_id=str(member.user_id),
            username=member.user.username,
            profile_photo_url=member.user.profile_photo_url,
            joined_at=member.joined_at.isoformat() if member.joined_at else None,
        )
        for member in members
    ]


def room_to_detail_response(db: Session, room, current_user) -> RoomDetailResponse:
    room_response = room_to_response(db, room, current_user)
    members = get_room_members_for_member(db, room.id, current_user)
    return RoomDetailResponse(
        **room_response.model_dump(),
        members=detail_members_to_response(members),
    )


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_room(
    payload: RoomCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    room = create_chat_room(db=db, name=payload.name, creator=current_user)
    return room_to_response(db, room, current_user)


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rooms = list_chat_rooms(
        db=db,
        limit=limit,
        offset=offset,
        current_user_id=current_user.id,
    )
    return [room_to_response(db, room, current_user) for room in rooms]


@router.post("/direct", response_model=RoomDetailResponse)
def create_direct_room(
    payload: DirectRoomRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    room = create_or_get_direct_room(db=db, user=current_user, target_user_id=payload.user_id)
    return room_to_detail_response(db, room, current_user)


@router.get("/{room_id}", response_model=RoomDetailResponse)
def get_room(
    room_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    room = get_room_detail_for_member(db=db, room_id=room_id, user=current_user)
    return room_to_detail_response(db, room, current_user)


@router.patch("/{room_id}", response_model=RoomDetailResponse)
def rename_room(
    room_id: uuid.UUID,
    payload: RoomRenameRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    room = rename_chat_room(db=db, room_id=room_id, user=current_user, name=payload.name)
    return room_to_detail_response(db, room, current_user)


@router.post("/{room_id}/join", response_model=RoomMemberResponse)
def join_room(
    room_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    membership = join_chat_room(db=db, room_id=room_id, user=current_user)
    return membership_to_response(membership)


@router.get("/{room_id}/members", response_model=list[RoomDetailMemberResponse])
def get_room_members(
    room_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    members = get_room_members_for_member(db=db, room_id=room_id, user=current_user)
    return detail_members_to_response(members)


@router.patch("/{room_id}/read-state", response_model=ReadStateResponse)
def update_read_state(
    room_id: uuid.UUID,
    payload: ReadStateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    read_state = update_room_read_state(
        db=db,
        room_id=room_id,
        user=current_user,
        last_read_sequence_number=payload.last_read_sequence_number,
    )
    return read_state_to_event(read_state)
