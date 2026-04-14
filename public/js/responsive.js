const MIN_WIDTH = 900;
const MIN_HEIGHT = 620;

export function initResponsive(i18n) {
  let warningDismissed = false;
  const resolutionWarning = document.getElementById("resolution-warning");
  const resolutionWarningTitle = document.getElementById("resolution-warning-title");
  const resolutionWarningMessage = document.getElementById("resolution-warning-message");
  const dismissButton = document.getElementById("dismissResolutionWarningBtn");

  function handleResize() {
    if (!resolutionWarning) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;
    const isTooSmall = width < MIN_WIDTH || height < MIN_HEIGHT;
    const shouldWarn = isPortrait && !isTooSmall;

    if (isPortrait) {
      resolutionWarningTitle.textContent = i18n.t("resolutionRotateTitle");
      resolutionWarningMessage.textContent = i18n.t("resolutionRotateMessage");
    } else {
      resolutionWarningTitle.textContent = i18n.t("resolutionTitle");
      resolutionWarningMessage.textContent = i18n.t("resolutionMessage");
    }

    if (!shouldWarn || isTooSmall) {
      warningDismissed = false;
    }

    resolutionWarning.style.display =
      shouldWarn && !warningDismissed ? "block" : "none";
  }

  if (dismissButton) {
    dismissButton.addEventListener("click", () => {
      warningDismissed = true;
      if (resolutionWarning) {
        resolutionWarning.style.display = "none";
      }
    });
  }

  window.addEventListener("resize", handleResize);
  handleResize();

  return { handleResize };
}
