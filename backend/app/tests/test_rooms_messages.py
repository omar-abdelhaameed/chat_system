import uuid

from app.models.message import Message
from app.models.room import Room
from app.models.room_member import RoomMember


def register_and_login(client, email="ada@example.com", username="ada"):
    payload = {
        "email": email,
        "username": username,
        "password": "strong-password",
    }
    user_response = client.post("/api/v1/auth/register", json=payload)
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "strong-password"},
    )
    return user_response.json(), login_response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def as_uuid(value):
    return uuid.UUID(value)


def test_create_room_adds_creator_as_member(client, db_session):
    user, token = register_and_login(client)

    response = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(token),
    )

    assert response.status_code == 201
    room = response.json()
    assert room["name"] == "general"
    assert room["created_by_id"] == user["id"]
    assert room["created_by_username"] == "ada"
    assert room["is_member"] is True
    assert room["member_count"] == 1

    membership = (
        db_session.query(RoomMember)
        .filter(
            RoomMember.room_id == as_uuid(room["id"]),
            RoomMember.user_id == as_uuid(user["id"]),
        )
        .one_or_none()
    )
    assert membership is not None


def test_duplicate_room_returns_409(client):
    _, token = register_and_login(client)
    headers = auth_headers(token)
    client.post("/api/v1/rooms", json={"name": "general"}, headers=headers)

    response = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=headers,
    )

    assert response.status_code == 409


def test_join_room_is_idempotent(client, db_session):
    _, token = register_and_login(client)
    headers = auth_headers(token)
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=headers,
    ).json()

    first = client.post(f"/api/v1/rooms/{room['id']}/join", headers=headers)
    second = client.post(f"/api/v1/rooms/{room['id']}/join", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert db_session.query(RoomMember).filter(RoomMember.room_id == as_uuid(room["id"])).count() == 1


def test_anonymous_room_requests_are_rejected(client):
    response = client.get("/api/v1/rooms")

    assert response.status_code == 401


def test_room_list_marks_current_user_membership(client):
    _, creator_token = register_and_login(client)
    _, joiner_token = register_and_login(client, "grace@example.com", "grace")
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(creator_token),
    ).json()

    before_join = client.get("/api/v1/rooms", headers=auth_headers(joiner_token)).json()
    listed_room = next(item for item in before_join if item["id"] == room["id"])
    assert listed_room["is_member"] is False
    assert listed_room["member_count"] == 1

    client.post(f"/api/v1/rooms/{room['id']}/join", headers=auth_headers(joiner_token))

    after_join = client.get("/api/v1/rooms", headers=auth_headers(joiner_token)).json()
    listed_room = next(item for item in after_join if item["id"] == room["id"])
    assert listed_room["is_member"] is True
    assert listed_room["member_count"] == 2


def test_message_history_requires_membership(client, db_session):
    creator, creator_token = register_and_login(client)
    _, outsider_token = register_and_login(client, "grace@example.com", "grace")
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(creator_token),
    ).json()

    db_session.add(
        Message(
            room_id=as_uuid(room["id"]),
            sender_id=as_uuid(creator["id"]),
            content="hello",
            sequence_number=1,
            client_message_id="client-1",
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/rooms/{room['id']}/messages",
        headers=auth_headers(outsider_token),
    )

    assert response.status_code == 403


def test_message_history_returns_sequence_ascending(client, db_session):
    user, token = register_and_login(client)
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(token),
    ).json()

    db_session.add_all(
        [
            Message(
                room_id=as_uuid(room["id"]),
                sender_id=as_uuid(user["id"]),
                content="second",
                sequence_number=2,
                client_message_id="client-2",
            ),
            Message(
                room_id=as_uuid(room["id"]),
                sender_id=as_uuid(user["id"]),
                content="first",
                sequence_number=1,
                client_message_id="client-1",
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/rooms/{room['id']}/messages",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    data = response.json()
    assert [message["sequence_number"] for message in data] == [1, 2]
    assert [message["sender_username"] for message in data] == ["ada", "ada"]
    assert [message["sender_profile_photo_url"] for message in data] == [None, None]


def test_read_state_updates_without_regression(client):
    _, token = register_and_login(client)
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(token),
    ).json()
    headers = auth_headers(token)

    first = client.patch(
        f"/api/v1/rooms/{room['id']}/read-state",
        json={"last_read_sequence_number": 3},
        headers=headers,
    )
    second = client.patch(
        f"/api/v1/rooms/{room['id']}/read-state",
        json={"last_read_sequence_number": 1},
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["user_username"] == "ada"
    assert second.json()["last_read_sequence_number"] == 3
