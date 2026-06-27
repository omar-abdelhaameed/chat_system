# Real-Time Chat App

Portfolio-grade real-time chat system built from `sys_design.md`.

For the full explanation, architecture walkthrough, API details, manual testing guide, and interview notes, read:

- [docs/APP_DOCUMENTATION.md](docs/APP_DOCUMENTATION.md)

## What It Does

- JWT register, login, and refresh
- User profiles with birthday and profile photo upload
- Public rooms with membership checks
- Private 1:1 direct rooms
- Persistent message history
- Ordered room messages using room-level sequence numbers
- WebSocket live messaging
- RabbitMQ message queue
- Redis Pub/Sub cross-instance sync
- Redis message rate limiting
- Reconnect with missed-message replay
- Read receipts and typing indicators
- React/Vite/HeroUI frontend
- Docker Compose local stack and scaling demo

## Stack

- Backend: FastAPI
- Frontend: React, Vite, HeroUI, Tailwind CSS 4
- Database: PostgreSQL
- ORM/migrations: sync SQLAlchemy + Alembic
- Cache/PubSub: Redis
- Queue: RabbitMQ
- Containers: Docker Compose
- Tests: pytest and Playwright

## Architecture

```txt
React frontend
  -> REST /api/v1 for auth, users, rooms, messages, read state
  -> WebSocket /ws/rooms/{room_id} for live events

FastAPI
  -> PostgreSQL for durable data
  -> Redis for Pub/Sub and rate limiting
  -> RabbitMQ for queued incoming messages

Worker
  -> locks room row
  -> increments last_sequence_number
  -> inserts ordered message
  -> publishes message.created to Redis
```

## Quick Start

Start backend services:

```powershell
docker compose up -d postgres redis rabbitmq fastapi worker
```

Check health:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Start frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```txt
http://localhost:5173
```

## Main API

Base URL:

```txt
/api/v1
```

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

Users:

- `GET /users/me`
- `PATCH /users/me`
- `POST /users/me/photo`
- `GET /users/search?username=...`

Rooms:

- `POST /rooms`
- `GET /rooms`
- `POST /rooms/direct`
- `GET /rooms/{room_id}`
- `PATCH /rooms/{room_id}`
- `POST /rooms/{room_id}/join`
- `GET /rooms/{room_id}/members`
- `PATCH /rooms/{room_id}/read-state`

Messages:

- `GET /rooms/{room_id}/messages?limit=50&before_sequence=100`

WebSocket:

```txt
/ws/rooms/{room_id}?token=ACCESS_TOKEN&session_id=SESSION_ID&last_sequence=15
```

## Testing

Backend:

```powershell
docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"
```

Alembic:

```powershell
docker compose run --rm fastapi alembic -c /code/app/alembic.ini check
```

Frontend build:

```powershell
cd frontend
npm run build
```

Frontend smoke:

```powershell
cd frontend
npx playwright test tests/smoke.spec.js --reporter=line --workers=1
```

Live backend browser tests:

```powershell
cd frontend
npx playwright test tests/live-backend.spec.js --reporter=line --workers=1
```

## Scaling Demo

Start two API instances behind nginx:

```powershell
docker compose up -d postgres redis rabbitmq worker fastapi-1 fastapi-2 nginx
```

Ports:

- `fastapi`: `http://localhost:8000`
- `fastapi-1`: `http://localhost:8001`
- `fastapi-2`: `http://localhost:8002`
- `nginx`: `http://localhost:8080`

Run the cross-instance smoke:

```powershell
docker compose exec fastapi-1 sh -c "cd /code/app && python tests/cross_instance_smoke.py"
```

Expected:

```txt
cross instance smoke ok
```

## Production Notes

This is an MVP/portfolio app. Before real production deployment:

- Use secure token storage and short-lived WebSocket tickets.
- Move secrets out of Docker Compose.
- Add production CORS allowlist.
- Store uploads in object storage or a persistent shared volume.
- Run migrations as a separate deployment step.
- Add structured logging, metrics, and monitoring.
