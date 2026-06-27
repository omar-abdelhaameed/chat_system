import asyncio
import json
import logging

import aio_pika

from app.core.config import get_settings
from app.core.queue import INCOMING_MESSAGES_QUEUE
from app.db.session import SessionLocal
from app.services.message_worker_service import (
    MessageWorkerError,
    process_incoming_message,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


async def handle_message(message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=False):
        try:
            payload = json.loads(message.body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.exception("Dropping invalid message payload")
            return

        db = SessionLocal()
        try:
            await process_incoming_message(db, payload)
        except MessageWorkerError:
            logger.exception("Dropping invalid chat message")
        finally:
            db.close()


async def run_worker() -> None:
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=20)
        queue = await channel.declare_queue(INCOMING_MESSAGES_QUEUE, durable=True)
        await queue.consume(handle_message)
        logger.info("Message worker consuming %s", INCOMING_MESSAGES_QUEUE)
        await asyncio.Future()


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
