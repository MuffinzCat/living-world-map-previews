import { addRoad, addRoadPoint, insertRoadPoint, moveRoadPoint, removeRoadPoint } from "./editor-actions.js";
import { hideToolOptions, showToolOptions } from "./tool-options.js";

const map = document.querySelector("#map");
const dataOutput = document.querySelector("#world-data");
const status = document.querySelector("#status");
const roadsButton = document.querySelector("#roads-mode");
const roadsControls = document.querySelector("#roads-controls");
const roadFrom = document.querySelector("#road-from");
const roadTo = document.querySelector("#road-to");
const createButton = document.querySelector("#create-road");
const cancelButton = document.querySelector("#cancel-road");
const editControls = document.querySelector("#road-edit-controls");
const addPointButton = document.querySelector("#add-road-point");
const removePointButton = document.querySelector("#remove-road-point");
let selectedRoadId = null;
let selectedPointIndex = null;
let bendGesture = null;

function worldData() {
  if (!dataOutput.value) return { settlements: [], roads: [] };
  try { return JSON.parse(dataOutput.value); }
  catch { return { settlements: [], roads: [] }; }
}
function refreshOptions() {
  const world = worldData();
  const fromValue = roadFrom.value;
  const toValue = roadTo.value;
  roadFrom.innerHTML = world.settlements.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  roadTo.innerHTML = world.settlements.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  if (fromValue && [...roadFrom.options].some(option => option.value === fromValue)) roadFrom.value = fromValue;
  if (toValue && [...roadTo.options].some(option => option.value === toValue)) roadTo.value = toValue;
  createButton.disabled = world.settlements.length < 2;
  if (!roadFrom.value && roadFrom.options.length) roadFrom.selectedIndex = 0;
  if (!roadTo.value && roadTo.options.length) roadTo.selectedIndex = roadTo.options.length > 1 ? 1 : 0;
}
function applyEdit(change, message) {
  const world = worldData();
  document.dispatchEvent(new CustomEvent("history-action-start"));
  change(world);
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  status.textContent = message;
  refreshOptions();
  refreshHandles();
}
function refreshHandles() {
  map.querySelectorAll(".road-edit-layer").forEach(node => node.remove());
  if (!selectedRoadId) {
    editControls.hidden = true;
    return;
  }
  const road = worldData().roads.find(item => item.id === selectedRoadId);
  if (!road) {
    selectedRoadId = null;
    selectedPointIndex = null;
    editControls.hidden = true;
    return;
  }
  editControls.hidden = false;
  removePointButton.disabled = selectedPointIndex === null;
  const layer = document.createElementNS(map.namespaceURI, "g");
  layer.setAttribute("class", "road-edit-layer");
  road.points.forEach((point, index) => {
    const handle = document.createElementNS(map.namespaceURI, "circle");
    handle.setAttribute("class", `road-bend-handle${selectedPointIndex === index ? " is-selected" : ""}`);
    handle.setAttribute("data-bend-index", String(index));
    handle.setAttribute("cx", point[0]);
    handle.setAttribute("cy", point[1]);
    handle.setAttribute("r", 7);
    layer.append(handle);
  });
  map.append(layer);
}
function updateRoadPath(world, road) {
  const settlements = new Map(world.settlements.map(item => [item.id, item]));
  const from = settlements.get(road.from);
  const to = settlements.get(road.to);
  if (!from || !to) return;
  const path = map.querySelector(`.road-layer [data-road-id="${CSS.escape(road.id)}"]`);
  const points = [[from.x, from.y], ...road.points, [to.x, to.y]];
  path?.setAttribute("d", points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" "));
}
function mapPoint(event) {
  const point = map.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(map.getScreenCTM().inverse());
  return [transformed.x, transformed.y];
}

function cancelRoad(message = "Road creation cancelled.") {
  selectedRoadId = null;
  selectedPointIndex = null;
  bendGesture = null;
  refreshHandles();
  hideToolOptions(roadsControls);
  document.querySelector('[data-mode="pan"]')?.click();
  status.textContent = message;
}

cancelButton.addEventListener("click", () => cancelRoad());
roadsButton.addEventListener("click", () => {
  document.querySelector('[data-mode="pan"]')?.click();
  showToolOptions(roadsControls, roadsButton);
});
createButton.addEventListener("click", () => {
  try {
    applyEdit(world => {
      selectedRoadId = addRoad(world, roadFrom.value, roadTo.value);
    }, "Road created.");
  } catch (error) {
    status.textContent = error.message;
  }
});
addPointButton.addEventListener("click", () => {
  if (!selectedRoadId) return;
  const world = worldData();
  const road = world.roads.find(item => item.id === selectedRoadId);
  const from = world.settlements.find(item => item.id === road?.from);
  const to = world.settlements.find(item => item.id === road?.to);
  if (!road || !from || !to) return;
  const point = road.points.length
    ? [(from.x + to.x) / 2 + 20, (from.y + to.y) / 2 + 20]
    : [(from.x + to.x) / 2, (from.y + to.y) / 2];
  applyEdit(world => {
    selectedPointIndex = addRoadPoint(world, selectedRoadId, point);
  }, "Road bend point added.");
});
removePointButton.addEventListener("click", () => {
  if (!selectedRoadId || selectedPointIndex === null) return;
  applyEdit(world => {
    removeRoadPoint(world, selectedRoadId, selectedPointIndex);
    selectedPointIndex = null;
  }, "Road bend point removed.");
});
document.addEventListener("road-selected", event => {
  selectedRoadId = event.detail.id;
  selectedPointIndex = null;
  refreshHandles();
  if (selectedRoadId) showToolOptions(roadsControls, roadsButton);
});
document.addEventListener("road-click", event => {
  if (event.detail.id !== selectedRoadId) return;
  applyEdit(world => {
    selectedPointIndex = insertRoadPoint(world, selectedRoadId, event.detail.point);
  }, "Road bend point added.");
});
document.addEventListener("world-data-changed", refreshOptions);
document.addEventListener("history-restore", () => {
  refreshOptions();
  refreshHandles();
});
document.querySelector("#load").addEventListener("click", () => setTimeout(refreshOptions));
document.querySelector("#apply-json").addEventListener("click", () => setTimeout(refreshOptions));

map.addEventListener("pointerdown", event => {
  const handle = event.composedPath().find(node => node instanceof Element && node.matches(".road-bend-handle"));
  if (!handle) return;
  const index = Number(handle.dataset.bendIndex);
  selectedPointIndex = index;
  bendGesture = { pointerId: event.pointerId, index };
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
  moveRoadPoint(world, selectedRoadId, bendGesture.index, [x, y]);
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  const road = world.roads.find(item => item.id === selectedRoadId);
  if (road) updateRoadPath(world, road);
  refreshHandles();
  const handle = map.querySelector(`.road-bend-handle[data-bend-index="${bendGesture.index}"]`);
  handle?.setAttribute("cx", x);
  handle?.setAttribute("cy", y);
});
function finishBend(event) {
  if (!bendGesture || bendGesture.pointerId !== event.pointerId) return;
  bendGesture = null;
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  status.textContent = "Road bend point moved.";
  refreshHandles();
}
map.addEventListener("pointerup", finishBend);
map.addEventListener("pointercancel", finishBend);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && isVisible()) {
    event.preventDefault();
    cancelRoad("Road operation cancelled.");
  }
});
document.addEventListener("tool-change", event => {
  if (event.detail.tool === "roads") return;
  if (selectedRoadId || selectedPointIndex !== null || bendGesture) {
    selectedRoadId = null;
    selectedPointIndex = null;
    bendGesture = null;
    refreshHandles();
  }
});
function isVisible() { return !roadsControls.hidden && !roadsControls.parentElement.hidden; }
refreshOptions();
