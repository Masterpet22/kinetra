import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { createKinetraBundle, validateKinetraProject } from "../src/animations/kinetra-runtime.js";
import { createTemplateProject, PROJECT_TEMPLATES } from "../src/studio/templates.js";

assert.deepEqual(PROJECT_TEMPLATES.map((template) => template.id), ["male", "female", "blank"]);

const male = createTemplateProject("male");
assert.equal(male.parts.length, 14);
assert.equal(male.assets.length, 14);
assert.equal(male.rig.bones.length, 13);
assert.equal(male.templateId, "male");
assert.ok(male.assets.every((asset) => asset.src.startsWith("./assets/templates/male/")));
assert.ok(male.parts.every((part) => part.source === "asset"));
assert.deepEqual(validateKinetraProject(createKinetraBundle(male)), []);

const female = createTemplateProject("female");
assert.equal(female.parts.length, 14);
assert.equal(female.assets.length, 14);
assert.equal(female.rig.bones.length, 13);
assert.ok(female.parts.every((part) => part.crop?.width > 0 && part.crop?.height > 0));
assert.equal(new Set(female.parts.map((part) => part.assetId)).size, 14);
assert.ok(female.assets.every((asset) => asset.src.startsWith("./assets/templates/female/")));
assert.deepEqual(
  Object.fromEntries(female.rig.bones.map(({ id, x, y }) => [id, { x, y }])),
  {
    neck: { x: 0, y: -343.2 },
    shoulderRight: { x: -281.6, y: -303.6 },
    elbowRight: { x: -453.2, y: -30.8 },
    wristRight: { x: -453.2, y: 184.8 },
    shoulderLeft: { x: 281.6, y: -303.6 },
    elbowLeft: { x: 457.6, y: -39.6 },
    wristLeft: { x: 492.8, y: 171.6 },
    hipRight: { x: -92.4, y: 140.8 },
    kneeRight: { x: -158.4, y: 462 },
    ankleRight: { x: -184.8, y: 708.4 },
    hipLeft: { x: 88, y: 140.8 },
    kneeLeft: { x: 92.4, y: 462 },
    ankleLeft: { x: 101.2, y: 708.4 }
  }
);
assert.deepEqual(
  female.parts.map(({ id, x, y, rotation, z }) => ({ id, x, y, rotation, z })),
  [
    { id: "brazo_izquierdo", x: 137.717778, y: -155.855556, rotation: 0, z: 0 },
    { id: "antebrazo_izquierdo", x: 228.835556, y: 13.19, rotation: 0, z: 1 },
    { id: "mano_izquierda", x: 304.218889, y: 166.491111, rotation: 0, z: 2 },
    { id: "muslo_izquierdo", x: 69.366667, y: 227.555556, rotation: 0, z: 3 },
    { id: "pierna_izquierda", x: 80.96, y: 460.936667, rotation: 0, z: 4 },
    { id: "pie_izquierdo", x: 130.68, y: 613.31, rotation: 0, z: 5 },
    { id: "torso", x: -22, y: -56.32, rotation: 0, z: 6 },
    { id: "muslo_derecho", x: -87.894444, y: 231.515556, rotation: 0, z: 7 },
    { id: "pierna_derecha", x: -119.325556, y: 466.704444, rotation: 0, z: 8 },
    { id: "pie_derecho", x: -147.533333, y: 616.533333, rotation: 0, z: 9 },
    { id: "brazo_derecho", x: -186.5, y: -143.822222, rotation: -12, z: 10 },
    { id: "antebrazo_derecho", x: -235.77, y: 62.231111, rotation: 6, z: 11 },
    { id: "mano_derecha", x: -234.603333, y: 213.724444, rotation: 4, z: 12 },
    { id: "cabeza", x: -3.96, y: -443.06, rotation: 0, z: 13 }
  ]
);
assert.deepEqual(validateKinetraProject(createKinetraBundle(female)), []);

const blank = createTemplateProject("blank");
assert.equal(blank.parts.length, 0);
assert.equal(blank.rig.bones.length, 0);

await Promise.all([...male.assets, ...female.assets].map((asset) => stat(new URL(`../${asset.src.slice(2)}`, import.meta.url))));

console.log("Pruebas de plantillas de Kinetra superadas.");
