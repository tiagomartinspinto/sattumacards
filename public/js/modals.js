export function initModals() {
  const menuIcon = document.querySelector(".menu-icon");
  const menuContent = document.getElementById("menuContent");

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

  function openModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal) {
      modal.style.display = "block";
      closeMenu();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal) {
      modal.style.display = "none";
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

  document.querySelectorAll("[data-modal-target]").forEach((trigger) => {
    trigger.addEventListener("click", () => openModal(trigger.dataset.modalTarget));
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(trigger.dataset.modalTarget);
      }
    });
  });

  document.querySelectorAll("[data-modal-close]").forEach((trigger) => {
    trigger.addEventListener("click", () => closeModal(trigger.dataset.modalClose));
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      closeModal(event.target.id);
    }
  });
}
