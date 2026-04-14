export function initDragAndDrop(socket) {
  let draggedItem = null;

  function getDropzone(target) {
    return target.closest?.(".dropzone") || null;
  }

  document.addEventListener("dragstart", (event) => {
    if (!event.target.classList.contains("card")) {
      return;
    }

    draggedItem = event.target;
    draggedItem.classList.add("dragging");
  });

  document.addEventListener("dragover", (event) => {
    if (getDropzone(event.target)) {
      event.preventDefault();
    }
  });

  document.addEventListener("drop", (event) => {
    const dropzone = getDropzone(event.target);

    if (!draggedItem || !dropzone) {
      return;
    }

    event.preventDefault();
    socket.emit("requestCardMove", {
      cardId: draggedItem.id,
      deckId: draggedItem.dataset.deckId,
      newParentId: dropzone.id,
      targetDeckId: dropzone.dataset.deckId,
    });
  });

  document.addEventListener("dragend", () => {
    if (draggedItem) {
      draggedItem.classList.remove("dragging");
    }

    draggedItem = null;
  });
}
