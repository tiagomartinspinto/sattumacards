function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "never";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

async function loadAppConfig() {
  try {
    const response = await fetch("/app-config", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Unexpected config response: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to load app config", error);
    return {
      appVersion: "",
      enableDebugPanel: false,
      storageMode: "memory",
    };
  }
}

function initAppFooter(appConfig = {}) {
  const appVersionText = document.getElementById("appVersionText");

  if (!appVersionText || !appConfig.appVersion) {
    return;
  }

  appVersionText.textContent = `v${appConfig.appVersion}`;
}

function initDebugPanel(appConfig = {}) {
  const debugPanel = document.getElementById("debugPanel");
  const debugSummary = document.getElementById("debugPanelSummary");
  const debugRooms = document.getElementById("debugPanelRooms");
  const debugRateLimits = document.getElementById("debugPanelRateLimits");

  if (!debugPanel || !debugSummary || !debugRooms || !debugRateLimits) {
    return;
  }

  if (!appConfig.enableDebugPanel) {
    debugPanel.hidden = true;
    return;
  }

  debugPanel.hidden = false;

  async function refreshDebugPanel() {
    try {
      const response = await fetch("/debug/state", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Unexpected debug response: ${response.status}`);
      }

      const debugState = await response.json();
      debugSummary.textContent = [
        `rooms ${debugState.activeRooms}`,
        `players ${debugState.activePlayers}`,
        `reservations ${debugState.reconnectReservations}`,
        `sockets ${debugState.socket?.currentSockets || 0}`,
        `storage ${debugState.storageMode || appConfig.storageMode || "memory"}`,
      ].join(" | ");

      const roomItems = (debugState.rooms || []).map((room) => {
        const roomLine = document.createElement("li");
        const reconnectLabel =
          room.reconnectReservations?.length > 0
            ? ` | reconnect ${room.reconnectReservations.length}`
            : "";
        roomLine.textContent =
          `${room.code} | ${room.phase} | host ${room.hostPlayer || "-"} | ` +
          `players ${room.playerCount} | cards ${room.tableCardCount} | ` +
          `last ${formatTimestamp(room.lastActivityAt)}${reconnectLabel}`;
        return roomLine;
      });

      debugRooms.textContent = "";
      debugRooms.append(...roomItems);

      debugRateLimits.textContent = "";
      Object.entries(debugState.socket?.rateLimitHits || {}).forEach(
        ([eventName, count]) => {
          const item = document.createElement("li");
          item.textContent = `${eventName}: ${count}`;
          debugRateLimits.appendChild(item);
        }
      );

      if (!debugRateLimits.childElementCount) {
        const item = document.createElement("li");
        item.textContent = "No rate-limit hits yet";
        debugRateLimits.appendChild(item);
      }
    } catch (error) {
      debugSummary.textContent = "Debug panel unavailable";
      debugRooms.textContent = "";
      debugRateLimits.textContent = "";
      console.error("Failed to refresh debug panel", error);
    }
  }

  refreshDebugPanel();
  window.setInterval(refreshDebugPanel, 4000);
}

export { initAppFooter, initDebugPanel, loadAppConfig };
