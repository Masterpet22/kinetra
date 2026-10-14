export const GIZMO_METRICS = Object.freeze({
  centerRadius: 10,
  axisStart: 8,
  axisEnd: 50,
  axisTolerance: 10,
  rotateRadius: 31,
  rotateTolerance: 10,
  scaleHalfSize: 24,
  scaleHandleRadius: 10
});

export function hitMoveGizmo(dx, dy, metrics = GIZMO_METRICS) {
  if (Math.hypot(dx, dy) <= metrics.centerRadius) return "free";
  if (dx >= metrics.axisStart && dx <= metrics.axisEnd && Math.abs(dy) <= metrics.axisTolerance) return "x";
  if (dy >= metrics.axisStart && dy <= metrics.axisEnd && Math.abs(dx) <= metrics.axisTolerance) return "y";
  return null;
}

export function hitRotateGizmo(dx, dy, metrics = GIZMO_METRICS) {
  return Math.abs(Math.hypot(dx, dy) - metrics.rotateRadius) <= metrics.rotateTolerance;
}

export function hitScaleGizmo(dx, dy, metrics = GIZMO_METRICS) {
  const signs = [-1, 1];
  for (const xSign of signs) {
    for (const ySign of signs) {
      const x = xSign * metrics.scaleHalfSize;
      const y = ySign * metrics.scaleHalfSize;
      if (Math.hypot(dx - x, dy - y) <= metrics.scaleHandleRadius) return { xSign, ySign };
    }
  }
  return null;
}

export function shortestAngleDelta(from, to) {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function constrainedTranslation(delta, axis) {
  return {
    x: axis === "y" ? 0 : delta.x,
    y: axis === "x" ? 0 : delta.y
  };
}

export function scaleFromDrag(initial, delta, handle, { uniform = false, sensitivity = 0.01 } = {}) {
  let x = delta.x * handle.xSign * sensitivity;
  let y = delta.y * handle.ySign * sensitivity;
  if (uniform) x = y = (x + y) / 2;
  const clamp = (value) => Math.max(-0.9, Math.min(4, value));
  return {
    scaleX: clamp(initial.scaleX + x),
    scaleY: clamp(initial.scaleY + y)
  };
}
