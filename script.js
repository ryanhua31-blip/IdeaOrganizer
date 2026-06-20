const storageKey = "gatherboard-data-v1";
const colors = ["#1f8a83", "#d99b24", "#d65a45", "#7763c5", "#4d8d59"];
const labels = {
  note: "Random note",
  task: "Task list",
  board: "Whiteboard",
  link: "Reference"
};

const defaultData = {
  activeCategoryId: "daily",
  activeFilter: "all",
  categories: [
    {
      id: "daily",
      name: "Daily Work",
      color: colors[0],
      items: [
        {
          id: "item-1",
          type: "task",
          title: "Morning sweep",
          body: "Check inbox\nUpdate project tracker\nMove blockers into the right category"
        },
        {
          id: "item-2",
          type: "note",
          title: "Loose thought",
          body: "Anything that does not have a home yet can start here, then move into a better category later."
        }
      ]
    },
    {
      id: "ideas",
      name: "Brainstorming",
      color: colors[3],
      items: [
        {
          id: "item-3",
          type: "board",
          title: "Quarterly planning board",
          body: "Wins | Risks | Questions | Next experiments"
        },
        {
          id: "item-4",
          type: "link",
          title: "Useful reference",
          body: "Paste source notes, URLs, decisions, or handoff context here."
        }
      ]
    }
  ]
};

let data = loadData();

const categoryForm = document.querySelector("#categoryForm");
const categoryInput = document.querySelector("#categoryInput");
const categoryList = document.querySelector("#categoryList");
const activeCategoryName = document.querySelector("#activeCategoryName");
const renameCategoryButton = document.querySelector("#renameCategoryButton");
const deleteCategoryButton = document.querySelector("#deleteCategoryButton");
const itemForm = document.querySelector("#itemForm");
const itemType = document.querySelector("#itemType");
const itemTitle = document.querySelector("#itemTitle");
const itemBody = document.querySelector("#itemBody");
const itemGrid = document.querySelector("#itemGrid");
const filterButtons = document.querySelectorAll(".filter-button");
const categoryTemplate = document.querySelector("#categoryTemplate");
const itemTemplate = document.querySelector("#itemTemplate");
const boardModal = document.querySelector("#boardModal");
const boardModalTitle = document.querySelector("#boardModalTitle");
const closeBoardButton = document.querySelector("#closeBoardButton");
const clearBoardButton = document.querySelector("#clearBoardButton");
const saveBoardButton = document.querySelector("#saveBoardButton");
const eraserButton = document.querySelector("#eraserButton");
const boardCanvas = document.querySelector("#boardCanvas");
const brushSize = document.querySelector("#brushSize");
const swatches = document.querySelectorAll(".swatch");
const boardContext = boardCanvas.getContext("2d");

let activeBoardItem = null;
let isDrawing = false;
let brushColor = "#1f2933";
let isErasing = false;
let lastPoint = null;

function loadData() {
  const saved = localStorage.getItem(storageKey);

  if (!saved) {
    return structuredClone(defaultData);
  }

  try {
    const parsed = JSON.parse(saved);
    return parsed.categories?.length ? parsed : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getActiveCategory() {
  return data.categories.find((category) => category.id === data.activeCategoryId) || data.categories[0];
}

function render() {
  if (!data.categories.length) {
    data.categories.push({
      id: makeId("category"),
      name: "New Space",
      color: colors[0],
      items: []
    });
    data.activeCategoryId = data.categories[0].id;
  }

  renderCategories();
  renderItems();
  saveData();
}

function renderCategories() {
  categoryList.innerHTML = "";

  data.categories.forEach((category) => {
    const categoryNode = categoryTemplate.content.firstElementChild.cloneNode(true);
    categoryNode.classList.toggle("active", category.id === data.activeCategoryId);
    categoryNode.dataset.categoryId = category.id;
    categoryNode.querySelector(".category-color").style.background = category.color;
    categoryNode.querySelector(".category-name").textContent = category.name;
    categoryNode.querySelector(".category-count").textContent = category.items.length;

    categoryNode.addEventListener("click", () => {
      data.activeCategoryId = category.id;
      data.activeFilter = "all";
      setFilterButtons();
      render();
    });

    categoryList.append(categoryNode);
  });
}

function renderItems() {
  const category = getActiveCategory();
  activeCategoryName.textContent = category.name;
  itemGrid.innerHTML = "";

  const visibleItems = data.activeFilter === "all"
    ? category.items
    : category.items.filter((item) => item.type === data.activeFilter);

  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<strong>No items here yet.</strong><span>Add a note, task list, whiteboard, or reference to start shaping this space.</span>`;
    itemGrid.append(empty);
    return;
  }

  visibleItems.forEach((item) => {
    const itemNode = itemTemplate.content.firstElementChild.cloneNode(true);
    itemNode.classList.add(item.type);
    itemNode.querySelector(".type-pill").textContent = labels[item.type];
    itemNode.querySelector("h3").textContent = item.title;
    itemNode.querySelector(".item-body").textContent = item.body;
    renderCustomPanel(itemNode.querySelector(".custom-panel"), item, category);

    itemNode.querySelector(".delete-item").addEventListener("click", () => {
      category.items = category.items.filter((savedItem) => savedItem.id !== item.id);
      render();
    });

    itemNode.querySelector(".move-up").addEventListener("click", () => moveItem(category, item.id, -1));
    itemNode.querySelector(".move-down").addEventListener("click", () => moveItem(category, item.id, 1));

    itemGrid.append(itemNode);
  });
}

function renderCustomPanel(panel, item, category) {
  panel.innerHTML = "";

  if (item.type === "note") {
    const status = document.createElement("div");
    const button = document.createElement("button");
    status.className = "note-status";
    status.innerHTML = `<strong>${item.pinned ? "Pinned note" : "Regular note"}</strong>${item.pinned ? "This one stays visually marked as important." : "Pin this if it needs attention."}`;
    button.className = `custom-action${item.pinned ? " active" : ""}`;
    button.type = "button";
    button.textContent = item.pinned ? "Unpin note" : "Pin note";
    button.addEventListener("click", () => {
      item.pinned = !item.pinned;
      render();
    });
    panel.append(status, button);
  }

  if (item.type === "task") {
    const checklist = document.createElement("div");
    checklist.className = "checklist";
    const tasks = getLines(item.body);
    item.checkedTasks = item.checkedTasks || {};

    tasks.forEach((task, index) => {
      const id = `${item.id}-task-${index}`;
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      const text = document.createElement("span");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.checkedTasks[index]);
      checkbox.id = id;
      text.textContent = task;
      checkbox.addEventListener("change", () => {
        item.checkedTasks[index] = checkbox.checked;
        saveData();
      });
      label.append(checkbox, text);
      checklist.append(label);
    });

    panel.append(checklist);
  }

  if (item.type === "board") {
    const preview = document.createElement("div");
    const button = document.createElement("button");
    preview.className = "board-preview";
    preview.innerHTML = `<strong>${item.drawing ? "Saved sketch" : "Blank board"}</strong>${item.drawing ? "Open it to keep drawing." : "Open the board and draw with a simple pen."}`;

    if (item.drawing) {
      const image = document.createElement("img");
      image.src = item.drawing;
      image.alt = `${item.title} whiteboard preview`;
      preview.append(image);
    }

    button.className = "custom-action";
    button.type = "button";
    button.textContent = "Open board";
    button.addEventListener("click", () => openBoard(item, category));
    panel.append(preview, button);
  }

  if (item.type === "link") {
    const url = findFirstUrl(item.body);
    const preview = document.createElement("div");
    preview.className = "link-preview";
    preview.innerHTML = `<strong>${url ? getUrlLabel(url) : "Reference note"}</strong>${url ? url : "Add a URL in the details to turn this into a quick reference."}`;
    panel.append(preview);

    if (url) {
      const button = document.createElement("button");
      button.className = "custom-action";
      button.type = "button";
      button.textContent = "Open reference";
      button.addEventListener("click", () => window.open(url, "_blank", "noopener"));
      panel.append(button);
    }
  }
}

function getLines(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function findFirstUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : "";
}

function getUrlLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Reference link";
  }
}

function moveItem(category, itemId, direction) {
  const currentIndex = category.items.findIndex((item) => item.id === itemId);
  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= category.items.length) {
    return;
  }

  const [item] = category.items.splice(currentIndex, 1);
  category.items.splice(nextIndex, 0, item);
  render();
}

function setFilterButtons() {
  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === data.activeFilter);
  });
}

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryInput.value.trim();

  if (!name) {
    categoryInput.focus();
    return;
  }

  const category = {
    id: makeId("category"),
    name,
    color: colors[data.categories.length % colors.length],
    items: []
  };

  data.categories.push(category);
  data.activeCategoryId = category.id;
  data.activeFilter = "all";
  categoryInput.value = "";
  setFilterButtons();
  render();
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const category = getActiveCategory();
  const title = itemTitle.value.trim();
  const body = itemBody.value.trim();

  if (!title || !body) {
    (!title ? itemTitle : itemBody).focus();
    return;
  }

  category.items.unshift({
    id: makeId("item"),
    type: itemType.value,
    title,
    body,
    checkedTasks: itemType.value === "task" ? {} : undefined,
    pinned: false,
    drawing: ""
  });

  itemTitle.value = "";
  itemBody.value = "";
  render();
});

renameCategoryButton.addEventListener("click", () => {
  const category = getActiveCategory();
  const name = prompt("Rename this category", category.name);

  if (name && name.trim()) {
    category.name = name.trim();
    render();
  }
});

deleteCategoryButton.addEventListener("click", () => {
  const category = getActiveCategory();

  if (data.categories.length === 1) {
    alert("Keep at least one category so the organizer has somewhere to put things.");
    return;
  }

  const confirmed = confirm(`Delete "${category.name}" and everything inside it?`);

  if (!confirmed) {
    return;
  }

  data.categories = data.categories.filter((savedCategory) => savedCategory.id !== category.id);
  data.activeCategoryId = data.categories[0].id;
  data.activeFilter = "all";
  setFilterButtons();
  render();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    data.activeFilter = button.dataset.filter;
    setFilterButtons();
    renderItems();
    saveData();
  });
});

itemType.addEventListener("change", () => {
  const hints = {
    note: "Quick capture for thoughts that do not need structure yet.",
    task: "Each line can be a small action or follow-up.",
    board: "Use sections like Now, Next, Later, Risks, or Questions.",
    link: "Store URLs, source notes, decisions, and handoff details."
  };

  document.querySelector("#composerHint").textContent = hints[itemType.value];
});

function openBoard(item) {
  activeBoardItem = item;
  boardModalTitle.textContent = item.title;
  boardModal.hidden = false;
  resetCanvas();

  if (item.drawing) {
    const image = new Image();
    image.onload = () => boardContext.drawImage(image, 0, 0, boardCanvas.width, boardCanvas.height);
    image.src = item.drawing;
  }
}

function closeBoard() {
  boardModal.hidden = true;
  activeBoardItem = null;
  isDrawing = false;
}

function resetCanvas() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.fillStyle = "#ffffff";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
}

function getCanvasPoint(event) {
  const rect = boardCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (boardCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (boardCanvas.height / rect.height)
  };
}

function startDrawing(event) {
  isDrawing = true;
  lastPoint = getCanvasPoint(event);
}

function draw(event) {
  if (!isDrawing || !lastPoint) {
    return;
  }

  const nextPoint = getCanvasPoint(event);
  boardContext.lineCap = "round";
  boardContext.lineJoin = "round";
  boardContext.strokeStyle = isErasing ? "#ffffff" : brushColor;
  boardContext.lineWidth = Number(brushSize.value) * (isErasing ? 2.4 : 1);
  boardContext.beginPath();
  boardContext.moveTo(lastPoint.x, lastPoint.y);
  boardContext.lineTo(nextPoint.x, nextPoint.y);
  boardContext.stroke();
  lastPoint = nextPoint;
}

function stopDrawing() {
  isDrawing = false;
  lastPoint = null;
}

function saveBoard() {
  if (!activeBoardItem) {
    return;
  }

  activeBoardItem.drawing = boardCanvas.toDataURL("image/png");
  saveData();
  closeBoard();
  render();
}

boardCanvas.addEventListener("pointerdown", (event) => {
  boardCanvas.setPointerCapture(event.pointerId);
  startDrawing(event);
});
boardCanvas.addEventListener("pointermove", draw);
boardCanvas.addEventListener("pointerup", stopDrawing);
boardCanvas.addEventListener("pointercancel", stopDrawing);
closeBoardButton.addEventListener("click", closeBoard);
clearBoardButton.addEventListener("click", resetCanvas);
saveBoardButton.addEventListener("click", saveBoard);
boardModal.addEventListener("click", (event) => {
  if (event.target === boardModal) {
    closeBoard();
  }
});

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    brushColor = swatch.dataset.color;
    isErasing = false;
    eraserButton.classList.remove("active");
    swatches.forEach((button) => button.classList.toggle("active", button === swatch));
  });
});

eraserButton.addEventListener("click", () => {
  isErasing = !isErasing;
  eraserButton.classList.toggle("active", isErasing);

  if (isErasing) {
    swatches.forEach((button) => button.classList.remove("active"));
  } else {
    const matchingSwatch = [...swatches].find((swatch) => swatch.dataset.color === brushColor);
    matchingSwatch?.classList.add("active");
  }
});

setFilterButtons();
render();
