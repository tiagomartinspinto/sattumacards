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

function createHttpApp({ config, logger, getRoomCount }) {
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
      status: "ok",
      rooms: getRoomCount(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use((request, response, next) => {
    next(createHttpError(404, "Not found"));
  });

  app.use((error, request, response, next) => {
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
