import { renderBrushStroke } from "./map-renderer.js";
import { previewMountainLayout, removeUnsupportedMountedSymbols } from "./terrain-generation.js";
import { previewForestLayout, removeUnsupportedForestSymbols } from "./forest-generation.js";

export function renderBrushPreview(layer, stroke, world) {
  layer.replaceChildren();
  renderBrushStroke(layer, stroke, "live-brush-stroke");
  if (stroke.type === "mountainRange" && world) {
    for (const mountain of previewMountainLayout(world, stroke)) {
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
    for (const forest of previewForestLayout(world, stroke)) {
      const group = layer.ownerDocument.createElementNS(layer.namespaceURI, "g");
      group.setAttribute("class", "live-generated-tree");
      group.setAttribute("transform", `translate(${forest.x} ${forest.y})`);
      const path = layer.ownerDocument.createElementNS(layer.namespaceURI, "path");
      path.setAttribute("d", "M 0 -20 l -14 25 h 9 l -4 8 h 18 l -4 -8 h 9 Z");
      path.setAttribute("fill", "#4f6942");
      path.setAttribute("stroke", "#51402d");
      path.setAttribute("stroke-width", "1");
      group.append(path);
      layer.append(group);
    }
  }
  if (world) {
    const previewWorld = structuredClone(world);
    if (["land", "water"].includes(stroke.type)) {
      removeUnsupportedMountedSymbols(previewWorld, stroke);
      removeUnsupportedForestSymbols(previewWorld, stroke);
    }
    const suppressedIds = new Set(previewWorld.mountains.filter(item => item.suppressed).map(item => item.id));
    layer.ownerSVGElement?.querySelectorAll(".mountain-symbol[data-object-id]").forEach(node => {
      const mountain = world.mountains.find(item => item.id === node.dataset.objectId);
      node.setAttribute("visibility", mountain?.suppressed || suppressedIds.has(node.dataset.objectId) ? "hidden" : "visible");
    });
    const suppressedForestIds = new Set(previewWorld.forests.filter(item => item.suppressed).map(item => item.id));
    layer.ownerSVGElement?.querySelectorAll(".forest-object[data-object-id]").forEach(node => {
      const forest = world.forests.find(item => item.id === node.dataset.objectId);
      node.setAttribute("visibility", forest?.suppressed || suppressedForestIds.has(node.dataset.objectId) ? "hidden" : "visible");
    });
  }
}
