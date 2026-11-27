import { renderBrushStroke } from "./map-renderer.js";
import { generateForestSymbols } from "./forest-generation.js";

export function renderBrushPreview(layer, stroke, world) {
  layer.replaceChildren();
  renderBrushStroke(layer, stroke, "live-brush-stroke");
  if (stroke.type === "forest" && world) {
    const previewWorld = { ...world, forests: world.forests.filter(item => !item.suppressed) };
    for (const forest of generateForestSymbols(previewWorld, stroke)) {
      const group = layer.ownerDocument.createElementNS(layer.namespaceURI, "g");
      group.setAttribute("class", "live-generated-tree");
      group.setAttribute("transform", `translate(${forest.x} ${forest.y})`);
      const path = layer.ownerDocument.createElementNS(layer.namespaceURI, "path");
      path.setAttribute("d", "M 0 -20 l -14 25 h 9 l -4 8 h 18 l -4 -8 h 9 Z");
      path.setAttribute("fill", "#647854");
      path.setAttribute("stroke", "#51402d");
      path.setAttribute("stroke-width", "1");
      group.append(path);
      layer.append(group);
    }
  }
}
