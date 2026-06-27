from app.models.room import Room
from app.models.room_member import RoomMember
from app.models.user import User
from app.services.message_worker_service import MessageWorkerError, persist_ordered_message


def create_user(db_session, email="ada@example.com", username="ada"):
    user = User(
        email=email,
        username=username,
        password_hash="not-used",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def create_room_with_member(db_session, user, name="general"):
    room = Room(name=name, created_by_id=user.id)
    db_session.add(room)
    db_session.flush()
    db_session.add(RoomMember(room_id=room.id, user_id=user.id))
    db_session.commit()
    db_session.refresh(room)
    return room


def worker_payload(room_id, sender_id, client_message_id, content="hello"):
    return {
        "room_id": str(room_id),
        "sender_id": str(sender_id),
        "client_message_id": client_message_id,
        "content": content,
    }


def test_worker_assigns_room_sequence_numbers(db_session):
    user = create_user(db_session)
    room = create_room_with_member(db_session, user)

    first = persist_ordered_message(
        db_session,
        worker_payload(room.id, user.id, "client-1", "first"),
    )
    second = persist_ordered_message(
        db_session,
        worker_payload(room.id, user.id, "client-2", "second"),
    )

    assert first.sequence_number == 1
    assert second.sequence_number == 2


def test_worker_deduplicates_client_message_id(db_session):
    user = create_user(db_session)
    room = create_room_with_member(db_session, user)
    payload = worker_payload(room.id, user.id, "client-1")

    first = persist_ordered_message(db_session, payload)
    second = persist_ordered_message(db_session, payload)

    assert second.id == first.id
    assert second.sequence_number == 1


def test_worker_sequence_is_room_scoped(db_session):
    user = create_user(db_session)
    first_room = create_room_with_member(db_session, user, "general")
    second_room = create_room_with_member(db_session, user, "random")

    first_message = persist_ordered_message(
        db_session,
        worker_payload(first_room.id, user.id, "client-1"),
    )
    second_message = persist_ordered_message(
        db_session,
        worker_payload(second_room.id, user.id, "client-2"),
    )

    assert first_message.sequence_number == 1
    assert second_message.sequence_number == 1


def test_worker_rejects_non_member(db_session):
    owner = create_user(db_session)
    outsider = create_user(db_session, "grace@example.com", "grace")
    room = create_room_with_member(db_session, owner)

    try:
        persist_ordered_message(
            db_session,
            worker_payload(room.id, outsider.id, "client-1"),
        )
    except MessageWorkerError as exc:
        assert "room member" in str(exc)
    else:
        raise AssertionError("Expected non-member message to be rejected")
