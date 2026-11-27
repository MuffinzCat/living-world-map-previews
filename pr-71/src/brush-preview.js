import { renderBrushStroke } from "./map-renderer.js";
import { generateMountainSymbols } from "./terrain-generation.js";
import { generateForestSymbols } from "./forest-generation.js";

export function renderBrushPreview(layer, stroke, world) {
  layer.replaceChildren();
  renderBrushStroke(layer, stroke, "live-brush-stroke");
  if (stroke.type === "mountainRange" && world) {
    const previewWorld = { ...world, mountains: world.mountains.filter(item => !item.suppressed) };
    for (const mountain of generateMountainSymbols(previewWorld, stroke)) {
      const group = layer.ownerDocument.createElementNS(layer.namespaceURI, "g");
      group.setAttribute("class", "live-generated-mountain");
      group.setAttribute("transform", `translate(${mountain.x} ${mountain.y})`);
      const path = layer.ownerDocument.createElementNS(layer.namespaceURI, "path");
      path.setAttribute("d", `M ${-mountain.size / 2} ${mountain.size / 3} L 0 ${-mountain.size / 2} L ${mountain.size / 2} ${mountain.size / 3} Z`);
      path.setAttribute("fill", "#e5d3a5");
      path.setAttribute("stroke", "#806d56");
      path.setAttribute("stroke-width", "2");
      group.append(path);
      layer.append(group);
    }
  }
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
