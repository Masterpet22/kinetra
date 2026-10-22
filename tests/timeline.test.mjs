import assert from "node:assert/strict";
import {
  clampKeyframeDelta,
  keyIdentitiesAtTime,
  moveKeyframes,
  previousKeyTime,
  selectedKeyframes
} from "../src/studio/timeline.js";

const clip = {
  duration: 1000,
  keys: {
    rig: [
      { t: 100, x: 1 },
      { t: 300, x: 3 },
      { t: 500, x: 5 }
    ],
    arm: [
      { t: 100, angle: 10 },
      { t: 300, angle: 30 }
    ]
  }
};

const selection = new Set(["rig:100", "rig:300", "arm:100"]);
assert.equal(previousKeyTime(clip, 100), undefined, "La primera clave no debe tener una referencia fantasma");
assert.equal(previousKeyTime(clip, 300), 100, "La vista fantasma debe usar el tiempo de clave anterior");
assert.equal(previousKeyTime(clip, 450), 300, "La referencia anterior también debe resolverse entre claves");
assert.deepEqual(
  [...keyIdentitiesAtTime(clip, 100)].sort(),
  ["arm:100", "rig:100"],
  "La selección por columna debe incluir todas las pistas alineadas en el mismo tiempo"
);
assert.deepEqual(
  [...keyIdentitiesAtTime(clip, 100, ["rig"])],
  ["rig:100"],
  "La selección por columna debe respetar la lista de pistas visibles"
);
const selected = selectedKeyframes(clip, selection);
assert.equal(selected.length, 3, "La selección debe encontrar claves de varias pistas");
assert.equal(clampKeyframeDelta(selected, -200, clip.duration), -100, "El grupo no debe atravesar el inicio");
assert.equal(clampKeyframeDelta(selected, 900, clip.duration), 700, "El grupo no debe atravesar el final");

const moved = moveKeyframes(clip, selection, 200);
assert.equal(moved.count, 3);
assert.equal(moved.delta, 200);
assert.equal(moved.overwritten, 2, "Las claves desplazadas deben reemplazar las claves que ocupan sus destinos");
assert.deepEqual([...moved.identities].sort(), ["arm:300", "rig:300", "rig:500"]);
assert.deepEqual(
  clip.keys.rig.map(({ t, x }) => [t, x]),
  [
    [300, 1],
    [500, 3]
  ],
  "Las claves deben conservar sus valores y distancia relativa al desplazarse juntas"
);
assert.deepEqual(
  clip.keys.arm.map(({ t, angle }) => [t, angle]),
  [[300, 10]],
  "Las colisiones deben resolverse también en otras pistas"
);

const unchanged = moveKeyframes(clip, new Set(["missing:10"]), 100);
assert.equal(unchanged.count, 0, "Las selecciones obsoletas no deben modificar el clip");

console.log("Pruebas de operaciones de timeline superadas.");
