# QA Progress

## 2026-05-07

Files changed:
- `docs/CURRENT_STATUS.md`
- `docs/progress/qa.md`
- `backend/app/requirements-dev.txt`
- `backend/pytest.ini`
- `backend/tests/conftest.py`
- `backend/tests/test_auth_api.py`
- `backend/tests/test_room_message_repositories.py`
- `frontend/package.json`
- `frontend/playwright.config.js`
- `frontend/tests/smoke.spec.js`

What was done:
- Created the QA progress log and accepted the frozen REST/WebSocket contract as the test target.
- Added backend pytest scaffolding using in-memory SQLite and FastAPI dependency overrides.
- Added auth API smoke coverage for registration, duplicate email conflict, login failure, and refresh-token type enforcement.
- Added room/message repository coverage for listable rooms, unique room membership, ordered message pagination, and duplicate client message protection.
- Added a frontend Playwright smoke test for the demo workspace path and wired `npm run test:smoke`.

What was tested:
- Not tested yet.
- Attempted `.venv\Scripts\python.exe -m pytest --version`; blocked because the launcher points to a missing Python 3.12 path.
- Attempted `backend\venv\Scripts\python.exe -m pytest --version`; blocked because the launcher points to a missing Python 3.11 path.
- Attempted `npm run build` in `frontend`; blocked by sandbox `spawn EPERM` while Vite/esbuild loaded config.

Known risks/blockers:
- No test suite exists yet.
- Backend room and message REST route files currently contain no implemented routes, so API-level tests for `/api/v1/rooms` and `/api/v1/rooms/{room_id}/messages` are still pending implementation.
- Local Python command/venv launchers are not usable in this environment yet.
- Frontend verification may need to run outside the current sandbox because esbuild process spawning was denied.

Next recommended task:
- Add backend auth smoke tests and frontend build/demo smoke checks.

## 2026-05-07 - Auth Test Foundation

Files changed:
- `backend/app/requirements.txt`
- `backend/app/pytest.ini`
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_auth.py`

What was done:
- Added backend pytest tooling.
- Added FastAPI auth tests for register, duplicate email, duplicate username, login, bad login, refresh success, and invalid refresh.

What was tested:
- `docker compose build fastapi`
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`
- Result: `7 passed`

Known risks/blockers:
- Tests use SQLite for speed and do not replace Alembic/Postgres integration checks.
- Local `backend/venv` is broken and points at a missing Python executable, so Docker is the verification source.

Next recommended task:
- Add REST contract tests for rooms, messages, and read state after endpoints are implemented.

## 2026-05-07 - REST Contract Tests

Files changed:
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_rooms_messages.py`

What was done:
- Added tests for room creation, duplicate rooms, idempotent join, anonymous rejection, membership-protected message history, ascending message order, and non-regressing read state.

What was tested:
- `docker compose build fastapi`
- `docker compose run --rm --no-deps fastapi sh -c "cd /code/app && pytest -q"`
- Result: `14 passed`

Known risks/blockers:
- Tests still do not exercise live Redis, RabbitMQ, or WebSocket behavior.

Next recommended task:
- Add WebSocket and worker integration tests after the service smoke passes.

## 2026-05-07 - WebSocket And Worker Contract Tests

Files changed:
- `backend/app/tests/conftest.py`
- `backend/app/tests/test_websocket.py`
- `backend/app/tests/test_message_worker_service.py`

What was done:
- Added WebSocket tests for close codes and valid connection.
- Added a patched queue test so `message.send` can be verified without a live RabbitMQ dependency.
- Added ordered worker tests.

What was tested:
- Backend test suite result: `22 passed`
- Docker service smoke result: health `ok`, Alembic current at head, no schema drift.

Known risks/blockers:
- No browser verification yet.
- No live RabbitMQ-to-worker-to-Redis-to-WebSocket end-to-end test yet.

Next recommended task:
- Add live backend integration smoke once Docker Compose includes a worker service.

## 2026-05-07 - Test Layout Reconciliation

Files changed:
- `backend/pytest.ini`
- `backend/app/requirements-dev.txt`
- `backend/tests/conftest.py`
- `backend/tests/test_auth_api.py`
- `backend/tests/test_room_message_repositories.py`
- `frontend/package.json`
- `frontend/playwright.config.js`
- `frontend/tests/smoke.spec.js`

What was done:
- Removed the duplicate backend test scaffold under `backend/tests`.
- Kept the active backend test suite under `backend/app/tests`, which is the Docker-aligned layout.
- Kept frontend Playwright smoke scaffolding and npm scripts.

What was tested:
- Backend suite was previously verified in Docker with `22 passed`.

Known risks/blockers:
- Frontend smoke test still needs package/tool verification after frontend dependency work.

Next recommended task:
- Run `npm run build` and `npm run test:smoke` after frontend dependencies are settled.

## 2026-05-07 - Live Backend Smoke

Files changed:
- `backend/app/tests/live_smoke.py`
- `docker-compose.yml`

What was done:
- Added live backend smoke coverage for the full single-instance real-time path.

What was tested:
- RabbitMQ enqueue
- Worker persistence
- Room-level sequence assignment
- Redis Pub/Sub publication
- WebSocket `message.created` delivery
- Result: `live smoke ok`

Known risks/blockers:
- No multi-instance Redis Pub/Sub test yet.

Next recommended task:
- Run frontend browser smoke after HeroUI/frontend work.

## 2026-05-07 - Frontend Smoke

Files changed:
- `frontend/playwright.config.js`
- `frontend/tests/smoke.spec.js`

What was done:
- Verified the frontend demo workspace opens with no console/page errors after HeroUI integration.

What was tested:
- `npm run build`: passed
- `npx playwright test --reporter=line --workers=1 --timeout=30000`: `1 passed`

Known risks/blockers:
- Smoke test covers demo mode only, not live room/WebSocket backend mode.

Next recommended task:
- Add live browser E2E coverage later if the user wants a larger QA phase.

## 2026-05-07 - Final QA Gate

Files changed:
- `docs/progress/qa.md`

What was done:
- Re-ran the main backend, Docker, live realtime, cross-instance, frontend build, and browser smoke checks.

What was tested:
- Backend unit/contract suite: `22 passed`
- Alembic: current revision `91d7f2c8a4b0 (head)`, no schema drift
- Health endpoint: `ok`
- Live backend WebSocket/worker smoke: `live smoke ok`
- Cross-instance Redis Pub/Sub smoke: `cross instance smoke ok`
- Frontend production build: passed
- Frontend Playwright smoke: `1 passed`

Known risks/blockers:
- Local Python virtualenv launchers are still not the trusted path in this workspace; Docker remains the reliable backend test environment.
- Browser QA is currently a smoke test, not a full visual regression suite.

Next recommended task:
- Review final scope with the user and choose the next learning/refactor target.

## 2026-05-07 - Join/Send Regression Gate

Files changed:
- `frontend/tests/live-backend.spec.js`
- `backend/app/tests/test_rooms_messages.py`
- `docs/progress/qa.md`

What was done:
- Added regression coverage for the manual bug report where join appeared broken and sending failed with `WebSocket is not connected`.

What was tested:
- Backend tests: `23 passed`
- Frontend build: passed
- Frontend Playwright suite: `2 passed`
- Live backend smoke: `live smoke ok`

Known risks/blockers:
- Browser regression depends on the live backend stack running at `localhost:8000`.

Next recommended task:
- If the user finds another UI issue, add a small regression test for that exact path before fixing.

## 2026-05-07 - Profile, People, Room Info QA Gate

Files changed:
- `backend/app/tests/test_profiles_people_rooms.py`
- `frontend/tests/smoke.spec.js`
- `frontend/tests/live-backend.spec.js`
- `docs/progress/qa.md`

What was done:
- Covered the new feature batch with backend API tests and browser tests.
- Added live browser coverage for people search creating a direct room and sending a message.

What was tested:
- Backend tests: `35 passed`
- Alembic check: no schema drift
- Frontend build: passed
- Frontend Playwright suite: `7 passed`
- Live backend smoke: `live smoke ok`
- Cross-instance smoke: `cross instance smoke ok`

Known risks/blockers:
- Alerts are not server-backed yet.
- Case-insensitive username uniqueness is not implemented yet.

Next recommended task:
- Manual exploratory UI testing with two real browser sessions.

## 2026-05-08 - Profile Photo And Receipt Regression Gate

Files changed:
- `backend/app/tests/test_profiles_people_rooms.py`
- `backend/app/tests/test_rooms_messages.py`
- `frontend/tests/smoke.spec.js`
- `docs/progress/qa.md`

What was done:
- Added backend checks for uploaded profile-photo responses, message sender display metadata, room creator display metadata, and read receipt display metadata.
- Added frontend smoke coverage for device photo upload in demo mode.
- Re-ran live backend browser tests to verify room creation, join, WebSocket send, and direct chat still work.

What was tested:
- Backend full suite: `36 passed`
- Alembic check: no schema drift
- Frontend build: passed
- Frontend smoke: `6 passed`
- Live backend Playwright: `2 passed`
- Health endpoint: `ok`

Known risks/blockers:
- Browser tests do not yet validate a real uploaded photo from one live user appearing in another live user's browser.

Next recommended task:
- Add a two-user live browser regression for uploaded profile photos when this feature becomes important enough to lock down.
