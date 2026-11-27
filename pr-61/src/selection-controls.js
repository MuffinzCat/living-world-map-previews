import { showToolOptions } from "./tool-options.js";
import {
  SETTLEMENT_TYPES,
  addRoad,
  addRoadPoint,
  deleteObjects,
  duplicateObjects,
  editSettlement,
  moveRoadPoint,
  removeRoadPoint,
} from "./editor-actions.js";

const map = document.querySelector("#map");
const dataOutput = document.querySelector("#world-data");
const status = document.querySelector("#status");
const optionsToolbar = document.querySelector("#tool-options-toolbar");
const selectButton = document.querySelector('button[data-mode="select"]');
let selected = [];
let boxGesture = null;
let dragGesture = null;
let bendGesture = null;
let roadEditId = null;
let bendEditIndex = null;

const controls = document.createElement("div");
controls.id = "selection-controls";
controls.className = "tool-options-content selection-flyout";
controls.hidden = true;
controls.setAttribute("role", "group");
controls.setAttribute("aria-label", "Selection actions");
controls.innerHTML = `
  <strong id="selection-description">Select an object or drag a box</strong>
  <span id="settlement-edit" class="selection-edit" hidden>
    <label>Name <input id="selected-settlement-name" type="text"></label>
    <label>Type <select id="selected-settlement-type">${SETTLEMENT_TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select></label>
    <button id="apply-settlement-edit" type="button">Apply</button>
  </span>
  <span id="road-edit" class="selection-edit" hidden>
    <button id="add-road-point" type="button">Add bend</button>
    <button id="remove-road-point" type="button" disabled>Remove bend</button>
  </span>
  <span id="road-create" class="selection-edit">
    <label>From <select id="road-from"></select></label>
    <label>To <select id="road-to"></select></label>
    <button id="create-road" type="button">Create road</button>
    <button id="cancel-road" type="button">Cancel</button>
  </span>
  <button id="duplicate-selection" class="flyout-icon-button" type="button" aria-label="Duplicate selected objects" data-tooltip="Duplicate selected objects" disabled>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
  </button>
  <button id="delete-selection" class="flyout-icon-button" type="button" aria-label="Delete selected objects" data-tooltip="Delete selected objects" disabled>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg>
  </button>
  <button id="clear-selection" class="flyout-icon-button" type="button" aria-label="Clear selection" data-tooltip="Clear selection" disabled>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
  </button>`;
optionsToolbar.append(controls);

const description = controls.querySelector("#selection-description");
const settlementEdit = controls.querySelector("#settlement-edit");
const settlementName = controls.querySelector("#selected-settlement-name");
const settlementType = controls.querySelector("#selected-settlement-type");
const roadEdit = controls.querySelector("#road-edit");
const roadCreate = controls.querySelector("#road-create");
const roadFrom = controls.querySelector("#road-from");
const roadTo = controls.querySelector("#road-to");
const duplicateButton = controls.querySelector("#duplicate-selection");
const deleteButton = controls.querySelector("#delete-selection");
const clearButton = controls.querySelector("#clear-selection");
const removePointButton = controls.querySelector("#remove-road-point");

function worldData() {
  if (!dataOutput.value) return { settlements: [], mountains: [], forests: [], roads: [] };
  try { return JSON.parse(dataOutput.value); }
  catch { return { settlements: [], mountains: [], forests: [], roads: [] }; }
}
function unique(items) { return [...new Map(items.map(item => [`${item.kind}:${item.id}`, item])).values()]; }
function nodeFor(item) {
  if (item.kind === "settlement") return map.querySelector(`.settlement[data-id="${CSS.escape(item.id)}"]`);
  if (item.kind === "mountain") return map.querySelector(`.mountain-symbol[data-object-id="${CSS.escape(item.id)}"]`);
  if (item.kind === "forest") return map.querySelector(`.forest-object[data-object-id="${CSS.escape(item.id)}"]`);
  if (item.kind === "road") return map.querySelector(`.road-layer [data-road-id="${CSS.escape(item.id)}"]`);
  return null;
}
function settleSelections(world) {
  const ids = new Set(world.settlements.map(item => item.id));
  const mountainIds = new Set(world.mountains.map(item => item.id));
  const forestIds = new Set(world.forests.map(item => item.id));
  const roadIds = new Set(world.roads.map(item => item.id));
  selected = selected.filter(item =>
    (item.kind === "settlement" && ids.has(item.id)) ||
    (item.kind === "mountain" && mountainIds.has(item.id)) ||
    (item.kind === "forest" && forestIds.has(item.id)) ||
    (item.kind === "road" && roadIds.has(item.id))
  );
}
function refreshRoadOptions() {
  const world = worldData();
  const options = world.settlements.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  const fromValue = roadFrom.value;
  const toValue = roadTo.value;
  roadFrom.innerHTML = options;
  roadTo.innerHTML = options;
  if (fromValue) roadFrom.value = fromValue;
  if (toValue) roadTo.value = toValue;
}
function updateToolbar() {
  const count = selected.length;
  description.textContent = count ? `${count} object${count === 1 ? "" : "s"} selected` : "Select an object or drag a box";
  duplicateButton.disabled = !count;
  deleteButton.disabled = !count;
  clearButton.disabled = !count;
  const settlementTarget = count === 1 && selected[0].kind === "settlement" ? worldData().settlements.find(item => item.id === selected[0].id) : null;
  settlementEdit.hidden = !settlementTarget;
  if (settlementTarget) {
    settlementName.value = settlementTarget.name;
    if (SETTLEMENT_TYPES.includes(settlementTarget.type)) settlementType.value = settlementTarget.type;
  }
  roadEdit.hidden = !roadEditId;
  removePointButton.disabled = bendEditIndex === null;
  refreshRoadOptions();
}
function refreshSelection() {
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  settleSelections(worldData());
  selected.forEach(item => nodeFor(item)?.classList.add("is-selected"));
  refreshRoadHandles();
  updateToolbar();
}
function clearSelection(message) {
  selected = [];
  roadEditId = null;
  bendEditIndex = null;
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  refreshRoadHandles();
  updateToolbar();
  if (message) status.textContent = message;
}
function applyEdit(change, message) {
  const world = worldData();
  document.dispatchEvent(new CustomEvent("history-action-start"));
  change(world);
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  status.textContent = message;
  queueMicrotask(refreshSelection);
}
function deleteSelected() {
  if (!selected.length) return;
  const targets = [...selected];
  applyEdit(world => deleteObjects(world, targets), `${targets.length} object${targets.length === 1 ? "" : "s"} deleted.`);
  selected = [];
  roadEditId = null;
}
function duplicateSelected() {
  if (!selected.length) return;
  const targets = [...selected];
  let copied = [];
  applyEdit(world => { copied = duplicateObjects(world, targets, [20, 20]); }, `${targets.length} object${targets.length === 1 ? "" : "s"} duplicated.`);
  selected = copied;
}
function mapPoint(event) {
  const point = map.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(map.getScreenCTM().inverse());
  return [transformed.x, transformed.y];
}
function selectionFromTarget(event) {
  const path = event.composedPath();
  const settlement = path.find(node => node instanceof Element && node.matches(".settlement"));
  const mountain = path.find(node => node instanceof Element && node.matches(".mountain-symbol[data-object-id]"));
  const forest = path.find(node => node instanceof Element && node.matches(".forest-object[data-object-id]"));
  const road = path.find(node => node instanceof Element && node.matches(".road-layer [data-road-id]"));
  if (settlement) return { kind: "settlement", id: settlement.dataset.id };
  if (mountain) return { kind: "mountain", id: mountain.dataset.objectId };
  if (forest) return { kind: "forest", id: forest.dataset.objectId };
  if (road) return { kind: "road", id: road.dataset.roadId };
  return null;
}
function startBoxSelection(event) {
  const [x, y] = mapPoint(event);
  const rectangle = document.createElementNS(map.namespaceURI, "rect");
  rectangle.setAttribute("class", "selection-box");
  rectangle.setAttribute("x", x); rectangle.setAttribute("y", y);
  rectangle.setAttribute("width", 0); rectangle.setAttribute("height", 0);
  map.append(rectangle);
  boxGesture = { pointerId: event.pointerId, start: [x, y], rectangle };
  map.setPointerCapture(event.pointerId);
}
function updateBox(event) {
  if (!boxGesture || event.pointerId !== boxGesture.pointerId) return;
  const [x, y] = mapPoint(event);
  const [startX, startY] = boxGesture.start;
  boxGesture.rectangle.setAttribute("x", Math.min(startX, x));
  boxGesture.rectangle.setAttribute("y", Math.min(startY, y));
  boxGesture.rectangle.setAttribute("width", Math.abs(x - startX));
  boxGesture.rectangle.setAttribute("height", Math.abs(y - startY));
}
function finishBox(event) {
  if (!boxGesture || event.pointerId !== boxGesture.pointerId) return;
  const box = boxGesture.rectangle.getBBox();
  boxGesture.rectangle.remove();
  boxGesture = null;
  const hits = [];
  for (const node of map.querySelectorAll('.settlement, .mountain-symbol[data-object-id], .forest-object[data-object-id]')) {
    const bounds = node.getBBox();
    if (bounds.x <= box.x + box.width && bounds.x + bounds.width >= box.x && bounds.y <= box.y + box.height && bounds.y + bounds.height >= box.y) {
      if (node.matches(".settlement")) hits.push({ kind: "settlement", id: node.dataset.id });
      if (node.matches(".mountain-symbol")) hits.push({ kind: "mountain", id: node.dataset.objectId });
      if (node.matches(".forest-object")) hits.push({ kind: "forest", id: node.dataset.objectId });
    }
  }
  selected = unique(hits);
  refreshSelection();
  status.textContent = selected.length ? `${selected.length} objects selected.` : "Nothing selected.";
}
function startDrag(event, target) {
  if (event.shiftKey) return;
  if (!selected.some(item => item.kind === target.kind && item.id === target.id)) selected = [target];
  refreshSelection();
  const point = mapPoint(event);
  const world = worldData();
  const originals = selected.map(item => {
    const collection = item.kind === "settlement" ? "settlements" : item.kind === "mountain" ? "mountains" : item.kind === "forest" ? "forests" : null;
    const object = collection ? world[collection].find(value => value.id === item.id) : null;
    return object ? { item, object, x: object.x, y: object.y } : null;
  }).filter(Boolean);
  if (!originals.length) return;
  dragGesture = { pointerId: event.pointerId, start: point, originals };
  document.dispatchEvent(new CustomEvent("history-action-start"));
  map.setPointerCapture(event.pointerId);
}
function updateDrag(event) {
  if (!dragGesture || event.pointerId !== dragGesture.pointerId) return;
  const [x, y] = mapPoint(event);
  const dx = x - dragGesture.start[0];
  const dy = y - dragGesture.start[1];
  const world = worldData();
  for (const original of dragGesture.originals) {
    original.object.x = Math.round((original.x + dx) * 10) / 10;
    original.object.y = Math.round((original.y + dy) * 10) / 10;
    const node = nodeFor(original.item);
    node?.setAttribute("transform", `translate(${original.object.x} ${original.object.y})`);
  }
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  updateRoadPaths(world);
  refreshRoadHandles();
}
function finishDrag(event) {
  if (!dragGesture || event.pointerId !== dragGesture.pointerId) return;
  dragGesture = null;
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  status.textContent = "Selected objects moved.";
  refreshSelection();
}
function updateRoadPaths(world) {
  const settlements = new Map(world.settlements.map(item => [item.id, item]));
  for (const road of world.roads) {
    const from = settlements.get(road.from);
    const to = settlements.get(road.to);
    if (!from || !to) continue;
    const path = map.querySelector(`.road-layer [data-road-id="${CSS.escape(road.id)}"]`);
    const points = [[from.x, from.y], ...(road.points ?? []), [to.x, to.y]];
    path?.setAttribute("d", points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" "));
  }
}
function refreshRoadHandles() {
  map.querySelectorAll(".road-edit-layer").forEach(node => node.remove());
  if (!roadEditId) return;
  const world = worldData();
  const road = world.roads.find(item => item.id === roadEditId);
  if (!road) { roadEditId = null; return; }
  const layer = document.createElementNS(map.namespaceURI, "g");
  layer.setAttribute("class", "road-edit-layer");
  (road.points ?? []).forEach((point, index) => {
    const handle = document.createElementNS(map.namespaceURI, "circle");
    handle.setAttribute("class", `road-bend-handle${bendEditIndex === index ? " is-selected" : ""}`);
    handle.setAttribute("data-bend-index", String(index));
    handle.setAttribute("cx", point[0]); handle.setAttribute("cy", point[1]); handle.setAttribute("r", 7);
    layer.append(handle);
  });
  map.append(layer);
}
function startBendDrag(event, index) {
  bendGesture = { pointerId: event.pointerId, roadId: roadEditId, index };
  bendEditIndex = index;
  document.dispatchEvent(new CustomEvent("history-action-start"));
  map.setPointerCapture(event.pointerId);
  refreshRoadHandles();
}
function updateBendDrag(event) {
  if (!bendGesture || event.pointerId !== bendGesture.pointerId) return;
  const [x, y] = mapPoint(event);
  const world = worldData();
  moveRoadPoint(world, bendGesture.roadId, bendGesture.index, [x, y]);
  dataOutput.value = `${JSON.stringify(world, null, 2)}\n`;
  updateRoadPaths(world);
  refreshRoadHandles();
  const handle = map.querySelector(`.road-bend-handle[data-bend-index="${bendGesture.index}"]`);
  handle?.setAttribute("cx", x); handle?.setAttribute("cy", y);
}
function finishBendDrag(event) {
  if (!bendGesture || event.pointerId !== bendGesture.pointerId) return;
  bendGesture = null;
  document.dispatchEvent(new CustomEvent("history-action-finish"));
  document.dispatchEvent(new CustomEvent("history-restore", { detail: { state: dataOutput.value } }));
  status.textContent = "Road bend point moved.";
  refreshSelection();
}

map.addEventListener("pointerdown", event => {
  if (event.button !== 0 || map.dataset.mode !== "select") return;
  const handle = event.composedPath().find(node => node instanceof Element && node.matches(".road-bend-handle"));
  if (handle) {
    startBendDrag(event, Number(handle.dataset.bendIndex));
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const target = selectionFromTarget(event);
  if (target) {
    if (event.shiftKey) selected = unique([...selected, target]);
    else if (target.kind === "road") selected = [target];
    else selected = selected.some(item => item.kind === target.kind && item.id === target.id) ? selected : [target];
    if (target.kind === "road") { roadEditId = target.id; bendEditIndex = null; }
    else { roadEditId = null; bendEditIndex = null; }
    refreshSelection();
    if (target.kind !== "road" || event.shiftKey) startDrag(event, target);
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  clearSelection();
  startBoxSelection(event);
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
map.addEventListener("pointermove", event => { updateBox(event); updateDrag(event); updateBendDrag(event); }, true);
map.addEventListener("pointerup", event => { finishBox(event); finishDrag(event); finishBendDrag(event); }, true);
map.addEventListener("pointercancel", event => { finishBox(event); finishDrag(event); finishBendDrag(event); }, true);

selectButton.addEventListener("click", () => { showToolOptions(controls); refreshSelection(); });
document.addEventListener("click", event => {
  if (event.target.closest('button[data-mode="select"]')) {
    showToolOptions(controls);
    refreshSelection();
  }
});
duplicateButton.addEventListener("click", duplicateSelected);
deleteButton.addEventListener("click", deleteSelected);
clearButton.addEventListener("click", () => clearSelection("Selection cleared."));
controls.querySelector("#apply-settlement-edit").addEventListener("click", () => {
  if (selected.length !== 1 || selected[0].kind !== "settlement") return;
  try {
    applyEdit(world => editSettlement(world, selected[0].id, settlementName.value, settlementType.value), "Settlement updated.");
  } catch (error) { status.textContent = error.message; }
});
controls.querySelector("#create-road").addEventListener("click", () => {
  try {
    applyEdit(world => { roadEditId = addRoad(world, roadFrom.value, roadTo.value); }, "Road created.");
  } catch (error) { status.textContent = error.message; }
});
controls.querySelector("#cancel-road").addEventListener("click", () => {
  status.textContent = "Road creation cancelled.";
});
controls.querySelector("#add-road-point").addEventListener("click", () => {
  if (!roadEditId) return;
  const world = worldData();
  const road = world.roads.find(item => item.id === roadEditId);
  const from = world.settlements.find(item => item.id === road?.from);
  const to = world.settlements.find(item => item.id === road?.to);
  if (!road || !from || !to) return;
  const point = road.points.length
    ? [(from.x + to.x) / 2 + 20, (from.y + to.y) / 2 + 20]
    : [(from.x + to.x) / 2, (from.y + to.y) / 2];
  applyEdit(world => { bendEditIndex = addRoadPoint(world, roadEditId, point); }, "Road bend point added.");
});
removePointButton.addEventListener("click", () => {
  if (!roadEditId || bendEditIndex === null) return;
  applyEdit(world => { removeRoadPoint(world, roadEditId, bendEditIndex); bendEditIndex = null; }, "Road bend point removed.");
});
document.addEventListener("keydown", event => {
  const editingText = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
  if (editingText) return;
  if (event.key === "Escape" && selected.length) clearSelection("Selection cleared.");
  else if ((event.key === "Delete" || event.key === "Backspace") && selected.length) { event.preventDefault(); deleteSelected(); }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selected.length) { event.preventDefault(); duplicateSelected(); }
});
document.querySelector("#export-svg").addEventListener("click", () => {
  map.querySelectorAll(".is-selected, .selection-box, .road-edit-layer").forEach(node => node.classList.contains("is-selected") ? node.classList.remove("is-selected") : node.remove());
  setTimeout(refreshSelection);
}, true);
refreshRoadOptions();
updateToolbar();

const readyForWorld = setInterval(() => {
  if (!worldData().settlements.length) return;
  clearInterval(readyForWorld);
  refreshRoadOptions();
  updateToolbar();
}, 10);
