import assert from "node:assert/strict";
import { PUPPET_TARGETS } from "../src/animations/rig.js";
import {
  createStudioProject,
  parseStudioProject,
  serializeStudioProject,
  STUDIO_SCHEMA,
  validateStudioProject
} from "../src/animations/studio-format.js";
import { sampleStudioAnimation, validateStudioAnimation } from "../src/animations/studio-runtime.js";
import { studioProjectToAnimationClip, studioProjectsToAnimationCatalog } from "../src/animations/studio-adapter.js";
import { PuppetAnimationController } from "../src/animations/controller.js";
import { validateAnimationCatalog } from "../src/animations/schema.js";
import { animationClipDuration, animationEase, sampleAnimationPose } from "../src/animations/runtime.js";

assert.equal(animationEase(0.5, "Linear"), 0.5);
assert.equal(animationEase(0.5, "Quad.in"), 0.25);
assert.equal(animationEase(0.5, "Quad.out"), 0.75);
assert.equal(animationEase(0.25, "Quad.inOut"), 0.125);

const legacyProject = {
  schema: STUDIO_SCHEMA,
  rig: "humanoid",
  anatomy: "male",
  animation: {
    id: "legacy_punch",
    duration: 1000,
    loop: false,
    keys: {
      shoulderRight: [
        { t: 1000, angle: -45 },
        { t: 0, angle: 0 }
      ]
    }
  }
};

assert.deepEqual(validateStudioProject(legacyProject), [], "Los JSON del prototipo deben seguir siendo importables");
const migrated = parseStudioProject(JSON.stringify(legacyProject), { allowedTargets: PUPPET_TARGETS });
assert.equal(migrated.animation.status, "draft");
assert.equal(migrated.animation.state, "action");
assert.deepEqual(migrated.animation.requires, ["shoulderRight"]);
assert.deepEqual(migrated.animation.keys.shoulderRight.map(({ t }) => t), [0, 1000]);
assert.equal(sampleStudioAnimation(legacyProject, 500).shoulderRight.angle, -22.5, "La migración debe conservar la interpolación lineal anterior");

const editableDraft = createStudioProject();
editableDraft.animation.description = "";
editableDraft.animation.keys.rig = [{ t: 0, x: 0 }];
assert.deepEqual(
  validateStudioProject(editableDraft, { mode: "project" }),
  [],
  "Un borrador debe poder dibujarse aunque su descripción todavía esté vacía"
);
assert.deepEqual(
  sampleStudioAnimation(editableDraft, 0),
  { rig: { x: 0 } },
  "El muestreador del editor no debe bloquear el personaje por metadatos editoriales incompletos"
);
assert.ok(
  validateStudioProject(editableDraft, { mode: "game" }).some((error) => error.includes("animation.description")),
  "La exportación al juego debe seguir exigiendo una descripción"
);

const project = createStudioProject({
  id: "attack_export_test",
  label: "Ataque de prueba",
  description: "Comprueba el contrato entre Studio y el juego.",
  category: "ataque",
  state: "action",
  duration: 1000
});
project.animation.requires = ["shoulderRight", "rig"];
project.animation.keys.shoulderRight = [
  { t: 1000, angle: -60, x: 10, ease: "Cubic.out" },
  { t: 0, angle: 0, x: 0 }
];
project.animation.keys.rig = [
  { t: 0, y: 0, scaleX: 0, scaleY: 0, alpha: 0 },
  { t: 1000, y: -10, scaleX: 0.1, scaleY: -0.1, alpha: -1, ease: "Linear" }
];
project.animation.spriteEvents = [{ t: 400, slot: "handRight", variant: "grip" }];

assert.deepEqual(validateStudioProject(project, { mode: "game" }), [], "Un proyecto completo debe superar la validación de exportación");
const serialized = serializeStudioProject(project, { mode: "game" });
const roundTrip = parseStudioProject(serialized, { mode: "game" });
assert.equal(serializeStudioProject(roundTrip, { mode: "game" }), serialized, "Importar y volver a exportar no debe alterar el archivo");
assert.ok(serialized.indexOf('"t": 0') < serialized.indexOf('"t": 1000'), "Los fotogramas deben serializarse en orden temporal");

const pose = sampleStudioAnimation(roundTrip, 500);
assert.equal(pose.shoulderRight.angle, -52.5, "El muestreador debe compartir la curva nominal con el runtime");
assert.equal(pose.shoulderRight.x, 8.75, "El formato debe admitir más transformaciones que el ángulo");
assert.deepEqual(pose.rig, { y: -5, scaleX: 0.05, scaleY: -0.05, alpha: -0.5 }, "Todas las transformaciones relativas deben interpolarse de forma determinista");
assert.equal(validateStudioAnimation(roundTrip).id, "attack_export_test");

const adapted = studioProjectToAnimationClip(roundTrip);
const priorities = { idle: 1, locomotion: 2, action: 3, hit: 4, defeated: 5 };
assert.deepEqual(validateAnimationCatalog({ [adapted.id]: adapted }, priorities), [], "El catálogo del juego debe aceptar clips de fotogramas clave");
assert.deepEqual(sampleAnimationPose(adapted, 500), pose, "Studio y el runtime del juego deben producir la misma pose");
assert.equal(animationClipDuration(adapted), 1000);
assert.deepEqual(Object.keys(studioProjectsToAnimationCatalog([roundTrip])), [adapted.id]);
assert.throws(() => studioProjectsToAnimationCatalog([roundTrip, roundTrip]), /duplicado/);

const makeTarget = () => ({ x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 });
const tweenConfigs = [];
const scene = { tweens: { add(config) { tweenConfigs.push(config); return { stop() {} }; } } };
const fighter = {
  rig: makeTarget(),
  sprite: makeTarget(),
  body: makeTarget(),
  shadow: makeTarget(),
  joints: { shoulderRight: makeTarget() }
};
const controller = new PuppetAnimationController(scene, fighter, { [adapted.id]: adapted });
const finished = controller.playOnce(adapted.id, { force: true });
assert.equal(tweenConfigs.length, 1, "Un clip multipista debe usar un solo reloj para evitar tweens en competencia");
tweenConfigs[0].targets.elapsed = 500;
tweenConfigs[0].onUpdate();
assert.equal(fighter.joints.shoulderRight.angle, -52.5);
assert.equal(fighter.rig.y, -5);
assert.equal(fighter.rig.scaleX, 1.05);
tweenConfigs[0].targets.elapsed = 1000;
tweenConfigs[0].onUpdate();
tweenConfigs[0].onComplete();
assert.equal(await finished, true);
assert.deepEqual(fighter.rig, makeTarget(), "Al terminar, el controlador debe restaurar la pose neutral");

const empty = createStudioProject();
assert.ok(validateStudioProject(empty, { mode: "game" }).some((error) => error.includes("al menos una pista")), "Un borrador vacío no debe marcarse como publicable");

const broken = structuredClone(project);
broken.animation.keys.shoulderRight.push({ t: 1000, rotation: 20 });
const brokenErrors = validateStudioProject(broken, { mode: "game" });
assert.ok(brokenErrors.some((error) => error.includes("tiempo duplicado")));
assert.ok(brokenErrors.some((error) => error.includes("propiedad desconocida")));
assert.ok(brokenErrors.some((error) => error.includes("falta una transformación")));

assert.throws(
  () => parseStudioProject("{not-json}"),
  /JSON de Studio inválido/,
  "La importación debe explicar los JSON mal formados"
);

console.log("Pruebas del contrato de Kinetra superadas.");
