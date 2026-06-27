# Frontend Progress

## 2026-05-07

Files changed:
- `docs/CURRENT_STATUS.md`
- `docs/progress/frontend.md`

What was done:
- Recorded that the current frontend is React/Vite and must preserve auth, API, WebSocket, and demo adapter behavior during redesign.

What was tested:
- Not tested yet.

Known risks/blockers:
- HeroUI dependencies are not installed yet.

Next recommended task:
- Add HeroUI and refactor the UI without changing backend contracts.

## 2026-05-07 - HeroUI Redesign Checkpoint

Files changed:
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/postcss.config.js`
- `frontend/src/styles.css`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/playwright.config.js`
- `frontend/tests/smoke.spec.js`

What was done:
- Installed HeroUI and upgraded Tailwind to v4-compatible packages.
- Imported HeroUI styles.
- Replaced selected shell/UI elements with HeroUI components:
  - `Card`
  - `Button`
  - `Input`
  - `TextArea`
  - `Avatar`
  - `Chip`
  - `ScrollShadow`
  - `Spinner`
- Preserved auth flow, API calls, WebSocket logic, demo adapter, and message send behavior.
- Added Playwright smoke test for demo workspace.

What was tested:
- `npm run build`
- `npx playwright test --reporter=line --workers=1 --timeout=30000`
- Result: frontend build passed and `1 passed`.

Known risks/blockers:
- App is still mostly in one large `App.jsx`; deeper component splitting can be a later cleanup.
- HeroUI v3 API differs from older examples, so future components should use current exported component props.

Next recommended task:
- Add final responsive/browser polish after backend multi-instance demo.

## 2026-05-07 - Final Frontend Verification

Files changed:
- `docs/progress/frontend.md`

What was done:
- Re-ran the frontend production build and browser smoke after backend work was complete.
- Confirmed HeroUI integration still builds and the demo workspace opens cleanly.

What was tested:
- `npm run build`: passed
- `npx playwright test --reporter=line --workers=1 --timeout=30000`: `1 passed`

Known risks/blockers:
- The smoke test covers the demo workspace shell. A fuller live-backend browser E2E test can be added later.
- `App.jsx` is still large; deeper component extraction is a cleanup task, not a required MVP blocker.

Next recommended task:
- Add live-browser E2E coverage only after the user asks for the next testing/refactor step.

## 2026-05-07 - Join And WebSocket Send Fix

Files changed:
- `frontend/src/App.jsx`
- `frontend/src/api/rooms.js`
- `frontend/tests/live-backend.spec.js`

What was done:
- Stopped treating every listed backend room as already joined.
- Prevented protected message loading and WebSocket connection before the current user has joined the selected room.
- After a successful join, the room state now flips to joined, message loading resumes, and the WebSocket connects.
- Added a live browser regression covering:
  - user A creates a room
  - user A sends successfully
  - user B selects the room before membership
  - user B joins
  - user B connects and sends successfully

What was tested:
- `npm run build`: passed
- `npx playwright test --reporter=line --workers=1 --timeout=60000`: `2 passed`

Known risks/blockers:
- The mobile rail can still show room shortcuts before membership; sending remains blocked until join.

Next recommended task:
- Manually retest with a fresh browser session using two users.

## 2026-05-07 - Settings, People, Alerts, And Room Info

Files changed:
- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `frontend/src/api/rooms.js`
- `frontend/src/api/users.js`
- `frontend/src/demo/demoAdapter.js`
- `frontend/tests/smoke.spec.js`
- `frontend/tests/live-backend.spec.js`
- `docs/progress/frontend.md`

What was done:
- Added API helpers for current-user profile, user search, room details, room member lists, room rename, and direct 1:1 room creation.
- Added Settings/Profile, People, Alerts, and Room Info views inside the existing chat shell without changing auth, room list, message, WebSocket, or demo fallback behavior.
- Profile settings can load/save username, birthday, and profile photo URL. Email is visible/editable in the UI, but backend PATCH currently does not include an email field.
- Register now collects birthday and optional profile photo URL.
- Room info shows room name, members, membership status, sequence info, creator status, and direct-room status, with backend error states when endpoints are not ready.
- People page searches by username and can start/select a direct room with the selected user.
- Demo adapter now supports the new frontend flows.
- Added Playwright smoke coverage for profile settings, people search UI, room settings, and birthday on register.

What was tested:
- `npm run build`: passed.
- `npx playwright test tests/smoke.spec.js --reporter=line --workers=1 --timeout=60000`: `5 passed`.
- `npx playwright test --reporter=line --workers=1 --timeout=60000`: `5 passed`, `1 failed`.

Known risks/blockers:
- Backend endpoints are being implemented in parallel, so live API behavior can still differ from the provisional response normalization.
- Profile email editing is visible, but the documented backend PATCH contract does not yet accept `email`.
- The full Playwright suite is blocked by `tests/live-backend.spec.js`: room creation shows `Internal Server Error` from the live backend before the new room appears.

Next recommended task:
- Run frontend build and Playwright regression once backend changes have settled.

## 2026-05-07 - Direct Chat Browser Regression

Files changed:
- `frontend/src/App.jsx`
- `frontend/src/api/users.js`
- `frontend/src/api/rooms.js`
- `frontend/tests/live-backend.spec.js`
- `docs/progress/frontend.md`

What was done:
- Login now fetches `/users/me` with the fresh access token so the frontend stores the real user UUID instead of falling back to email.
- Profile email is displayed but disabled because the backend profile PATCH contract does not support email changes.
- Fixed direct-room normalization when backend room details include `members` as an array.
- Added live browser coverage for people search creating a 1:1 direct chat and sending a message.

What was tested:
- `npm run build`: passed
- `npx playwright test tests/live-backend.spec.js --reporter=line --workers=1 --timeout=90000`: `2 passed`
- `npx playwright test --reporter=line --workers=1 --timeout=90000`: `7 passed`

Known risks/blockers:
- Alerts are currently client-side operational notices, not a persisted notification system.

Next recommended task:
- Manually test Settings, People, Alerts, Room Info, and direct chat on desktop and mobile widths.

## 2026-05-08 - Profile Photos, Sender Names, Receipts, And Bubble Polish

Files changed:
- `frontend/src/App.jsx`
- `frontend/src/api/client.js`
- `frontend/src/api/messages.js`
- `frontend/src/api/rooms.js`
- `frontend/src/api/users.js`
- `frontend/src/realtime/chatSocket.js`
- `frontend/src/realtime/demoChatSocket.js`
- `frontend/vite.config.js`
- `frontend/tests/smoke.spec.js`
- `frontend/tests/live-backend.spec.js`
- `docs/progress/frontend.md`

What was done:
- Replaced profile-photo URL editing with device image upload from Settings.
- Added a reusable profile-photo avatar wrapper so uploaded photos render in the sidebar, settings, people results, room members, and message bubbles.
- Removed profile photo URL collection from registration UI.
- Fixed real WebSocket `sendMessage`, `sendTyping`, and `sendReadReceipt` to return send success/failure correctly.
- Updated message bubbles to stay compact with sender photo outside the bubble and username/receipt inside.
- Applied incoming `read.receipt` events to message state so receipt chips can move from Sent to Seen.
- Added `/uploads` to the Vite dev proxy so backend-uploaded photos render during local development.

What was tested:
- `npm run build`: passed
- `npx playwright test tests/smoke.spec.js --reporter=line --workers=1`: `6 passed`
- `npx playwright test tests/live-backend.spec.js --reporter=line --workers=1`: `2 passed`

Known risks/blockers:
- Uploaded files are stored in the backend container filesystem for this MVP. A persistent/shared volume or object storage is needed before production deployment.

Next recommended task:
- Manually test profile upload with two browser sessions to confirm each user sees the other user's latest photo after refresh.
