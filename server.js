const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const compression = require("compression");
const express = require("express");
const helmet = require("helmet");
const http = require("http");
const socketIo = require("socket.io");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const PORT = Number(process.env.PORT || 4000);
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS || 4 * 60 * 60 * 1000);
const ROOM_CLEANUP_INTERVAL_MS = Number(
  process.env.ROOM_CLEANUP_INTERVAL_MS || 15 * 60 * 1000
);
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 5 * 60 * 1000);
const STATIC_MAX_AGE_MS = Number(process.env.STATIC_MAX_AGE_MS || 60 * 60 * 1000);
const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM || 12);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 200);
const CARD_COUNT = 9;
const SUPPORTED_LANGUAGES = ["fi", "en"];
const ALLOWED_TIMER_DURATIONS = [0, 60, 120, 180, 300];
const EVENT_RATE_LIMITS = {
  requestCardMove: { limit: 24, windowMs: 4000 },
  requestFlipCard: { limit: 24, windowMs: 4000 },
  requestCardText: { limit: 48, windowMs: 6000 },
  requestAllCardTexts: { limit: 12, windowMs: 6000 },
  cursorMove: { limit: 120, windowMs: 5000 },
  resetDecks: { limit: 4, windowMs: 10000 },
  dealRandomSituation: { limit: 4, windowMs: 10000 },
  startReplacementPhase: { limit: 8, windowMs: 10000 },
  setTimerDuration: { limit: 12, windowMs: 10000 },
};
const SOCKET_ALLOWED_ORIGINS = (process.env.SOCKET_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const DECKS = [
  { id: "situation", file: "situation.txt" },
  { id: "space", file: "space.txt" },
  { id: "methods", file: "methods.txt" },
  { id: "resources", file: "resources.txt" },
  { id: "teaching-format", file: "teaching-format.txt" },
  { id: "chance", file: "chance.txt" },
];
const VALID_DECK_IDS = new Set(DECKS.map((deck) => deck.id));

const animalNames = [
  "Karhu",
  "Kettu",
  "Susi",
  "Peura",
  "Pöllö",
  "Haukka",
  "Jänis",
  "Orava",
  "Mäyrä",
  "Hirvi",
];

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors:
    IS_PRODUCTION && SOCKET_ALLOWED_ORIGINS.length > 0
      ? {
          origin: SOCKET_ALLOWED_ORIGINS,
          methods: ["GET", "POST"],
        }
      : undefined,
});

const rooms = {};
const deckTextCache = loadDeckTextCache();
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
};

app.disable("x-powered-by");

function log(level, message, meta) {
  if ((LOG_LEVELS[level] ?? LOG_LEVELS.info) > (LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info)) {
    return;
  }

  const time = new Date().toISOString();
  const details = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${time}] [${level.toUpperCase()}] ${message}${details}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

function buildContentSecurityPolicy() {
  const directives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: ["'self'", "ws:", "wss:"],
    fontSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  };

  if (IS_PRODUCTION) {
    directives.upgradeInsecureRequests = [];
  }

  return directives;
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicy(),
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(
  express.static("public", {
    maxAge: STATIC_MAX_AGE_MS,
    setHeaders(response, filePath) {
      if (filePath.endsWith(".html")) {
        response.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.get("/health", (request, response) => {
  response.json({
    status: "ok",
    rooms: Object.keys(rooms).length,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

app.use((request, response, next) => {
  next(createHttpError(404, "Not found"));
});

app.use((error, request, response, next) => {
  const statusCode = Number(error.statusCode || 500);
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  log("error", "Express request failed", {
    path: request.path,
    statusCode,
    message: error.message,
  });

  response.status(statusCode).json({ error: message });
});

process.on("uncaughtException", (error) => {
  log("error", "Uncaught exception", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  log("error", "Unhandled rejection", {
    message: error.message,
    stack: error.stack,
  });
});

function readDeckFile(deck, language) {
  const filePath = path.join(__dirname, "public/cards", language, deck.file);

  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data
      .split("\n")
      .map((word) => word.trim())
      .filter(Boolean);
  } catch (error) {
    log("error", "Failed to read deck file", { filePath, message: error.message });
    return [];
  }
}

function loadDeckTextCache() {
  return Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [
      language,
      Object.fromEntries(
        DECKS.map((deck) => [deck.id, readDeckFile(deck, language)])
      ),
    ])
  );
}

function generateSecureRoomCode() {
  let roomCode = "";

  while (roomCode.length < 6 || rooms[roomCode]) {
    roomCode = crypto
      .randomBytes(6)
      .toString("base64url")
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 6)
      .toUpperCase();
  }

  return roomCode;
}

function normalizeRoomCode(roomCode) {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase();
}

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : "fi";
}

function normalizeSessionId(sessionId) {
  if (typeof sessionId !== "string") {
    return "";
  }

  const normalized = sessionId.trim();
  return /^[a-z0-9_-]{12,128}$/i.test(normalized) ? normalized : "";
}

function getDeck(deckId) {
  return DECKS.find((deck) => deck.id === deckId);
}

function getRoomCount() {
  return Object.keys(rooms).length;
}

function createRoom(roomCode = generateSecureRoomCode()) {
  if (!rooms[roomCode] && getRoomCount() >= MAX_ROOMS) {
    return null;
  }

  rooms[roomCode] = {
    code: roomCode,
    hostId: "",
    players: {},
    playerOrder: [],
    nameIndex: 0,
    cardIndices: {},
    usedCardIndices: {},
    localizedCardTexts: {},
    cardPositions: {},
    discardedCards: {},
    flippedCards: {},
    reconnectReservations: {},
    gameA: {
      phase: "deal",
      turnIndex: 0,
      pendingCardId: null,
      roundNumber: 1,
      timerDurationSeconds: 0,
      timerEndsAt: null,
    },
    lastActivityAt: Date.now(),
  };

  log("info", "Created room", { roomCode });
  return rooms[roomCode];
}

function touchRoom(room) {
  room.lastActivityAt = Date.now();
}

function getHostPlayerName(room) {
  return room.hostId ? room.players[room.hostId] || "" : "";
}

function getRoomPlayers(room) {
  return room.playerOrder
    .map((socketId) => ({
      name: room.players[socketId],
      isHost: room.hostId === socketId,
    }))
    .filter((player) => Boolean(player.name));
}

function getBoardState(room) {
  return {
    cardPositions: room.cardPositions,
    discardedCards: room.discardedCards,
    flippedCards: room.flippedCards,
  };
}

function getCurrentPlayerId(room) {
  if (room.playerOrder.length === 0) {
    return "";
  }

  const normalizedTurnIndex = room.gameA.turnIndex % room.playerOrder.length;
  return room.playerOrder[normalizedTurnIndex];
}

function getGameState(room, socketId = "") {
  const currentPlayerId = getCurrentPlayerId(room);

  return {
    phase: room.gameA.phase,
    currentPlayer: currentPlayerId ? room.players[currentPlayerId] : "",
    hostPlayer: getHostPlayerName(room),
    canManageRoom: Boolean(socketId && socketId === room.hostId),
    pendingCardId: room.gameA.pendingCardId,
    roundNumber: room.gameA.roundNumber,
    serverNow: Date.now(),
    tableCardCount: Object.keys(room.cardPositions).length,
    timerDurationSeconds: room.gameA.timerDurationSeconds,
    timerEndsAt: room.gameA.timerEndsAt,
    totalTableCards: DECKS.length,
  };
}

function emitPlayers(room) {
  io.to(room.code).emit("updatePlayerList", getRoomPlayers(room));
}

function emitGameState(room) {
  room.playerOrder.forEach((socketId) => {
    io.to(socketId).emit("gameState", getGameState(room, socketId));
  });
}

function emitBoardReset(room, animate = false) {
  const boardState = getBoardState(room);

  room.playerOrder.forEach((socketId) => {
    io.to(socketId).emit("resetDecks", {
      roomCode: room.code,
      animate,
      boardState,
      gameState: getGameState(room, socketId),
    });
  });

  emitPlayers(room);
  emitGameState(room);
}

function advanceTurn(room) {
  if (room.playerOrder.length > 0) {
    room.gameA.turnIndex = (room.gameA.turnIndex + 1) % room.playerOrder.length;
  }
}

function resetGameA(room) {
  room.gameA = {
    phase: "deal",
    turnIndex: 0,
    pendingCardId: null,
    roundNumber: 1,
    timerDurationSeconds: room.gameA?.timerDurationSeconds || 0,
    timerEndsAt: null,
  };
}

function startDiscussionPhase(room) {
  room.gameA.phase = "discuss";
  room.gameA.timerEndsAt = room.gameA.timerDurationSeconds
    ? Date.now() + room.gameA.timerDurationSeconds * 1000
    : null;
}

function dealRandomSituation(room) {
  resetRoomCards(room);

  DECKS.forEach((deck) => {
    const cardIndex = Math.floor(Math.random() * CARD_COUNT);
    const cardId = `card-${deck.id}-${cardIndex}`;
    room.cardPositions[cardId] = `dropzone-${deck.id}`;
    room.flippedCards[cardId] = true;
  });

  startDiscussionPhase(room);
  touchRoom(room);
}

function getNextPlayerName(room) {
  const animalName = animalNames[room.nameIndex % animalNames.length];
  const nameRound = Math.floor(room.nameIndex / animalNames.length);

  room.nameIndex++;
  return nameRound === 0 ? animalName : `${animalName} ${nameRound + 1}`;
}

function readDeckLines(deckId, language = "fi") {
  const normalizedLanguage = normalizeLanguage(language);
  const cachedLines = deckTextCache[normalizedLanguage]?.[deckId];

  if (cachedLines) {
    return cachedLines;
  }

  const deck = getDeck(deckId);

  if (!deck) {
    return [];
  }

  const lines = readDeckFile(deck, normalizedLanguage);
  deckTextCache[normalizedLanguage][deckId] = lines;
  return lines;
}

function getCardIndex(room, deckId, cardId) {
  if (room.cardIndices[cardId] !== undefined) {
    return room.cardIndices[cardId];
  }

  const baseCards = readDeckLines(deckId, "fi");
  const usedIndices = room.usedCardIndices[deckId] || new Set();
  const availableIndices = baseCards
    .map((_, index) => index)
    .filter((index) => !usedIndices.has(index));

  if (availableIndices.length === 0) {
    return -1;
  }

  const selectedIndex =
    availableIndices[Math.floor(Math.random() * availableIndices.length)];
  room.cardIndices[cardId] = selectedIndex;
  usedIndices.add(selectedIndex);
  room.usedCardIndices[deckId] = usedIndices;
  return selectedIndex;
}

function generateCardText(room, deckId, cardId, language = "fi") {
  const normalizedLanguage = normalizeLanguage(language);
  const localizedCardTextKey = `${normalizedLanguage}:${cardId}`;

  if (room.localizedCardTexts[localizedCardTextKey]) {
    return room.localizedCardTexts[localizedCardTextKey];
  }

  try {
    const cardIndex = getCardIndex(room, deckId, cardId);

    if (cardIndex === -1) {
      return normalizedLanguage === "en"
        ? "No unique text available for this card"
        : "Tälle kortille ei ole enää uutta tekstiä";
    }

    const localizedCards = readDeckLines(deckId, normalizedLanguage);
    const fallbackCards = readDeckLines(deckId, "fi");
    const cardText = localizedCards[cardIndex] || fallbackCards[cardIndex];
    room.localizedCardTexts[localizedCardTextKey] = cardText;
    return cardText;
  } catch (error) {
    log("error", "Failed to fetch card text", {
      deckId,
      cardId,
      message: error.message,
    });
    return normalizedLanguage === "en"
      ? "Error fetching card text"
      : "Korttitekstin hakeminen epäonnistui";
  }
}

function generateAllCardTexts(room, language = "fi") {
  const normalizedLanguage = normalizeLanguage(language);
  const allTexts = {};

  DECKS.forEach((deck) => {
    for (let cardIndex = 0; cardIndex < CARD_COUNT; cardIndex++) {
      const cardId = `card-${deck.id}-${cardIndex}`;
      allTexts[cardId] = generateCardText(room, deck.id, cardId, normalizedLanguage);
    }
  });

  return allTexts;
}

function resetRoomCards(room) {
  room.cardIndices = {};
  room.usedCardIndices = {};
  room.localizedCardTexts = {};
  room.cardPositions = {};
  room.discardedCards = {};
  room.flippedCards = {};
  resetGameA(room);
  touchRoom(room);
}

function isCurrentPlayer(room, socket) {
  return getCurrentPlayerId(room) === socket.id;
}

function isHost(room, socket) {
  return room.hostId === socket.id;
}

function getCardDeckId(cardId) {
  if (typeof cardId !== "string" || !cardId.startsWith("card-")) {
    return "";
  }

  return cardId.slice(5).replace(/-\d+$/, "");
}

function getCardStackIndex(cardId) {
  const match = typeof cardId === "string" ? cardId.match(/-(\d+)$/) : null;
  return match ? Number(match[1]) : -1;
}

function getTopAvailableCardId(room, deckId) {
  for (let index = CARD_COUNT - 1; index >= 0; index--) {
    const cardId = `card-${deckId}-${index}`;

    if (!room.cardPositions[cardId] && !room.discardedCards[cardId]) {
      return cardId;
    }
  }

  return "";
}

function isTopAvailableDeckCard(room, cardId, deckId) {
  return (
    getCardDeckId(cardId) === deckId &&
    getCardStackIndex(cardId) >= 0 &&
    getTopAvailableCardId(room, deckId) === cardId
  );
}

function rejectAction(socket, key) {
  socket.emit("actionRejected", { key });
}

function emitServerError(socket, key) {
  socket.emit("serverError", { key });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDeckId(deckId) {
  return typeof deckId === "string" && VALID_DECK_IDS.has(deckId);
}

function isValidCardId(cardId) {
  if (typeof cardId !== "string" || !/^card-[a-z-]+-\d+$/.test(cardId)) {
    return false;
  }

  const deckId = getCardDeckId(cardId);
  const stackIndex = getCardStackIndex(cardId);
  return isValidDeckId(deckId) && stackIndex >= 0 && stackIndex < CARD_COUNT;
}

function validateCardMoveData(data) {
  if (!isPlainObject(data)) {
    return null;
  }

  const { cardId, deckId, newParentId, targetDeckId } = data;

  if (
    !isValidCardId(cardId) ||
    !isValidDeckId(deckId) ||
    !isValidDeckId(targetDeckId) ||
    deckId !== getCardDeckId(cardId) ||
    newParentId !== `dropzone-${targetDeckId}`
  ) {
    return null;
  }

  return { cardId, deckId, newParentId, targetDeckId };
}

function validateFlipCardData(data) {
  if (!isPlainObject(data) || !isValidCardId(data.cardId)) {
    return null;
  }

  return { cardId: data.cardId };
}

function validateTimerDurationData(data) {
  if (!isPlainObject(data)) {
    return null;
  }

  const durationSeconds = Number(data.durationSeconds);

  if (!ALLOWED_TIMER_DURATIONS.includes(durationSeconds)) {
    return null;
  }

  return { durationSeconds };
}

function validateCardTextRequest(data) {
  if (!isPlainObject(data)) {
    return null;
  }

  const { deckId, cardId, language } = data;

  if (!isValidDeckId(deckId) || !isValidCardId(cardId) || deckId !== getCardDeckId(cardId)) {
    return null;
  }

  return {
    deckId,
    cardId,
    language: normalizeLanguage(language),
  };
}

function validateAllCardTextsRequest(data) {
  if (data !== undefined && !isPlainObject(data)) {
    return null;
  }

  return {
    language: normalizeLanguage(data?.language),
  };
}

function validateCursorMoveData(data) {
  if (!isPlainObject(data)) {
    return null;
  }

  const x = Number(data.x);
  const y = Number(data.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function cleanupReconnectReservations(room) {
  const now = Date.now();

  Object.entries(room.reconnectReservations || {}).forEach(([sessionId, reservation]) => {
    if (!reservation || reservation.expiresAt <= now) {
      delete room.reconnectReservations[sessionId];
    }
  });
}

function reserveDisconnectedPlayer(room, socket, disconnectedIndex, userName, wasHost) {
  const playerSessionId = socket.data.playerSessionId;

  if (!playerSessionId) {
    return;
  }

  cleanupReconnectReservations(room);
  room.reconnectReservations[playerSessionId] = {
    insertIndex:
      disconnectedIndex >= 0 ? disconnectedIndex : room.playerOrder.length,
    userName,
    wasCurrentPlayer: getCurrentPlayerId(room) === socket.id,
    wasHost,
    expiresAt: Date.now() + RECONNECT_GRACE_MS,
  };
}

function takeReconnectReservation(room, playerSessionId) {
  if (!playerSessionId) {
    return null;
  }

  cleanupReconnectReservations(room);
  const reservation = room.reconnectReservations[playerSessionId];

  if (!reservation) {
    return null;
  }

  delete room.reconnectReservations[playerSessionId];
  return reservation;
}

function consumeRateLimit(socket, eventName) {
  const rateLimit = EVENT_RATE_LIMITS[eventName];

  if (!rateLimit) {
    return true;
  }

  if (!socket.data.rateLimitState) {
    socket.data.rateLimitState = {};
  }

  const now = Date.now();
  const existingState = socket.data.rateLimitState[eventName];

  if (!existingState || now - existingState.startedAt >= rateLimit.windowMs) {
    socket.data.rateLimitState[eventName] = {
      count: 1,
      startedAt: now,
    };
    return true;
  }

  if (existingState.count >= rateLimit.limit) {
    return false;
  }

  existingState.count += 1;
  return true;
}

function registerSocketAction(socket, room, eventName, options) {
  const { handler, hostOnly = false, validator } = options;

  socket.on(eventName, (rawData) => {
    if (!consumeRateLimit(socket, eventName)) {
      rejectAction(socket, "tooManyRequests");
      return;
    }

    if (hostOnly && !isHost(room, socket)) {
      rejectAction(socket, "hostOnly");
      return;
    }

    const data = validator ? validator(rawData) : rawData;

    if (validator && !data) {
      rejectAction(socket, "invalidPayload");
      return;
    }

    try {
      handler(data);
    } catch (error) {
      log("error", "Socket action failed", {
        eventName,
        roomCode: room.code,
        userName: socket.data.userName,
        message: error.message,
        stack: error.stack,
      });
      emitServerError(socket, "serverError");
    }
  });
}

function canMoveCard(room, socket, data) {
  if (!isCurrentPlayer(room, socket)) {
    return "notYourTurn";
  }

  if (room.gameA.phase === "discuss") {
    return "discussionPhase";
  }

  if (room.gameA.pendingCardId) {
    return "flipPendingCard";
  }

  if (!isTopAvailableDeckCard(room, data.cardId, data.deckId)) {
    return "activeCardOnly";
  }

  if (data.deckId !== data.targetDeckId) {
    return "wrongDropzone";
  }

  const hasCardInDropzone = Object.values(room.cardPositions).includes(data.newParentId);

  if (room.gameA.phase === "deal" && hasCardInDropzone) {
    return "dropzoneOccupied";
  }

  if (room.gameA.phase === "replace" && !hasCardInDropzone) {
    return "replaceExistingCard";
  }

  return "";
}

function handleCardMove(room, socket, data) {
  const rejectionKey = canMoveCard(room, socket, data);

  if (rejectionKey) {
    rejectAction(socket, rejectionKey);
    return;
  }

  const replacedCardId = Object.entries(room.cardPositions).find(
    ([, parentId]) => parentId === data.newParentId
  )?.[0];

  if (replacedCardId) {
    delete room.cardPositions[replacedCardId];
    delete room.flippedCards[replacedCardId];
    room.discardedCards[replacedCardId] = true;
  }

  touchRoom(room);
  room.cardPositions[data.cardId] = data.newParentId;
  room.flippedCards[data.cardId] = false;
  room.gameA.pendingCardId = data.cardId;
  io.to(room.code).emit("cardMoved", {
    cardId: data.cardId,
    newParentId: data.newParentId,
    replacedCardId,
  });
  emitGameState(room);
}

function handleFlipCard(room, socket, data) {
  if (!isCurrentPlayer(room, socket)) {
    rejectAction(socket, "notYourTurn");
    return;
  }

  if (room.gameA.pendingCardId !== data.cardId) {
    rejectAction(socket, "flipPendingCard");
    return;
  }

  touchRoom(room);
  room.flippedCards[data.cardId] = true;
  room.gameA.pendingCardId = null;
  io.to(room.code).emit("flipCard", { cardId: data.cardId, isFlipped: true });

  if (room.gameA.phase === "deal" && Object.keys(room.cardPositions).length >= DECKS.length) {
    startDiscussionPhase(room);
  } else if (room.gameA.phase === "replace") {
    startDiscussionPhase(room);
  } else {
    advanceTurn(room);
  }

  emitGameState(room);
}

function startReplacementPhase(room) {
  if (room.gameA.phase !== "discuss") {
    return false;
  }

  touchRoom(room);
  room.gameA.phase = "replace";
  room.gameA.timerEndsAt = null;
  room.gameA.roundNumber += 1;
  advanceTurn(room);
  emitGameState(room);
  return true;
}

function setTimerDuration(room, data) {
  room.gameA.timerDurationSeconds = data.durationSeconds;
  room.gameA.timerEndsAt =
    room.gameA.phase === "discuss" && room.gameA.timerDurationSeconds
      ? Date.now() + room.gameA.timerDurationSeconds * 1000
      : null;
  touchRoom(room);
  emitGameState(room);
}

function clearPendingAction(room) {
  const pendingCardId = room.gameA.pendingCardId;

  if (!pendingCardId) {
    return false;
  }

  delete room.cardPositions[pendingCardId];
  delete room.flippedCards[pendingCardId];
  room.discardedCards[pendingCardId] = true;
  room.gameA.pendingCardId = null;
  return true;
}

function cleanupRooms() {
  const now = Date.now();

  Object.entries(rooms).forEach(([roomCode, room]) => {
    cleanupReconnectReservations(room);
    const isEmpty = Object.keys(room.players).length === 0;
    const isStale = now - room.lastActivityAt > ROOM_TTL_MS;

    if (isEmpty && isStale) {
      delete rooms[roomCode];
      log("info", "Removed stale room", { roomCode });
    }
  });
}

function createSocketError(key) {
  const error = new Error(key);
  error.data = { key };
  return error;
}

io.use((socket, next) => {
  const requestedRoomCode = normalizeRoomCode(socket.handshake.query.room);
  const playerSessionId = normalizeSessionId(
    socket.handshake.auth?.playerSessionId || socket.handshake.query.playerSessionId
  );
  const existingRoom = requestedRoomCode ? rooms[requestedRoomCode] : null;

  if (requestedRoomCode && !existingRoom) {
    next(createSocketError("roomExpired"));
    return;
  }

  if (existingRoom && Object.keys(existingRoom.players).length >= MAX_PLAYERS_PER_ROOM) {
    next(createSocketError("roomFull"));
    return;
  }

  if (!requestedRoomCode && getRoomCount() >= MAX_ROOMS) {
    next(createSocketError("serverBusy"));
    return;
  }

  socket.data.requestedRoomCode = requestedRoomCode;
  socket.data.playerSessionId = playerSessionId || crypto.randomUUID();
  next();
});

setInterval(cleanupRooms, ROOM_CLEANUP_INTERVAL_MS).unref();

io.on("connection", (socket) => {
  const room =
    (socket.data.requestedRoomCode && rooms[socket.data.requestedRoomCode]) || createRoom();
  const reconnectReservation = room
    ? takeReconnectReservation(room, socket.data.playerSessionId)
    : null;

  if (!room) {
    emitServerError(socket, "serverBusy");
    socket.disconnect(true);
    return;
  }

  const userName = reconnectReservation?.userName || getNextPlayerName(room);
  room.players[socket.id] = userName;

  if (reconnectReservation) {
    const insertIndex = Math.max(
      0,
      Math.min(reconnectReservation.insertIndex, room.playerOrder.length)
    );
    room.playerOrder.splice(insertIndex, 0, socket.id);

    if (reconnectReservation.wasCurrentPlayer) {
      room.gameA.turnIndex = insertIndex;
    } else if (insertIndex <= room.gameA.turnIndex) {
      room.gameA.turnIndex += 1;
    }
  } else {
    room.playerOrder.push(socket.id);
  }

  if (!room.hostId || (reconnectReservation?.wasHost && !room.players[room.hostId])) {
    room.hostId = socket.id;
  }

  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.userName = userName;
  socket.data.rateLimitState = {};
  touchRoom(room);

  log("info", "Player connected", {
    roomCode: room.code,
    userName,
    host: isHost(room, socket),
    resumed: Boolean(reconnectReservation),
  });

  socket.emit("yourUserName", userName);
  socket.emit("roomInfo", { roomCode: room.code });
  socket.emit("sessionInfo", { playerSessionId: socket.data.playerSessionId });

  if (reconnectReservation) {
    socket.emit("sessionResumed");
  }

  emitBoardReset(room);

  registerSocketAction(socket, room, "requestCardMove", {
    handler: (data) => handleCardMove(room, socket, data),
    validator: validateCardMoveData,
  });

  registerSocketAction(socket, room, "requestFlipCard", {
    handler: (data) => handleFlipCard(room, socket, data),
    validator: validateFlipCardData,
  });

  registerSocketAction(socket, room, "startReplacementPhase", {
    handler: () => {
      if (!startReplacementPhase(room)) {
        rejectAction(socket, "notDiscussionPhase");
      }
    },
    hostOnly: true,
  });

  registerSocketAction(socket, room, "setTimerDuration", {
    handler: (data) => setTimerDuration(room, data),
    hostOnly: true,
    validator: validateTimerDurationData,
  });

  registerSocketAction(socket, room, "dealRandomSituation", {
    handler: () => {
      dealRandomSituation(room);
      emitBoardReset(room, true);
    },
    hostOnly: true,
  });

  registerSocketAction(socket, room, "resetDecks", {
    handler: () => {
      resetRoomCards(room);
      emitBoardReset(room, true);
    },
    hostOnly: true,
  });

  registerSocketAction(socket, room, "requestCardText", {
    handler: (data) => {
      touchRoom(room);
      const text = generateCardText(room, data.deckId, data.cardId, data.language);
      socket.emit("cardText", { cardId: data.cardId, text });
    },
    validator: validateCardTextRequest,
  });

  registerSocketAction(socket, room, "requestAllCardTexts", {
    handler: (data) => {
      touchRoom(room);
      socket.emit("allCardTexts", {
        texts: generateAllCardTexts(room, data.language),
      });
    },
    validator: validateAllCardTextsRequest,
  });

  registerSocketAction(socket, room, "cursorMove", {
    handler: (data) => {
      socket.to(room.code).emit("cursorUpdate", {
        x: data.x,
        y: data.y,
        userId: socket.id,
        userName,
      });
    },
    validator: validateCursorMoveData,
  });

  socket.on("disconnect", () => {
    const currentPlayerIdBeforeDisconnect = getCurrentPlayerId(room);
    const disconnectedIndex = room.playerOrder.indexOf(socket.id);
    const wasHost = room.hostId === socket.id;
    reserveDisconnectedPlayer(room, socket, disconnectedIndex, userName, wasHost);

    delete room.players[socket.id];
    room.playerOrder = room.playerOrder.filter((playerId) => playerId !== socket.id);

    if (currentPlayerIdBeforeDisconnect === socket.id) {
      clearPendingAction(room);
    }

    if (disconnectedIndex >= 0 && disconnectedIndex < room.gameA.turnIndex) {
      room.gameA.turnIndex = Math.max(0, room.gameA.turnIndex - 1);
    }

    if (room.gameA.turnIndex >= room.playerOrder.length) {
      room.gameA.turnIndex = 0;
    }

    if (wasHost) {
      room.hostId = room.playerOrder[0] || "";
    }

    touchRoom(room);
    emitBoardReset(room);
    io.to(room.code).emit("playerDisconnected", userName);

    log("info", "Player disconnected", {
      roomCode: room.code,
      userName,
      reassignedHost: getHostPlayerName(room),
    });
  });
});

server.listen(PORT, () => {
  log("info", "Server running", {
    port: PORT,
    environment: NODE_ENV,
    maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM,
    maxRooms: MAX_ROOMS,
  });
});
