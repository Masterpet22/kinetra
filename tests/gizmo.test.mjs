import assert from "node:assert/strict";
import {
  constrainedTranslation,
  hitMoveGizmo,
  hitRotateGizmo,
  hitScaleGizmo,
  scaleFromDrag,
  shortestAngleDelta
} from "../src/studio/gizmo.js";

assert.equal(hitMoveGizmo(0, 0), "free");
assert.equal(hitMoveGizmo(42, 2), "x");
assert.equal(hitMoveGizmo(2, 42), "y");
assert.equal(hitMoveGizmo(-30, 0), null);

assert.equal(hitRotateGizmo(31, 0), true);
assert.equal(hitRotateGizmo(0, 0), false);
assert.deepEqual(hitScaleGizmo(24, -24), { xSign: 1, ySign: -1 });
assert.equal(hitScaleGizmo(0, 0), null);

assert.deepEqual(constrainedTranslation({ x: 12, y: 7 }, "x"), { x: 12, y: 0 });
assert.deepEqual(constrainedTranslation({ x: 12, y: 7 }, "y"), { x: 0, y: 7 });
assert.equal(shortestAngleDelta(170, -170), 20);
assert.equal(shortestAngleDelta(-170, 170), -20);

assert.deepEqual(
  scaleFromDrag({ scaleX: 0, scaleY: 0 }, { x: 20, y: -10 }, { xSign: 1, ySign: -1 }),
  { scaleX: 0.2, scaleY: 0.1 }
);
assert.deepEqual(
  scaleFromDrag({ scaleX: 0, scaleY: 0 }, { x: 20, y: -10 }, { xSign: 1, ySign: -1 }, { uniform: true }),
  { scaleX: 0.15000000000000002, scaleY: 0.15000000000000002 }
);

console.log("Pruebas de controles de transformación de Kinetra superadas.");
