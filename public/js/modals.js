export function initModals() {
  const menuIcon = document.querySelector(".menu-icon");
  const menuContent = document.getElementById("menuContent");
  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");
  let activeModalId = "";
  let lastFocusedElement = null;

  function closeMenu() {
    if (!menuIcon || !menuContent) {
      return;
    }

    menuIcon.classList.remove("open");
    menuIcon.setAttribute("aria-expanded", "false");
    menuContent.style.display = "none";
  }

  function toggleMenu() {
    if (!menuIcon || !menuContent) {
      return;
    }

    const isOpen = menuContent.style.display === "block";
    menuIcon.classList.toggle("open", !isOpen);
    menuIcon.setAttribute("aria-expanded", String(!isOpen));
    menuContent.style.display = isOpen ? "none" : "block";
  }

  function getFocusableElements(modal) {
    return [...modal.querySelectorAll(focusableSelector)].filter(
      (element) => !element.hasAttribute("hidden")
    );
  }

  function openModal(modalId, triggerElement = document.activeElement) {
    const modal = document.getElementById(modalId);

    if (modal) {
      activeModalId = modalId;
      lastFocusedElement = triggerElement || null;
      modal.setAttribute("aria-hidden", "false");
      modal.style.display = "block";
      closeMenu();

      const focusableElements = getFocusableElements(modal);
      const initialFocusElement =
        focusableElements.find((element) => element.matches("[data-modal-close]")) ||
        focusableElements[0] ||
        modal.querySelector(".modal-content");

      initialFocusElement?.focus();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal) {
      if (activeModalId === modalId) {
        activeModalId = "";
      }

      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
      lastFocusedElement?.focus?.();
      lastFocusedElement = null;
    }
  }

  if (menuIcon) {
    menuIcon.addEventListener("click", toggleMenu);
    menuIcon.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMenu();
      }
    });
  }

  document.addEventListener("click", (event) => {
    const openTrigger = event.target.closest?.("[data-modal-target]");
    const closeTrigger = event.target.closest?.("[data-modal-close]");

    if (openTrigger) {
      openModal(openTrigger.dataset.modalTarget, openTrigger);
    }

    if (closeTrigger) {
      closeModal(closeTrigger.dataset.modalClose);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (activeModalId) {
        event.preventDefault();
        closeModal(activeModalId);
        return;
      }

      closeMenu();
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && event.target.closest?.("[data-modal-target]")) {
      const openTrigger = event.target.closest("[data-modal-target]");
      event.preventDefault();
      openModal(openTrigger.dataset.modalTarget, openTrigger);
      return;
    }

    if (event.key !== "Tab" || !activeModalId) {
      return;
    }

    const activeModal = document.getElementById(activeModalId);
    const focusableElements = activeModal ? getFocusableElements(activeModal) : [];

    if (focusableElements.length === 0) {
      event.preventDefault();
      activeModal?.querySelector(".modal-content")?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const isShiftTab = event.shiftKey;

    if (isShiftTab && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!isShiftTab && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      closeModal(event.target.id);
    }
  });
}
