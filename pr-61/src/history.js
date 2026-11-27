export function createHistory(initialState, maximumSteps = 50) {
  let current = initialState;
  let limit = normaliseLimit(maximumSteps);
  let undoStack = [];
  let redoStack = [];

  function trim() {
    if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
    if (redoStack.length > limit) redoStack.splice(0, redoStack.length - limit);
  }

  return {
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    get limit() { return limit; },
    commit(nextState) {
      if (nextState === current) return false;
      undoStack.push(current);
      current = nextState;
      redoStack = [];
      trim();
      return true;
    },
    undo() {
      if (!undoStack.length) return null;
      redoStack.push(current);
      current = undoStack.pop();
      trim();
      return current;
    },
    redo() {
      if (!redoStack.length) return null;
      undoStack.push(current);
      current = redoStack.pop();
      trim();
      return current;
    },
    replace(nextState) {
      current = nextState;
      undoStack = [];
      redoStack = [];
    },
    setLimit(nextLimit) {
      limit = normaliseLimit(nextLimit);
      trim();
      return limit;
    },
  };
}

function normaliseLimit(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(500, Math.max(1, number)) : 50;
}
