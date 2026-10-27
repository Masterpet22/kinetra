import assert from "node:assert/strict";
import {
  collapseHierarchicalSelection,
  constrainedTranslation,
  hitMoveGizmo,
  hitRotateGizmo,
  hitScaleGizmo,
  scaleFromDrag,
  shortestAngleDelta
} from "../src/studio/gizmo.js";
import { inverseTransformPoint, transformedRectContainsPoint } from "../src/studio/canvas-renderer.js";

const transformedSource = { width: 10, height: 6 };
const rotatedScaledMatrix = [0, 2, -1, 0, 10, 20];
assert.deepEqual(inverseTransformPoint(rotatedScaledMatrix, { x: 8, y: 28 }), { x: 4, y: 2 });
assert.equal(
  transformedRectContainsPoint(rotatedScaledMatrix, transformedSource, { x: 8, y: 28 }),
  true,
  "La selección debe reconocer un punto dentro de una capa rotada y escalada"
);
assert.equal(
  transformedRectContainsPoint(rotatedScaledMatrix, transformedSource, { x: 10, y: 32 }),
  false,
  "La selección debe rechazar un punto fuera de la forma transformada"
);
assert.deepEqual(
  inverseTransformPoint([-1, 0, 0, 1, 10, 20], { x: 6, y: 22 }),
  { x: 4, y: 2 },
  "La selección debe admitir capas reflejadas"
);

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

const parents = { shoulderRight: null, elbowRight: "shoulderRight", wristRight: "elbowRight", hipLeft: null };
assert.deepEqual(collapseHierarchicalSelection(["shoulderRight", "elbowRight", "wristRight"], parents), [
  "shoulderRight"
]);
assert.deepEqual(collapseHierarchicalSelection(["elbowRight", "wristRight", "hipLeft"], parents), [
  "elbowRight",
  "hipLeft"
]);
assert.deepEqual(collapseHierarchicalSelection(["rig", "wristRight"], parents), ["rig"]);

assert.deepEqual(scaleFromDrag({ scaleX: 0, scaleY: 0 }, { x: 20, y: -10 }, { xSign: 1, ySign: -1 }), {
  scaleX: 0.2,
  scaleY: 0.1
});
assert.deepEqual(
  scaleFromDrag({ scaleX: 0, scaleY: 0 }, { x: 20, y: -10 }, { xSign: 1, ySign: -1 }, { uniform: true }),
  { scaleX: 0.15000000000000002, scaleY: 0.15000000000000002 }
);

console.log("Pruebas de controles de transformación de Kinetra superadas.");
