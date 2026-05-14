const fs = require("fs");
const path = require("path");

const { normalizeLanguage } = require("./validators");

function createDeckStore(config, logger) {
  const deckTextCache = loadDeckTextCache();

  function getDeck(deckId) {
    return config.DECKS.find((deck) => deck.id === deckId);
  }

  function readDeckFile(deck, language) {
    const filePath = path.join(config.CARDS_DIR, language, deck.file);

    try {
      const data = fs.readFileSync(filePath, "utf8");
      return data
        .split("\n")
        .map((word) => word.trim())
        .filter(Boolean);
    } catch (error) {
      logger.error("Failed to read deck file", { filePath, message: error.message });
      return [];
    }
  }

  function loadDeckTextCache() {
    return Object.fromEntries(
      config.SUPPORTED_LANGUAGES.map((language) => [
        language,
        Object.fromEntries(
          config.DECKS.map((deck) => [deck.id, readDeckFile(deck, language)])
        ),
      ])
    );
  }

  function getDeckLines(deckId, language = "fi") {
    const normalizedLanguage = normalizeLanguage(language, config.SUPPORTED_LANGUAGES);
    const cachedLines = deckTextCache[normalizedLanguage]?.[deckId];

    if (cachedLines) {
      return cachedLines;
    }

    const deck = getDeck(deckId);

    if (!deck) {
      return [];
    }

    const lines = readDeckFile(deck, normalizedLanguage);

    if (!deckTextCache[normalizedLanguage]) {
      deckTextCache[normalizedLanguage] = {};
    }

    deckTextCache[normalizedLanguage][deckId] = lines;
    return lines;
  }

  return {
    getDeck,
    getDeckLines,
  };
}

module.exports = {
  createDeckStore,
};
