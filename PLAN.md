# 8-Day Implementation Plan For The Real-Time Chat App

## Summary

Build the backend-first MVP from `sys_design.md`, with a simple HTML/JS demo client instead of React at first. Use FastAPI, async SQLAlchemy, Alembic, PostgreSQL, Redis, RabbitMQ, Docker Compose, JWT auth, WebSockets, ordered messages, reconnect, typing, and read receipts.

The goal is: after 8 days, you have a working portfolio-grade real-time chat backend with a demo client and README that shows you understand real app architecture.

## Day 1: Project Foundation

- Create the backend structure from the design:
  - `app/main.py`
  - `app/core/`
  - `app/db/`
  - `app/api/routes/`
  - `app/models/`
  - `app/services/`
  - `app/repositories/`
  - `app/websocket/`
  - `app/workers/`
- Fix current folder naming issues like `routrs` and `web-socket`.
- Add FastAPI app setup with `/health`.
- Add settings management for database, Redis, RabbitMQ, JWT secrets.
- Add Docker Compose with:
  - `postgres`
  - `redis`
  - `rabbitmq`
  - `fastapi`
- Run app locally and confirm `/health` works.

## Day 2: Database Models And Migrations

- Add async SQLAlchemy setup.
- Add Alembic.
- Implement models:
  - `User`
  - `Room`
  - `RoomMember`
  - `Message`
  - `RoomReadState`
  - `WebSocketSession`
- Add constraints:
  - unique email
  - unique username
  - unique room name
  - unique room member per room/user
  - unique message sequence per room
  - unique client message per sender
- Create and run the first migration.
- Add basic repository functions for users, rooms, and messages.

## Day 3: Authentication

- Implement:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
- Use password hashing.
- Use JWT access tokens and refresh tokens.
- Add auth dependency for protected routes.
- Validate:
  - duplicate email returns `409`
  - duplicate username returns `409`
  - bad login returns `401`
  - valid login returns both tokens.
- Test with Swagger/Postman/curl.

## Day 4: Rooms And Message History

- Implement:
  - `POST /api/v1/rooms`
  - `GET /api/v1/rooms`
  - `POST /api/v1/rooms/{room_id}/join`
  - `GET /api/v1/rooms/{room_id}/messages`
- Creating a room should also add the creator as a room member.
- Joining a room should be idempotent: joining twice should not create duplicates.
- Message history should return messages ordered by `sequence_number`.
- Add membership checks.
- Start a very simple HTML/JS demo client with:
  - register/login form
  - room list
  - create room
  - join room

## Day 5: Basic WebSocket Room Connection

- Implement WebSocket endpoint:

```txt
/ws/rooms/{room_id}?token=ACCESS_TOKEN&session_id=SESSION_ID&last_sequence=0
```

- Validate JWT on connection.
- Validate room membership on connection.
- Close with:
  - `4401` for invalid token
  - `4403` for non-member
- Add in-memory connection manager:
  - track active connections by room
  - broadcast events to local users in the same room
- Support client events:
  - `message.send`
  - `typing.started`
  - `typing.stopped`
  - `read.receipt`
- For this day, messages can be accepted by WebSocket but do not need full RabbitMQ ordering yet.
- Update demo client to connect to a room WebSocket.

## Day 6: Queued Ordered Messaging

- Add RabbitMQ producer in WebSocket message handler.
- Add message worker that consumes queued messages.
- Worker behavior:
  - validate room and sender
  - lock the room row in PostgreSQL
  - increment `last_sequence_number`
  - insert message with the new sequence
  - commit transaction
  - publish `message.created` to Redis Pub/Sub
- Add Redis Pub/Sub listener inside FastAPI.
- When Redis receives `message.created`, broadcast it to connected WebSocket clients in that room.
- Make sure duplicate `client_message_id` does not create duplicate messages.
- Update demo client:
  - show pending message
  - replace pending state when `message.created` arrives.

## Day 7: Reconnect, Missed Messages, And Rate Limit

- On WebSocket connect, use `last_sequence`.
- Query missed messages:

```sql
WHERE room_id = :room_id
AND sequence_number > :last_sequence
ORDER BY sequence_number ASC
```

- Send missed messages before live events.
- Store/update `WebSocketSession`.
- Add Redis rate limit for `message.send`:
  - key: `rate:user:{user_id}`
  - limit: 10 messages per second
- Return WebSocket error event:

```json
{
  "type": "error",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "You can send up to 10 messages per second."
}
```

- Update demo client:
  - store `last_received_sequence` per room
  - reconnect using the last sequence
  - deduplicate messages by `message_id` or `sequence_number`.

## Day 8: Read Receipts, Typing, Scaling Demo, README

- Implement:

```txt
PATCH /api/v1/rooms/{room_id}/read-state
```

- Implement WebSocket `read.receipt`:
  - update `room_read_states`
  - publish read event through Redis
  - broadcast to room members
- Implement typing indicators through Redis Pub/Sub only, without database persistence.
- Update Docker Compose to run:
  - `fastapi-1`
  - `fastapi-2`
  - `postgres`
  - `redis`
  - `rabbitmq`
  - optional `nginx`
- Prove cross-instance messaging works:
  - one client connected to `fastapi-1`
  - another connected to `fastapi-2`
  - messages still arrive through Redis Pub/Sub
- Finish README:
  - architecture summary
  - setup commands
  - API list
  - WebSocket protocol
  - screenshots or short demo steps
  - what production problems this project solves.

## Public Interfaces

Keep these exactly aligned with `sys_design.md`:

- REST base URL: `/api/v1`
- Auth endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
- Room endpoints:
  - `POST /rooms`
  - `GET /rooms`
  - `POST /rooms/{room_id}/join`
  - `GET /rooms/{room_id}/messages`
  - `PATCH /rooms/{room_id}/read-state`
- WebSocket endpoint:
  - `/ws/rooms/{room_id}?token=ACCESS_TOKEN&session_id=SESSION_ID&last_sequence=15`
- WebSocket event names:
  - `message.send`
  - `message.created`
  - `typing.started`
  - `typing.stopped`
  - `read.receipt`
  - `error`

## Test Plan

- Day 1-2: app boots, database connects, migrations run.
- Day 3: auth success/failure tests.
- Day 4: room creation, duplicate room, join once, join twice, list rooms.
- Day 5: WebSocket accepts valid members and rejects invalid users.
- Day 6: two quick messages in one room receive sequence numbers `1`, `2`.
- Day 7: reconnect with old `last_sequence` returns only missed messages.
- Day 8: two FastAPI instances receive the same Redis-published events.

## Assumptions

- Use RabbitMQ, not Kafka, because it is easier to learn and enough for this project.
- Use a simple HTML/JS demo client first, not React, so your backend and system-design skills stay the main focus.
- Use async SQLAlchemy because it fits FastAPI and WebSockets well.
- Password reset, email verification, private DMs, file uploads, and production deployment are out of scope for this 8-day version.
- I will help you each day with small tasks, explanations, debugging, and planning, while you stay the main developer.
