# Project Status

## Completed in this session

- Added real ESLint and Prettier tooling:
  - `eslint.config.js`
  - `.prettierrc.json`
  - `.prettierignore`
  - package scripts for linting, fixing, formatting, and format checks
- Added Playwright browser-level tests for:
  - landing flow and multiplayer join
  - drag/drop plus card flip sync
  - modal keyboard focus trap and Escape close
  - reconnect notice flow
  - mobile observer mode
- Added deployment examples and docs:
  - `Dockerfile`
  - `.dockerignore`
  - `render.yaml`
  - `fly.toml`
  - `deployment/README.md`
  - `deployment/sattuma.service`
- Added semantic-versioning support in project docs:
  - bumped `package.json` version to `1.1.0`
  - added `CHANGELOG.md`
  - surfaced the app version in the UI footer
- Added a development-only debug panel backed by `/debug/state`, showing:
  - active rooms
  - active players
  - reconnect reservations
  - Socket.IO rate-limit hits
- Added a mobile observer mode for smaller screens so participants can:
  - follow room code and game phase
  - read current table cards
  - follow the player list and active turn
- Added optional storage scaffolding:
  - default memory mode remains unchanged
  - optional SQLite-backed room persistence is available behind environment variables and disabled by default
- Tightened the modal focus return behavior so opening a modal from the menu returns focus to the menu button instead of a hidden menu item.
- Updated `README.md`, `.env.example`, and CI to reflect the new tooling, deployment flow, storage options, and test requirements.
- Re-ran multiplayer tests and Playwright tests successfully after the new changes.
- Re-scanned project files for accidental vendor/tool wording and kept the requested terms out of the tracked project files.

## Files changed

- `eslint.config.js`
- `.prettierrc.json`
- `.prettierignore`
- `CHANGELOG.md`
- `README.md`
- `PROJECT_STATUS.md`
- `.env.example`
- `.dockerignore`
- `Dockerfile`
- `render.yaml`
- `fly.toml`
- `deployment/README.md`
- `deployment/sattuma.service`
- `.github/workflows/ci.yml`
- `package.json`
- `package-lock.json`
- `server/config.js`
- `server/http-app.js`
- `server/logger.js`
- `server/room-service.js`
- `server/room-store.js`
- `server/runtime.js`
- `server/socket-server.js`
- `public/index.html`
- `public/gameA.css`
- `public/js/app-shell.js`
- `public/js/gameA.js`
- `public/js/room.js`
- `public/js/cards.js`
- `public/js/modals.js`
- `public/i18n/en.json`
- `public/i18n/fi.json`
- `playwright.config.js`
- `tests/e2e/app.spec.js`
- `index.html`
- `ohjeet.html`
- `index.js`

## Remaining tasks

- Decide whether custom player names should replace the current automatic animal naming.
- Decide whether the plain-text export should also support a downloadable text or PDF artifact in addition to clipboard copying.
- Decide whether the optional SQLite mode should be exercised in CI or remain a manual deployment feature only.
- Decide whether the development debug panel should stay purely local or also become a protected admin route in hosted workshop environments.
- Decide whether custom player names should replace the current automatic animal naming.

## Known issues or risks

- The default deployment is still memory-only. SQLite persistence exists, but it is disabled by default and has not yet been exercised in automated CI.
- SQLite mode depends on a Node.js runtime that supports `node:sqlite`.
- Reconnect recovery still depends on the same browser keeping its local reconnect token. A different browser or a cleared storage state joins as a new participant.
- Host control is intentionally temporary-transfer based. That keeps a room moving, but control can still switch twice: once when the host drops, and again when the original host returns within the grace window.
- The older root `index.html` and `ohjeet.html` pages still remain alongside the main `public/` app, so there are still two UI generations in the repository.

## Manual tests to run next

1. Start the app in development mode and confirm the footer version and debug panel appear together.
2. Open a room on a phone-sized viewport and confirm the mobile observer panel updates when table cards change on a larger host screen.
3. Enable `ROOM_STORAGE_MODE=sqlite`, restart the server, and confirm active room state survives a process restart in a writable environment.
4. Deploy once with the provided Docker or platform example files and confirm `/health` remains reachable through the real reverse proxy.
5. Open a modal from both the burger menu and a direct trigger and confirm focus always returns to a logical visible control after closing.
