import assert from "node:assert/strict";
import { PUPPET_TARGETS } from "../src/animations/rig.js";
import {
  createKinetraClip,
  normalizeKinetraClip,
  parseKinetraClip,
  validateKinetraClip
} from "../src/animations/studio-format.js";
import { sampleKinetraClip } from "../src/animations/studio-runtime.js";
import { PuppetAnimationController } from "../src/animations/controller.js";
import { animationEase, sampleKeyframeAnimationPose } from "../src/animations/runtime.js";

assert.equal(animationEase(0.5, "Linear"), 0.5);
assert.equal(animationEase(0.5, "Quad.in"), 0.25);
assert.equal(animationEase(0.5, "Quad.out"), 0.75);
assert.equal(animationEase(0.25, "Quad.inOut"), 0.125);

const editableDraft = createKinetraClip();
editableDraft.description = "";
editableDraft.keys.rig = [{ t: 0, x: 0 }];
assert.equal("schema" in editableDraft, false, "Un clip usa el objeto de animación de Kinetra v2, no un envoltorio versionado");
assert.deepEqual(
  validateKinetraClip(editableDraft),
  [],
  "Un borrador puede editarse aunque su descripción todavía esté vacía"
);
assert.deepEqual(
  sampleKinetraClip(editableDraft, 0),
  { rig: { x: 0 } },
  "El muestreador del editor no debe bloquear borradores incompletos"
);
assert.ok(
  validateKinetraClip(editableDraft, { mode: "game" }).some((error) => error.includes("clip.description")),
  "Los clips publicados deben incluir una descripción"
);

const project = createKinetraClip({
  id: "attack_export_test",
  label: "Ataque de prueba",
  description: "Comprueba el contrato entre Kinetra y el runtime.",
  category: "ataque",
  state: "action",
  duration: 1000
});
project.requires = ["shoulderRight", "rig"];
project.keys.shoulderRight = [
  { t: 1000, angle: -60, x: 10, ease: "Cubic.out" },
  { t: 0, angle: 0, x: 0 }
];
project.keys.rig = [
  { t: 0, y: 0, scaleX: 0, scaleY: 0, alpha: 0 },
  { t: 1000, y: -10, scaleX: 0.1, scaleY: -0.1, alpha: -1, ease: "Linear" }
];
project.spriteEvents = [{ t: 400, slot: "handRight", variant: "grip" }];

assert.deepEqual(validateKinetraClip(project, { mode: "game" }), [], "Un clip completo debe superar la validación de publicación");
const serialized = JSON.stringify(normalizeKinetraClip(project), null, 2);
const roundTrip = parseKinetraClip(serialized, { mode: "game" });
assert.equal(JSON.stringify(roundTrip, null, 2), serialized, "La importación debe conservar el objeto de clip Kinetra");
assert.ok(serialized.indexOf('"t": 0') < serialized.indexOf('"t": 1000'), "Los fotogramas deben serializarse en orden temporal");

const pose = sampleKinetraClip(roundTrip, 500);
assert.equal(pose.shoulderRight.angle, -52.5, "El muestreador del editor debe usar la curva declarada");
assert.equal(pose.shoulderRight.x, 8.75, "El formato debe admitir más transformaciones que el ángulo");
assert.deepEqual(pose.rig, { y: -5, scaleX: 0.05, scaleY: -0.05, alpha: -0.5 }, "Las transformaciones relativas se interpolan de forma determinista");
assert.deepEqual(sampleKeyframeAnimationPose(roundTrip, 500), pose, "El editor y el runtime deben producir la misma pose");

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
const controller = new PuppetAnimationController(scene, fighter, { [roundTrip.id]: roundTrip });
const finished = controller.playOnce(roundTrip.id, { force: true });
assert.equal(tweenConfigs.length, 1, "Un clip multipista debe usar un solo reloj");
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

const empty = createKinetraClip();
assert.ok(
  validateKinetraClip(empty, { mode: "game" }).some((error) => error.includes("al menos una pista")),
  "Un borrador vacío no debe marcarse como publicable"
);

const broken = structuredClone(project);
broken.keys.shoulderRight.push({ t: 1000, rotation: 20 });
const brokenErrors = validateKinetraClip(broken, { mode: "game" });
assert.ok(brokenErrors.some((error) => error.includes("tiempo duplicado")));
assert.ok(brokenErrors.some((error) => error.includes("propiedad desconocida")));
assert.ok(brokenErrors.some((error) => error.includes("falta una transformación")));

assert.throws(
  () => parseKinetraClip("{not-json}"),
  /JSON de clip Kinetra inválido/,
  "La importación debe explicar los JSON mal formados"
);
assert.throws(
  () => parseKinetraClip(JSON.stringify({ animation: project })),
  /estructura plana de Kinetra v2/,
  "Los envoltorios de animación antiguos deben dejar de ser importables"
);

console.log("Pruebas del contrato de Kinetra v2 superadas.");
