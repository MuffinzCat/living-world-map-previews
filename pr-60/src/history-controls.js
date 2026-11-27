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
  restoring = true;
  dataOutput.value = state;
  applyButton.click();
  restoring = false;
  status.textContent = message;
  updateControls();
}
function addControls() {
  const oldUndo = document.querySelector("#undo-brush");
  undoButton = oldUndo.cloneNode(false);
  undoButton.id = "undo";
  undoButton.disabled = true;
  undoButton.setAttribute("aria-label", "Undo last edit");
  undoButton.dataset.tooltip = "Undo last edit";
  undoButton.textContent = "Undo";
  oldUndo.replaceWith(undoButton);
  undoButton.insertAdjacentHTML("afterend", '<button id="redo" type="button" disabled>Redo</button><label for="history-limit">History</label><input id="history-limit" type="number" min="1" max="500" step="1" value="50" aria-label="Maximum undo history steps">');
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
