const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
};

function createLogger(logLevel = "info") {
  function log(level, message, meta) {
    if ((LOG_LEVELS[level] ?? LOG_LEVELS.info) > (LOG_LEVELS[logLevel] ?? LOG_LEVELS.info)) {
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

  return {
    error(message, meta) {
      log("error", message, meta);
    },
    warn(message, meta) {
      log("warn", message, meta);
    },
    info(message, meta) {
      log("info", message, meta);
    },
  };
}

module.exports = {
  createLogger,
};
