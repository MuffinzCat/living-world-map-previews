import { renderBrushStroke } from "./map-renderer.js";

export function renderBrushPreview(layer, stroke) {
  layer.replaceChildren();
  renderBrushStroke(layer, stroke, "live-brush-stroke");
}
