# Project Status

## Completed in this session

- Cleaned up the status file by removing duplicated remaining tasks and tightening the risk summary.
- Archived the obsolete root static-site files under `docs/archive/legacy-static-site/` so the repository has one live app entrypoint.
- Added a `package.json` Node engines requirement for Node.js `22.13.0` or newer and aligned CI plus Docker to the same runtime family.
- Marked the optional SQLite storage mode as experimental in docs and deployment notes while keeping it disabled by default.
- Manually sanity-checked the SQLite path by creating a room in SQLite mode and confirming a fresh runtime could reload it from the same database file.
- Updated `README.md`, `.env.example`, deployment notes, and CI/runtime metadata to reflect the stabilized Node and SQLite expectations.
- Re-ran `npm run check`, `npm run test`, `npm run format:check`, and `npm run lint` successfully after the cleanup.
- Re-scanned project files for accidental vendor/tool wording and kept the requested terms out of the tracked project files.

## Files changed

- `README.md`
- `PROJECT_STATUS.md`
- `.env.example`
- `Dockerfile`
- `deployment/README.md`
- `.github/workflows/ci.yml`
- `package.json`
- `docs/archive/legacy-static-site/README.md`
- `docs/archive/legacy-static-site/index.html`
- `docs/archive/legacy-static-site/ohjeet.html`
- `docs/archive/legacy-static-site/index.js`
- `docs/archive/legacy-static-site/css/index.css`
- `docs/archive/legacy-static-site/css/ohjeet.css`
- `eslint.config.js`

## Remaining tasks

- Decide whether custom player names should replace the current automatic animal naming.
- Decide whether the plain-text export should also support a downloadable text or PDF artifact in addition to clipboard copying.
- Decide whether the optional SQLite mode should be exercised in CI or remain a manual deployment feature only.
- Decide whether the development debug panel should stay purely local or also become a protected admin route in hosted workshop environments.

## Known issues or risks

- Default operation is still memory-only. Experimental SQLite persistence exists, but it is opt-in and not covered by CI yet.
- Reconnect recovery still depends on the same browser keeping its local reconnect token.
- Host control is intentionally temporary-transfer based, so it can move once on disconnect and once again on reclaim.
- The archived static-site prototype is kept only under `docs/archive/legacy-static-site/` for historical reference and is not part of the live app.

## Manual tests to run next

1. Start the app in development mode and confirm the footer version and debug panel appear together.
2. Open a room on a phone-sized viewport and confirm the mobile observer panel updates when table cards change on a larger host screen.
3. Enable experimental `ROOM_STORAGE_MODE=sqlite`, restart the server, and confirm active room state survives a process restart in a writable environment.
4. Deploy once with the provided Docker or platform example files and confirm `/health` remains reachable through the real reverse proxy.
5. Open a modal from both the burger menu and a direct trigger and confirm focus always returns to a logical visible control after closing.
