import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { createKinetraBundle, validateKinetraProject } from "../src/animations/kinetra-runtime.js";
import { createTemplateProject } from "../src/studio/templates.js";
import {
  createClip,
  deleteClip,
  duplicateClip,
  migrateAuthoringProject,
  moveClip,
  renameClip,
  selectClip,
  serializeAuthoringProject
} from "../src/studio/project-model.js";
import { createCommandHistory } from "../src/studio/history.js";
import {
  createIndexedDbAdapter,
  createPersistenceController,
  KinetraStorageError,
  readStorageValue,
  removeStorageValue,
  writeStorageValue
} from "../src/studio/persistence.js";

const deniedStorage = {
  getItem() {
    throw new DOMException("denied", "SecurityError");
  },
  setItem() {
    throw new DOMException("denied", "SecurityError");
  },
  removeItem() {
    throw new DOMException("denied", "SecurityError");
  }
};
assert.equal(readStorageValue(deniedStorage, "theme", "noche"), "noche");
assert.equal(writeStorageValue(deniedStorage, "theme", "aurora"), false);
assert.equal(removeStorageValue(deniedStorage, "theme"), false);
assert.equal(writeStorageValue(null, "theme", "aurora"), false);
assert.equal(removeStorageValue(null, "theme"), false);

const legacy = createTemplateProject("male");
legacy.rig.bones.forEach((bone) => delete bone.motionLimits);
const project = migrateAuthoringProject(legacy);
assert.equal(project.clips.length, 1, "La estructura antigua debe migrarse sin perder el clip");
assert.equal(project.clip.id, project.activeClipId);
assert.ok(
  project.rig.bones
    .filter((bone) => !bone.parent)
    .every((bone) => bone.motionLimits.x === 0 && bone.motionLimits.y === 0),
  "La migración debe fijar los huesos conectados directamente a la raíz masculina"
);

const legacyFemale = createTemplateProject("female");
legacyFemale.rig.bones.forEach((bone) => {
  delete bone.followTarget;
  delete bone.motionLimits;
});
legacyFemale.parts.find((part) => part.id === "torso").boneId = "rig";
const migratedFemale = migrateAuthoringProject(legacyFemale);
assert.equal(migratedFemale.parts.find((part) => part.id === "torso").boneId, "torso");
assert.ok(
  migratedFemale.rig.bones
    .filter((bone) => !bone.parent)
    .every((bone) => bone.motionLimits.x === 0 && bone.motionLimits.y === 0),
  "La migración debe fijar los huesos conectados directamente a la raíz femenina"
);
assert.equal(migratedFemale.rig.bones.find((bone) => bone.id === "neck").followTarget, "torso");

for (let index = 2; index <= 5; index += 1) createClip(project, { id: `clip_${index}`, label: `Clip ${index}` });
assert.equal(project.clips.length, 5);
selectClip(project, "clip_2");
const duplicate = duplicateClip(project);
renameClip(project, duplicate.id, { id: "clip_copia", label: "Clip copia" });
assert.equal(project.clip.label, "Clip copia");
assert.equal(moveClip(project, project.activeClipId, -1), true);
deleteClip(project, "clip_5");
assert.equal(project.clips.length, 5);

const bundle = createKinetraBundle(serializeAuthoringProject(project));
assert.equal(bundle.clips.length, 5, "La exportación debe conservar todos los clips");
assert.deepEqual(validateKinetraProject(bundle), []);
const reopened = migrateAuthoringProject(bundle);
assert.deepEqual(reopened.clips, bundle.clips, "Abrir y reexportar cinco clips no debe alterar su estructura");

const historyProject = migrateAuthoringProject(createTemplateProject("blank"));
historyProject.assets.push({
  id: "large",
  name: "large.png",
  type: "image/png",
  src: `data:image/png;base64,${"A".repeat(1024 * 1024)}`
});
const history = createCommandHistory({ budgetBytes: 200000 });
history.reset(historyProject);
for (let index = 0; index < 100; index += 1) {
  historyProject.rig.name = `Rig ${index}`;
  history.record(`Transformación ${index}`, historyProject);
}
assert.ok(history.stats().bytes < 200000, "Cien transformaciones deben respetar el presupuesto de memoria");
assert.ok(history.stats().entries > 1, "El historial debe conservar múltiples comandos");
const undone = history.undo(historyProject);
assert.ok(undone.project.assets[0].src.length > 1024 * 1024, "Deshacer debe reutilizar el recurso inmutable actual");

const states = [];
const quotaAdapter = {
  async save() {
    throw new DOMException("quota", "QuotaExceededError");
  },
  async load() {
    return null;
  }
};
const quotaPersistence = createPersistenceController({
  adapter: quotaAdapter,
  onState: (state) => states.push(state),
  delay: 1
});
await assert.rejects(
  () => quotaPersistence.saveNow(historyProject),
  (error) => error instanceof KinetraStorageError && error.code === "quota"
);
assert.equal(states.at(-1).state, "quota", "La cuota insuficiente debe producir un estado visible y específico");

const memory = new Map();
const memoryAdapter = {
  async save(key, value, options) {
    memory.set(key, { project: migrateAuthoringProject(value), updatedAt: Date.now(), dirty: options.dirty });
  },
  async load(key) {
    return memory.get(key) || null;
  }
};
const persistence = createPersistenceController({ adapter: memoryAdapter, delay: 1 });
await persistence.saveNow(project);
await persistence.saveRecovery(project);
assert.equal(
  (await persistence.loadLatest()).project.clips.length,
  5,
  "La recuperación debe conservar todos los clips"
);

const quarantined = [];
const damagedPersistence = createPersistenceController({
  adapter: {
    async load(key) {
      if (key === "current") throw new Error("metadatos dañados");
      return { project, updatedAt: Date.now(), dirty: true };
    },
    async quarantine(key, error) {
      quarantined.push({ key, message: error.message });
    }
  }
});
const recoveredAfterDamage = await damagedPersistence.loadLatest();
assert.equal(recoveredAfterDamage.project.activeClipId, project.activeClipId);
assert.deepEqual(quarantined, [{ key: "current", message: "metadatos dañados" }]);

const failedStates = [];
const fullyDamagedPersistence = createPersistenceController({
  adapter: {
    async load(key) {
      throw new Error(`${key} dañado`);
    },
    async quarantine() {}
  },
  onState: (state) => failedStates.push(state)
});
assert.equal(await fullyDamagedPersistence.loadLatest(), null);
assert.equal(failedStates.at(-1).state, "repaired");
assert.equal(failedStates.at(-1).error.code, "corrupt-project");

const largeProject = migrateAuthoringProject(createTemplateProject("blank"));
const imageBytes = 24 * 1024 * 1024;
largeProject.assets.push({
  id: "imagen_24mb",
  name: "imagen_24mb.png",
  type: "image/png",
  size: imageBytes,
  blob: new Blob([new Uint8Array(imageBytes)], { type: "image/png" })
});
const indexedDbAdapter = await createIndexedDbAdapter({ indexedDBFactory: indexedDB });
await indexedDbAdapter.save("large-project", largeProject);
const restoredLargeProject = await indexedDbAdapter.load("large-project");
assert.equal(
  restoredLargeProject.project.assets[0].blob.size,
  imageBytes,
  "IndexedDB debe recuperar los 24 MB como Blob"
);
assert.match(
  restoredLargeProject.project.assets[0].src,
  /^blob:/,
  "La recuperación no debe convertir la imagen a data URL"
);
URL.revokeObjectURL(restoredLargeProject.project.assets[0].src);
indexedDbAdapter.close();

console.log("Pruebas de integridad, migración, historial y recuperación superadas.");
