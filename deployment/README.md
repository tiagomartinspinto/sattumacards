# Deployment examples

Sattuma needs a long-running Node.js process and WebSocket support. It is not a static-site deployment.

Use Node.js `22.13.0` or newer across deployments. The optional SQLite mode relies on `node:sqlite`, and in this project that mode should still be treated as experimental and opt-in.

## Docker

Build and run locally:

```bash
docker build -t sattumacards .
docker run --rm -p 4000:4000 --env-file .env sattumacards
```

The included `Dockerfile` uses Node.js 22 and installs production dependencies only before starting the server with `npm start`.

## Railway

Railway can deploy this project directly from the repository. If a `Dockerfile` is present, Railway will detect and use it automatically.

Suggested environment variables:

- `NODE_ENV=production`
- `PORT=4000`
- `SOCKET_ALLOWED_ORIGINS=https://your-domain.example`
- `ROOM_STORAGE_MODE=memory`

If you later enable experimental SQLite persistence, mount persistent disk storage and set `SQLITE_DB_PATH` to a writable location.

## Render

The included `render.yaml` is a Docker-based example. Render should expose `/health` as the service health check.

Minimum environment variables:

- `NODE_ENV=production`
- `PORT=4000`
- `SOCKET_ALLOWED_ORIGINS=https://your-domain.example`

## Fly.io

The included `fly.toml` is a starting point for Docker deployment with an HTTP health check on `/health`.

Before first deploy:

1. Create the Fly app name you want to use.
2. Update `app` in `fly.toml`.
3. Set any production environment variables with `fly secrets set`.

If you enable experimental SQLite mode on Fly.io, add a mounted volume and point `SQLITE_DB_PATH` to the mounted directory.

## Self-hosted VPS

For a small VPS:

1. Install Node.js `22.13.0` or newer and npm.
2. Clone the repository.
3. Run `npm ci`.
4. Copy `.env.example` to `.env` and set production values.
5. Start the app behind a reverse proxy such as Nginx or Caddy.
6. Use a process manager or system service to keep the app running.

An example `systemd` service file is included at `deployment/sattuma.service`.

### Reverse proxy notes

- Forward both HTTP and WebSocket traffic.
- Keep `/health` reachable for monitors and local checks.
- Restrict allowed origins with `SOCKET_ALLOWED_ORIGINS`.

### Manual SQLite sanity check

If you opt into SQLite mode on a hosted deployment:

1. set `ROOM_STORAGE_MODE=sqlite`
2. point `SQLITE_DB_PATH` to writable persistent storage
3. create a room
4. restart the process
5. confirm the room is restored from the SQLite file
