import { createCards } from "./cards.js";
import { initDragAndDrop } from "./drag-drop.js";
import { createI18n } from "./i18n.js";
import { initModals } from "./modals.js";
import { showGameNotice } from "./notice.js";
import { initResponsive } from "./responsive.js";
import { createRoom } from "./room.js";
import { initThemes } from "./themes.js";

function createSocket() {
  const requestedRoomCode =
    new URLSearchParams(window.location.search).get("room") || "";

  return window.io({ query: { room: requestedRoomCode } });
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
  document.addEventListener("contextmenu", (event) => event.preventDefault());

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
