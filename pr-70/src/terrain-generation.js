export function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

export function pointWithinBrush(point, stroke) {
  const radius = stroke.size / 2;
  if (stroke.points.length === 1) return Math.hypot(point[0] - stroke.points[0][0], point[1] - stroke.points[0][1]) <= radius;
  return stroke.points.slice(1).some((pointB, index) =>
    distanceToSegment(point, stroke.points[index], pointB) <= radius
  );
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function uniqueStrokeId(world, preferred) {
  if (preferred && !world.brushStrokes.some(stroke => stroke.id === preferred)) return preferred;
  const existing = new Set(world.brushStrokes.map(stroke => stroke.id).filter(Boolean));
  let index = 1;
  let id = preferred ? `${preferred}-${index}` : `stroke-${world.brushStrokes.length + 1}`;
  while (existing.has(id)) id = `${preferred ?? "stroke"}-${++index}`;
  return id;
}

export function generateMountainSymbols(world, stroke) {
  const random = randomFrom(hashString(`${stroke.id}:${JSON.stringify(stroke.points)}:${stroke.size}`));
  const candidates = [];
  const radius = Math.max(5, stroke.size / 2);
  const spacing = Math.max(18, radius * 0.75);

  if (stroke.points.length === 1) {
    const [x, y] = stroke.points[0];
    const count = Math.max(1, Math.min(18, Math.round(Math.PI * radius * radius / (spacing * spacing))));
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius * 0.82;
      candidates.push([x + Math.cos(angle) * distance, y + Math.sin(angle) * distance]);
    }
  } else {
    for (let segment = 0; segment < stroke.points.length - 1; segment += 1) {
      const a = stroke.points[segment];
      const b = stroke.points[segment + 1];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const count = Math.max(1, Math.ceil(length / spacing));
      for (let step = 0; step <= count; step += 1) {
        const ratio = count ? step / count : 0;
        const centerX = a[0] + (b[0] - a[0]) * ratio;
        const centerY = a[1] + (b[1] - a[1]) * ratio;
        const offsetAngle = random() * Math.PI * 2;
        const offsetDistance = random() * radius * 0.62;
        candidates.push([centerX + Math.cos(offsetAngle) * offsetDistance, centerY + Math.sin(offsetAngle) * offsetDistance]);
      }
    }
  }

  const used = world.mountains.filter(item => !item.suppressed);
  const accepted = [];
  for (const [x, y] of candidates) {
    if (!pointWithinBrush([x, y], stroke)) continue;
    if (used.some(item => Math.hypot(item.x - x, item.y - y) < spacing * 0.42)) continue;
    if (accepted.some(point => Math.hypot(point[0] - x, point[1] - y) < spacing * 0.42)) continue;
    accepted.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }

  return accepted.map(([x, y], index) => ({
    id: `mountain-${stroke.id}-${index + 1}`,
    x,
    y,
    size: Math.round((26 + random() * 12) * 10) / 10,
    sourceId: stroke.id,
    seed: hashString(`${stroke.id}:${index}`)
  }));
}

export function commitMountainStroke(world, stroke) {
  if (!stroke.id) stroke.id = uniqueStrokeId(world);
  if (!world.brushStrokes.some(item => item.id === stroke.id)) world.brushStrokes.push(stroke);
  const generated = generateMountainSymbols(world, stroke);
  const ids = new Set(world.mountains.map(item => item.id));
  for (const symbol of generated) {
    if (!ids.has(symbol.id)) {
      world.mountains.push(symbol);
      ids.add(symbol.id);
    }
  }
  return world;
}

export function removeUnsupportedMountedSymbols(world, replacementStroke) {
  if (!["land", "water"].includes(replacementStroke.type)) return;
  for (const symbol of world.mountains) {
    if (!symbol.sourceId || symbol.suppressed) continue;
    if (pointWithinBrush([symbol.x, symbol.y], replacementStroke)) symbol.suppressed = true;
  }
}
