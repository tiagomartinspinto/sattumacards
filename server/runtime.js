const http = require("http");

const { createConfig } = require("./config");
const { createDeckStore } = require("./deck-store");
const { createHttpApp } = require("./http-app");
const { createLogger } = require("./logger");
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
  const validators = createValidators(config);
  const roomService = createRoomService({
    config,
    deckStore,
    logger,
    validators,
  });
  const app = createHttpApp({
    config,
    logger,
    getRoomCount: () => roomService.getRoomCount(),
  });
  const server = http.createServer(app);
  const io = createGameSocketServer({
    server,
    config,
    logger,
    roomService,
    validators,
  });

  registerProcessErrorLogging(logger);

  return {
    app,
    config,
    deckStore,
    io,
    logger,
    roomService,
    server,
    validators,
  };
}

module.exports = {
  createRuntime,
};
