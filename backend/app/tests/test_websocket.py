import pytest
from starlette.websockets import WebSocketDisconnect


def register_and_login(client, email="ada@example.com", username="ada"):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "password": "strong-password",
        },
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "strong-password"},
    )
    return login_response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def create_room(client, token, name="general"):
    response = client.post(
        "/api/v1/rooms",
        json={"name": name},
        headers=auth_headers(token),
    )
    return response.json()


def test_websocket_rejects_invalid_token(client):
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/rooms/00000000-0000-0000-0000-000000000000?token=bad"):
            pass

    assert exc_info.value.code == 4401


def test_websocket_rejects_non_member(client):
    owner_token = register_and_login(client)
    outsider_token = register_and_login(client, "grace@example.com", "grace")
    room = create_room(client, owner_token)

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/ws/rooms/{room['id']}?token={outsider_token}"):
            pass

    assert exc_info.value.code == 4403


def test_websocket_accepts_valid_member(client):
    token = register_and_login(client)
    room = create_room(client, token)

    with client.websocket_connect(
        f"/ws/rooms/{room['id']}?token={token}&session_id=00000000-0000-0000-0000-000000000001&last_sequence=0"
    ) as websocket:
        event = websocket.receive_json()

    assert event["type"] == "connection.ready"
    assert event["room_id"] == room["id"]
    assert event["session_id"] == "00000000-0000-0000-0000-000000000001"


def test_websocket_message_send_queues_payload(client, monkeypatch):
    queued_payloads = []

    async def fake_allow_message_send(user_id, limit=10, window_seconds=1):
        return True

    async def fake_publish_incoming_message(payload):
        queued_payloads.append(payload)

    monkeypatch.setattr("app.websocket.handlers.allow_message_send", fake_allow_message_send)
    monkeypatch.setattr(
        "app.websocket.handlers.publish_incoming_message",
        fake_publish_incoming_message,
    )

    token = register_and_login(client)
    room = create_room(client, token)

    with client.websocket_connect(f"/ws/rooms/{room['id']}?token={token}") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "message.send",
                "client_message_id": "client-1",
                "content": "hello",
            }
        )

    assert queued_payloads == [
        {
            "room_id": room["id"],
            "sender_id": queued_payloads[0]["sender_id"],
            "client_message_id": "client-1",
            "content": "hello",
        }
    ]
