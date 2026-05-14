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

function createSocket() {
  const requestedRoomCode =
    new URLSearchParams(window.location.search).get("room") || "";
  const playerSessionId = getPlayerSessionId();

  return window.io({
    auth: { playerSessionId },
    query: { room: requestedRoomCode },
  });
}

async function initGame() {
  const i18n = createI18n();
  await i18n.init();

  const socket = createSocket();
  const cards = createCards({ socket, i18n, showNotice: showGameNotice });
  const room = createRoom({ socket, i18n, cards, showNotice: showGameNotice });
  const responsive = initResponsive(i18n);

  initModals();
  initThemes();
  initDragAndDrop(socket);

  document.getElementById("copyRoomBtn")?.addEventListener("click", room.copyRoomCode);
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
