import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { createKinetraBundle, validateKinetraProject } from "../src/animations/kinetra-runtime.js";
import { createTemplateProject, PROJECT_TEMPLATES } from "../src/studio/templates.js";

assert.deepEqual(
  PROJECT_TEMPLATES.map((template) => template.id),
  ["male", "female", "blank"]
);

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
assert.deepEqual(Object.fromEntries(female.rig.bones.map(({ id, x, y }) => [id, { x, y }])), {
  neck: { x: 0, y: -292.2 },
  shoulderRight: { x: -167.78, y: -271.37 },
  elbowRight: { x: -224.11, y: -24.14 },
  wristRight: { x: -249.54, y: 145.85 },
  shoulderLeft: { x: 95.36, y: -269.89 },
  elbowLeft: { x: 198.12, y: -60.41 },
  wristLeft: { x: 284.58, y: 96.99 },
  hipRight: { x: -92.4, y: 140.8 },
  kneeRight: { x: -106.54, y: 370.16 },
  ankleRight: { x: -136.24, y: 556.99 },
  hipLeft: { x: 88, y: 140.8 },
  kneeLeft: { x: 84.57, y: 363.76 },
  ankleLeft: { x: 86.01, y: 550.29 }
});
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
    { id: "brazo_derecho", x: -186.5, y: -143.822222, rotation: 0, z: 10 },
    { id: "antebrazo_derecho", x: -235.77, y: 62.231111, rotation: 0, z: 11 },
    { id: "mano_derecha", x: -234.603333, y: 213.724444, rotation: 0, z: 12 },
    { id: "cabeza", x: -3.96, y: -443.06, rotation: 0, z: 13 }
  ]
);
assert.ok(
  female.parts.every((part) => part.rotation === 0),
  "La pose femenina oficial debe iniciar en rotación cero"
);
assert.deepEqual(
  Object.fromEntries(
    female.parts.filter((part) => part.restRotation).map(({ id, restRotation }) => [id, restRotation])
  ),
  { brazo_derecho: -12, antebrazo_derecho: 6, mano_derecha: 4 },
  "La orientación visual de los sprites debe conservarse como calibración de reposo"
);
assert.deepEqual(validateKinetraProject(createKinetraBundle(female)), []);

const blank = createTemplateProject("blank");
assert.equal(blank.parts.length, 0);
assert.equal(blank.rig.bones.length, 0);

await Promise.all(
  [...male.assets, ...female.assets].map((asset) => stat(new URL(`../${asset.src.slice(2)}`, import.meta.url)))
);

console.log("Pruebas de plantillas de Kinetra superadas.");
