let noticeTimeout;

export function showGameNotice(title, message) {
  let notice = document.getElementById("gameNotice");

  if (!notice) {
    notice = document.createElement("div");
    notice.id = "gameNotice";
    notice.className = "game-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = `
      <strong class="game-notice-title"></strong>
      <span class="game-notice-message"></span>
    `;
    document.body.appendChild(notice);
  }

  notice.querySelector(".game-notice-title").textContent = title;
  notice.querySelector(".game-notice-message").textContent = message;
  notice.classList.remove("show");

  window.clearTimeout(noticeTimeout);
  window.requestAnimationFrame(() => {
    notice.classList.add("show");
  });

  noticeTimeout = window.setTimeout(() => {
    notice.classList.remove("show");
  }, 3600);
}
