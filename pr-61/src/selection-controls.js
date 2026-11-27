const map = document.querySelector("#map");
const dataOutput = document.querySelector("#world-data");
const status = document.querySelector("#status");
const toolbar = document.querySelector(".mode-toolbar");
let selected = null;

const actions = document.createElement("span");
actions.className = "selection-actions";
actions.hidden = true;
actions.setAttribute("role", "group");
actions.setAttribute("aria-label", "Selected object actions");
actions.innerHTML = '<span id="selection-description"></span><button id="duplicate-selection" type="button">Duplicate</button><button id="delete-selection" type="button">Delete</button>';
toolbar.querySelector(".toolbar-spacer").before(actions);

const description = actions.querySelector("#selection-description");
const duplicateButton = actions.querySelector("#duplicate-selection");
const deleteButton = actions.querySelector("#delete-selection");

function worldData() { return JSON.parse(dataOutput.value); }
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
function selectedNode() {
  if (!selected) return null;
  if (selected.kind === "settlement") return map.querySelector(`.settlement[data-id="${CSS.escape(selected.id)}"]`);
  return map.querySelector(`.mountain-symbol[data-object-index="${selected.index}"]`);
}
function refreshSelection() {
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  decorateMountains();
  const node = selectedNode();
  if (!node) { clearSelection(); return; }
  node.classList.add("is-selected");
  actions.hidden = false;
  description.textContent = selected.kind === "settlement" ? "Settlement selected" : "Mountain selected";
}
function clearSelection() {
  selected = null;
  map.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  actions.hidden = true;
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
  if (!selected) return;
  const target = { ...selected };
  applyEdit(world => {
    if (target.kind === "settlement") {
      world.settlements = world.settlements.filter(item => item.id !== target.id);
      world.roads = world.roads.filter(road => road.from !== target.id && road.to !== target.id);
    } else world.mountains.splice(target.index, 1);
    selected = null;
  }, `${target.kind === "settlement" ? "Settlement" : "Mountain"} deleted.`);
}
function duplicateSelected() {
  if (!selected) return;
  const target = { ...selected };
  applyEdit(world => {
    if (target.kind === "settlement") {
      const original = world.settlements.find(item => item.id === target.id);
      if (!original) return;
      const copy = { ...original, id: uniqueSettlementId(world, original), name: `${original.name} copy`, x: original.x + 20, y: original.y + 20 };
      world.settlements.push(copy);
      selected = { kind: "settlement", id: copy.id };
    } else {
      const original = world.mountains[target.index];
      if (!original) return;
      world.mountains.push({ ...original, x: original.x + 20, y: original.y + 20 });
      selected = { kind: "mountain", index: world.mountains.length - 1 };
    }
  }, `${target.kind === "settlement" ? "Settlement" : "Mountain"} duplicated.`);
}

map.addEventListener("click", event => {
  if (map.dataset.mode !== "select") return;
  const settlement = event.target.closest(".settlement");
  const mountain = event.target.closest('.mountain-symbol[data-object-kind="mountain"]');
  if (settlement) selected = { kind: "settlement", id: settlement.dataset.id };
  else if (mountain) selected = { kind: "mountain", index: Number(mountain.dataset.objectIndex) };
  else { clearSelection(); return; }
  refreshSelection();
});
duplicateButton.addEventListener("click", duplicateSelected);
deleteButton.addEventListener("click", deleteSelected);
document.addEventListener("keydown", event => {
  const editingText = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
  if (editingText) return;
  if (event.key === "Escape" && selected) { clearSelection(); status.textContent = "Selection cleared."; }
  else if ((event.key === "Delete" || event.key === "Backspace") && selected) { event.preventDefault(); deleteSelected(); }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selected) { event.preventDefault(); duplicateSelected(); }
});
document.querySelector("#export-svg").addEventListener("click", () => {
  const node = selectedNode();
  node?.classList.remove("is-selected");
  setTimeout(refreshSelection);
}, true);
new MutationObserver(() => queueMicrotask(refreshSelection)).observe(map, { childList: true });
decorateMountains();
