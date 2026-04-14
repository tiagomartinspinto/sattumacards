// Utility Functions
function navigate(url) {
  document.body.classList.add("fade-out");
  setTimeout(() => (window.location.href = url), 2000);
}

function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
  updateMenuIconAndContent(false);
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    closeModal(event.target.id);
  }
};

function toggleMenu() {
  var menuIcon = document.querySelector(".menu-icon");
  if (!menuIcon) {
    return;
  }
  menuIcon.classList.toggle("open");
  var menuContent = document.getElementById("menuContent");
  if (!menuContent) {
    return;
  }
  menuContent.style.display =
    menuContent.style.display === "block" ? "none" : "block";
}

function updateMenuIconAndContent(reset) {
  var menuIcon = document.querySelector(".menu-icon");
  var menuContent = document.getElementById("menuContent");

  if (reset && menuIcon.classList.contains("open")) {
    menuIcon.classList.remove("open");
  }
  menuContent.style.display = reset ? "none" : menuContent.style.display;
}

function loadModalContent(modalId, contentId, filePath) {
  fetch(filePath)
    .then((response) => response.text())
    .then((htmlText) => {
      const contentElement = document.getElementById(contentId);
      contentElement.innerHTML = htmlText; // Use innerHTML to render HTML content
    })
    .catch((error) =>
      console.error("Error loading content for " + modalId + ":", error)
    );
}

// Function to handle window resize
function handleWindowResize() {
  const minWidth = 1200;
  const minHeight = 830;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const resolutionWarning = document.getElementById("resolution-warning");
  resolutionWarning.style.display =
    width < minWidth || height < minHeight ? "block" : "none";
}

// Event Binding Functions
function bindEventListeners() {
  const createGameBtn = document.getElementById("createGameBtn");
  const homePageBtn = document.getElementById("homePageBtn");
  const closeModalButton = document.getElementById("closeModalButton");
  const centerImage = document.getElementById("centerImage");
  const menuIcon = document.querySelector(".menu-icon");
  const dismissResolutionWarningBtn = document.getElementById(
    "dismissResolutionWarningBtn"
  );

  if (createGameBtn) {
    createGameBtn.addEventListener("click", () =>
      navigate("./public/index.html")
    );
  }

  if (homePageBtn) {
    homePageBtn.addEventListener("click", () => navigate("index.html"));
  }

  if (closeModalButton) {
    closeModalButton.addEventListener("click", () => closeModal("myModal"));
  }

  if (centerImage) {
    centerImage.addEventListener("dragstart", (e) => e.preventDefault());
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

  document.querySelectorAll("[data-modal-target]").forEach((menuItem) => {
    menuItem.addEventListener("click", () => openModal(menuItem.dataset.modalTarget));
    menuItem.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(menuItem.dataset.modalTarget);
      }
    });
  });

  document.querySelectorAll("[data-modal-close]").forEach((closeButton) => {
    closeButton.addEventListener("click", () =>
      closeModal(closeButton.dataset.modalClose)
    );
  });

  if (dismissResolutionWarningBtn) {
    dismissResolutionWarningBtn.addEventListener("click", () => {
      document.getElementById("resolution-warning").style.display = "none";
    });
  }

  window.addEventListener("resize", handleWindowResize);
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  handleWindowResize();

  // Initialization
  loadModalContent(
    "instructionsModal",
    "instructionsContent",
    "./public/content/fi/instructions.html"
  );
  loadModalContent(
    "historyModal",
    "historyContent",
    "./public/content/fi/about.html"
  );
  loadModalContent(
    "contactsModal",
    "contactsContent",
    "./public/content/fi/contacts.html"
  );
}

// DOM Content Loading
document.addEventListener("DOMContentLoaded", bindEventListeners);
