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

  document.addEventListener("click", (event) => {
    const openTrigger = event.target.closest?.("[data-modal-target]");
    const closeTrigger = event.target.closest?.("[data-modal-close]");

    if (openTrigger) {
      openModal(openTrigger.dataset.modalTarget);
    }

    if (closeTrigger) {
      closeModal(closeTrigger.dataset.modalClose);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const openTrigger = event.target.closest?.("[data-modal-target]");

    if (openTrigger) {
      event.preventDefault();
      openModal(openTrigger.dataset.modalTarget);
    }
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      closeModal(event.target.id);
    }
  });
}
