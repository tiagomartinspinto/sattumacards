import { DECKS, getDeckById } from "./deck-config.js";

const CARD_COUNT = 9;
const SHUFFLE_ANIMATION_DURATION = 1200;
const DEAL_ANIMATION_DURATION = 1500;

function formatCardText(text) {
  if (text.length <= 15) {
    return text;
  }

  const words = text.split(" ");
  let formattedText = "";
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + word).length > 15) {
      formattedText += `${currentLine.trim()}\n`;
      currentLine = `${word} `;
    } else {
      currentLine += `${word} `;
    }
  });

  return formattedText + currentLine.trim();
}

export function createCards({ socket, i18n, showNotice }) {
  const decks = [...document.querySelectorAll(".deck")];
  const dropzones = [...document.querySelectorAll(".dropzone")];
  const resetButton = document.getElementById("resetBtn");
  const quickDealButton = document.getElementById("quickDealBtn");
  const cardElements = new Map();
  let allCards = [];
  let cardClickBound = false;

  function getAllCards() {
    return allCards;
  }

  function createCard(deckElement, deckId, cardIndex) {
    const deck = getDeckById(deckId);
    const card = document.createElement("div");
    const front = document.createElement("div");
    const back = document.createElement("div");

    card.className = "card initial-animation";
    card.draggable = true;
    card.id = `card-${deckId}-${cardIndex}`;
    card.dataset.deckId = deckId;
    card.style.setProperty("--deal-delay", `${cardIndex * 35}ms`);

    front.className = "front";
    front.style = `background-image: url('./back_card_imgs/sattuma-bkg.webp'); background-size: cover; background-color: #939598;`;

    back.className = "back";
    back.style = `background-image: url('./front_card_img/${deck.image}'); background-size: cover; background-color: white;`;

    card.append(front, back);
    cardElements.set(card.id, card);
    return card;
  }

  function createDeck(deckElement) {
    const deckId = deckElement.dataset.deckId;
    const fragment = document.createDocumentFragment();

    for (let cardIndex = 0; cardIndex < CARD_COUNT; cardIndex++) {
      fragment.appendChild(createCard(deckElement, deckId, cardIndex));
    }

    deckElement.appendChild(fragment);
  }

  function createDecks() {
    decks.forEach(createDeck);
    allCards = [...cardElements.values()];

    window.setTimeout(() => {
      getAllCards().forEach((card) => {
        card.classList.remove("initial-animation");
      });
    }, DEAL_ANIMATION_DURATION);
  }

  function clearBoard() {
    cardElements.clear();
    allCards = [];
    decks.forEach((deck) => (deck.textContent = ""));
    dropzones.forEach((dropzone) => (dropzone.textContent = ""));
  }

  function resetDeckElements() {
    clearBoard();
    createDecks();
  }

  function applyBoardState(boardState = {}) {
    getAllCards().forEach((card) => {
      card.classList.remove("flip");
    });

    Object.keys(boardState.discardedCards || {}).forEach((cardId) => {
      removeCard(cardId);
    });

    Object.entries(boardState.cardPositions || {}).forEach(([cardId, parentId]) => {
      const card = document.getElementById(cardId);
      const parent = document.getElementById(parentId);

      if (card && parent) {
        parent.appendChild(card);
        Object.assign(card.style, { position: "absolute", top: "0", left: "0" });
      }
    });

    Object.entries(boardState.flippedCards || {}).forEach(([cardId, isFlipped]) => {
      const card = document.getElementById(cardId);

      if (card) {
        card.classList.toggle("flip", Boolean(isFlipped));
      }
    });
  }

  function prepareShuffleAnimation() {
    getAllCards().forEach((card, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const sweep = 36 + (index % 5) * 8;
      const lift = 44 + (index % 3) * 14;
      const rotation = direction * (12 + (index % 4) * 5);
      const delay = (index % CARD_COUNT) * 25;

      card.style.setProperty("--shuffle-x", `${direction * sweep}px`);
      card.style.setProperty("--shuffle-y", `-${lift}px`);
      card.style.setProperty("--shuffle-rotation", `${rotation}deg`);
      card.style.setProperty("--shuffle-delay", `${delay}ms`);
      card.classList.remove("flip");
      card.classList.add("shuffle-card");
    });
  }

  function playShuffleThenReset(callback) {
    prepareShuffleAnimation();

    window.setTimeout(() => {
      callback();
      if (resetButton) {
        resetButton.disabled = false;
        resetButton.classList.remove("is-loading");
        resetButton.setAttribute("aria-label", i18n.t("shuffleButton"));
        resetButton.setAttribute("title", i18n.t("shuffleButton"));
      }
      if (quickDealButton) {
        quickDealButton.disabled = false;
        quickDealButton.classList.remove("is-loading");
        quickDealButton.setAttribute("aria-label", i18n.t("quickDealButton"));
        quickDealButton.setAttribute("title", i18n.t("quickDealButton"));
      }
    }, SHUFFLE_ANIMATION_DURATION);
  }

  function refreshTexts() {
    socket.emit("requestAllCardTexts", { language: i18n.language });
  }

  function updateCardText(cardId, text) {
    const card = cardElements.get(cardId) || document.getElementById(cardId);
    const back = card?.querySelector(".back");

    if (back) {
      back.textContent = formatCardText(text);
    }
  }

  function removeCard(cardId) {
    cardElements.get(cardId)?.remove();
    cardElements.delete(cardId);
    allCards = allCards.filter((card) => card.id !== cardId);
  }

  function bindCardClickHandler() {
    if (cardClickBound) {
      return;
    }

    document.addEventListener("click", (event) => {
      const card = event.target.closest?.(".card");

      if (!card) {
        return;
      }

      if (card.closest(".dropzone")) {
        socket.emit("requestFlipCard", { cardId: card.id });
        return;
      }

      showNotice(i18n.t("oneCardTitle"), i18n.t("oneCardMessage"));
    });
    cardClickBound = true;
  }

  bindCardClickHandler();

  return {
    applyBoardState,
    clearBoard,
    playShuffleThenReset,
    refreshTexts,
    removeCard,
    resetDeckElements,
    updateCardText,
  };
}

export { DECKS };
