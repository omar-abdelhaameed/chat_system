import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

from redis import RedisError
from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def room_channel(room_id) -> str:
    return f"room:{room_id}"


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def publish_room_event(room_id, event: dict) -> None:
    payload = json.dumps(event)
    await get_redis().publish(room_channel(room_id), payload)


async def allow_message_send(user_id, limit: int = 10, window_seconds: int = 1) -> bool:
    key = f"rate:user:{user_id}:messages"
    try:
        redis = get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        return count <= limit
    except RedisError:
        logger.exception("Redis rate-limit check failed; allowing message send")
        return True


async def listen_for_room_events(
    on_event: Callable[[dict], Awaitable[None]],
) -> None:
    while True:
        pubsub = get_redis().pubsub()
        try:
            await pubsub.psubscribe("room:*")
            async for message in pubsub.listen():
                if message.get("type") != "pmessage":
                    continue

                raw_payload = message.get("data")
                if not raw_payload:
                    continue

                try:
                    event = json.loads(raw_payload)
                except json.JSONDecodeError:
                    logger.warning("Ignoring invalid Redis Pub/Sub payload")
                    continue

                await on_event(event)
        except asyncio.CancelledError:
            raise
        except RedisError:
            logger.exception("Redis Pub/Sub listener disconnected; reconnecting")
            await asyncio.sleep(1)
        finally:
            await pubsub.aclose()
