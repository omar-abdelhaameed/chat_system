# Review Progress

## 2026-05-07

Files changed:
- `docs/CURRENT_STATUS.md`
- `docs/progress/review.md`

What was done:
- Documented project truth: sync SQLAlchemy and React/Vite are current, while older async/HTML notes in `PLAN.md` are historical.

What was tested:
- Not tested yet.

Known risks/blockers:
- Broad parallel work can drift from the API contract if not reviewed at each gate.

Next recommended task:
- Review room/message REST implementation before WebSocket work.

## 2026-05-07 - Review Hygiene

Files changed:
- `.gitignore`
- `docs/progress/review.md`

What was done:
- Added ignore rules for Python caches, local virtualenvs, frontend dependencies, Vite build output, logs, env files, and editor files.

What was tested:
- Not tested; this is repository hygiene only.

Known risks/blockers:
- Existing generated files may already be present in the working tree, but they are now ignored going forward.

Next recommended task:
- Keep review focused on source/docs changes only.

## 2026-05-07 - Architecture Gates Passed

Files changed:
- `README.md`
- `docker-compose.yml`
- `nginx.conf`
- `backend/app/tests/live_smoke.py`
- `backend/app/tests/cross_instance_smoke.py`

What was done:
- Confirmed the implementation now has tests/smokes for the main architecture claims:
  - REST contract
  - WebSocket connect/close behavior
  - worker-owned ordering
  - RabbitMQ to Redis to WebSocket live path
  - cross-instance Redis Pub/Sub

What was tested:
- Backend suite passed with 22 tests.
- Live single-instance smoke passed.
- Cross-instance smoke passed.
- Frontend build and browser smoke passed.

Known risks/blockers:
- Startup migration should be revisited before production-style deployment.
- Token storage and WebSocket query-token auth are documented as MVP tradeoffs.

Next recommended task:
- Final status review and decide the next learning/refactor phase.

## 2026-05-07 - Final Review Decision

Files changed:
- `docs/progress/review.md`

What was done:
- Reviewed the final verification evidence against the implementation plan.
- Accepted the MVP architecture as portfolio-ready for the current scope.

What was tested:
- Relied on fresh verification evidence:
  - backend suite `22 passed`
  - Alembic no drift
  - health `ok`
  - live queue/WebSocket smoke passed
  - cross-instance smoke passed
  - frontend build passed
  - frontend browser smoke passed

Known risks/blockers:
- Before production-style deployment, move migrations out of API startup.
- Replace MVP token handling choices with production security decisions if this app is deployed publicly.
- Consider splitting the frontend shell into smaller components for maintainability.

Next recommended task:
- Let the user decide whether the next phase is cleanup, deeper tests, deployment, or feature expansion.

## 2026-05-07 - Profile/People/Direct Room Review

Files changed:
- `docs/progress/review.md`

What was done:
- Reviewed the new profile, people search, room info/settings, and direct room implementation against privacy and contract requirements.
- Required hardening for direct room visibility/join/rename and private profile fields before final acceptance.

What was tested:
- Accepted based on fresh verification evidence:
  - backend suite `35 passed`
  - Alembic no drift
  - frontend build passed
  - Playwright suite `7 passed`
  - live backend smoke passed
  - cross-instance smoke passed

Known risks/blockers:
- Persisted alerts/notifications are not implemented; current Alerts page reports client/backend connection state.
- Username uniqueness is not case-insensitive yet.

Next recommended task:
- Decide whether the next phase is persisted notifications, email/profile-photo upload, or deployment hardening.

## 2026-05-08 - Review Decision For Photo And Receipt Fixes

Files changed:
- `docs/progress/review.md`

What was done:
- Reviewed the scoped fixes against the user's requested behavior:
  - profile photo upload uses a device file, not a URL input
  - user-facing message sender and room creator display names use usernames instead of IDs
  - read receipt events update message receipt state
  - message bubbles stay compact with sender photo outside the bubble
  - real WebSocket send no longer falsely reports failure after a successful send
- Accepted the changes based on fresh backend, frontend, live browser, and Alembic verification.

What was tested:
- Backend suite `36 passed`
- Alembic no drift
- Frontend build passed
- Frontend smoke `6 passed`
- Live backend Playwright `2 passed`

Known risks/blockers:
- Uploaded photos need persistent/shared storage before production-style deployment.
- A future cleanup could remove URL-based profile-photo support from backend contracts if backward compatibility is no longer needed.

Next recommended task:
- Decide whether to add persistent uploads storage now or keep it as documented MVP hardening.

## 2026-05-12 - Documentation Refresh

Files changed:
- `README.md`
- `docs/APP_DOCUMENTATION.md`
- `docs/CURRENT_STATUS.md`
- `docs/progress/review.md`

What was done:
- Added a full app documentation file covering architecture, backend layers, database models, REST API, WebSocket protocol, ordering, reconnect, receipts, frontend behavior, Docker, testing, manual QA, security notes, limitations, next improvements, and interview explanation.
- Replaced the short README with a concise project entrypoint that links to the full docs.
- Updated current status so it reflects the implemented app instead of older pending tasks.

What was tested:
- Checked the new documentation files for non-ASCII characters.
- Read the opening sections of the updated docs to verify they render as normal Markdown.

Known risks/blockers:
- Documentation should be updated again whenever endpoints or frontend behavior change.

Next recommended task:
- Add screenshots or short demo GIFs after the next manual UI pass.
