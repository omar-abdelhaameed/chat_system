import json

import aio_pika
from aio_pika import DeliveryMode, Message
from aio_pika.abc import AbstractRobustChannel, AbstractRobustConnection

from app.core.config import get_settings

settings = get_settings()
INCOMING_MESSAGES_QUEUE = "chat.incoming_messages"

_connection: AbstractRobustConnection | None = None
_channel: AbstractRobustChannel | None = None


async def get_rabbitmq_channel() -> AbstractRobustChannel:
    global _connection, _channel

    if _connection is None or _connection.is_closed:
        _connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        _channel = None

    if _channel is None or _channel.is_closed:
        _channel = await _connection.channel()
        await _channel.declare_queue(INCOMING_MESSAGES_QUEUE, durable=True)

    return _channel


async def publish_incoming_message(payload: dict) -> None:
    channel = await get_rabbitmq_channel()
    body = json.dumps(payload).encode("utf-8")
    await channel.default_exchange.publish(
        Message(
            body=body,
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
        ),
        routing_key=INCOMING_MESSAGES_QUEUE,
    )


async def close_rabbitmq() -> None:
    global _connection, _channel

    if _channel is not None and not _channel.is_closed:
        await _channel.close()
    if _connection is not None and not _connection.is_closed:
        await _connection.close()

    _channel = None
    _connection = None
