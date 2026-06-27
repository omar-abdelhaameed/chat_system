import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, room_id, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[str(room_id)].add(websocket)

    async def disconnect(self, room_id, websocket: WebSocket) -> None:
        async with self._lock:
            room_key = str(room_id)
            connections = self._connections.get(room_key)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(room_key, None)

    async def broadcast_json(self, event: dict) -> None:
        room_id = event.get("room_id")
        if room_id is None:
            return

        room_key = str(room_id)
        async with self._lock:
            connections = list(self._connections.get(room_key, set()))

        stale_connections: list[WebSocket] = []
        for websocket in connections:
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json(event)
                else:
                    stale_connections.append(websocket)
            except RuntimeError:
                stale_connections.append(websocket)
                logger.debug("Dropping closed WebSocket for room %s", room_key)

        if stale_connections:
            async with self._lock:
                active = self._connections.get(room_key)
                if active is None:
                    return
                for websocket in stale_connections:
                    active.discard(websocket)
                if not active:
                    self._connections.pop(room_key, None)


manager = WebSocketManager()
