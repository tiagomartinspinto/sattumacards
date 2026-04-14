const CURSOR_COLORS = [
  "red",
  "blue",
  "green",
  "orange",
  "purple",
  "pink",
  "yellow",
  "cyan",
  "magenta",
  "brown",
];

function hashCode(str) {
  let hash = 0;

  for (let index = 0; index < str.length; index++) {
    hash = (hash << 5) - hash + str.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}

function throttle(callback, limit) {
  let waiting = false;

  return function throttledCallback(...args) {
    if (waiting) {
      return;
    }

    callback.apply(this, args);
    waiting = true;
    setTimeout(() => {
      waiting = false;
    }, limit);
  };
}

export function createRoom({ socket, i18n, cards, showNotice }) {
  let roomCode = "";
  let userName = "";
  let lastPlayers = [];
  let lastGameState = null;
  let serverClockOffset = 0;
  let timerInterval = null;
  let timerNoticeKey = "";

  function interpolate(template, values = {}) {
    return Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, value || ""),
      template
    );
  }

  function updateRoomCodeDisplay(nextRoomCode) {
    const roomCodeDisplay = document.getElementById("roomCodeDisplay");
    const roomCodeScreenReader = document.getElementById("roomCodeScreenReader");

    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = nextRoomCode;
    }

    if (roomCodeScreenReader) {
      roomCodeScreenReader.textContent = `${i18n.t("roomCodeScreenReader")} ${nextRoomCode}`;
    }
  }

  function updatePlayersList(players = lastPlayers) {
    const playersList = document.getElementById("playersList");
    lastPlayers = players;

    if (!playersList) {
      return;
    }

    playersList.innerHTML = "";
    players.forEach((player) => {
      const playerElement = document.createElement("li");
      const colorDot = document.createElement("span");
      const nameElement = document.createElement("span");

      colorDot.className = "player-dot";
      colorDot.style.backgroundColor =
        CURSOR_COLORS[Math.abs(hashCode(player)) % CURSOR_COLORS.length];
      nameElement.textContent = player;
      playerElement.append(colorDot, nameElement);

      if (player === userName) {
        const selfElement = document.createElement("strong");
        selfElement.textContent = i18n.t("selfLabel");
        playerElement.appendChild(selfElement);
      }

      playersList.appendChild(playerElement);
    });
  }

  function copyRoomCode() {
    if (!roomCode) {
      return;
    }

    const roomUrl = new URL(window.location.href);
    roomUrl.searchParams.set("room", roomCode);
    roomUrl.searchParams.set("lang", i18n.language);

    if (!navigator.clipboard) {
      showNotice(i18n.t("roomCodeNotice"), roomCode);
      return;
    }

    navigator.clipboard
      .writeText(roomUrl.toString())
      .then(() => showNotice(i18n.t("roomLinkCopied"), roomCode))
      .catch(() => showNotice(i18n.t("roomCodeNotice"), roomCode));
  }

  function requestReset() {
    const resetButton = document.getElementById("resetBtn");

    if (resetButton?.disabled) {
      return;
    }

    if (resetButton) {
      resetButton.disabled = true;
      resetButton.classList.add("is-loading");
      resetButton.setAttribute("aria-label", i18n.t("shuffling"));
      resetButton.setAttribute("title", i18n.t("shuffling"));
    }

    socket.emit("resetDecks");
  }

  function requestRandomSituation() {
    const quickDealButton = document.getElementById("quickDealBtn");

    if (quickDealButton?.disabled) {
      return;
    }

    if (quickDealButton) {
      quickDealButton.disabled = true;
      quickDealButton.classList.add("is-loading");
      quickDealButton.setAttribute("aria-label", i18n.t("quickDealing"));
      quickDealButton.setAttribute("title", i18n.t("quickDealing"));
    }

    socket.emit("dealRandomSituation");
  }

  function startReplacementRound() {
    socket.emit("startReplacementPhase");
  }

  function setTimerDuration(durationSeconds) {
    socket.emit("setTimerDuration", { durationSeconds: Number(durationSeconds) });
  }

  function getPhaseLabelKey(phase) {
    if (phase === "discuss") {
      return "phaseDiscuss";
    }

    if (phase === "replace") {
      return "phaseReplace";
    }

    return "phaseDeal";
  }

  function getTurnHelpKey(gameState) {
    if (gameState.phase === "discuss") {
      return "turnHelpDiscuss";
    }

    if (gameState.phase === "replace" && gameState.pendingCardId) {
      return "turnHelpReplacePending";
    }

    if (gameState.phase === "replace") {
      return "turnHelpReplace";
    }

    if (gameState.pendingCardId) {
      return "turnHelpDealPending";
    }

    return "turnHelpDeal";
  }

  function getReplacementButtonKey(gameState) {
    return gameState.roundNumber > 1 ? "continueToNextTurn" : "startReplacement";
  }

  function formatTimer(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function updateTimerDisplay(gameState = lastGameState) {
    const timerDisplay = document.getElementById("roundTimerDisplay");

    if (!timerDisplay || !gameState) {
      return;
    }

    if (!gameState.timerEndsAt) {
      timerDisplay.textContent = "--:--";
      return;
    }

    const remainingMilliseconds = gameState.timerEndsAt - (Date.now() + serverClockOffset);
    timerDisplay.textContent = formatTimer(remainingMilliseconds);

    if (remainingMilliseconds <= 0 && timerNoticeKey !== String(gameState.timerEndsAt)) {
      timerNoticeKey = String(gameState.timerEndsAt);
      showNotice(i18n.t("timerFinishedTitle"), i18n.t("timerFinishedMessage"));
    }
  }

  function syncTimer(gameState) {
    const timerSelector = document.getElementById("roundTimerSelector");

    if (timerSelector) {
      timerSelector.value = String(gameState.timerDurationSeconds || 0);
    }

    if (timerInterval) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }

    if (gameState.timerEndsAt) {
      timerInterval = window.setInterval(() => updateTimerDisplay(), 500);
    } else {
      timerNoticeKey = "";
    }

    updateTimerDisplay(gameState);
  }

  function updateGameState(gameState = lastGameState) {
    if (!gameState) {
      return;
    }

    lastGameState = gameState;
    serverClockOffset = gameState.serverNow ? gameState.serverNow - Date.now() : 0;

    const phaseLabel = document.getElementById("gamePhaseLabel");
    const turnHelp = document.getElementById("gameTurnHelp");
    const replacementButton = document.getElementById("startReplacementBtn");

    if (phaseLabel) {
      phaseLabel.textContent = i18n.t(getPhaseLabelKey(gameState.phase));
    }

    if (turnHelp) {
      turnHelp.textContent = interpolate(i18n.t(getTurnHelpKey(gameState)), {
        player: gameState.currentPlayer,
      });
    }

    if (replacementButton) {
      replacementButton.classList.toggle("is-visible", gameState.phase === "discuss");
      replacementButton.textContent = i18n.t(getReplacementButtonKey(gameState));
      replacementButton.setAttribute("title", i18n.t(getReplacementButtonKey(gameState)));
      replacementButton.setAttribute("aria-label", i18n.t(getReplacementButtonKey(gameState)));
    }

    syncTimer(gameState);
  }

  function showRejectedAction({ key }) {
    const titleKey = `${key}Title`;
    const messageKey = `${key}Message`;
    const title = i18n.t(titleKey);
    const message = i18n.t(messageKey);

    showNotice(
      title === titleKey ? i18n.t("oneCardTitle") : title,
      message === messageKey ? i18n.t("oneCardMessage") : message
    );
  }

  function renderCursor(data) {
    let cursor = document.getElementById(`cursor-${data.userId}`);

    if (!cursor) {
      cursor = document.createElement("div");
      cursor.id = `cursor-${data.userId}`;
      cursor.className = "cursor";

      const label = document.createElement("span");
      label.textContent = data.userName;
      label.className = "cursor-label";
      cursor.appendChild(label);
      document.body.appendChild(cursor);
    }

    cursor.style.left = `${data.x}px`;
    cursor.style.top = `${data.y}px`;
    cursor.style.backgroundColor =
      CURSOR_COLORS[Math.abs(hashCode(data.userId)) % CURSOR_COLORS.length];
  }

  function initCursorSharing() {
    document.addEventListener(
      "mousemove",
      throttle((event) => {
        socket.emit("cursorMove", {
          x: event.pageX,
          y: event.pageY,
          userId: userName,
          userName,
        });
      }, 100)
    );
  }

  function bindSocketEvents() {
    socket.on("cardMoved", ({ cardId, newParentId, replacedCardId }) => {
      if (replacedCardId) {
        cards.removeCard(replacedCardId);
      }

      const card = document.getElementById(cardId);
      const newParent = document.getElementById(newParentId);

      if (card && newParent) {
        newParent.appendChild(card);
        Object.assign(card.style, { position: "absolute", top: "0", left: "0" });
      }
    });

    socket.on("cardText", ({ cardId, text }) => {
      cards.updateCardText(cardId, text);
    });

    socket.on("flipCard", ({ cardId, isFlipped }) => {
      document.getElementById(cardId)?.classList.toggle("flip", Boolean(isFlipped));
    });

    socket.on("resetDecks", (payload = {}) => {
      roomCode = payload.roomCode || roomCode;
      updateRoomCodeDisplay(roomCode);
      updateGameState(payload.gameState);

      const resetBoard = () => {
        cards.resetDeckElements();
        cards.applyBoardState(payload.boardState);
      };

      if (payload.animate) {
        cards.playShuffleThenReset(resetBoard);
      } else {
        resetBoard();
      }
    });

    socket.on("updatePlayerList", updatePlayersList);
    socket.on("gameState", updateGameState);
    socket.on("actionRejected", showRejectedAction);

    socket.on("yourUserName", (nextUserName) => {
      userName = nextUserName;
      updatePlayersList();
    });

    socket.on("roomInfo", ({ roomCode: nextRoomCode }) => {
      roomCode = nextRoomCode;
      const url = new URL(window.location.href);
      url.searchParams.set("room", roomCode);
      url.searchParams.set("lang", i18n.language);
      window.history.replaceState({}, "", url);
      updateRoomCodeDisplay(roomCode);
    });

    socket.on("cursorUpdate", renderCursor);
    socket.on("playerDisconnected", (disconnectedUserName) => {
      document.getElementById(`cursor-${disconnectedUserName}`)?.remove();
    });
  }

  function refreshLabels() {
    updateRoomCodeDisplay(roomCode);
    updatePlayersList();
    updateGameState();
  }

  bindSocketEvents();
  initCursorSharing();

  return {
    copyRoomCode,
    refreshLabels,
    requestRandomSituation,
    requestReset,
    setTimerDuration,
    startReplacementRound,
  };
}
