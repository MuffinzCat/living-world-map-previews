import { showToolOptions } from "./tool-options.js";

const map = document.querySelector("#map");
const dataOutput = document.querySelector("#world-data");
const status = document.querySelector("#status");
const optionsToolbar = document.querySelector("#tool-options-toolbar");
const selectButton = document.querySelector('button[data-mode="select"]');
let selected = [];
let boxGesture = null;

const selectionControls = document.createElement("div");
selectionControls.id = "selection-controls";
selectionControls.className = "tool-options-content selection-flyout";
selectionControls.hidden = true;
selectionControls.setAttribute("role", "group");
selectionControls.setAttribute("aria-label", "Selection actions");
selectionControls.innerHTML = `
  <strong id="selection-description">Select an object or drag a box</strong>
  <button id="duplicate-selection" class="flyout-icon-button" type="button" aria-label="Duplicate selected objects" data-tooltip="Duplicate selected objects" disabled>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
  </button>
  <button id="delete-selection" class="flyout-icon-button" type="button" aria-label="Delete selected objects" data-tooltip="Delete selected objects" disabled>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg>
  </button>
  <button id="clear-selection" class="flyout-icon-button" type="button" aria-label="Clear selection" data-tooltip="Clear selection" disabled>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
  </button>`;
optionsToolbar.append(selectionControls);

const description = selectionControls.querySelector("#selection-description");
const duplicateButton = selectionControls.querySelector("#duplicate-selection");
const deleteButton = selectionControls.querySelector("#delete-selection");
const clearButton = selectionControls.querySelector("#clear-selection");

function worldData() { return JSON.parse(dataOutput.value); }
function key(item) { return item.kind === "settlement" ? `settlement:${item.id}` : `mountain:${item.index}`; }
function unique(items) { return [...new Map(items.map(item => [key(item), item])).values()]; }
function manualMountainNodes(world) {
  const nodes = [...map.querySelectorAll(".mountain-layer > .mountain-symbol")];
  return nodes.slice(-world.mountains.length);
}
function decorateMountains() {
  if (!dataOutput.value) return;
  const world = worldData();
  manualMountainNodes(world).forEach((node, index) => {
    node.dataset.objectKind = "mountain";
    node.dataset.objectIndex = String(index);
  });
}
function nodeFor(item) {
  if (item.kind === "settlement") return map.querySelector(`.settlement[data-id="${CSS.escape(item.id)}"]`);
  return map.querySelector(`.mountain-symbol[data-object-index="${item.index}"]`);
}
function updateToolbar() {
  const count = selected.length;
  description.textContent = count ? `${count} object${count === 1 ? "" : "s"} selected` : "Select an object or drag a box";
  duplicateButton.disabled = !count;
  deleteButton.disabled = !count;
  clearButton.disabled = !count;
}
function refreshSelection() {
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  decorateMountains();
  selected = selected.filter(item => {
    const node = nodeFor(item);
    node?.classList.add("is-selected");
    return Boolean(node);
  });
  updateToolbar();
}
function clearSelection(message) {
  selected = [];
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
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
function uniqueSettlementId(world, original) {
  const base = `${original.id}-copy`;
  let id = base;
  let suffix = 2;
  while (world.settlements.some(item => item.id === id)) id = `${base}-${suffix++}`;
  return id;
}
function deleteSelected() {
  if (!selected.length) return;
  const targets = [...selected];
  applyEdit(world => {
    const settlementIds = new Set(targets.filter(item => item.kind === "settlement").map(item => item.id));
    const mountainIndexes = new Set(targets.filter(item => item.kind === "mountain").map(item => item.index));
    world.settlements = world.settlements.filter(item => !settlementIds.has(item.id));
    world.roads = world.roads.filter(road => !settlementIds.has(road.from) && !settlementIds.has(road.to));
    world.mountains = world.mountains.filter((_, index) => !mountainIndexes.has(index));
    selected = [];
  }, `${targets.length} object${targets.length === 1 ? "" : "s"} deleted.`);
}
function duplicateSelected() {
  if (!selected.length) return;
  const targets = [...selected];
  applyEdit(world => {
    const next = [];
    for (const target of targets) {
      if (target.kind === "settlement") {
        const original = world.settlements.find(item => item.id === target.id);
        if (!original) continue;
        const copy = { ...original, id: uniqueSettlementId(world, original), name: `${original.name} copy`, x: original.x + 20, y: original.y + 20 };
        world.settlements.push(copy);
        next.push({ kind: "settlement", id: copy.id });
      } else {
        const original = world.mountains[target.index];
        if (!original) continue;
        world.mountains.push({ ...original, x: original.x + 20, y: original.y + 20 });
        next.push({ kind: "mountain", index: world.mountains.length - 1 });
      }
    }
    selected = next;
  }, `${targets.length} object${targets.length === 1 ? "" : "s"} duplicated.`);
}
function mapPoint(event) {
  const point = map.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(map.getScreenCTM().inverse());
  return [transformed.x, transformed.y];
}
function selectionFromTarget(event) {
  decorateMountains();
  const path = event.composedPath();
  const settlement = path.find(node => node instanceof Element && node.matches(".settlement"));
  const mountain = path.find(node => node instanceof Element && node.matches('.mountain-symbol[data-object-kind="mountain"]'));
  if (settlement) return { kind: "settlement", id: settlement.dataset.id };
  if (mountain) return { kind: "mountain", index: Number(mountain.dataset.objectIndex) };
  return null;
}
function startBoxSelection(event) {
  const [x, y] = mapPoint(event);
  const rectangle = document.createElementNS(map.namespaceURI, "rect");
  rectangle.setAttribute("class", "selection-box");
  rectangle.setAttribute("x", x);
  rectangle.setAttribute("y", y);
  rectangle.setAttribute("width", 0);
  rectangle.setAttribute("height", 0);
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
  for (const node of map.querySelectorAll('.settlement, .mountain-symbol[data-object-kind="mountain"]')) {
    const bounds = node.getBBox();
    if (bounds.x <= box.x + box.width && bounds.x + bounds.width >= box.x && bounds.y <= box.y + box.height && bounds.y + bounds.height >= box.y) {
      if (node.matches(".settlement")) hits.push({ kind: "settlement", id: node.dataset.id });
      else hits.push({ kind: "mountain", index: Number(node.dataset.objectIndex) });
    }
  }
  selected = unique(hits);
  refreshSelection();
  status.textContent = selected.length ? `${selected.length} objects selected.` : "Nothing selected.";
}

map.addEventListener("pointerdown", event => {
  if (event.button !== 0 || map.dataset.mode !== "select") return;
  const target = selectionFromTarget(event);
  if (target) {
    selected = event.shiftKey ? unique([...selected, target]) : [target];
    refreshSelection();
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  clearSelection();
  startBoxSelection(event);
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
map.addEventListener("pointermove", updateBox, true);
map.addEventListener("pointerup", finishBox, true);
map.addEventListener("pointercancel", finishBox, true);
selectButton.addEventListener("click", () => { showToolOptions(selectionControls); refreshSelection(); });
duplicateButton.addEventListener("click", duplicateSelected);
deleteButton.addEventListener("click", deleteSelected);
clearButton.addEventListener("click", () => clearSelection("Selection cleared."));
document.addEventListener("keydown", event => {
  const editingText = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
  if (editingText) return;
  if (event.key === "Escape" && selected.length) clearSelection("Selection cleared.");
  else if ((event.key === "Delete" || event.key === "Backspace") && selected.length) { event.preventDefault(); deleteSelected(); }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selected.length) { event.preventDefault(); duplicateSelected(); }
});
document.querySelector("#export-svg").addEventListener("click", () => {
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  setTimeout(refreshSelection);
}, true);
new MutationObserver(() => queueMicrotask(refreshSelection)).observe(map, { childList: true });
decorateMountains();
updateToolbar();
