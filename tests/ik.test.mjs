import assert from "node:assert/strict";
import { solveJointRotation, solveTwoBoneIk } from "../src/studio/ik.js";

const bent = solveTwoBoneIk(
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 1, y: 1 }
);
assert.ok(bent);
assert.ok(Math.abs(bent.upperDelta) < 1e-6);
assert.ok(Math.abs(bent.lowerDelta - 90) < 0.01);
assert.ok(Math.abs(bent.end.x - 1) < 0.001);
assert.ok(Math.abs(bent.end.y - 1) < 0.001);

const unreachable = solveTwoBoneIk(
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 5, y: 0 }
);
assert.ok(unreachable.end.x < 2 && unreachable.end.x > 1.99);
assert.ok(Math.abs(unreachable.end.y) < 0.001);

const rotatedJoint = solveJointRotation(
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 1, y: 3 }
);
assert.ok(rotatedJoint);
assert.ok(Math.abs(rotatedJoint.angleDelta - 71.565) < 0.01);
assert.ok(Math.abs(Math.hypot(rotatedJoint.joint.x, rotatedJoint.joint.y) - 2) < 0.001);
assert.equal(solveJointRotation({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }), null);

console.log("Pruebas de cinemática inversa de Kinetra superadas.");
