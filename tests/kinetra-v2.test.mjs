import assert from "node:assert/strict";
import {
  KINETRA_SCHEMA,
  createKinetraBundle,
  resolveKinetraFrame,
  resolveKinetraRig,
  sampleKinetraClip,
  validateKinetraProject
} from "../src/animations/kinetra-runtime.js";

const project = {
  schema: KINETRA_SCHEMA,
  name: "Robot",
  fps: 24,
  rig: {
    id: "robot",
    name: "Robot",
    bones: [
      { id: "brazo", name: "Brazo", parent: null, x: 50, y: 0 },
      { id: "mano", name: "Mano", parent: "brazo", x: 120, y: 0 }
    ]
  },
  assets: [{ id: "mano_png", name: "mano.png", type: "image/png", src: "data:image/png;base64,AA==" }],
  layers: [{ id: "mano_capa", name: "Mano", assetId: "mano_png", source: "asset", boneId: "mano", x: 120, y: 0, scaleX: 1, scaleY: 1, rotation: 0, visible: true, z: 0, groupId: "extremidad", crop: { x: 0, y: 0, width: 32, height: 48 } }],
  layerGroups: [{ id: "extremidad", name: "Extremidad", collapsed: false }],
  clips: [{ id: "saludo", duration: 1000, loop: false, keys: { brazo: [{ t: 0, angle: 0 }, { t: 1000, angle: 90 }] } }]
};

assert.deepEqual(validateKinetraProject(project), []);
assert.equal(sampleKinetraClip(project, "saludo", 500).brazo.angle, 45);
const rig = resolveKinetraRig(project, sampleKinetraClip(project, "saludo", 500));
assert.ok(Math.abs(rig.mano[4] - 99.497) < 0.01, "La mano debe heredar la rotación del brazo");
assert.ok(Math.abs(rig.mano[5] - 49.497) < 0.01, "La cadena debe resolverse sin depender del editor");
const frame = resolveKinetraFrame(project, "saludo", 500);
assert.equal(frame.layers.length, 1);
assert.equal(frame.layers[0].assetId, "mano_png");
assert.equal(frame.layers[0].asset.src, "data:image/png;base64,AA==");
assert.deepEqual(frame.layers[0].crop, { x: 0, y: 0, width: 32, height: 48 });
assert.equal(frame.layers[0].matrix.length, 6);
assert.deepEqual(createKinetraBundle({
  clip: { animation: project.clips[0] },
  fps: project.fps,
  rig: project.rig,
  assets: project.assets,
  parts: project.layers,
  layerGroups: project.layerGroups
}).layerGroups, project.layerGroups, "La exportación debe conservar la organización de grupos del editor");

const invalid = structuredClone(project);
invalid.layers[0].boneId = "fantasma";
assert.match(validateKinetraProject(invalid).join("\n"), /boneId no existe/);

const cyclic = structuredClone(project);
cyclic.rig.bones[0].parent = "mano";
assert.match(validateKinetraProject(cyclic).join("\n"), /ciclo jerárquico/);

const invalidClip = structuredClone(project);
invalidClip.clips[0].keys.fantasma = [{ t: 0, x: 1 }];
assert.match(validateKinetraProject(invalidClip).join("\n"), /no pertenece al rig/);

console.log("Pruebas del runtime Kinetra v2 superadas.");
