# Sattuma

Sattuma is a collaborative bilingual card game for imagining, discussing, and reshaping teaching situations. The digital version lets several participants join the same room, share one synchronized table, and build scenarios together in local, remote, or hybrid settings.

The current app version is surfaced in the UI footer and tracked in `CHANGELOG.md`. Release tags should follow the same semantic version number format, for example `v1.1.0`.

## What the app does

Players use six decks to build a shared teaching scenario:

- situation
- space
- methods and insights
- resources
- teaching format
- chance

The game flow supports:

1. a landing screen for creating or joining a room
2. manual card dealing onto the shared table
3. a host-only random deal for a full six-card scenario
4. discussion and replacement rounds after the table is filled
5. copying the final table as plain text for workshop notes

## Running locally

Install dependencies:

```bash
npm install
```

Install the Playwright browser once if you want to run browser tests locally:

```bash
npx playwright install chromium
```

Start the app:

```bash
npm start
```

For local development with automatic restarts:

```bash
npm run dev
```

Open:

```text
http://localhost:4000
```

## How multiplayer rooms work

- Each browser session joins one room.
- Players in the same room share the same synchronized table state.
- The first player to join becomes the host.
- Only the host can reset the room, deal a random situation, change the timer, or start a replacement round.
- Reset and random-deal actions require confirmation before they replace the shared table.
- An opaque browser session token helps the same browser reconnect to its earlier player slot after a refresh or short disconnect.
- If the host disconnects, host control temporarily moves to the next connected player so the room can continue.
- If the original host reconnects within the reconnect grace window from the same browser session, host control returns to that browser.
- Empty rooms are cleaned up after inactivity.

## Mobile observer mode

On smaller screens, Sattuma now offers a read-only observer view instead of a full gameplay layout. Participants can:

- see the room code
- follow the current phase and active turn
- read the current table cards
- follow the player list and discussion state

The observer view is intentionally not a second control surface.

## Storage modes

By default, room state is kept only in server memory.

An optional SQLite-backed room store is available behind environment variables and is disabled by default. This keeps the default setup simple and privacy-friendly while leaving room for more persistent workshop deployments later.

Relevant environment variables are listed in `.env.example`:

- `ROOM_STORAGE_MODE=memory`
- `SQLITE_DB_PATH=.data/sattuma.sqlite`

SQLite mode requires a Node.js runtime that supports `node:sqlite`.

## Privacy and data note

Room state is temporary and kept in server memory by default. No user accounts or persistent personal data are stored.

The browser stores a short opaque reconnect token locally so the same participant can resume a room more reliably after a reload or brief network interruption.

## Development setup

This repository now includes real linting, formatting, and browser regression coverage.

Useful commands:

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run test
npm run check
```

`npm run check` includes:

- ESLint
- Prettier check
- server syntax checks
- client module checks
- deck parity checks
- smoke validation
- multiplayer Node tests
- Playwright browser E2E tests

## Development-only debug panel

In non-production mode, the app exposes a lightweight debug panel and debug endpoint for:

- active room count
- current players
- reconnect reservations
- Socket.IO rate-limit hits

This is controlled by `ENABLE_DEBUG_PANEL` and is intended for development only.

## Health check

The server exposes:

```text
/health
```

It returns a small JSON payload with status, version, storage mode, room count, and uptime.

## Deployment

This project requires a Node.js server. It is not a GitHub Pages-only app because multiplayer depends on an Express and Socket.IO backend.

The production build is self-contained:

- the Socket.IO client is served locally by the server
- the main app does not depend on third-party script CDNs
- origin restrictions and HTTP hardening are configured on the server

Deployment examples are included for:

- Docker via `Dockerfile`
- Render via `render.yaml`
- Fly.io via `fly.toml`
- Railway via `deployment/README.md`
- self-hosted VPS via `deployment/sattuma.service`

See `deployment/README.md` for notes and environment variable guidance.

## Project structure

```text
server.js                  Runtime entrypoint
server/                    Config, HTTP app, socket server, validators, room and storage services
public/index.html          Landing screen, game board, observer view, and debug shell
public/gameA.css           Main styling
public/js/                 Client-side modules
public/i18n/               Interface translations
public/content/            Localized modal content
public/cards/              Localized deck text files
deployment/                Deployment examples and service templates
scripts/                   Local validation scripts
tests/                     Multiplayer and browser-level tests
```

## License

This project is distributed under the MIT License. See `LICENSE`.
