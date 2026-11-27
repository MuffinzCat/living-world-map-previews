import { createHistory } from "./history.js";

const limitStorageKey = "living-world-map-history-limit";
const dataOutput = document.querySelector("#world-data");
const map = document.querySelector("#map");
const applyButton = document.querySelector("#apply-json");
const status = document.querySelector("#status");
let undoButton;
let redoButton;
let limitInput;
let history;
let stateBeforeAction = null;
let restoring = false;

function currentState() { return dataOutput.value; }
function updateControls() {
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
  limitInput.value = String(history.limit);
}
function beginAction() {
  if (!history || restoring || stateBeforeAction !== null) return;
  stateBeforeAction = currentState();
}
function finishAction() {
  if (!history || restoring || stateBeforeAction === null) return;
  const before = stateBeforeAction;
  stateBeforeAction = null;
  if (before !== currentState()) history.commit(currentState());
  updateControls();
}
function restore(state, message) {
  if (state === null) return;
  const viewBox = map.getAttribute("viewBox");
  restoring = true;
  dataOutput.value = state;
  applyButton.click();
  map.setAttribute("viewBox", viewBox);
  map.dispatchEvent(new CustomEvent("history-view-restored", { detail: { viewBox } }));
  restoring = false;
  status.textContent = message;
  updateControls();
}
function historyIcon(path) {
  return `<svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}
function addControls() {
  document.querySelector("#undo-brush").remove();
  const zoomIn = document.querySelector("#zoom-in");
  zoomIn.insertAdjacentHTML("beforebegin", `<span class="history-controls"><button id="undo" class="icon-button" type="button" aria-label="Undo last edit" data-tooltip="Undo last edit" disabled>${historyIcon("M9 7H4v-5M4.6 7.3A8.5 8.5 0 1 1 6 18")}</button><button id="redo" class="icon-button" type="button" aria-label="Redo last edit" data-tooltip="Redo last edit" disabled>${historyIcon("M15 7h5v-5m-.6 5.3A8.5 8.5 0 1 0 18 18")}</button><label class="history-limit-control" for="history-limit">History <input id="history-limit" type="number" min="1" max="500" step="1" value="50" aria-label="Maximum undo history steps"></label></span>`);
  undoButton = document.querySelector("#undo");
  redoButton = document.querySelector("#redo");
  limitInput = document.querySelector("#history-limit");
}
function initialise() {
  addControls();
  history = createHistory(currentState(), localStorage.getItem(limitStorageKey) ?? "50");
  map.addEventListener("pointerdown", beginAction, true);
  map.addEventListener("pointerup", () => setTimeout(finishAction));
  map.addEventListener("pointercancel", () => setTimeout(finishAction));
  applyButton.addEventListener("click", () => { beginAction(); setTimeout(finishAction); }, true);
  document.querySelector("#load").addEventListener("click", () => { beginAction(); setTimeout(finishAction); }, true);
  undoButton.addEventListener("click", () => restore(history.undo(), "Undid last edit."));
  redoButton.addEventListener("click", () => restore(history.redo(), "Redid last edit."));
  limitInput.addEventListener("change", () => {
    const limit = history.setLimit(limitInput.value);
    localStorage.setItem(limitStorageKey, String(limit));
    updateControls();
    status.textContent = `Undo history limited to ${limit} steps.`;
  });
  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "z" && event.shiftKey) { event.preventDefault(); restore(history.redo(), "Redid last edit."); }
    else if (key === "z") { event.preventDefault(); restore(history.undo(), "Undid last edit."); }
    else if (key === "y") { event.preventDefault(); restore(history.redo(), "Redid last edit."); }
  });
  updateControls();
}

const ready = setInterval(() => {
  if (!currentState()) return;
  clearInterval(ready);
  initialise();
}, 10);
