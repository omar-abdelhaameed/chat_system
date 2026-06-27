import asyncio
import json
import time
import uuid
from urllib import request
from urllib.error import HTTPError
from urllib.error import URLError

import websockets


BASE_URL = "http://fastapi:8000"
WS_BASE_URL = "ws://fastapi:8000"


def api(path, method="GET", body=None, token=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers=headers,
    )
    with request.urlopen(req, timeout=10) as response:
        if response.status == 204:
            return None
        return json.loads(response.read().decode("utf-8"))


def unique_user():
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"smoke-{suffix}@example.com",
        "username": f"smoke_{suffix}",
        "password": "strong-password",
    }


def wait_for_api(timeout_seconds=30):
    deadline = time.monotonic() + timeout_seconds
    last_error = None
    while time.monotonic() < deadline:
        try:
            return api("/health")
        except (URLError, TimeoutError, ConnectionError, HTTPError) as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"FastAPI did not become ready: {last_error}")


async def main():
    wait_for_api()
    user = unique_user()
    api("/api/v1/auth/register", method="POST", body=user)
    tokens = api(
        "/api/v1/auth/login",
        method="POST",
        body={"email": user["email"], "password": user["password"]},
    )
    token = tokens["access_token"]
    room = api(
        "/api/v1/rooms",
        method="POST",
        body={"name": f"smoke-room-{uuid.uuid4().hex[:8]}"},
        token=token,
    )

    async with websockets.connect(
        f"{WS_BASE_URL}/ws/rooms/{room['id']}?token={token}&session_id={uuid.uuid4()}&last_sequence=0"
    ) as websocket:
        ready = json.loads(await asyncio.wait_for(websocket.recv(), timeout=5))
        assert ready["type"] == "connection.ready", ready

        client_message_id = str(uuid.uuid4())
        await websocket.send(
            json.dumps(
                {
                    "type": "message.send",
                    "client_message_id": client_message_id,
                    "content": "live smoke hello",
                }
            )
        )

        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            event = json.loads(await asyncio.wait_for(websocket.recv(), timeout=15))
            if event.get("type") == "message.created":
                assert event["client_message_id"] == client_message_id, event
                assert event["sequence_number"] == 1, event
                print("live smoke ok")
                return

    raise AssertionError("message.created event was not received")


if __name__ == "__main__":
    asyncio.run(main())
