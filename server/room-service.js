const crypto = require("crypto");

function createRoomService({ config, deckStore, logger, roomStore, validators }) {
  const rooms = roomStore.loadRooms();

  function persistRoom(room) {
    roomStore.saveRoom(room);
  }

  function deleteRoom(roomCode) {
    delete rooms[roomCode];
    roomStore.deleteRoom(roomCode);
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

  function getRoom(roomCode) {
    return rooms[roomCode] || null;
  }

  function getRoomCount() {
    return Object.keys(rooms).length;
  }

  function createRoom(roomCode = generateSecureRoomCode()) {
    if (!rooms[roomCode] && getRoomCount() >= config.MAX_ROOMS) {
      return null;
    }

    rooms[roomCode] = {
      code: roomCode,
      hostId: "",
      isClosed: false,
      players: {},
      playerOrder: [],
      playerSessions: {},
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

    logger.info("Created room", { roomCode });
    persistRoom(rooms[roomCode]);
    return rooms[roomCode];
  }

  function touchRoom(room) {
    if (room.isClosed) {
      return;
    }

    room.lastActivityAt = Date.now();
    persistRoom(room);
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
      totalTableCards: config.DECKS.length,
    };
  }

  function getBoardResetPayload(room, socketId, animate = false) {
    return {
      roomCode: room.code,
      animate,
      boardState: getBoardState(room),
      gameState: getGameState(room, socketId),
    };
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

  function resetRoomCards(room, persist = true) {
    room.cardIndices = {};
    room.usedCardIndices = {};
    room.localizedCardTexts = {};
    room.cardPositions = {};
    room.discardedCards = {};
    room.flippedCards = {};
    resetGameA(room);
    room.lastActivityAt = Date.now();

    if (persist) {
      persistRoom(room);
    }
  }

  function dealRandomSituation(room) {
    resetRoomCards(room, false);

    config.DECKS.forEach((deck) => {
      const cardIndex = Math.floor(Math.random() * config.CARD_COUNT);
      const cardId = `card-${deck.id}-${cardIndex}`;
      room.cardPositions[cardId] = `dropzone-${deck.id}`;
      room.flippedCards[cardId] = true;
    });

    startDiscussionPhase(room);
    room.lastActivityAt = Date.now();
    persistRoom(room);
  }

  function getNextPlayerName(room) {
    const animalName = config.ANIMAL_NAMES[room.nameIndex % config.ANIMAL_NAMES.length];
    const nameRound = Math.floor(room.nameIndex / config.ANIMAL_NAMES.length);

    room.nameIndex += 1;
    return nameRound === 0 ? animalName : `${animalName} ${nameRound + 1}`;
  }

  function getCardIndex(room, deckId, cardId) {
    if (room.cardIndices[cardId] !== undefined) {
      return room.cardIndices[cardId];
    }

    const baseCards = deckStore.getDeckLines(deckId, "fi");
    const usedIndices = room.usedCardIndices[deckId] || new Set();
    const availableIndices = baseCards
      .map((cardText, index) => index)
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
    const normalizedLanguage = validators.normalizeLanguage(language);
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

      const localizedCards = deckStore.getDeckLines(deckId, normalizedLanguage);
      const fallbackCards = deckStore.getDeckLines(deckId, "fi");
      const cardText = localizedCards[cardIndex] || fallbackCards[cardIndex];
      room.localizedCardTexts[localizedCardTextKey] = cardText;
      return cardText;
    } catch (error) {
      logger.error("Failed to fetch card text", {
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
    const normalizedLanguage = validators.normalizeLanguage(language);
    const allTexts = {};

    config.DECKS.forEach((deck) => {
      for (let cardIndex = 0; cardIndex < config.CARD_COUNT; cardIndex += 1) {
        const cardId = `card-${deck.id}-${cardIndex}`;
        allTexts[cardId] = generateCardText(room, deck.id, cardId, normalizedLanguage);
      }
    });

    return allTexts;
  }

  function getTopAvailableCardId(room, deckId) {
    for (let index = config.CARD_COUNT - 1; index >= 0; index -= 1) {
      const cardId = `card-${deckId}-${index}`;

      if (!room.cardPositions[cardId] && !room.discardedCards[cardId]) {
        return cardId;
      }
    }

    return "";
  }

  function isTopAvailableDeckCard(room, cardId, deckId) {
    return (
      validators.getCardDeckId(cardId) === deckId &&
      validators.getCardStackIndex(cardId) >= 0 &&
      getTopAvailableCardId(room, deckId) === cardId
    );
  }

  function isCurrentPlayer(room, socketId) {
    return getCurrentPlayerId(room) === socketId;
  }

  function isHost(room, socketId) {
    return room.hostId === socketId;
  }

  function canMoveCard(room, socketId, data) {
    if (!isCurrentPlayer(room, socketId)) {
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

    const hasCardInDropzone = Object.values(room.cardPositions).includes(
      data.newParentId
    );

    if (room.gameA.phase === "deal" && hasCardInDropzone) {
      return "dropzoneOccupied";
    }

    if (room.gameA.phase === "replace" && !hasCardInDropzone) {
      return "replaceExistingCard";
    }

    return "";
  }

  function moveCard(room, socketId, data) {
    const rejectionKey = canMoveCard(room, socketId, data);

    if (rejectionKey) {
      return { ok: false, rejectionKey };
    }

    const replacedCardId = Object.entries(room.cardPositions).find(
      ([, parentId]) => parentId === data.newParentId
    )?.[0];

    if (replacedCardId) {
      delete room.cardPositions[replacedCardId];
      delete room.flippedCards[replacedCardId];
      room.discardedCards[replacedCardId] = true;
    }

    room.lastActivityAt = Date.now();
    room.cardPositions[data.cardId] = data.newParentId;
    room.flippedCards[data.cardId] = false;
    room.gameA.pendingCardId = data.cardId;
    persistRoom(room);

    return {
      ok: true,
      newParentId: data.newParentId,
      replacedCardId,
    };
  }

  function flipCard(room, socketId, data) {
    if (!isCurrentPlayer(room, socketId)) {
      return { ok: false, rejectionKey: "notYourTurn" };
    }

    if (room.gameA.pendingCardId !== data.cardId) {
      return { ok: false, rejectionKey: "flipPendingCard" };
    }

    room.lastActivityAt = Date.now();
    room.flippedCards[data.cardId] = true;
    room.gameA.pendingCardId = null;

    if (
      room.gameA.phase === "deal" &&
      Object.keys(room.cardPositions).length >= config.DECKS.length
    ) {
      startDiscussionPhase(room);
    } else if (room.gameA.phase === "replace") {
      startDiscussionPhase(room);
    } else {
      advanceTurn(room);
    }

    persistRoom(room);

    return { ok: true };
  }

  function startReplacementPhase(room) {
    if (room.gameA.phase !== "discuss") {
      return false;
    }

    room.lastActivityAt = Date.now();
    room.gameA.phase = "replace";
    room.gameA.timerEndsAt = null;
    room.gameA.roundNumber += 1;
    advanceTurn(room);
    persistRoom(room);
    return true;
  }

  function setTimerDuration(room, data) {
    room.gameA.timerDurationSeconds = data.durationSeconds;
    room.gameA.timerEndsAt =
      room.gameA.phase === "discuss" && room.gameA.timerDurationSeconds
        ? Date.now() + room.gameA.timerDurationSeconds * 1000
        : null;
    room.lastActivityAt = Date.now();
    persistRoom(room);
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

  function cleanupReconnectReservations(room) {
    const now = Date.now();

    Object.entries(room.reconnectReservations || {}).forEach(
      ([sessionId, reservation]) => {
        if (!reservation || reservation.expiresAt <= now) {
          delete room.reconnectReservations[sessionId];
        }
      }
    );
  }

  function reserveDisconnectedPlayer(
    room,
    socketId,
    disconnectedIndex,
    userName,
    wasHost
  ) {
    const playerSessionId = room.playerSessions[socketId];

    if (!playerSessionId) {
      return;
    }

    cleanupReconnectReservations(room);
    room.reconnectReservations[playerSessionId] = {
      insertIndex: disconnectedIndex >= 0 ? disconnectedIndex : room.playerOrder.length,
      userName,
      wasCurrentPlayer: getCurrentPlayerId(room) === socketId,
      wasHost,
      expiresAt: Date.now() + config.RECONNECT_GRACE_MS,
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

  function joinRoom({ requestedRoomCode, socketId, playerSessionId }) {
    const room = (requestedRoomCode && rooms[requestedRoomCode]) || createRoom();

    if (!room) {
      return null;
    }

    const reconnectReservation = takeReconnectReservation(room, playerSessionId);
    const userName = reconnectReservation?.userName || getNextPlayerName(room);

    room.players[socketId] = userName;
    room.playerSessions[socketId] = playerSessionId;

    if (reconnectReservation) {
      const insertIndex = Math.max(
        0,
        Math.min(reconnectReservation.insertIndex, room.playerOrder.length)
      );
      room.playerOrder.splice(insertIndex, 0, socketId);

      if (reconnectReservation.wasCurrentPlayer) {
        room.gameA.turnIndex = insertIndex;
      } else if (insertIndex <= room.gameA.turnIndex) {
        room.gameA.turnIndex += 1;
      }
    } else {
      room.playerOrder.push(socketId);
    }

    if (reconnectReservation?.wasHost) {
      room.hostId = socketId;
    } else if (!room.hostId) {
      room.hostId = socketId;
    }

    room.lastActivityAt = Date.now();
    persistRoom(room);

    return {
      room,
      userName,
      reconnectReservation,
    };
  }

  function disconnectPlayer(room, socketId) {
    if (room.isClosed) {
      return {
        roomCode: room.code,
        userName: room.players[socketId] || "",
        reassignedHost: "",
      };
    }

    const currentPlayerIdBeforeDisconnect = getCurrentPlayerId(room);
    const disconnectedIndex = room.playerOrder.indexOf(socketId);
    const wasHost = room.hostId === socketId;
    const userName = room.players[socketId] || "";

    reserveDisconnectedPlayer(room, socketId, disconnectedIndex, userName, wasHost);

    delete room.players[socketId];
    delete room.playerSessions[socketId];
    room.playerOrder = room.playerOrder.filter((playerId) => playerId !== socketId);

    if (currentPlayerIdBeforeDisconnect === socketId) {
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

    room.lastActivityAt = Date.now();
    persistRoom(room);

    return {
      roomCode: room.code,
      userName,
      reassignedHost: getHostPlayerName(room),
    };
  }

  function closeRoom(room) {
    room.isClosed = true;
    deleteRoom(room.code);
    logger.info("Closed room", { roomCode: room.code });
  }

  function cleanupRooms() {
    const now = Date.now();

    Object.entries(rooms).forEach(([roomCode, room]) => {
      const reservationCountBeforeCleanup = Object.keys(
        room.reconnectReservations || {}
      ).length;
      cleanupReconnectReservations(room);
      const reservationCountAfterCleanup = Object.keys(
        room.reconnectReservations || {}
      ).length;
      const isEmpty = Object.keys(room.players).length === 0;
      const isStale = now - room.lastActivityAt > config.ROOM_TTL_MS;

      if (isEmpty && isStale) {
        deleteRoom(roomCode);
        logger.info("Removed stale room", { roomCode });
      } else if (reservationCountBeforeCleanup !== reservationCountAfterCleanup) {
        persistRoom(room);
      }
    });
  }

  function getDebugSnapshot() {
    const roomSummaries = Object.values(rooms)
      .map((room) => {
        cleanupReconnectReservations(room);

        return {
          code: room.code,
          currentPlayer: room.players[getCurrentPlayerId(room)] || "",
          hostPlayer: getHostPlayerName(room),
          lastActivityAt: room.lastActivityAt,
          pendingCardId: room.gameA.pendingCardId,
          phase: room.gameA.phase,
          playerCount: room.playerOrder.length,
          players: room.playerOrder
            .map((socketId) => room.players[socketId])
            .filter(Boolean),
          reconnectReservations: Object.values(room.reconnectReservations || {}).map(
            (reservation) => ({
              expiresAt: reservation.expiresAt,
              userName: reservation.userName,
              wasHost: reservation.wasHost,
            })
          ),
          tableCardCount: Object.keys(room.cardPositions).length,
        };
      })
      .sort((left, right) => right.lastActivityAt - left.lastActivityAt);

    return {
      activePlayers: roomSummaries.reduce((total, room) => total + room.playerCount, 0),
      activeRooms: roomSummaries.length,
      reconnectReservations: roomSummaries.reduce(
        (total, room) => total + room.reconnectReservations.length,
        0
      ),
      rooms: roomSummaries,
      storageMode: config.ROOM_STORAGE_MODE,
    };
  }

  return {
    cleanupRooms,
    createRoom,
    dealRandomSituation,
    disconnectPlayer,
    generateAllCardTexts,
    generateCardText,
    getBoardResetPayload,
    getBoardState,
    getGameState,
    getRoom,
    getRoomCount,
    getDebugSnapshot,
    getRoomPlayers,
    getHostPlayerName,
    isHost,
    joinRoom,
    moveCard,
    closeRoom,
    resetRoomCards,
    setTimerDuration,
    startReplacementPhase,
    touchRoom,
    flipCard,
  };
}

module.exports = {
  createRoomService,
};
