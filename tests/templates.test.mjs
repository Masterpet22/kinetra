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
assert.deepEqual(validateKinetraProject(createKinetraBundle(female)), []);

const blank = createTemplateProject("blank");
assert.equal(blank.parts.length, 0);
assert.equal(blank.rig.bones.length, 0);

await Promise.all([...male.assets, ...female.assets].map((asset) => stat(new URL(`../${asset.src.slice(2)}`, import.meta.url))));

console.log("Pruebas de plantillas de Kinetra superadas.");
