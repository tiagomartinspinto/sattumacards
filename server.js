const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

const SUPPORTED_LANGUAGES = ["fi", "en"];
const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
const CARD_COUNT = 9;
const DECKS = [
  { id: "situation", file: "situation.txt" },
  { id: "space", file: "space.txt" },
  { id: "methods", file: "methods.txt" },
  { id: "resources", file: "resources.txt" },
  { id: "teaching-format", file: "teaching-format.txt" },
  { id: "chance", file: "chance.txt" },
];

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

const rooms = {};
const deckTextCache = loadDeckTextCache();

function readDeckFile(deck, language) {
  const filePath = path.join(__dirname, "public/cards", language, deck.file);

  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data
      .split("\n")
      .map((word) => word.trim())
      .filter(Boolean);
  } catch (error) {
    console.error(`Failed to read deck file ${filePath}:`, error);
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

function generateRoomCode() {
  let roomCode;

  do {
    roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms[roomCode]);

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

function getDeck(deckId) {
  return DECKS.find((deck) => deck.id === deckId);
}

function createRoom(roomCode = generateRoomCode()) {
  rooms[roomCode] = {
    code: roomCode,
    players: {},
    playerOrder: [],
    nameIndex: 0,
    cardIndices: {},
    usedCardIndices: {},
    localizedCardTexts: {},
    cardPositions: {},
    discardedCards: {},
    flippedCards: {},
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

  console.log(`Created room ${roomCode}`);
  return rooms[roomCode];
}

function getOrCreateRoom(roomCode) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const code = normalizedRoomCode || generateRoomCode();

  return rooms[code] || createRoom(code);
}

function touchRoom(room) {
  room.lastActivityAt = Date.now();
}

function getRoomPlayerNames(room) {
  return room.playerOrder.map((socketId) => room.players[socketId]).filter(Boolean);
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

function getGameState(room) {
  const currentPlayerId = getCurrentPlayerId(room);

  return {
    phase: room.gameA.phase,
    currentPlayer: currentPlayerId ? room.players[currentPlayerId] : "",
    pendingCardId: room.gameA.pendingCardId,
    roundNumber: room.gameA.roundNumber,
    serverNow: Date.now(),
    tableCardCount: Object.keys(room.cardPositions).length,
    timerDurationSeconds: room.gameA.timerDurationSeconds,
    timerEndsAt: room.gameA.timerEndsAt,
    totalTableCards: DECKS.length,
  };
}

function emitGameState(room) {
  io.to(room.code).emit("gameState", getGameState(room));
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
    console.error(`Failed to fetch data for deck ${deckId}:`, error);
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

function startReplacementPhase(room, socket) {
  if (room.gameA.phase !== "discuss") {
    rejectAction(socket, "notDiscussionPhase");
    return;
  }

  touchRoom(room);
  room.gameA.phase = "replace";
  room.gameA.timerEndsAt = null;
  room.gameA.roundNumber++;
  advanceTurn(room);
  emitGameState(room);
}

function setTimerDuration(room, data) {
  const allowedDurations = [0, 60, 120, 180, 300];
  const duration = Number(data?.durationSeconds);

  room.gameA.timerDurationSeconds = allowedDurations.includes(duration) ? duration : 0;
  room.gameA.timerEndsAt =
    room.gameA.phase === "discuss" && room.gameA.timerDurationSeconds
      ? Date.now() + room.gameA.timerDurationSeconds * 1000
      : null;
  touchRoom(room);
  emitGameState(room);
}

function cleanupRooms() {
  const now = Date.now();

  Object.entries(rooms).forEach(([roomCode, room]) => {
    const isEmpty = Object.keys(room.players).length === 0;
    const isStale = now - room.lastActivityAt > ROOM_TTL_MS;

    if (isEmpty && isStale) {
      delete rooms[roomCode];
      console.log(`Removed stale room ${roomCode}`);
    }
  });
}

setInterval(cleanupRooms, 15 * 60 * 1000).unref();

io.on("connection", (socket) => {
  const room = getOrCreateRoom(socket.handshake.query.room);
  const userName = getNextPlayerName(room);
  room.players[socket.id] = userName;
  room.playerOrder.push(socket.id);
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.userName = userName;
  touchRoom(room);

  console.log(`${userName} connected to room ${room.code}`);

  socket.emit("yourUserName", userName);
  socket.emit("roomInfo", { roomCode: room.code });
  socket.emit("resetDecks", {
    roomCode: room.code,
    animate: false,
    boardState: getBoardState(room),
    gameState: getGameState(room),
  });

  io.to(room.code).emit("updatePlayerList", getRoomPlayerNames(room));
  emitGameState(room);

  socket.on("requestCardMove", (data) => handleCardMove(room, socket, data));

  socket.on("requestFlipCard", (data) => handleFlipCard(room, socket, data));

  socket.on("startReplacementPhase", () => startReplacementPhase(room, socket));

  socket.on("setTimerDuration", (data) => setTimerDuration(room, data));

  socket.on("dealRandomSituation", () => {
    dealRandomSituation(room);
    io.to(room.code).emit("resetDecks", {
      roomCode: room.code,
      animate: true,
      boardState: getBoardState(room),
      gameState: getGameState(room),
    });
    emitGameState(room);
  });

  socket.on("resetDecks", () => {
    resetRoomCards(room);
    io.to(room.code).emit("resetDecks", {
      roomCode: room.code,
      animate: true,
      boardState: getBoardState(room),
      gameState: getGameState(room),
    });
    emitGameState(room);
  });

  socket.on("requestCardText", (data) => {
    touchRoom(room);
    const text = generateCardText(
      room,
      data.deckId,
      data.cardId,
      data.language
    );
    socket.emit("cardText", { cardId: data.cardId, text });
  });

  socket.on("requestAllCardTexts", (data) => {
    touchRoom(room);
    socket.emit("allCardTexts", {
      texts: generateAllCardTexts(room, data?.language),
    });
  });

  socket.on("cursorMove", (data) => {
    socket.to(room.code).emit("cursorUpdate", data);
  });

  socket.on("disconnect", () => {
    delete room.players[socket.id];
    const disconnectedIndex = room.playerOrder.indexOf(socket.id);
    room.playerOrder = room.playerOrder.filter((playerId) => playerId !== socket.id);
    if (disconnectedIndex >= 0 && disconnectedIndex < room.gameA.turnIndex) {
      room.gameA.turnIndex = Math.max(0, room.gameA.turnIndex - 1);
    }
    if (room.gameA.turnIndex >= room.playerOrder.length) {
      room.gameA.turnIndex = 0;
    }
    touchRoom(room);
    io.to(room.code).emit("updatePlayerList", getRoomPlayerNames(room));
    io.to(room.code).emit("playerDisconnected", userName);
    emitGameState(room);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
