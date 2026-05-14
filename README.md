# Sattuma

Sattuma is a collaborative bilingual card game for imagining, discussing, and reshaping teaching situations. The digital version lets several participants join the same room, share one synchronized game table, and build scenarios together in local, remote, or hybrid settings.

## What the app does

Players use six card decks to build a shared teaching scenario:

- situation
- space
- methods and insights
- resources
- teaching format
- chance

The app supports two main ways to begin:

1. Create a room or join one from the landing screen.
2. Draw cards manually onto the table.
3. Use the random deal button to create a six-card situation automatically.

After the table is filled, the group discusses the scenario and can continue with replacement rounds in which one card is swapped for a new card from the same deck.

## Running locally

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

For local development with automatic restarts:

```bash
npm run dev
```

Then open:

```text
http://localhost:4000
```

## How multiplayer rooms work

- Each browser session joins one room.
- Players in the same room share the same synchronized table state.
- The first player to join a room becomes the host.
- Only the host can start over, deal a random situation, change the timer, or start a replacement round.
- Before reset and random deal actions, the host is asked for confirmation because those actions replace the shared state for everyone in the room.
- Room state is temporary and stored in server memory.
- An opaque browser session token helps the same browser reconnect to its previous player slot after a refresh or short connection drop.
- If the host disconnects, host control temporarily moves to the next connected player so the room can keep going. If the original host reconnects within the reconnect grace window, host control returns to that browser.
- Empty rooms are automatically cleaned up after inactivity.

## Sharing and export

- The landing screen lets facilitators create a room and participants join one with a short room code.
- The game room includes a copy-room-link action for inviting others.
- The current table can be copied as plain text so the final scenario can be pasted into workshop notes or external documents.

## Privacy and data note

Room state is temporary and kept in server memory. No user accounts or persistent personal data are stored.

The browser stores a short opaque reconnect token locally so the same participant can resume a room more reliably after a reload or network interruption.

## Deployment

This project requires a Node.js server. It is not a GitHub Pages-only app because multiplayer depends on an Express and Socket.IO backend.

For deployment, make sure the hosting environment supports:

- persistent Node.js processes
- WebSocket connections
- environment variables for room limits, room expiry, and origin restrictions

The production build is self-contained. The Socket.IO client is served locally by the Node server, and the main game view does not rely on third-party CDNs or hosted web fonts.

Recommended environment variables are documented in `.env.example`.

## Health check

The server exposes:

```text
/health
```

It returns a simple JSON status payload that can be used by uptime checks or deployment monitors.

## Checks

Run the built-in project checks with:

```bash
npm run check
```

These checks validate server syntax, client module syntax, deck parity, a smoke-test file set, and automated multiplayer tests for host permissions, reconnects, invalid payloads, disconnect handling, and rate limiting.

## Project structure

```text
server.js                  Runtime entrypoint
server/                    Config, HTTP app, socket server, validators, room service
public/index.html          Landing screen and main game interface
public/gameA.css           Main styling
public/js/                 Client-side modules
public/i18n/               Interface translations
public/content/            Localized modal content
public/cards/              Localized deck text files
scripts/                   Local validation scripts
tests/                     Automated multiplayer tests
```

## License

This project is distributed under the MIT License. See `LICENSE`.
