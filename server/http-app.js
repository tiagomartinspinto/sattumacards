const compression = require("compression");
const express = require("express");
const helmet = require("helmet");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildContentSecurityPolicy(config) {
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

  if (config.IS_PRODUCTION) {
    directives.upgradeInsecureRequests = [];
  }

  return directives;
}

function createHttpApp({ config, getDebugState, getRoomCount, logger }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: buildContentSecurityPolicy(config),
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  app.use(
    express.static(config.PUBLIC_DIR, {
      maxAge: config.STATIC_MAX_AGE_MS,
      setHeaders(response, filePath) {
        if (filePath.endsWith(".html")) {
          response.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  app.get("/health", (request, response) => {
    response.json({
      storageMode: config.ROOM_STORAGE_MODE,
      status: "ok",
      rooms: getRoomCount(),
      uptimeSeconds: Math.round(process.uptime()),
      version: config.APP_VERSION,
    });
  });

  app.get("/app-config", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({
      appVersion: config.APP_VERSION,
      enableDebugPanel: Boolean(config.ENABLE_DEBUG_PANEL),
      showVersionLabel: !config.IS_PRODUCTION,
      storageMode: config.ROOM_STORAGE_MODE,
    });
  });

  if (config.ENABLE_DEBUG_PANEL) {
    app.get("/debug/state", (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.json(getDebugState());
    });
  }

  app.use((request, response, next) => {
    next(createHttpError(404, "Not found"));
  });

  app.use((error, request, response, _next) => {
    const statusCode = Number(error.statusCode || 500);
    const message = statusCode >= 500 ? "Internal server error" : error.message;

    logger.error("Express request failed", {
      path: request.path,
      statusCode,
      message: error.message,
    });

    response.status(statusCode).json({ error: message });
  });

  return app;
}

module.exports = {
  createHttpApp,
};
