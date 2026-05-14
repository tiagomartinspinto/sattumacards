function normalizeRoomCode(roomCode) {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase();
}

function normalizeLanguage(language, supportedLanguages = ["fi", "en"]) {
  return supportedLanguages.includes(language) ? language : "fi";
}

function normalizeSessionId(sessionId) {
  if (typeof sessionId !== "string") {
    return "";
  }

  const normalized = sessionId.trim();
  return /^[a-z0-9_-]{12,128}$/i.test(normalized) ? normalized : "";
}

function createValidators(config) {
  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isValidDeckId(deckId) {
    return typeof deckId === "string" && config.VALID_DECK_IDS.has(deckId);
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

  function isValidCardId(cardId) {
    if (typeof cardId !== "string" || !/^card-[a-z-]+-\d+$/.test(cardId)) {
      return false;
    }

    const deckId = getCardDeckId(cardId);
    const stackIndex = getCardStackIndex(cardId);
    return (
      isValidDeckId(deckId) &&
      Number.isInteger(stackIndex) &&
      stackIndex >= 0 &&
      stackIndex < config.CARD_COUNT
    );
  }

  function validateCardMoveData(data) {
    if (!isPlainObject(data)) {
      return null;
    }

    const { cardId, deckId, newParentId, targetDeckId } = data;

    if (
      !isValidCardId(cardId) ||
      !isValidDeckId(deckId) ||
      !isValidDeckId(targetDeckId) ||
      deckId !== getCardDeckId(cardId) ||
      newParentId !== `dropzone-${targetDeckId}`
    ) {
      return null;
    }

    return { cardId, deckId, newParentId, targetDeckId };
  }

  function validateFlipCardData(data) {
    if (!isPlainObject(data) || !isValidCardId(data.cardId)) {
      return null;
    }

    return { cardId: data.cardId };
  }

  function validateTimerDurationData(data) {
    if (!isPlainObject(data)) {
      return null;
    }

    const durationSeconds = Number(data.durationSeconds);

    if (!config.ALLOWED_TIMER_DURATIONS.includes(durationSeconds)) {
      return null;
    }

    return { durationSeconds };
  }

  function validateCardTextRequest(data) {
    if (!isPlainObject(data)) {
      return null;
    }

    const { deckId, cardId, language } = data;

    if (!isValidDeckId(deckId) || !isValidCardId(cardId) || deckId !== getCardDeckId(cardId)) {
      return null;
    }

    return {
      deckId,
      cardId,
      language: normalizeLanguage(language, config.SUPPORTED_LANGUAGES),
    };
  }

  function validateAllCardTextsRequest(data) {
    if (data !== undefined && !isPlainObject(data)) {
      return null;
    }

    return {
      language: normalizeLanguage(data?.language, config.SUPPORTED_LANGUAGES),
    };
  }

  function validateCursorMoveData(data) {
    if (!isPlainObject(data)) {
      return null;
    }

    const x = Number(data.x);
    const y = Number(data.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  return {
    getCardDeckId,
    getCardStackIndex,
    isPlainObject,
    isValidCardId,
    isValidDeckId,
    normalizeLanguage(language) {
      return normalizeLanguage(language, config.SUPPORTED_LANGUAGES);
    },
    validateAllCardTextsRequest,
    validateCardMoveData,
    validateCardTextRequest,
    validateCursorMoveData,
    validateFlipCardData,
    validateTimerDurationData,
  };
}

module.exports = {
  createValidators,
  normalizeLanguage,
  normalizeRoomCode,
  normalizeSessionId,
};
