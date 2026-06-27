# Current Status

Date: 2026-05-12

Use this file as the quick status reference. Use `docs/APP_DOCUMENTATION.md` for the full explanation.

## Project Truth

- Backend: FastAPI
- ORM: sync SQLAlchemy with `postgresql+psycopg2`
- Migrations: Alembic
- Database: PostgreSQL
- Cache/PubSub: Redis
- Queue: RabbitMQ
- Frontend: React/Vite/HeroUI
- Containers: Docker Compose

`PLAN.md` is historical. When it conflicts with this file or `AGENT.md`, use the current code and `AGENT.md`.

## Implemented

- `GET /health`
- Docker Compose for:
  - FastAPI
  - PostgreSQL
  - Redis
  - RabbitMQ
  - message worker
  - optional `fastapi-1`, `fastapi-2`, and nginx scaling demo
- Settings management for database, Redis, RabbitMQ, and JWT
- Sync SQLAlchemy database setup
- Alembic migrations
- Models for:
  - users
  - rooms
  - room members
  - messages
  - read states
  - WebSocket sessions
- Auth endpoints:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
- User/profile endpoints:
  - `GET /api/v1/users/me`
  - `PATCH /api/v1/users/me`
  - `POST /api/v1/users/me/photo`
  - `GET /api/v1/users/search`
- Room endpoints:
  - `POST /api/v1/rooms`
  - `GET /api/v1/rooms`
  - `POST /api/v1/rooms/direct`
  - `GET /api/v1/rooms/{room_id}`
  - `PATCH /api/v1/rooms/{room_id}`
  - `POST /api/v1/rooms/{room_id}/join`
  - `GET /api/v1/rooms/{room_id}/members`
  - `PATCH /api/v1/rooms/{room_id}/read-state`
- Message history:
  - `GET /api/v1/rooms/{room_id}/messages`
- WebSocket endpoint:
  - `/ws/rooms/{room_id}?token=ACCESS_TOKEN&session_id=SESSION_ID&last_sequence=15`
- RabbitMQ worker-owned ordered message persistence
- Redis Pub/Sub broadcasting
- Redis message rate limiting
- Reconnect missed-message replay
- Read receipts
- Typing indicators
- Profile photo upload and static serving from `/uploads`
- React frontend with:
  - auth flow
  - room list
  - chat window
  - People page
  - Alerts page
  - Settings/profile page
  - Room info/settings page
  - direct chats
  - demo mode
  - live backend mode

## Current API Contract

REST base URL:

```txt
/api/v1
```

WebSocket:

```txt
/ws/rooms/{room_id}?token=ACCESS_TOKEN&session_id=SESSION_ID&last_sequence=15
```

Events:

- `message.send`
- `message.created`
- `typing.started`
- `typing.stopped`
- `read.receipt`
- `error`
- `connection.ready`

## Test Commands

Backend:

```powershell
docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"
```

Alembic:

```powershell
docker compose run --rm fastapi alembic -c /code/app/alembic.ini check
```

Frontend:

```powershell
cd frontend
npm run build
npx playwright test tests/smoke.spec.js --reporter=line --workers=1
```

Live backend browser checks:

```powershell
cd frontend
npx playwright test tests/live-backend.spec.js --reporter=line --workers=1
```

## Known Limitations

- Profile photos are stored in the backend container filesystem. Add a Docker volume or object storage for persistence.
- Alerts are client-side operational notices, not server-backed notifications.
- Username uniqueness is case-sensitive.
- LocalStorage tokens and WebSocket query tokens are acceptable for this MVP, but should be hardened for production.
- FastAPI startup runs Alembic migrations for convenience. Production should use a dedicated migration step.
