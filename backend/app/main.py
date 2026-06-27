import asyncio
import contextlib
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.messages import router as messages_router
from app.api.routes.rooms import router as rooms_router
from app.api.routes.users import router as users_router
from app.core.config import get_settings
from app.core.queue import close_rabbitmq
from app.core.redis import close_redis, listen_for_room_events
from app.websocket.handlers import room_websocket
from app.websocket.manager import manager

settings = get_settings()
redis_listener_task: asyncio.Task | None = None

app = FastAPI(title=settings.app_name)
uploads_dir = Path(__file__).resolve().parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(users_router, prefix=settings.api_v1_prefix)
app.include_router(rooms_router, prefix=settings.api_v1_prefix)
app.include_router(messages_router, prefix=settings.api_v1_prefix)
app.websocket("/ws/rooms/{room_id}")(room_websocket)


@app.on_event("startup")
async def startup() -> None:
    global redis_listener_task
    redis_listener_task = asyncio.create_task(
        listen_for_room_events(manager.broadcast_json)
    )


@app.on_event("shutdown")
async def shutdown() -> None:
    if redis_listener_task is not None:
        redis_listener_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await redis_listener_task

    await close_rabbitmq()
    await close_redis()


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
    }
