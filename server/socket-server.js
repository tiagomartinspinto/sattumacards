const socketIo = require("socket.io");

const { normalizeRoomCode, normalizeSessionId } = require("./validators");

function createSocketError(key) {
  const error = new Error(key);
  error.data = { key };
  return error;
}

function createGameSocketServer({ server, config, logger, roomService, validators }) {
  const io = socketIo(server, {
    cors:
      config.IS_PRODUCTION && config.SOCKET_ALLOWED_ORIGINS.length > 0
        ? {
            origin: config.SOCKET_ALLOWED_ORIGINS,
            methods: ["GET", "POST"],
          }
        : undefined,
  });
  const debugState = {
    rateLimitHits: {},
    totalConnections: 0,
  };

  function rejectAction(socket, key) {
    socket.emit("actionRejected", { key });
  }

  function emitServerError(socket, key) {
    socket.emit("serverError", { key });
  }

  function emitPlayers(room) {
    io.to(room.code).emit("updatePlayerList", roomService.getRoomPlayers(room));
  }

  function emitGameState(room) {
    room.playerOrder.forEach((socketId) => {
      io.to(socketId).emit("gameState", roomService.getGameState(room, socketId));
    });
  }

  function emitBoardReset(room, animate = false) {
    room.playerOrder.forEach((socketId) => {
      io.to(socketId).emit(
        "resetDecks",
        roomService.getBoardResetPayload(room, socketId, animate)
      );
    });

    emitPlayers(room);
    emitGameState(room);
  }

  function consumeRateLimit(socket, eventName) {
    const rateLimit = config.EVENT_RATE_LIMITS[eventName];

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
      debugState.rateLimitHits[eventName] =
        (debugState.rateLimitHits[eventName] || 0) + 1;
      return false;
    }

    existingState.count += 1;
    return true;
  }

  function registerSocketAction(socket, room, eventName, options) {
    const { handler, hostOnly = false, validator } = options;

    socket.on(eventName, (rawData) => {
      if (room.isClosed) {
        rejectAction(socket, "roomExpired");
        return;
      }

      if (!consumeRateLimit(socket, eventName)) {
        rejectAction(socket, "tooManyRequests");
        return;
      }

      if (hostOnly && !roomService.isHost(room, socket.id)) {
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
        logger.error("Socket action failed", {
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

  io.use((socket, next) => {
    const requestedRoomCode = normalizeRoomCode(socket.handshake.query.room);
    const playerSessionId = normalizeSessionId(
      socket.handshake.auth?.playerSessionId || socket.handshake.query.playerSessionId
    );
    const existingRoom = requestedRoomCode
      ? roomService.getRoom(requestedRoomCode)
      : null;

    if (requestedRoomCode && !existingRoom) {
      next(createSocketError("roomExpired"));
      return;
    }

    if (
      existingRoom &&
      Object.keys(existingRoom.players).length >= config.MAX_PLAYERS_PER_ROOM
    ) {
      next(createSocketError("roomFull"));
      return;
    }

    if (!requestedRoomCode && roomService.getRoomCount() >= config.MAX_ROOMS) {
      next(createSocketError("serverBusy"));
      return;
    }

    socket.data.requestedRoomCode = requestedRoomCode;
    socket.data.playerSessionId = playerSessionId;
    next();
  });

  const cleanupHandle = setInterval(
    () => roomService.cleanupRooms(),
    config.ROOM_CLEANUP_INTERVAL_MS
  );
  cleanupHandle.unref();

  io.on("connection", (socket) => {
    debugState.totalConnections += 1;
    const joinResult = roomService.joinRoom({
      requestedRoomCode: socket.data.requestedRoomCode,
      socketId: socket.id,
      playerSessionId: socket.data.playerSessionId,
    });

    if (!joinResult?.room) {
      emitServerError(socket, "serverBusy");
      socket.disconnect(true);
      return;
    }

    const { room, userName, reconnectReservation } = joinResult;

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.userName = userName;
    socket.data.rateLimitState = {};

    logger.info("Player connected", {
      roomCode: room.code,
      userName,
      host: roomService.isHost(room, socket.id),
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
      handler: (data) => {
        const result = roomService.moveCard(room, socket.id, data);

        if (!result.ok) {
          rejectAction(socket, result.rejectionKey);
          return;
        }

        io.to(room.code).emit("cardMoved", {
          cardId: data.cardId,
          newParentId: result.newParentId,
          replacedCardId: result.replacedCardId,
        });
        emitGameState(room);
      },
      validator: validators.validateCardMoveData,
    });

    registerSocketAction(socket, room, "requestFlipCard", {
      handler: (data) => {
        const result = roomService.flipCard(room, socket.id, data);

        if (!result.ok) {
          rejectAction(socket, result.rejectionKey);
          return;
        }

        io.to(room.code).emit("flipCard", { cardId: data.cardId, isFlipped: true });
        emitGameState(room);
      },
      validator: validators.validateFlipCardData,
    });

    registerSocketAction(socket, room, "startReplacementPhase", {
      handler: () => {
        if (!roomService.startReplacementPhase(room)) {
          rejectAction(socket, "notDiscussionPhase");
          return;
        }

        emitGameState(room);
      },
      hostOnly: true,
    });

    registerSocketAction(socket, room, "setTimerDuration", {
      handler: (data) => {
        roomService.setTimerDuration(room, data);
        emitGameState(room);
      },
      hostOnly: true,
      validator: validators.validateTimerDurationData,
    });

    registerSocketAction(socket, room, "dealRandomSituation", {
      handler: () => {
        roomService.dealRandomSituation(room);
        emitBoardReset(room, true);
      },
      hostOnly: true,
    });

    registerSocketAction(socket, room, "resetDecks", {
      handler: () => {
        roomService.resetRoomCards(room);
        emitBoardReset(room, true);
      },
      hostOnly: true,
    });

    registerSocketAction(socket, room, "closeRoom", {
      handler: () => {
        roomService.closeRoom(room);
        io.to(room.code).emit("roomClosed", { closedBy: userName });
      },
      hostOnly: true,
    });

    registerSocketAction(socket, room, "requestCardText", {
      handler: (data) => {
        roomService.touchRoom(room);
        const text = roomService.generateCardText(
          room,
          data.deckId,
          data.cardId,
          data.language
        );
        socket.emit("cardText", { cardId: data.cardId, text });
      },
      validator: validators.validateCardTextRequest,
    });

    registerSocketAction(socket, room, "requestAllCardTexts", {
      handler: (data) => {
        roomService.touchRoom(room);
        socket.emit("allCardTexts", {
          texts: roomService.generateAllCardTexts(room, data.language),
        });
      },
      validator: validators.validateAllCardTextsRequest,
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
      validator: validators.validateCursorMoveData,
    });

    socket.on("disconnect", () => {
      if (room.isClosed) {
        logger.info("Player disconnected from closed room", {
          roomCode: room.code,
          userName,
        });
        return;
      }

      const disconnectResult = roomService.disconnectPlayer(room, socket.id);

      emitBoardReset(room);
      io.to(room.code).emit("playerDisconnected", {
        userId: socket.id,
        userName,
      });

      logger.info("Player disconnected", {
        roomCode: disconnectResult.roomCode,
        userName: disconnectResult.userName,
        reassignedHost: disconnectResult.reassignedHost,
      });
    });
  });

  return {
    getDebugSnapshot() {
      return {
        currentSockets: io.engine.clientsCount,
        rateLimitHits: { ...debugState.rateLimitHits },
        totalConnections: debugState.totalConnections,
      };
    },
    io,
  };
}

module.exports = {
  createGameSocketServer,
};
