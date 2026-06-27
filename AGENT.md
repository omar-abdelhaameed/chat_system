# Agent Reference

This file is the durable project handoff for Codex or any future agent working in this repo.

## Project Context

- Project: Real-Time Chat App
- Backend: FastAPI
- Database: PostgreSQL
- ORM and migrations: sync SQLAlchemy + Alembic
- Cache/PubSub: Redis
- Queue: RabbitMQ
- Containers: Docker Compose
- API base: `/api/v1`

Important: `PLAN.md` may still mention async SQLAlchemy, but the current project direction is sync SQLAlchemy with `postgresql+psycopg2`.

## Source Of Truth Order

Use this order when instructions conflict:

1. The user's latest message
2. This `AGENT.md`
3. `sys_design.md`
4. `PLAN.md`
5. Existing code

Always inspect relevant files before advising or editing.

## Collaboration Rules

The user is the main developer and wants to build this project themselves.

- Do not implement broad features unless the user explicitly asks.
- Small, scoped implementation is allowed when the user says "implement" or names exact files/tasks.
- Prefer explaining hard concepts simply over dumping large implementations.
- Keep edits narrow and aligned with the current prompt.
- Do not rewrite or remove user work unless the user clearly requests it.
- If the user asks for a plan, provide a clear implementation plan and wait.
- If the user asks a learning question, answer directly with small examples.

## Current Implementation Notes

- `GET /health` exists in `backend/app/main.py`.
- Docker Compose runs FastAPI, PostgreSQL, Redis, and RabbitMQ.
- The database layer uses sync SQLAlchemy:
  - driver: `postgresql+psycopg2`
  - session setup: `backend/app/db/session.py`
  - base model class: `backend/app/db/base.py`
- SQLAlchemy models already exist for:
  - `User`
  - `Room`
  - `RoomMember`
  - `Message`
  - `RoomReadState`
  - `WebSocketSession`
- Alembic exists under `backend/app/alembic`; handle future migrations carefully and avoid deleting migration history.

## App Flow Summary

Build in this general order unless the user asks otherwise:

1. Authentication with JWT access and refresh tokens
2. Room creation, listing, and joining
3. Message persistence and room-level sequence ordering
4. WebSocket room connection
5. Reconnection with missed messages
6. Redis-based rate limiting
7. Read receipts
8. Typing indicators
9. README and demo client

## Agent Behavior

- Read `sys_design.md` for system behavior and contracts.
- Read `PLAN.md` for the original day-by-day build path.
- Use the existing code as the current implementation truth, especially where it differs from older plans.
- Verify with Docker when relevant:

```powershell
docker compose build fastapi
docker compose up -d
Invoke-RestMethod http://localhost:8000/health
```

- Keep responses concise and practical.
- Teach the "why" behind backend concepts when the user asks.
- Avoid spending tokens restating the full system design; reference the relevant file instead.
