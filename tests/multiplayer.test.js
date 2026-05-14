const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { io: createClient } = require("socket.io-client");

const { createRuntime } = require("../server/runtime");

async function onceWithTimeout(emitter, eventName, timeoutMs = 1500) {
  return Promise.race([
    once(emitter, eventName).then((args) => args[0]),
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${eventName}`));
      }, timeoutMs);

      timer.unref?.();
    }),
  ]);
}

async function startTestRuntime(configOverrides = {}) {
  const runtime = createRuntime({
    config: {
      PORT: 0,
      ROOM_CLEANUP_INTERVAL_MS: 50,
      RECONNECT_GRACE_MS: 200,
      ...configOverrides,
    },
  });

  await new Promise((resolve, reject) => {
    runtime.server.listen(0, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const address = runtime.server.address();
  return {
    ...runtime,
    port: address.port,
  };
}

async function connectClient({ port, roomCode = "", playerSessionId = "" }) {
  const socket = createClient(`http://127.0.0.1:${port}`, {
    autoConnect: false,
    auth: playerSessionId ? { playerSessionId } : undefined,
    query: roomCode ? { room: roomCode } : undefined,
    reconnection: false,
    transports: ["websocket"],
  });

  const connectPromise = onceWithTimeout(socket, "connect");
  const connectErrorPromise = onceWithTimeout(socket, "connect_error");
  const userNamePromise = onceWithTimeout(socket, "yourUserName");
  const roomInfoPromise = onceWithTimeout(socket, "roomInfo");
  const sessionInfoPromise = onceWithTimeout(socket, "sessionInfo");
  const resetPayloadPromise = onceWithTimeout(socket, "resetDecks");
  const sessionResumedPromise = onceWithTimeout(socket, "sessionResumed").catch(() => null);

  socket.connect();

  const connectionOutcome = await Promise.race([connectPromise, connectErrorPromise]);

  if (connectionOutcome instanceof Error) {
    throw connectionOutcome;
  }

  return {
    roomInfo: await roomInfoPromise,
    sessionInfo: await sessionInfoPromise,
    sessionResumedPromise,
    socket,
    userName: await userNamePromise,
    initialResetPayload: await resetPayloadPromise,
  };
}

test("guest cannot use host-only room actions", async (t) => {
  const runtime = await startTestRuntime();
  t.after(() => runtime.server.close());

  const host = await connectClient({
    port: runtime.port,
    playerSessionId: "host-session-123456",
  });

  const guest = await connectClient({
    port: runtime.port,
    roomCode: host.roomInfo.roomCode,
    playerSessionId: "guest-session-123456",
  });

  t.after(() => {
    host.socket.close();
    guest.socket.close();
  });

  guest.socket.emit("resetDecks");
  assert.equal((await onceWithTimeout(guest.socket, "actionRejected")).key, "hostOnly");

  guest.socket.emit("dealRandomSituation");
  assert.equal((await onceWithTimeout(guest.socket, "actionRejected")).key, "hostOnly");

  guest.socket.emit("setTimerDuration", { durationSeconds: 60 });
  assert.equal((await onceWithTimeout(guest.socket, "actionRejected")).key, "hostOnly");

  guest.socket.emit("startReplacementPhase");
  assert.equal((await onceWithTimeout(guest.socket, "actionRejected")).key, "hostOnly");
});

test("temporary host transfer keeps the room moving and original host can reclaim it on reconnect", async (t) => {
  const runtime = await startTestRuntime({ RECONNECT_GRACE_MS: 300 });
  t.after(() => runtime.server.close());

  const hostSessionId = "host-session-reconnect-123";
  const host = await connectClient({ port: runtime.port, playerSessionId: hostSessionId });
  const hostName = host.userName;

  const guest = await connectClient({
    port: runtime.port,
    roomCode: host.roomInfo.roomCode,
    playerSessionId: "guest-session-reconnect-123",
  });
  const guestName = guest.userName;

  t.after(() => {
    host.socket.close();
    guest.socket.close();
  });

  host.socket.close();

  const guestResetPayload = await onceWithTimeout(guest.socket, "resetDecks");
  assert.equal(guestResetPayload.gameState.hostPlayer, guestName);

  guest.socket.emit("resetDecks");
  const guestResetBoard = await onceWithTimeout(guest.socket, "resetDecks");
  assert.equal(guestResetBoard.gameState.hostPlayer, guestName);

  const reconnectedHost = await connectClient({
    port: runtime.port,
    roomCode: host.roomInfo.roomCode,
    playerSessionId: hostSessionId,
  });
  t.after(() => reconnectedHost.socket.close());

  assert.equal(reconnectedHost.userName, hostName);
  const resumedNotice = await reconnectedHost.sessionResumedPromise;
  assert.equal(resumedNotice, undefined);

  const reconnectedPayload = reconnectedHost.initialResetPayload;
  assert.equal(reconnectedPayload.gameState.hostPlayer, hostName);
});

test("invalid payloads are rejected", async (t) => {
  const runtime = await startTestRuntime();
  t.after(() => runtime.server.close());

  const host = await connectClient({
    port: runtime.port,
    playerSessionId: "host-session-invalid-1",
  });
  t.after(() => host.socket.close());

  host.socket.emit("requestCardMove", { bad: true });
  assert.equal((await onceWithTimeout(host.socket, "actionRejected")).key, "invalidPayload");
});

test("disconnecting during a pending turn clears the pending card and advances the room", async (t) => {
  const runtime = await startTestRuntime();
  t.after(() => runtime.server.close());

  const host = await connectClient({
    port: runtime.port,
    playerSessionId: "host-session-pending-1",
  });

  const guest = await connectClient({
    port: runtime.port,
    roomCode: host.roomInfo.roomCode,
    playerSessionId: "guest-session-pending-1",
  });
  const guestName = guest.userName;

  t.after(() => {
    host.socket.close();
    guest.socket.close();
  });

  host.socket.emit("requestCardMove", {
    cardId: "card-situation-8",
    deckId: "situation",
    newParentId: "dropzone-situation",
    targetDeckId: "situation",
  });

  await onceWithTimeout(guest.socket, "cardMoved");
  host.socket.close();

  const guestResetPayload = await onceWithTimeout(guest.socket, "resetDecks");
  assert.equal(guestResetPayload.gameState.pendingCardId, null);
  assert.equal(Object.keys(guestResetPayload.boardState.cardPositions).length, 0);
  assert.equal(guestResetPayload.gameState.currentPlayer, guestName);
});

test("rate limiting rejects bursts of repeated requests", async (t) => {
  const runtime = await startTestRuntime();
  t.after(() => runtime.server.close());

  const host = await connectClient({
    port: runtime.port,
    playerSessionId: "host-session-rate-1",
  });
  t.after(() => host.socket.close());

  for (let index = 0; index < 13; index += 1) {
    host.socket.emit("requestAllCardTexts", { language: "en" });
  }

  assert.equal((await onceWithTimeout(host.socket, "actionRejected")).key, "tooManyRequests");
});
