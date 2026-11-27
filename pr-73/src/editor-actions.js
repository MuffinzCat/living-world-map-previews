export const SETTLEMENT_TYPES = ["village", "town", "city", "castle"];

export function editSettlement(world, id, name, type) {
  const settlement = world.settlements.find(item => item.id === id);
  if (!settlement) throw new Error("The selected settlement no longer exists.");
  const nextName = name.trim();
  if (!nextName) throw new Error("Settlement name cannot be empty.");
  if (!SETTLEMENT_TYPES.includes(type)) throw new Error("Choose a valid settlement type.");
  settlement.name = nextName;
  settlement.type = type;
  return settlement;
}

export function deleteObjects(world, targets) {
  const settlementIds = new Set(targets.filter(item => item.kind === "settlement").map(item => item.id));
  const mountainIds = new Set(targets.filter(item => item.kind === "mountain").map(item => item.id));
  const forestIds = new Set(targets.filter(item => item.kind === "forest").map(item => item.id));
  const roadIds = new Set(targets.filter(item => item.kind === "road").map(item => item.id));
  const riverIds = new Set(targets.filter(item => item.kind === "river").map(item => item.id));
  world.settlements = world.settlements.filter(item => !settlementIds.has(item.id));
  for (const mountain of world.mountains) {
    if (mountainIds.has(mountain.id) && mountain.sourceId) mountain.suppressed = true;
  }
  world.mountains = world.mountains.filter(item => !mountainIds.has(item.id) || item.sourceId);
  for (const forest of world.forests) {
    if (forestIds.has(forest.id) && forest.sourceId) forest.suppressed = true;
  }
  world.forests = world.forests.filter(item => !forestIds.has(item.id) || item.sourceId);
  world.rivers = (world.rivers ?? []).filter(item => !riverIds.has(item.id));
  world.roads = world.roads.filter(item =>
    !roadIds.has(item.id) &&
    !settlementIds.has(item.from) &&
    !settlementIds.has(item.to)
  );
}

function uniqueId(world, prefix, originalId) {
  const base = `${originalId}-copy`;
  let id = base;
  let suffix = 2;
  const existing = new Set([
    ...world.settlements.map(item => item.id),
    ...world.mountains.map(item => item.id),
    ...world.forests.map(item => item.id),
    ...(world.rivers ?? []).map(item => item.id),
    ...world.roads.map(item => item.id),
  ]);
  while (existing.has(id)) id = `${base}-${suffix++}`;
  return id;
}

export function duplicateObjects(world, targets, offset = [20, 20]) {
  const copies = [];
  for (const target of targets) {
    if (target.kind === "settlement") {
      const original = world.settlements.find(item => item.id === target.id);
      if (!original) continue;
      const copy = {
        ...original,
        id: uniqueId(world, "settlement", original.id),
        name: `${original.name} copy`,
        x: original.x + offset[0],
        y: original.y + offset[1],
      };
      world.settlements.push(copy);
      copies.push({ kind: "settlement", id: copy.id });
    } else if (target.kind === "mountain") {
      const original = world.mountains.find(item => item.id === target.id);
      if (!original) continue;
      const copy = { ...original, id: uniqueId(world, "mountain", original.id), x: original.x + offset[0], y: original.y + offset[1] };
      delete copy.sourceId;
      delete copy.seed;
      delete copy.suppressed;
      world.mountains.push(copy);
      copies.push({ kind: "mountain", id: copy.id });
    } else if (target.kind === "forest") {
      const original = world.forests.find(item => item.id === target.id);
      if (!original) continue;
      const copy = { ...original, id: uniqueId(world, "forest", original.id), x: original.x + offset[0], y: original.y + offset[1] };
      delete copy.sourceId;
      delete copy.seed;
      delete copy.suppressed;
      world.forests.push(copy);
      copies.push({ kind: "forest", id: copy.id });
    } else if (target.kind === "river") {
      const original = world.rivers.find(item => item.id === target.id);
      if (!original) continue;
      const copy = {
        ...original,
        id: uniqueId(world, "river", original.id),
        points: (original.points ?? []).map(([x, y]) => [x + offset[0], y + offset[1]])
      };
      world.rivers.push(copy);
      copies.push({ kind: "river", id: copy.id });
    }
  }
  return copies;
}

export function addRiver(world, points) {
  if (!Array.isArray(points) || points.length < 2) throw new Error("A river needs at least two points.");
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
      throw new Error("River points must be finite [x, y] pairs.");
    }
  }
  world.rivers = world.rivers ?? [];
  let id = `river-${world.rivers.length + 1}`;
  const ids = new Set((world.rivers ?? []).map(item => item.id));
  let suffix = 2;
  while (ids.has(id)) id = `river-${world.rivers.length + 1}-${suffix++}`;
  const river = { id, points: points.map(point => [point[0], point[1]]) };
  world.rivers.push(river);
  return river;
}

export function addRiverPoint(world, riverId, point) {
  const river = world.rivers.find(item => item.id === riverId);
  if (!river) throw new Error("The selected river no longer exists.");
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error("River points must be finite [x, y] pairs.");
  river.points.push([point[0], point[1]]);
  return river.points.length - 1;
}

export function insertRiverPoint(world, riverId, point) {
  const river = world.rivers.find(item => item.id === riverId);
  if (!river) throw new Error("The selected river no longer exists.");
  let closestSegment = 0;
  let closestDistance = Infinity;
  for (let index = 0; index < river.points.length - 1; index += 1) {
    const [ax, ay] = river.points[index];
    const [bx, by] = river.points[index + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const parameter = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared)) : 0;
    const distance = Math.hypot(point[0] - (ax + parameter * dx), point[1] - (ay + parameter * dy));
    if (distance < closestDistance) {
      closestDistance = distance;
      closestSegment = index;
    }
  }
  river.points.splice(closestSegment + 1, 0, [point[0], point[1]]);
  return closestSegment + 1;
}

export function moveRiverPoint(world, riverId, index, point) {
  const river = world.rivers.find(item => item.id === riverId);
  if (!river || !river.points[index]) throw new Error("The river bend point no longer exists.");
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error("River points must be finite [x, y] pairs.");
  river.points[index] = [point[0], point[1]];
}

export function removeRiverPoint(world, riverId, index) {
  const river = world.rivers.find(item => item.id === riverId);
  if (!river || !river.points[index]) throw new Error("The river bend point no longer exists.");
  if (river.points.length <= 2) throw new Error("A river needs at least two points.");
  river.points.splice(index, 1);
}

export function addRoad(world, from, to) {
  if (from === to) throw new Error("A road cannot connect a settlement to itself.");
  if (!world.settlements.some(item => item.id === from) || !world.settlements.some(item => item.id === to)) {
    throw new Error("A road must use existing settlements.");
  }
  const duplicate = world.roads.some(item =>
    (item.from === from && item.to === to) || (item.from === to && item.to === from)
  );
  if (duplicate) throw new Error("A road already connects those settlements.");
  let id = `road-${world.roads.length + 1}`;
  const ids = new Set(world.roads.map(item => item.id));
  let suffix = 2;
  while (ids.has(id)) id = `road-${world.roads.length + 1}-${suffix++}`;
  world.roads.push({ id, from, to, points: [] });
  return id;
}

export function addRoadPoint(world, roadId, point) {
  const road = world.roads.find(item => item.id === roadId);
  if (!road) throw new Error("The selected road no longer exists.");
  road.points.push([point[0], point[1]]);
  return road.points.length - 1;
}

export function moveRoadPoint(world, roadId, index, point) {
  const road = world.roads.find(item => item.id === roadId);
  if (!road || !road.points[index]) throw new Error("The road bend point no longer exists.");
  road.points[index] = [point[0], point[1]];
}

export function removeRoadPoint(world, roadId, index) {
  const road = world.roads.find(item => item.id === roadId);
  if (!road || !road.points[index]) throw new Error("The road bend point no longer exists.");
  road.points.splice(index, 1);
}

export function insertRoadPoint(world, roadId, point) {
  const road = world.roads.find(item => item.id === roadId);
  if (!road) throw new Error("The selected road no longer exists.");
  const from = world.settlements.find(item => item.id === road.from);
  const to = world.settlements.find(item => item.id === road.to);
  if (!from || !to) throw new Error("The road endpoints no longer exist.");
  const path = [[from.x, from.y], ...(road.points ?? []), [to.x, to.y]];
  let closestSegment = 0;
  let closestDistance = Infinity;
  let closestParameter = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const [ax, ay] = path[index];
    const [bx, by] = path[index + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const parameter = lengthSquared
      ? Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared))
      : 0;
    const [projectX, projectY] = [ax + parameter * dx, ay + parameter * dy];
    const distance = Math.hypot(point[0] - projectX, point[1] - projectY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestSegment = index;
      closestParameter = parameter;
    }
  }
  const insertIndex = closestSegment;
  road.points.splice(insertIndex, 0, [point[0], point[1]]);
  return insertIndex;
}
