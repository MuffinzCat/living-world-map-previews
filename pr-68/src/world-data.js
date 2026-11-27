export const CURRENT_FORMAT_VERSION = 2;

export const DEFAULT_INITIAL_VIEW = Object.freeze({ x: -600, y: -400, width: 1200, height: 800 });
export const DEFAULT_SVG_PADDING = 80;

const COLLECTIONS = [
  "terrain",
  "settlements",
  "roads",
  "rivers",
  "forests",
  "mountains",
  "mountainRanges",
  "brushStrokes"
];
const TERRAIN_TYPES = new Set(["land", "water"]);
const BRUSH_TYPES = new Set(["land", "water", "mountainRange"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function canonicalType(type) {
  if (type === "mountain_range") return "mountainRange";
  return type;
}

function emptyWorld(source = {}) {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    canvas: clone(source.canvas ?? { width: 1200, height: 800 }),
    bounds: clone(source.bounds ?? null),
    initialView: clone(source.initialView ?? DEFAULT_INITIAL_VIEW),
    terrain: [],
    settlements: clone(source.settlements ?? []),
    roads: clone(source.roads ?? []),
    rivers: clone(source.rivers ?? []),
    forests: clone(source.forests ?? []),
    mountains: clone(source.mountains ?? []),
    mountainRanges: clone(source.mountainRanges ?? source.mountain_ranges ?? []),
    brushStrokes: clone(source.brushStrokes ?? source.brush_strokes ?? []),
    notes: typeof source.notes === "string" ? source.notes : ""
  };
}

function stableId(prefix, item, index, used) {
  if (typeof item.id === "string" && item.id.trim() && !used.has(item.id)) {
    used.add(item.id);
    return item.id;
  }
  let id = `${prefix}-${index + 1}`;
  let suffix = 2;
  while (used.has(id)) id = `${prefix}-${index + 1}-${suffix++}`;
  used.add(id);
  return id;
}

function migrateObjectIds(world) {
  for (const collection of ["mountains", "forests"]) {
    const used = new Set();
    world[collection] = world[collection].map((item, index) => {
      if (!isRecord(item)) return item;
      return { ...item, id: stableId(collection === "mountains" ? "mountain" : "forest", item, index, used) };
    });
  }

  const roadIds = new Set();
  world.roads = world.roads.map((road, index) => {
    if (!isRecord(road)) return road;
    let id = road.id;
    if (typeof id !== "string" || !id.trim() || roadIds.has(id)) id = `road-${index + 1}`;
    let suffix = 2;
    while (roadIds.has(id)) id = `road-${index + 1}-${suffix++}`;
    roadIds.add(id);
    const points = Array.isArray(road.points) ? clone(road.points) : [];
    return { ...road, id, points };
  });
}

function includePoint(bounds, point) {
  if (!Array.isArray(point) || point.length !== 2) return bounds;
  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return bounds;
  if (!bounds) return { left: x, top: y, right: x, bottom: y };
  return {
    left: Math.min(bounds.left, x),
    top: Math.min(bounds.top, y),
    right: Math.max(bounds.right, x),
    bottom: Math.max(bounds.bottom, y)
  };
}

export function calculateAuthoredBounds(world) {
  let bounds = null;
  for (const item of world.settlements ?? []) bounds = includePoint(bounds, [item?.x, item?.y]);
  for (const item of world.forests ?? []) bounds = includePoint(bounds, [item?.x, item?.y]);
  for (const item of world.mountains ?? []) bounds = includePoint(bounds, [item?.x, item?.y]);
  for (const collection of ["terrain", "rivers", "mountainRanges", "brushStrokes"]) {
    for (const item of world[collection] ?? []) {
      for (const point of item?.points ?? []) bounds = includePoint(bounds, point);
    }
  }
  for (const road of world.roads ?? []) {
    for (const point of road?.points ?? []) bounds = includePoint(bounds, point);
  }
  return bounds;
}

export function expandAuthoredBounds(world) {
  const calculated = calculateAuthoredBounds(world);
  if (!calculated) return world.bounds ?? null;
  const existing = world.bounds;
  if (!existing) return calculated;
  return {
    left: Math.min(existing.left, calculated.left),
    top: Math.min(existing.top, calculated.top),
    right: Math.max(existing.right, calculated.right),
    bottom: Math.max(existing.bottom, calculated.bottom)
  };
}

export function exportWorldBounds(world, padding = DEFAULT_SVG_PADDING) {
  const safePadding = Number.isFinite(padding) && padding >= 0 ? padding : DEFAULT_SVG_PADDING;
  const bounds = world.bounds ?? calculateAuthoredBounds(world);
  if (!bounds) return { x: DEFAULT_INITIAL_VIEW.x, y: DEFAULT_INITIAL_VIEW.y, width: DEFAULT_INITIAL_VIEW.width, height: DEFAULT_INITIAL_VIEW.height };
  return {
    x: bounds.left - safePadding,
    y: bounds.top - safePadding,
    width: Math.max(1, bounds.right - bounds.left + safePadding * 2),
    height: Math.max(1, bounds.bottom - bounds.top + safePadding * 2)
  };
}

function migrateTerrainEntry(entry, world) {
  if (!isRecord(entry)) {
    world.terrain.push(clone(entry));
    return;
  }

  const type = canonicalType(entry.type);
  const migrated = { ...clone(entry), type };

  if (TERRAIN_TYPES.has(type) && Array.isArray(entry.points)) {
    const looksLikeBrush = entry.size !== undefined || entry.brush === true || entry.kind === "brush";
    if (looksLikeBrush) world.brushStrokes.push(migrated);
    else world.terrain.push(migrated);
    return;
  }
  if (type === "river") {
    delete migrated.type;
    world.rivers.push(migrated);
    return;
  }
  if (type === "forest") {
    delete migrated.type;
    world.forests.push(migrated);
    return;
  }
  if (type === "mountain") {
    delete migrated.type;
    world.mountains.push(migrated);
    return;
  }
  if (type === "mountainRange") {
    delete migrated.type;
    if (entry.size !== undefined || entry.brush === true || entry.kind === "brush") {
      world.brushStrokes.push({ ...migrated, type: "mountainRange" });
    } else {
      world.mountainRanges.push(migrated);
    }
    return;
  }

  world.terrain.push(migrated);
}

export function migrateWorld(input) {
  if (!isRecord(input)) throw new TypeError("World data must be an object.");
  if (input.formatVersion !== undefined && ![1, 2].includes(input.formatVersion)) {
    throw new Error(`Unsupported world format version: ${input.formatVersion}`);
  }

  const world = emptyWorld(input);
  for (const entry of input.terrain ?? []) migrateTerrainEntry(entry, world);
  migrateObjectIds(world);
  world.mountainRanges = world.mountainRanges.map(item => ({ ...item, type: undefined })).map(({ type, ...item }) => item);
  world.brushStrokes = world.brushStrokes.map(stroke => ({ ...stroke, type: canonicalType(stroke?.type) }));
  const strokeIds = new Set();
  world.brushStrokes = world.brushStrokes.map((stroke, index) => {
    let id = typeof stroke.id === "string" && stroke.id.trim() ? stroke.id : `stroke-${index + 1}`;
    let suffix = 2;
    while (strokeIds.has(id)) id = `stroke-${index + 1}-${suffix++}`;
    strokeIds.add(id);
    return { ...stroke, id };
  });

  if (input.formatVersion === undefined || input.formatVersion === 1) {
    const canvas = input.canvas;
    if (isRecord(canvas) && Number.isFinite(canvas.width) && Number.isFinite(canvas.height) && canvas.width > 0 && canvas.height > 0) {
      world.bounds = { left: 0, top: 0, right: canvas.width, bottom: canvas.height };
      world.initialView = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    } else {
      world.bounds = calculateAuthoredBounds(world);
      world.initialView = clone(DEFAULT_INITIAL_VIEW);
    }
  } else {
    world.bounds = isRecord(input.bounds) ? clone(input.bounds) : calculateAuthoredBounds(world);
    world.initialView = isRecord(input.initialView) ? clone(input.initialView) : clone(DEFAULT_INITIAL_VIEW);
  }
  world.bounds = expandAuthoredBounds(world);
  return world;
}

function requireRecord(value, path) {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
}

function requireString(value, path, { allowEmpty = true } = {}) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`${path} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
}

function requireFinite(value, path, { positive = false } = {}) {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    throw new Error(`${path} must be ${positive ? "a positive" : "a finite"} number.`);
  }
}

function validatePoint(point, path) {
  if (!Array.isArray(point) || point.length !== 2) throw new Error(`${path} must be an [x, y] pair.`);
  requireFinite(point[0], `${path}[0]`);
  requireFinite(point[1], `${path}[1]`);
}

function validatePoints(points, path) {
  if (!Array.isArray(points) || points.length === 0) throw new Error(`${path} must be a non-empty point array.`);
  points.forEach((point, index) => validatePoint(point, `${path}[${index}]`));
}

function validatePosition(item, path) {
  requireRecord(item, path);
  requireFinite(item.x, `${path}.x`);
  requireFinite(item.y, `${path}.y`);
}

function validateBounds(bounds, path) {
  if (bounds === null) return;
  requireRecord(bounds, path);
  for (const key of ["left", "top", "right", "bottom"]) requireFinite(bounds[key], `${path}.${key}`);
  if (bounds.right < bounds.left) throw new Error(`${path}.right must be greater than or equal to ${path}.left.`);
  if (bounds.bottom < bounds.top) throw new Error(`${path}.bottom must be greater than or equal to ${path}.top.`);
}

function validateView(view, path) {
  requireRecord(view, path);
  requireFinite(view.x, `${path}.x`);
  requireFinite(view.y, `${path}.y`);
  requireFinite(view.width, `${path}.width`, { positive: true });
  requireFinite(view.height, `${path}.height`, { positive: true });
}

export function validateWorld(input) {
  const world = migrateWorld(input);
  requireRecord(world.canvas, "canvas");
  requireFinite(world.canvas.width, "canvas.width", { positive: true });
  requireFinite(world.canvas.height, "canvas.height", { positive: true });
  requireString(world.notes, "notes");
  validateBounds(world.bounds, "bounds");
  validateView(world.initialView, "initialView");

  for (const key of COLLECTIONS) {
    if (!Array.isArray(world[key])) throw new Error(`${key} must be an array.`);
  }

  world.terrain.forEach((item, index) => {
    const path = `terrain[${index}]`;
    requireRecord(item, path);
    if (!TERRAIN_TYPES.has(item.type)) throw new Error(`${path}.type must be land or water.`);
    validatePoints(item.points, `${path}.points`);
  });

  const settlementIds = new Set();
  world.settlements.forEach((item, index) => {
    const path = `settlements[${index}]`;
    validatePosition(item, path);
    requireString(item.id, `${path}.id`, { allowEmpty: false });
    requireString(item.name, `${path}.name`, { allowEmpty: false });
    requireString(item.type, `${path}.type`, { allowEmpty: false });
    if (settlementIds.has(item.id)) throw new Error(`${path}.id must be unique.`);
    settlementIds.add(item.id);
  });

  const roadIds = new Set();
  const roadPairs = new Set();
  world.roads.forEach((item, index) => {
    const path = `roads[${index}]`;
    requireRecord(item, path);
    requireString(item.id, `${path}.id`, { allowEmpty: false });
    if (roadIds.has(item.id)) throw new Error(`${path}.id must be unique.`);
    roadIds.add(item.id);
    requireString(item.from, `${path}.from`, { allowEmpty: false });
    requireString(item.to, `${path}.to`, { allowEmpty: false });
    if (!Array.isArray(item.points)) throw new Error(`${path}.points must be an array.`);
    item.points.forEach((point, pointIndex) => validatePoint(point, `${path}.points[${pointIndex}]`));
    if (!settlementIds.has(item.from) || !settlementIds.has(item.to)) {
      throw new Error(`${path} must connect existing settlement IDs.`);
    }
    if (item.from === item.to) throw new Error(`${path} cannot connect a settlement to itself.`);
    const pair = [item.from, item.to].sort().join("\u0000");
    if (roadPairs.has(pair)) throw new Error(`${path} duplicates an existing road connection.`);
    roadPairs.add(pair);
  });

  world.rivers.forEach((item, index) => {
    requireRecord(item, `rivers[${index}]`);
    validatePoints(item.points, `rivers[${index}].points`);
  });
  for (const [collection, prefix] of [["forests", "forest"], ["mountains", "mountain"]]) {
    const ids = new Set();
    world[collection].forEach((item, index) => {
      const path = `${collection}[${index}]`;
      validatePosition(item, path);
      requireString(item.id, `${path}.id`, { allowEmpty: false });
      if (ids.has(item.id)) throw new Error(`${path}.id must be unique.`);
      ids.add(item.id);
      if (item.size !== undefined) requireFinite(item.size, `${path}.size`, { positive: true });
      if (item.seed !== undefined) {
        requireFinite(item.seed, `${path}.seed`);
        if (!Number.isInteger(item.seed) || item.seed < 0) throw new Error(`${path}.seed must be a non-negative integer.`);
      }
      if (item.sourceId !== undefined) requireString(item.sourceId, `${path}.sourceId`, { allowEmpty: false });
      if (item.suppressed !== undefined && typeof item.suppressed !== "boolean") throw new Error(`${path}.suppressed must be a boolean.`);
    });
  }
  world.mountainRanges.forEach((item, index) => {
    const path = `mountainRanges[${index}]`;
    requireRecord(item, path);
    validatePoints(item.points, `${path}.points`);
    if (item.size !== undefined) requireFinite(item.size, `${path}.size`, { positive: true });
  });
  world.brushStrokes.forEach((item, index) => {
    const path = `brushStrokes[${index}]`;
    requireRecord(item, path);
    requireString(item.id, `${path}.id`, { allowEmpty: false });
    if (!BRUSH_TYPES.has(item.type)) throw new Error(`${path}.type is not supported.`);
    requireFinite(item.size, `${path}.size`, { positive: true });
    validatePoints(item.points, `${path}.points`);
  });
  const sourceIds = new Set(world.brushStrokes.map(stroke => stroke.id));
  for (const collection of ["mountains", "forests"]) {
    world[collection].forEach((item, index) => {
      if (item.sourceId && !sourceIds.has(item.sourceId)) {
        throw new Error(`${collection}[${index}].sourceId must reference an existing brush stroke.`);
      }
    });
  }

  return world;
}

export function serialiseWorld(world) {
  return JSON.stringify(validateWorld(world), null, 2);
}

export async function loadWorld(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load world data (${response.status}).`);
  return validateWorld(await response.json());
}
