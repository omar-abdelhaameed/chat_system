# Backend Progress

## 2026-05-07

- Implemented room REST endpoints:
  - `POST /api/v1/rooms`
  - `GET /api/v1/rooms`
  - `POST /api/v1/rooms/{room_id}/join`
- Implemented message history endpoint:
  - `GET /api/v1/rooms/{room_id}/messages`
- Implemented read-state endpoint:
  - `PATCH /api/v1/rooms/{room_id}/read-state`
- Added Redis helpers for:
  - room Pub/Sub channels
  - JSON event publishing
  - reconnecting room-event listener
  - per-user message rate limit
- Added RabbitMQ helpers for durable incoming-message publishing.
- Added WebSocket protocol at:
  - `/ws/rooms/{room_id}?token=ACCESS_TOKEN&session_id=SESSION_ID&last_sequence=15`
- WebSocket support now includes:
  - JWT authentication with `4401` close on failure
  - room membership validation with `4403` close on failure
  - missed-message replay after reconnect
  - `message.send` queue publishing
  - `typing.started` and `typing.stopped` through Redis Pub/Sub
  - `read.receipt` persistence and Redis Pub/Sub publishing
  - local room broadcast from Redis events
- Added message worker processing:
  - consumes `chat.incoming_messages`
  - locks the room row
  - increments `last_sequence_number`
  - persists ordered messages with duplicate-client-message handling
  - publishes committed `message.created` events to Redis

## Verification

- Pending targeted backend import/build checks after implementation.

## 2026-05-07 - REST Contract And Docker Gate

Files changed:
- `backend/Dockerfile`
- `backend/app/api/routes/rooms.py`
- `backend/app/api/routes/messages.py`
- `backend/app/main.py`
- `backend/app/services/room_service.py`
- `backend/app/services/message_service.py`
- `backend/app/services/receipt_service.py`
- `backend/app/services/message_worker_service.py`
- `backend/app/core/redis.py`
- `backend/app/core/queue.py`
- `backend/app/websocket/schemas.py`
- `backend/app/websocket/manager.py`
- `backend/app/websocket/handlers.py`
- `backend/app/workers/message_worker.py`
- `backend/app/repositories/message_repository.py`
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_rooms_messages.py`

What was done:
- Added room, message history, and read-state REST endpoints.
- Wired routers and WebSocket endpoint into FastAPI.
- Added Redis Pub/Sub/rate-limit helpers and RabbitMQ queue helper.
- Added ordered message worker draft.
- Docker FastAPI container now runs `alembic upgrade head` before starting Uvicorn.
- Replaced deprecated Redis Pub/Sub close call with `aclose()`.

What was tested:
- `docker compose build fastapi`
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`
- Result: `14 passed`

Known risks/blockers:
- WebSocket/RabbitMQ/Redis behavior still needs real integration testing with services running.
- Running migrations at FastAPI startup is acceptable for this single-instance dev stage; multi-instance scaling should later use a dedicated migration step/service.

Next recommended task:
- Run Docker service smoke with Postgres/Redis/RabbitMQ and verify Alembic/current health.

## 2026-05-07 - WebSocket And Worker Test Gate

Files changed:
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_websocket.py`
- `backend/app/tests/test_message_worker_service.py`
- `docs/progress/backend.md`
- `docs/progress/qa.md`

What was done:
- Added WebSocket contract tests for invalid token, non-member rejection, valid member connection, and `message.send` queue payload.
- Added worker ordering tests for room sequence assignment, duplicate `client_message_id`, room-scoped sequence numbers, and non-member rejection.

What was tested:
- `docker compose build fastapi`
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`
- Result: `22 passed`
- Docker service smoke:
  - `docker compose up -d postgres redis rabbitmq fastapi`
  - `docker compose exec fastapi sh -c "cd /code/app && alembic current && alembic check"`
  - `Invoke-RestMethod http://localhost:8000/health`
  - Result: Alembic at `91d7f2c8a4b0 (head)`, no schema drift, health `ok`.

Known risks/blockers:
- RabbitMQ consumer and Redis Pub/Sub are still not tested with live cross-process delivery.
- FastAPI startup migration should move to a dedicated migration service before multi-instance scaling.

Next recommended task:
- Add worker service to Docker Compose and run a live message queue/pubsub smoke.

## 2026-05-07 - Live Queue/WebSocket Smoke

Files changed:
- `docker-compose.yml`
- `backend/app/tests/live_smoke.py`

What was done:
- Added a `worker` service to Docker Compose.
- Added a live smoke script that registers/logs in a user, creates a room, opens WebSocket, sends `message.send`, and waits for `message.created`.

What was tested:
- `docker compose build fastapi worker`
- `docker compose up -d postgres redis rabbitmq fastapi worker`
- `docker compose exec fastapi sh -c "cd /code/app && python tests/live_smoke.py"`
- Result: `live smoke ok`

Known risks/blockers:
- Cross-instance broadcast is not tested yet.
- Worker scaling remains intentionally single-worker for ordering safety.

Next recommended task:
- Implement frontend HeroUI redesign and then run frontend build/smoke.

## 2026-05-07 - Cross-Instance Scaling Demo

Files changed:
- `docker-compose.yml`
- `nginx.conf`
- `backend/app/tests/cross_instance_smoke.py`
- `README.md`

What was done:
- Added `fastapi-1`, `fastapi-2`, and `nginx` services while preserving the original `fastapi` dev service.
- Added nginx WebSocket upgrade support.
- Added cross-instance smoke script.
- Added README with architecture, setup, API, WebSocket protocol, scaling demo, and production notes.

What was tested:
- `docker compose build fastapi-1 fastapi-2 worker`
- `docker compose up -d postgres redis rabbitmq worker fastapi-1 fastapi-2 nginx`
- `docker compose exec fastapi-1 sh -c "cd /code/app && python tests/cross_instance_smoke.py"`
- Result: `cross instance smoke ok`

Known risks/blockers:
- Multi-instance FastAPI startup currently runs migrations in each API container. This is acceptable for the demo but should become a dedicated migration job later.

Next recommended task:
- Run final full verification commands.

## 2026-05-07 - Final Backend Verification

Files changed:
- `docs/progress/backend.md`

What was done:
- Rebuilt all backend runtime images used by the dev and scaling demo.
- Verified the backend test suite, schema state, health endpoint, live queue/WebSocket path, and cross-instance Redis Pub/Sub path.

What was tested:
- `docker compose build fastapi worker fastapi-1 fastapi-2`: passed
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`: `22 passed`
- `docker compose exec fastapi sh -c "cd /code/app && alembic current && alembic check"`: current revision `91d7f2c8a4b0 (head)`, no schema drift
- `Invoke-RestMethod http://localhost:8000/health`: health `ok`
- `docker compose exec fastapi sh -c "cd /code/app && python tests/live_smoke.py"`: `live smoke ok`
- `docker compose exec fastapi-1 sh -c "cd /code/app && python tests/cross_instance_smoke.py"`: `cross instance smoke ok`

Known risks/blockers:
- FastAPI startup still uses `on_event`, which works but should later move to lifespan handlers.
- API containers run Alembic on startup for the demo; production should use a dedicated migration job.

Next recommended task:
- Start a cleanup/refactor phase only after the user approves it.

## 2026-05-07 - Room Membership Contract Fix

Files changed:
- `backend/app/api/routes/rooms.py`
- `backend/app/repositories/room_repository.py`
- `backend/app/tests/test_rooms_messages.py`

What was done:
- Added `is_member` and `member_count` to room responses so the frontend can distinguish joined rooms from rooms the current user still needs to join.
- Added a repository helper to count room members.
- Added a regression test proving room list membership changes from `false` to `true` after join.

What was tested:
- `docker compose build fastapi`: passed
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`: `23 passed`
- `docker compose exec fastapi sh -c "cd /code/app && python tests/live_smoke.py"`: `live smoke ok`

Known risks/blockers:
- `member_count` currently performs one count query per listed room. This is fine for the MVP limit of 100 rooms but can be optimized later with an aggregate query.

Next recommended task:
- Keep UI/backend membership behavior covered by the new browser regression test.

## 2026-05-07 - Profiles, People Search, And Direct Rooms

Files changed:
- `backend/app/models/user.py`
- `backend/app/models/room.py`
- `backend/app/repositories/user_repository.py`
- `backend/app/repositories/room_repository.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/user_service.py`
- `backend/app/services/room_service.py`
- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/users.py`
- `backend/app/api/routes/rooms.py`
- `backend/app/main.py`
- `backend/app/alembic/versions/4d2c9b8a71e3_add_profiles_and_direct_rooms.py`
- `backend/app/tests/test_profiles_people_rooms.py`
- `docs/progress/backend.md`

What was done:
- Added nullable `birthday` and `profile_photo_url` fields to users and accepted them during registration.
- Added authenticated profile endpoints:
  - `GET /api/v1/users/me`
  - `PATCH /api/v1/users/me`
- Added authenticated people search:
  - `GET /api/v1/users/search?username=...&limit=...`
- Added room detail/member endpoints:
  - `GET /api/v1/rooms/{room_id}`
  - `GET /api/v1/rooms/{room_id}/members`
- Added creator-only room rename:
  - `PATCH /api/v1/rooms/{room_id}`
- Added direct room creation/find:
  - `POST /api/v1/rooms/direct`
  - uses deterministic sorted-UUID `direct_key` with a unique index.

What was tested:
- `docker compose build fastapi`: passed
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q tests/test_profiles_people_rooms.py"`: `8 passed`
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`: `31 passed`
- `docker compose run --rm fastapi sh -c "cd /code/app && alembic check"`: initially reported the dev database was not up to date.
- `docker compose run --rm fastapi sh -c "cd /code/app && alembic upgrade head && alembic check"`: migration applied and no new upgrade operations detected.
- `docker compose run --rm fastapi sh -c "cd /code/app && alembic check"`: no new upgrade operations detected.

Known risks/blockers:
- Direct room names are deterministic and include a short direct-key suffix. A user-created public room could still intentionally occupy that exact generated name; the unique `direct_key` prevents duplicate direct rooms, but the name collision path may need a friendlier fallback later.
- Existing list-room responses now include `is_direct`; this is additive and should be compatible with current clients.

Next recommended task:
- Add a small integration smoke for profile/search/direct-room flows once the frontend consumes these endpoints.

## 2026-05-07 - Direct Room Privacy Hardening

Files changed:
- `backend/app/repositories/room_repository.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/room_service.py`
- `backend/app/services/user_service.py`
- `backend/app/api/routes/rooms.py`
- `backend/app/api/routes/users.py`
- `backend/app/tests/test_profiles_people_rooms.py`

What was done:
- Kept direct rooms private in room lists: public rooms are visible to authenticated users, direct rooms are visible only to their members.
- Blocked public `POST /rooms/{room_id}/join` for direct rooms.
- Blocked renaming direct rooms through room settings.
- Added validation for future birthdays and unsafe/non-http profile photo URLs.
- Required at least two characters for username search.
- Added regression tests for private direct rooms, public join rejection, direct-room rename rejection, self-chat rejection, search privacy, and profile validation.

What was tested:
- `docker compose build fastapi`: passed
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`: `35 passed`
- `docker compose run --rm fastapi sh -c "cd /code/app && alembic check"`: passed, no schema drift
- `docker compose exec fastapi sh -c "cd /code/app && python tests/live_smoke.py"`: `live smoke ok`
- `docker compose exec fastapi-1 sh -c "cd /code/app && python tests/cross_instance_smoke.py"`: `cross instance smoke ok`

Known risks/blockers:
- Username uniqueness remains database-case-sensitive. Case-insensitive username uniqueness can be added later with a normalized username column or functional index.

Next recommended task:
- Manually test people search and direct chat in two browser sessions.

## 2026-05-08 - Upload Photos And Display Metadata

Files changed:
- `backend/app/main.py`
- `backend/app/services/user_service.py`
- `backend/app/services/message_service.py`
- `backend/app/services/receipt_service.py`
- `backend/app/api/routes/users.py`
- `backend/app/api/routes/messages.py`
- `backend/app/api/routes/rooms.py`
- `backend/app/tests/test_profiles_people_rooms.py`
- `backend/app/tests/test_rooms_messages.py`
- `docs/progress/backend.md`

What was done:
- Added `POST /api/v1/users/me/photo` for multipart profile-photo upload.
- Served uploaded files from `/uploads`.
- Added sender username and sender profile photo URL to message history and `message.created` events.
- Added creator username and creator profile photo URL to room responses.
- Added read-receipt username and profile photo URL to both service events and REST response schema.
- Added backend regressions for profile upload, room creator username, message sender username/photo fields, and read receipt username.

What was tested:
- `docker compose build fastapi worker`: passed
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`: `36 passed`
- `docker compose run --rm fastapi alembic -c /code/app/alembic.ini check`: no new upgrade operations detected
- `Invoke-RestMethod http://localhost:8000/health`: `ok`

Known risks/blockers:
- Profile photos are local files inside the container image/runtime filesystem. Use a Docker volume for local persistence or object storage for deployment.
- Existing profile-photo URL fields remain accepted by older auth/profile contracts, but the frontend now uses upload instead of URL entry.

Next recommended task:
- Add a local uploads volume if users should keep profile photos after container recreation.
