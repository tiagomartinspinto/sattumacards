import { initAppFooter, initDebugPanel, loadAppConfig } from "./app-shell.js";
import { createCards } from "./cards.js";
import { initDragAndDrop } from "./drag-drop.js";
import { createI18n } from "./i18n.js";
import { initModals } from "./modals.js";
import { showGameNotice } from "./notice.js";
import { initResponsive } from "./responsive.js";
import { createRoom } from "./room.js";
import { initThemes } from "./themes.js";

const PLAYER_SESSION_STORAGE_KEY = "sattumaPlayerSessionId";

function generatePlayerSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `sattuma-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getPlayerSessionId() {
  const existingSessionId = localStorage.getItem(PLAYER_SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = generatePlayerSessionId();
  localStorage.setItem(PLAYER_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

function getRoomFromUrl() {
  return new URLSearchParams(window.location.search).get("room") || "";
}

function shouldAutoStart() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get("room") || params.get("create") === "1");
}

function showLandingScreen({ prefillRoomCode = "" } = {}) {
  document.body.classList.remove("is-board");
  document.body.classList.add("is-landing");
  document.getElementById("landingScreen")?.removeAttribute("hidden");
  document.getElementById("gameBoardShell")?.setAttribute("hidden", "hidden");

  const joinRoomCode = document.getElementById("joinRoomCode");

  if (joinRoomCode && prefillRoomCode) {
    joinRoomCode.value = prefillRoomCode;
  }
}

function showGameBoard() {
  document.body.classList.remove("is-landing");
  document.body.classList.add("is-board");
  document.getElementById("landingScreen")?.setAttribute("hidden", "hidden");
  document.getElementById("gameBoardShell")?.removeAttribute("hidden");
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 12)
    .toUpperCase();
}

function updateUrlForRoom({ roomCode = "", create = false, language }) {
  const url = new URL(window.location.href);

  if (roomCode) {
    url.searchParams.set("room", normalizeRoomCode(roomCode));
  } else {
    url.searchParams.delete("room");
  }

  if (create) {
    url.searchParams.set("create", "1");
  } else {
    url.searchParams.delete("create");
  }

  if (language) {
    url.searchParams.set("lang", language);
  }

  window.location.assign(url.toString());
}

function createSocket() {
  const requestedRoomCode = getRoomFromUrl();
  const playerSessionId = getPlayerSessionId();

  return window.io({
    auth: { playerSessionId },
    query: { room: requestedRoomCode },
  });
}

function initLandingActions(i18n) {
  const createRoomButton = document.getElementById("createRoomBtn");
  const joinRoomForm = document.getElementById("joinRoomForm");
  const joinRoomCode = document.getElementById("joinRoomCode");

  if (createRoomButton) {
    createRoomButton.addEventListener("click", () => {
      updateUrlForRoom({ create: true, language: i18n.language });
    });
  }

  if (joinRoomForm) {
    joinRoomForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const roomCode = normalizeRoomCode(joinRoomCode?.value || "");

      if (!roomCode) {
        showGameNotice(i18n.t("joinRoomMissingTitle"), i18n.t("joinRoomMissingMessage"));
        joinRoomCode?.focus();
        return;
      }

      updateUrlForRoom({ roomCode, language: i18n.language });
    });
  }
}

async function initGame() {
  const appConfig = await loadAppConfig();
  initAppFooter(appConfig);
  initDebugPanel(appConfig);

  const i18n = createI18n();
  await i18n.init();

  initModals();
  initThemes();
  const responsive = initResponsive(i18n);
  initLandingActions(i18n);

  if (!shouldAutoStart()) {
    showLandingScreen({ prefillRoomCode: getRoomFromUrl() });
    return;
  }

  showGameBoard();

  const socket = createSocket();
  const cards = createCards({ socket, i18n, showNotice: showGameNotice });
  const room = createRoom({
    socket,
    i18n,
    cards,
    showNotice: showGameNotice,
    onJoinFailure: () => {
      socket.close();
      const prefillRoomCode = getRoomFromUrl();
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url);
      showLandingScreen({ prefillRoomCode });
    },
    onRoomReady: () => {
      showGameBoard();
    },
    onLeaveRoom: () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url);
      showLandingScreen();
    },
  });

  initDragAndDrop(socket);

  document.getElementById("copyRoomBtn")?.addEventListener("click", room.copyRoomCode);
  document.getElementById("leaveRoomBtn")?.addEventListener("click", room.leaveRoom);
  document
    .getElementById("closeRoomBtn")
    ?.addEventListener("click", room.requestCloseRoom);
  document.getElementById("copyResultsBtn")?.addEventListener("click", room.copyResults);
  document
    .getElementById("quickDealBtn")
    ?.addEventListener("click", room.requestRandomSituation);
  document.getElementById("resetBtn")?.addEventListener("click", room.requestReset);
  document
    .getElementById("startReplacementBtn")
    ?.addEventListener("click", room.startReplacementRound);
  document
    .getElementById("roundTimerSelector")
    ?.addEventListener("change", (event) => room.setTimerDuration(event.target.value));

  i18n.onChange(() => {
    room.refreshLabels();
    cards.refreshTexts();
    responsive.handleResize();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initGame().catch((error) => {
    console.error("Failed to initialize Sattuma:", error);
  });
});
