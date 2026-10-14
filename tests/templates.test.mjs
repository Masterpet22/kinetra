import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { createKinetraBundle, validateKinetraProject } from "../src/animations/kinetra-runtime.js";
import { createTemplateProject, PROJECT_TEMPLATES } from "../src/studio/templates.js";

assert.deepEqual(PROJECT_TEMPLATES.map((template) => template.id), ["male", "female", "dog", "blank"]);

const male = createTemplateProject("male");
assert.equal(male.parts.length, 14);
assert.equal(male.rig.bones.length, 13);
assert.equal(male.templateId, "male");

const female = createTemplateProject("female");
assert.equal(female.parts.length, 14);
assert.equal(female.rig.bones.length, 13);
assert.ok(female.parts.every((part) => part.crop?.width > 0 && part.crop?.height > 0));
assert.equal(new Set(female.parts.map((part) => part.assetId)).size, 1);
assert.deepEqual(validateKinetraProject(createKinetraBundle(female)), []);

const dog = createTemplateProject("dog");
assert.equal(dog.parts.length, 15);
assert.equal(dog.rig.bones.length, 14);
assert.ok(dog.parts.every((part) => part.crop?.width > 0 && part.crop?.height > 0));
assert.equal(new Set(dog.parts.map((part) => part.z)).size, dog.parts.length);
assert.equal(dog.rig.bones.find((bone) => bone.id === "wristRight").parent, "elbowRight");
assert.equal(dog.rig.bones.find((bone) => bone.id === "ankleLeft").parent, "kneeLeft");
assert.deepEqual(validateKinetraProject(createKinetraBundle(dog)), []);

const blank = createTemplateProject("blank");
assert.equal(blank.parts.length, 0);
assert.equal(blank.rig.bones.length, 0);

await Promise.all([
  stat(new URL("../assets/templates/male/preview.png", import.meta.url)),
  stat(new URL("../assets/templates/female/preview.png", import.meta.url)),
  stat(new URL("../assets/templates/female/atlas.png", import.meta.url)),
  stat(new URL("../assets/templates/dog/preview.png", import.meta.url)),
  stat(new URL("../assets/templates/dog/atlas.png", import.meta.url))
]);

console.log("Pruebas de plantillas de Kinetra superadas.");
