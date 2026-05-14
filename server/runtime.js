const http = require("http");

const { createConfig } = require("./config");
const { createDeckStore } = require("./deck-store");
const { createHttpApp } = require("./http-app");
const { createLogger } = require("./logger");
const { createRoomStore } = require("./room-store");
const { createRoomService } = require("./room-service");
const { createGameSocketServer } = require("./socket-server");
const { createValidators } = require("./validators");

function registerProcessErrorLogging(logger) {
  if (process.__SATTUMA_ERROR_LOGGING_REGISTERED__) {
    return;
  }

  process.__SATTUMA_ERROR_LOGGING_REGISTERED__ = true;

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", {
      message: error.message,
      stack: error.stack,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error("Unhandled rejection", {
      message: error.message,
      stack: error.stack,
    });
  });
}

function createRuntime(overrides = {}) {
  const config = createConfig(overrides.config);
  const logger = createLogger(config.LOG_LEVEL);
  const deckStore = createDeckStore(config, logger);
  const roomStore = createRoomStore({ config, logger });
  const validators = createValidators(config);
  const roomService = createRoomService({
    config,
    deckStore,
    logger,
    roomStore,
    validators,
  });
  let socketServer = null;
  const app = createHttpApp({
    config,
    getDebugState: () => ({
      ...roomService.getDebugSnapshot(),
      socket: socketServer?.getDebugSnapshot() || {
        currentSockets: 0,
        rateLimitHits: {},
        totalConnections: 0,
      },
    }),
    logger,
    getRoomCount: () => roomService.getRoomCount(),
  });
  const server = http.createServer(app);
  socketServer = createGameSocketServer({
    server,
    config,
    logger,
    roomService,
    validators,
  });
  const io = socketServer.io;

  registerProcessErrorLogging(logger);

  return {
    app,
    config,
    deckStore,
    io,
    logger,
    roomStore,
    roomService,
    server,
    validators,
  };
}

module.exports = {
  createRuntime,
};
