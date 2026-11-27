import {
  addRiverPoint,
  insertRiverPoint,
  moveRiverPoint,
  removeRiverPoint,
} from "./editor-actions.js";
import { hideToolOptions, showToolOptions } from "./tool-options.js";

const map = document.querySelector("#map");
const dataOutput = document.querySelector("#world-data");
const status = document.querySelector("#status");
const riverButton = document.querySelector("#river-mode");
const riverControls = document.querySelector("#river-controls");
const cancelButton = document.querySelector("#cancel-river");
const editControls = document.querySelector("#river-edit-controls");
const addPointButton = document.querySelector("#add-river-point");
const removePointButton = document.querySelector("#remove-river-point");
let selectedRiverId = null;
let selectedPointIndex = null;
let bendGesture = null;

function worldData() {
  try { return JSON.parse(dataOutput.value); }
  catch { return { rivers: [] }; }
}

function refreshHandles() {
  map.querySelectorAll(".river-edit-layer").forEach(node => node.remove());
  if (!selectedRiverId) {
    editControls.hidden = true;
    return;
  }
  const river = worldData().rivers.find(item => item.id === selectedRiverId);
  if (!river) {
    selectedRiverId = null;
    selectedPointIndex = null;
    editControls.hidden = true;
    return;
  }
  editControls.hidden = false;
  removePointButton.disabled = selectedPointIndex === null || river.points.length <= 2;
  const layer = document.createElementNS(map.namespaceURI, "g");
  layer.setAttribute("class", "river-edit-layer");
  river.points.forEach((point, index) => {
    const handle = document.createElementNS(map.namespaceURI, "circle");
    handle.setAttribute("class", `river-bend-handle${selectedPointIndex === index ? " is-selected" : ""}`);
    handle.setAttribute("data-bend-index", String(index));
    handle.setAttribute("cx", point[0]);
    handle.setAttribute("cy", point[1]);
    handle.setAttribute("r", 7);
    layer.append(handle);
  });
  map.append(layer);
}

function applyEdit(change, message) {
  const world = worldData();
  document.dispatchEvent(new CustomEvent("history-action-start"));
  change(world);
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  status.textContent = message;
  refreshHandles();
}

function updateRiverPath(world, river) {
  const path = map.querySelector(`.river-path[data-river-id="${CSS.escape(river.id)}"]`);
  path?.setAttribute("d", river.points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" "));
}

function mapPoint(event) {
  const point = map.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(map.getScreenCTM().inverse());
  return [transformed.x, transformed.y];
}

function cancelRiver(message = "River operation cancelled.") {
  selectedRiverId = null;
  selectedPointIndex = null;
  bendGesture = null;
  refreshHandles();
  hideToolOptions(riverControls);
  document.querySelector('[data-mode="pan"]')?.click();
  status.textContent = message;
}

riverButton.addEventListener("click", () => showToolOptions(riverControls, riverButton));
cancelButton.addEventListener("click", () => cancelRiver());

addPointButton.addEventListener("click", () => {
  if (!selectedRiverId) return;
  const world = worldData();
  const river = world.rivers.find(item => item.id === selectedRiverId);
  if (!river || river.points.length < 2) return;
  const middle = Math.floor(river.points.length / 2);
  const [ax, ay] = river.points[middle - 1];
  const [bx, by] = river.points[middle];
  applyEdit(value => {
    selectedPointIndex = insertRiverPoint(value, selectedRiverId, [(ax + bx) / 2, (ay + by) / 2]);
  }, "River bend point added.");
});

removePointButton.addEventListener("click", () => {
  if (!selectedRiverId || selectedPointIndex === null) return;
  applyEdit(world => {
    removeRiverPoint(world, selectedRiverId, selectedPointIndex);
    selectedPointIndex = null;
  }, "River bend point removed.");
});

document.addEventListener("river-selected", event => {
  selectedRiverId = event.detail.id;
  selectedPointIndex = null;
  refreshHandles();
  if (selectedRiverId) showToolOptions(riverControls, riverButton);
});

document.addEventListener("river-click", event => {
  if (event.detail.id !== selectedRiverId) return;
  applyEdit(world => {
    selectedPointIndex = insertRiverPoint(world, selectedRiverId, event.detail.point);
  }, "River bend point added.");
});

document.addEventListener("history-restore", refreshHandles);
document.addEventListener("world-data-changed", refreshHandles);

map.addEventListener("pointerdown", event => {
  const handle = event.composedPath().find(node => node instanceof Element && node.matches(".river-bend-handle"));
  if (!handle) return;
  bendGesture = { pointerId: event.pointerId, index: Number(handle.dataset.bendIndex) };
  selectedPointIndex = bendGesture.index;
  document.dispatchEvent(new CustomEvent("history-action-start"));
  map.setPointerCapture(event.pointerId);
  refreshHandles();
  event.preventDefault();
  event.stopPropagation();
}, true);

map.addEventListener("pointermove", event => {
  if (!bendGesture || bendGesture.pointerId !== event.pointerId) return;
  const world = worldData();
  const [x, y] = mapPoint(event);
  moveRiverPoint(world, selectedRiverId, bendGesture.index, [x, y]);
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  updateRiverPath(world, world.rivers.find(item => item.id === selectedRiverId));
  refreshHandles();
  const handle = map.querySelector(`.river-bend-handle[data-bend-index="${bendGesture.index}"]`);
  handle?.setAttribute("cx", x);
  handle?.setAttribute("cy", y);
});

function finishBend(event) {
  if (!bendGesture || bendGesture.pointerId !== event.pointerId) return;
  bendGesture = null;
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  status.textContent = "River bend point moved.";
  refreshHandles();
}

map.addEventListener("pointerup", finishBend);
map.addEventListener("pointercancel", finishBend);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !riverControls.hidden) {
    event.preventDefault();
    cancelRiver();
  }
});
