const path = require("path");
const packageJson = require("../package.json");

const DEFAULT_DECKS = [
  { id: "situation", file: "situation.txt" },
  { id: "space", file: "space.txt" },
  { id: "methods", file: "methods.txt" },
  { id: "resources", file: "resources.txt" },
  { id: "teaching-format", file: "teaching-format.txt" },
  { id: "chance", file: "chance.txt" },
];

const DEFAULT_EVENT_RATE_LIMITS = {
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

const DEFAULT_ANIMAL_NAMES = [
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

function toOrigins(value) {
  if (Array.isArray(value)) {
    return value.map((origin) => String(origin).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function cloneDecks(decks = DEFAULT_DECKS) {
  return decks.map((deck) => ({ ...deck }));
}

function toBoolean(value, defaultValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return defaultValue;
}

function createConfig(overrides = {}) {
  const NODE_ENV = overrides.NODE_ENV || process.env.NODE_ENV || "development";
  const DECKS = cloneDecks(overrides.DECKS);
  const SUPPORTED_LANGUAGES = [...(overrides.SUPPORTED_LANGUAGES || ["fi", "en"])];
  const ROOT_DIR = path.join(__dirname, "..");

  const config = {
    APP_VERSION: overrides.APP_VERSION || process.env.APP_VERSION || packageJson.version,
    NODE_ENV,
    IS_PRODUCTION: NODE_ENV === "production",
    ENABLE_DEBUG_PANEL: toBoolean(
      overrides.ENABLE_DEBUG_PANEL ?? process.env.ENABLE_DEBUG_PANEL,
      NODE_ENV !== "production"
    ),
    LOG_LEVEL: overrides.LOG_LEVEL || process.env.LOG_LEVEL || "info",
    PORT: Number(overrides.PORT || process.env.PORT || 4000),
    ROOM_TTL_MS: Number(
      overrides.ROOM_TTL_MS || process.env.ROOM_TTL_MS || 4 * 60 * 60 * 1000
    ),
    ROOM_CLEANUP_INTERVAL_MS: Number(
      overrides.ROOM_CLEANUP_INTERVAL_MS ||
        process.env.ROOM_CLEANUP_INTERVAL_MS ||
        15 * 60 * 1000
    ),
    RECONNECT_GRACE_MS: Number(
      overrides.RECONNECT_GRACE_MS || process.env.RECONNECT_GRACE_MS || 5 * 60 * 1000
    ),
    STATIC_MAX_AGE_MS: Number(
      overrides.STATIC_MAX_AGE_MS || process.env.STATIC_MAX_AGE_MS || 60 * 60 * 1000
    ),
    MAX_PLAYERS_PER_ROOM: Number(
      overrides.MAX_PLAYERS_PER_ROOM || process.env.MAX_PLAYERS_PER_ROOM || 12
    ),
    MAX_ROOMS: Number(overrides.MAX_ROOMS || process.env.MAX_ROOMS || 200),
    CARD_COUNT: Number(overrides.CARD_COUNT || 9),
    SUPPORTED_LANGUAGES,
    ALLOWED_TIMER_DURATIONS: overrides.ALLOWED_TIMER_DURATIONS || [0, 60, 120, 180, 300],
    EVENT_RATE_LIMITS: overrides.EVENT_RATE_LIMITS || DEFAULT_EVENT_RATE_LIMITS,
    SOCKET_ALLOWED_ORIGINS: toOrigins(
      overrides.SOCKET_ALLOWED_ORIGINS ?? process.env.SOCKET_ALLOWED_ORIGINS
    ),
    ROOM_STORAGE_MODE: String(
      overrides.ROOM_STORAGE_MODE || process.env.ROOM_STORAGE_MODE || "memory"
    ).toLowerCase(),
    SQLITE_DB_PATH:
      overrides.SQLITE_DB_PATH ||
      process.env.SQLITE_DB_PATH ||
      path.join(ROOT_DIR, ".data", "sattuma.sqlite"),
    DECKS,
    VALID_DECK_IDS: new Set(DECKS.map((deck) => deck.id)),
    ANIMAL_NAMES: overrides.ANIMAL_NAMES || DEFAULT_ANIMAL_NAMES,
    ROOT_DIR,
    PUBLIC_DIR: path.join(ROOT_DIR, "public"),
    CARDS_DIR: path.join(ROOT_DIR, "public", "cards"),
  };

  return config;
}

module.exports = {
  createConfig,
};
