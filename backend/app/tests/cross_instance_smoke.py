import asyncio
import json
import time
import uuid
from urllib import request
from urllib.error import HTTPError, URLError

import websockets


FASTAPI_1 = "http://fastapi-1:8000"
FASTAPI_2 = "http://fastapi-2:8000"
WS_1 = "ws://fastapi-1:8000"
WS_2 = "ws://fastapi-2:8000"


def api(base_url, path, method="GET", body=None, token=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(
        f"{base_url}{path}",
        data=data,
        method=method,
        headers=headers,
    )
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for(base_url, timeout_seconds=45):
    deadline = time.monotonic() + timeout_seconds
    last_error = None
    while time.monotonic() < deadline:
        try:
            return api(base_url, "/health")
        except (URLError, TimeoutError, ConnectionError, HTTPError) as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"{base_url} did not become ready: {last_error}")


def user_payload(prefix):
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"{prefix}-{suffix}@example.com",
        "username": f"{prefix}_{suffix}",
        "password": "strong-password",
    }


def register_login(base_url, prefix):
    payload = user_payload(prefix)
    api(base_url, "/api/v1/auth/register", method="POST", body=payload)
    tokens = api(
        base_url,
        "/api/v1/auth/login",
        method="POST",
        body={"email": payload["email"], "password": payload["password"]},
    )
    return tokens["access_token"]


async def main():
    wait_for(FASTAPI_1)
    wait_for(FASTAPI_2)

    token_1 = register_login(FASTAPI_1, "alice")
    token_2 = register_login(FASTAPI_2, "bob")
    room = api(
        FASTAPI_1,
        "/api/v1/rooms",
        method="POST",
        body={"name": f"cross-room-{uuid.uuid4().hex[:8]}"},
        token=token_1,
    )
    api(FASTAPI_2, f"/api/v1/rooms/{room['id']}/join", method="POST", token=token_2)

    async with (
        websockets.connect(f"{WS_1}/ws/rooms/{room['id']}?token={token_1}&session_id={uuid.uuid4()}&last_sequence=0") as ws_1,
        websockets.connect(f"{WS_2}/ws/rooms/{room['id']}?token={token_2}&session_id={uuid.uuid4()}&last_sequence=0") as ws_2,
    ):
        assert json.loads(await asyncio.wait_for(ws_1.recv(), timeout=5))["type"] == "connection.ready"
        assert json.loads(await asyncio.wait_for(ws_2.recv(), timeout=5))["type"] == "connection.ready"

        client_message_id = str(uuid.uuid4())
        await ws_1.send(
            json.dumps(
                {
                    "type": "message.send",
                    "client_message_id": client_message_id,
                    "content": "cross instance hello",
                }
            )
        )

        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            event = json.loads(await asyncio.wait_for(ws_2.recv(), timeout=20))
            if event.get("type") == "message.created":
                assert event["client_message_id"] == client_message_id, event
                assert event["sequence_number"] == 1, event
                print("cross instance smoke ok")
                return

    raise AssertionError("cross-instance message.created was not received")


if __name__ == "__main__":
    asyncio.run(main())
