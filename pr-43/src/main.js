import { renderBrushPreview } from "./brush-preview.js";
import { renderWorld } from "./map-renderer.js";
import { panView, zoomView } from "./view-maths.js";
import { loadWorld, serialiseWorld, validateWorld } from "./world-data.js";

const storageKey = "living-world-map";
const map = document.querySelector("#map");
const dataOutput = document.querySelector("#world-data");
const status = document.querySelector("#status");
const brushType = document.querySelector("#brush-type");
const brushSize = document.querySelector("#brush-size");
const brushSizeValue = document.querySelector("#brush-size-value");
const placementStatus = document.querySelector("#placement-status");
const cancelPlacementButton = document.querySelector("#cancel-placement");
const modeHelp = {
  select: "Move settlements: drag a settlement; connected roads follow.",
  pan: "Move map: drag empty map space. Use the wheel or buttons to zoom.",
  brush: "Brush: drag to paint. The outline shows the selected size."
};
let world;
let view;
let mode = "select";
let gesture = null;
let pendingPlacement = null;
let liveLayer;
let brushOutline;
let lastJSON = "";

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function setStatus(message) { status.textContent = message; }
function applyView() { map.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`); }
function resetView() { view = { x: 0, y: 0, width: world.canvas.width, height: world.canvas.height }; applyView(); }
function syncJSON() { dataOutput.value = serialiseWorld(world); lastJSON = dataOutput.value; }
function rounded([x, y]) { return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; }
function inside([x, y]) { return x >= 0 && y >= 0 && x <= world.canvas.width && y <= world.canvas.height; }
function mapPoint(event) { const point = map.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; const transformed = point.matrixTransform(map.getScreenCTM().inverse()); return rounded([transformed.x, transformed.y]); }
function mapElement(name) { return map.ownerDocument.createElementNS(map.namespaceURI, name); }
function makeInteractionLayer() { liveLayer = mapElement("g"); liveLayer.setAttribute("class", "live-brush-layer"); brushOutline = mapElement("circle"); brushOutline.setAttribute("class", "brush-outline"); brushOutline.setAttribute("visibility", "hidden"); map.append(liveLayer, brushOutline); }
function placeLiveBrushLayer() { const target = map.querySelector(".terrain-layer"); target.after(liveLayer); }
function refreshMap({ sync = true } = {}) { renderWorld(map, world); applyView(); makeInteractionLayer(); if (sync) syncJSON(); }
function updateOutline(point) { if (mode !== "brush" || !inside(point)) { brushOutline.setAttribute("visibility", "hidden"); return; } brushOutline.setAttribute("cx", point[0]); brushOutline.setAttribute("cy", point[1]); brushOutline.setAttribute("r", Number(brushSize.value) / 2); brushOutline.setAttribute("visibility", "visible"); }
function updatePlacementUI() {
  const kind = pendingPlacement?.kind;
  placementStatus.textContent = kind === "settlement" ? `Place settlement: ${pendingPlacement.name}` : kind === "mountain" ? "Place mountain" : "No feature awaiting placement";
  cancelPlacementButton.hidden = !kind;
  document.querySelectorAll("button[data-placement]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.placement === kind)));
}
function setMode(next) {
  if (next !== "placement" && pendingPlacement) { pendingPlacement = null; updatePlacementUI(); }
  mode = next;
  map.dataset.mode = mode;
  document.querySelectorAll("button[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  if (mode !== "brush") brushOutline.setAttribute("visibility", "hidden");
  if (mode !== "placement") setStatus(modeHelp[mode]);
}
function cancelPlacement(message = "Placement cancelled.") { if (!pendingPlacement) return; pendingPlacement = null; updatePlacementUI(); setMode("select"); setStatus(`${message} ${modeHelp.select}`); }
function ensureCurrentJSON() { return dataOutput.value === lastJSON || applyJSON(false); }
function applyJSON(reset = true) { try { world = validateWorld(JSON.parse(dataOutput.value)); pendingPlacement = null; updatePlacementUI(); syncJSON(); if (reset) resetView(); refreshMap(); setMode("select"); setStatus(`JSON applied. ${modeHelp.select}`); return true; } catch (error) { setStatus(`Could not apply JSON: ${error.message}`); return false; } }
function download(content, type, filename) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function updateRoads(settlement) { map.querySelectorAll(".road-layer line").forEach(line => { if (line.dataset.from === settlement.id) { line.setAttribute("x1", settlement.x); line.setAttribute("y1", settlement.y); } if (line.dataset.to === settlement.id) { line.setAttribute("x2", settlement.x); line.setAttribute("y2", settlement.y); } }); }
function settlementId(name) { const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "settlement"; let id = base; let suffix = 2; while (world.settlements.some(item => item.id === id)) id = `${base}-${suffix++}`; return id; }
function beginSettlementPlacement() { if (!ensureCurrentJSON()) return; const name = document.querySelector("#settlement-name").value.trim(); if (!name) { setStatus("Enter a settlement name before placing it."); return; } pendingPlacement = { kind: "settlement", name, type: document.querySelector("#settlement-type").value }; updatePlacementUI(); setMode("placement"); setStatus(`Click the map to place ${name}. Press Escape or Cancel placement to stop.`); }
function beginMountainPlacement() { if (!ensureCurrentJSON()) return; pendingPlacement = { kind: "mountain" }; updatePlacementUI(); setMode("placement"); setStatus("Click the map to place a mountain. Press Escape or Cancel placement to stop."); }
function completePlacement(point) {
  const placement = pendingPlacement;
  if (!placement) return;
  if (placement.kind === "settlement") world.settlements.push({ id: settlementId(placement.name), name: placement.name, type: placement.type, x: point[0], y: point[1] });
  else world.mountains.push({ x: point[0], y: point[1] });
  pendingPlacement = null;
  updatePlacementUI();
  refreshMap();
  setMode("select");
  setStatus(`${placement.kind === "settlement" ? "Settlement" : "Mountain"} added. ${modeHelp.select}`);
}

map.addEventListener("pointerdown", event => {
  if (event.button !== 0 || gesture || !ensureCurrentJSON()) return;
  const point = mapPoint(event);
  const settlementNode = event.target.closest(".settlement");
  if (mode === "placement" && inside(point)) { completePlacement(point); event.preventDefault(); return; }
  if (mode === "select" && settlementNode) { const settlement = world.settlements.find(item => item.id === settlementNode.dataset.id); gesture = { kind: "settlement", pointerId: event.pointerId, node: settlementNode, settlement, offset: [point[0] - settlement.x, point[1] - settlement.y] }; }
  else if (mode === "pan" && !settlementNode) gesture = { kind: "pan", pointerId: event.pointerId, startClient: { x: event.clientX, y: event.clientY }, startView: { ...view } };
  else if (mode === "brush" && inside(point)) { const stroke = { type: brushType.value, size: Number(brushSize.value), points: [point] }; gesture = { kind: "brush", pointerId: event.pointerId, stroke }; placeLiveBrushLayer(); renderBrushPreview(liveLayer, stroke); }
  else return;
  map.setPointerCapture(event.pointerId);
  event.preventDefault();
});
map.addEventListener("pointermove", event => { const point = mapPoint(event); updateOutline(point); if (!gesture || event.pointerId !== gesture.pointerId) return; if (gesture.kind === "pan") { const rect = map.getBoundingClientRect(); view = panView(gesture.startView, gesture.startClient, { x: event.clientX, y: event.clientY }, { width: rect.width, height: rect.height }); applyView(); } else if (gesture.kind === "settlement") { const [offsetX, offsetY] = gesture.offset; gesture.settlement.x = Math.round(clamp(point[0] - offsetX, 0, world.canvas.width) * 10) / 10; gesture.settlement.y = Math.round(clamp(point[1] - offsetY, 0, world.canvas.height) * 10) / 10; gesture.node.setAttribute("transform", `translate(${gesture.settlement.x} ${gesture.settlement.y})`); updateRoads(gesture.settlement); } else if (gesture.kind === "brush" && inside(point)) { const last = gesture.stroke.points.at(-1); if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= 2) { gesture.stroke.points.push(point); renderBrushPreview(liveLayer, gesture.stroke); } } });
function finishGesture(event) { if (!gesture || event.pointerId !== gesture.pointerId) return; const completed = gesture; gesture = null; if (completed.kind === "brush") world.brushStrokes.push(completed.stroke); if (completed.kind !== "pan") { syncJSON(); refreshMap(); } setStatus(`${completed.kind === "brush" ? "Brush stroke added." : completed.kind === "settlement" ? "Settlement moved." : "Map moved."} ${modeHelp[mode]}`); }
map.addEventListener("pointerup", finishGesture); map.addEventListener("pointercancel", finishGesture); map.addEventListener("pointerleave", () => { if (!gesture) brushOutline.setAttribute("visibility", "hidden"); });
map.addEventListener("wheel", event => { event.preventDefault(); const [x, y] = mapPoint(event); const factor = event.deltaY < 0 ? .85 : 1.15; const next = zoomView(view, factor, { x, y }); if (next.width >= world.canvas.width * .2 && next.width <= world.canvas.width * 5) { view = next; applyView(); } }, { passive: false });
document.addEventListener("keydown", event => { if (event.key === "Escape" && pendingPlacement) { event.preventDefault(); cancelPlacement(); } });
document.querySelectorAll("button[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
brushSize.addEventListener("input", () => { brushSizeValue.value = brushSize.value; brushSizeValue.textContent = brushSize.value; brushOutline.setAttribute("r", Number(brushSize.value) / 2); });
document.querySelector("#zoom-in").addEventListener("click", () => { view = zoomView(view, .8, { x: view.x + view.width / 2, y: view.y + view.height / 2 }); applyView(); }); document.querySelector("#zoom-out").addEventListener("click", () => { view = zoomView(view, 1.25, { x: view.x + view.width / 2, y: view.y + view.height / 2 }); applyView(); }); document.querySelector("#reset-view").addEventListener("click", resetView); document.querySelector("#apply-json").addEventListener("click", () => applyJSON(true));
document.querySelector("#undo-brush").addEventListener("click", () => { if (!ensureCurrentJSON()) return; if (!world.brushStrokes.length) { setStatus("There are no brush strokes to undo."); return; } world.brushStrokes.pop(); refreshMap(); setStatus("Last brush stroke undone."); });
document.querySelector("#add-settlement").addEventListener("click", beginSettlementPlacement);
document.querySelector("#add-mountain").addEventListener("click", beginMountainPlacement);
cancelPlacementButton.addEventListener("click", () => cancelPlacement());
document.querySelector("#save").addEventListener("click", () => { if (ensureCurrentJSON()) { localStorage.setItem(storageKey, serialiseWorld(world)); setStatus("World saved in this browser."); } });
document.querySelector("#load").addEventListener("click", () => { try { const saved = localStorage.getItem(storageKey); if (!saved) { setStatus("No saved world found."); return; } world = validateWorld(JSON.parse(saved)); pendingPlacement = null; updatePlacementUI(); resetView(); refreshMap(); setMode("select"); setStatus("Saved world loaded."); } catch (error) { setStatus(`Could not load saved world: ${error.message}`); } });
document.querySelector("#export-json").addEventListener("click", () => { if (ensureCurrentJSON()) download(serialiseWorld(world), "application/json", "world.json"); });
document.querySelector("#export-svg").addEventListener("click", () => { if (!ensureCurrentJSON()) return; const copy = map.cloneNode(true); copy.querySelectorAll(".live-brush-layer, .brush-outline").forEach(node => node.remove()); copy.setAttribute("viewBox", `0 0 ${world.canvas.width} ${world.canvas.height}`); copy.setAttribute("width", world.canvas.width); copy.setAttribute("height", world.canvas.height); download(new XMLSerializer().serializeToString(copy), "image/svg+xml", "world.svg"); });
try { world = await loadWorld("data/sample-world.json"); resetView(); refreshMap(); brushSizeValue.value = brushSize.value; updatePlacementUI(); setMode("select"); } catch (error) { console.error(error); setStatus(`Could not load the sample world: ${error.message}`); }
