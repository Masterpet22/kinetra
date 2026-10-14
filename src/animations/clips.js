import { assertValidAnimationCatalog } from "./schema.js";

export const ANIMATION_STATES = Object.freeze({
  IDLE: "idle",
  LOCOMOTION: "locomotion",
  ACTION: "action",
  HIT: "hit",
  DEFEATED: "defeated"
});

export const ANIMATION_PRIORITIES = Object.freeze({
  [ANIMATION_STATES.IDLE]: 10,
  [ANIMATION_STATES.LOCOMOTION]: 20,
  [ANIMATION_STATES.ACTION]: 30,
  [ANIMATION_STATES.HIT]: 40,
  [ANIMATION_STATES.DEFEATED]: 50
});

// Un clip solo describe intención y movimiento. El controlador de Phaser y el
// laboratorio HTML actúan como adaptadores y consumen estos mismos datos.
export const PUPPET_ANIMATION_CLIPS = Object.freeze({
  "idle-natural": Object.freeze({
    id: "idle-natural",
    label: "Respiración natural",
    description: "Respiración suave con el peso fijo en los pies.",
    category: "reposo",
    state: ANIMATION_STATES.IDLE,
    status: "integrated",
    loop: true,
    requires: Object.freeze(["torso", "neck", "shoulderLeft", "shoulderRight"]),
    tracks: Object.freeze([
      { target: "torso", duration: 1550, yoyo: true, ease: "Sine.inOut", to: { y: -4, scaleY: 0.008 } },
      { target: "neck", duration: 1550, yoyo: true, ease: "Sine.inOut", to: { y: -4 } },
      { target: "shoulderLeft", duration: 1550, yoyo: true, ease: "Sine.inOut", to: { y: -2.5 } },
      { target: "shoulderRight", duration: 1550, yoyo: true, ease: "Sine.inOut", to: { y: -2.5 } },
      { target: "neck", duration: 3100, delay: 420, yoyo: true, ease: "Sine.inOut", to: { angle: 0.8 } }
    ])
  }),
  "idle-alert": Object.freeze({
    id: "idle-alert",
    label: "Reposo alerta",
    description: "Respiración corta y mirada atenta antes de actuar.",
    category: "reposo",
    state: ANIMATION_STATES.IDLE,
    status: "integrated",
    loop: true,
    requires: Object.freeze(["torso", "neck", "shoulderLeft", "shoulderRight"]),
    tracks: Object.freeze([
      { target: "torso", duration: 980, yoyo: true, ease: "Sine.inOut", to: { y: -2.4, scaleY: 0.005 } },
      { target: "neck", duration: 980, yoyo: true, ease: "Sine.inOut", to: { y: -2.4 } },
      { target: "shoulderLeft", duration: 980, yoyo: true, ease: "Sine.inOut", to: { y: -1.6 } },
      { target: "shoulderRight", duration: 980, yoyo: true, ease: "Sine.inOut", to: { y: -1.6 } },
      { target: "neck", duration: 1850, delay: 220, yoyo: true, ease: "Sine.inOut", to: { angle: -1.4 } }
    ])
  }),
  "idle-focus": Object.freeze({
    id: "idle-focus",
    label: "Reposo concentrado",
    description: "Movimiento lento y contenido para diálogos o espera.",
    category: "reposo",
    state: ANIMATION_STATES.IDLE,
    status: "integrated",
    loop: true,
    requires: Object.freeze(["torso", "neck", "shoulderLeft", "shoulderRight"]),
    tracks: Object.freeze([
      { target: "torso", duration: 2200, yoyo: true, ease: "Sine.inOut", to: { y: -2.5, scaleY: 0.005 } },
      { target: "neck", duration: 2200, yoyo: true, ease: "Sine.inOut", to: { y: -2.5, angle: 0.45 } },
      { target: "shoulderLeft", duration: 2200, yoyo: true, ease: "Sine.inOut", to: { y: -1.4 } },
      { target: "shoulderRight", duration: 2200, yoyo: true, ease: "Sine.inOut", to: { y: -1.4 } }
    ])
  }),
  "guard-hold": Object.freeze({
    id: "guard-hold",
    label: "Guardia sostenida",
    description: "El brazo derecho delantero cubre el rostro y el torso; el otro queda libre.",
    category: "defensa",
    state: ANIMATION_STATES.ACTION,
    status: "integrated",
    loop: true,
    enterDuration: 180,
    requires: Object.freeze(["rig", "shoulderRight", "elbowRight", "wristRight"]),
    tracks: Object.freeze([
      { target: "shoulderRight", duration: 1150, yoyo: true, ease: "Sine.inOut", from: { angle: -62 }, to: { angle: -59 } },
      { target: "elbowRight", duration: 1150, yoyo: true, ease: "Sine.inOut", from: { angle: -70 }, to: { angle: -67 } },
      { target: "wristRight", duration: 1150, yoyo: true, ease: "Sine.inOut", from: { angle: -8 }, to: { angle: -5 } },
      { target: "rig", duration: 1150, yoyo: true, ease: "Sine.inOut", from: { x: -2, angle: -1 }, to: { x: -1, angle: -0.4 } }
    ])
  }),
  "guard-impact": Object.freeze({
    id: "guard-impact",
    label: "Impacto bloqueado",
    description: "La guardia absorbe el golpe y retrocede sin perder la postura.",
    category: "defensa",
    state: ANIMATION_STATES.HIT,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["rig", "shoulderRight", "elbowRight", "wristRight"]),
    tracks: Object.freeze([
      { target: "shoulderRight", duration: 115, yoyo: true, ease: "Quad.out", from: { angle: -62 }, to: { angle: -69 } },
      { target: "elbowRight", duration: 115, yoyo: true, ease: "Quad.out", from: { angle: -70 }, to: { angle: -77 } },
      { target: "wristRight", duration: 115, yoyo: true, ease: "Quad.out", from: { angle: -8 }, to: { angle: -13 } },
      { target: "rig", duration: 115, yoyo: true, ease: "Quad.out", from: { x: -2, angle: -1 }, to: { x: -15, angle: -3.5 } }
    ])
  }),
  "hit-light": Object.freeze({
    id: "hit-light",
    label: "Daño leve",
    description: "Retroceso corto del torso y la cabeza ante un impacto común.",
    category: "reacción",
    state: ANIMATION_STATES.HIT,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["rig", "neck", "shoulderLeft", "shoulderRight"]),
    tracks: Object.freeze([
      { target: "rig", duration: 125, yoyo: true, ease: "Quad.out", to: { x: -13, angle: -3 } },
      { target: "neck", duration: 105, yoyo: true, ease: "Quad.out", to: { angle: -6 } },
      { target: "shoulderLeft", duration: 125, yoyo: true, ease: "Quad.out", to: { angle: 8 } },
      { target: "shoulderRight", duration: 125, yoyo: true, ease: "Quad.out", to: { angle: 8 } }
    ])
  }),
  "hit-heavy": Object.freeze({
    id: "hit-heavy",
    label: "Daño fuerte",
    description: "El cuerpo entero cede y flexiona las piernas ante un golpe potente.",
    category: "reacción",
    state: ANIMATION_STATES.HIT,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["rig", "neck", "shoulderLeft", "shoulderRight", "hipRight", "hipLeft", "kneeRight", "kneeLeft"]),
    tracks: Object.freeze([
      { target: "rig", duration: 165, yoyo: true, ease: "Cubic.out", to: { x: -27, y: 7, angle: -7 } },
      { target: "neck", duration: 125, yoyo: true, ease: "Quad.out", to: { angle: -11 } },
      { target: "shoulderLeft", duration: 150, yoyo: true, ease: "Quad.out", to: { angle: 15 } },
      { target: "shoulderRight", duration: 150, yoyo: true, ease: "Quad.out", to: { angle: 13 } },
      { target: "hipRight", duration: 165, yoyo: true, ease: "Cubic.out", to: { angle: -7 } },
      { target: "hipLeft", duration: 165, yoyo: true, ease: "Cubic.out", to: { angle: 9 } },
      { target: "kneeRight", duration: 165, yoyo: true, ease: "Cubic.out", to: { angle: 13 } },
      { target: "kneeLeft", duration: 165, yoyo: true, ease: "Cubic.out", to: { angle: 16 } }
    ])
  }),
  "guard-hold-simple": Object.freeze({
    id: "guard-hold-simple",
    label: "Guardia simplificada",
    description: "Postura defensiva corporal para rigs sin brazos articulados.",
    category: "defensa",
    state: ANIMATION_STATES.ACTION,
    status: "integrated",
    loop: true,
    requires: Object.freeze(["torso"]),
    tracks: Object.freeze([
      { target: "torso", duration: 800, yoyo: true, ease: "Sine.inOut", from: { x: -2, angle: -1 }, to: { x: -1, angle: -0.4 } }
    ])
  }),
  "guard-impact-simple": Object.freeze({
    id: "guard-impact-simple",
    label: "Impacto bloqueado simplificado",
    description: "Retroceso defensivo para rigs sin brazos articulados.",
    category: "defensa",
    state: ANIMATION_STATES.HIT,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["torso"]),
    tracks: Object.freeze([
      { target: "torso", duration: 115, yoyo: true, ease: "Quad.out", to: { x: -9, angle: -3.5 } }
    ])
  }),
  "hit-light-simple": Object.freeze({
    id: "hit-light-simple",
    label: "Daño leve simplificado",
    description: "Retroceso corporal para rigs sin articulaciones.",
    category: "reacción",
    state: ANIMATION_STATES.HIT,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["torso"]),
    tracks: Object.freeze([
      { target: "torso", duration: 125, yoyo: true, ease: "Quad.out", to: { x: -13, angle: -3 } }
    ])
  }),
  "hit-heavy-simple": Object.freeze({
    id: "hit-heavy-simple",
    label: "Daño fuerte simplificado",
    description: "Retroceso corporal amplio para rigs sin articulaciones.",
    category: "reacción",
    state: ANIMATION_STATES.HIT,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["torso"]),
    tracks: Object.freeze([
      { target: "torso", duration: 165, yoyo: true, ease: "Cubic.out", to: { x: -27, y: 7, angle: -7 } }
    ])
  }),
  "run-cycle": Object.freeze({
    id: "run-cycle",
    label: "Carrera de combate",
    description: "Zancada articulada con balanceo opuesto de brazos y sombra comprimida.",
    category: "locomoción",
    state: ANIMATION_STATES.LOCOMOTION,
    status: "integrated",
    loop: true,
    requires: Object.freeze(["rig", "shadow", "hipLeft", "hipRight", "kneeLeft", "kneeRight", "ankleLeft", "ankleRight", "shoulderLeft", "shoulderRight", "elbowLeft", "elbowRight"]),
    tracks: Object.freeze([
      { target: "hipLeft", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: -24 }, to: { angle: 24 } },
      { target: "hipRight", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: 24 }, to: { angle: -24 } },
      { target: "kneeLeft", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: 7 }, to: { angle: 30 } },
      { target: "kneeRight", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: 30 }, to: { angle: 7 } },
      { target: "ankleLeft", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: -7 }, to: { angle: 8 } },
      { target: "ankleRight", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: 8 }, to: { angle: -7 } },
      { target: "shoulderLeft", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: 21 }, to: { angle: -21 } },
      { target: "shoulderRight", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: -21 }, to: { angle: 21 } },
      { target: "elbowLeft", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: -12 }, to: { angle: 12 } },
      { target: "elbowRight", duration: 180, yoyo: true, ease: "Sine.inOut", from: { angle: 12 }, to: { angle: -12 } },
      { target: "rig", duration: 90, yoyo: true, ease: "Sine.inOut", to: { y: -5 } },
      { target: "shadow", duration: 90, yoyo: true, ease: "Sine.inOut", to: { scaleX: 0.08, scaleY: -0.16 } }
    ])
  }),
  "run-simple": Object.freeze({
    id: "run-simple",
    label: "Carrera simplificada",
    description: "Rebote corporal para combatientes que aún no poseen articulaciones.",
    category: "locomoción",
    state: ANIMATION_STATES.LOCOMOTION,
    status: "integrated",
    loop: true,
    requires: Object.freeze(["body", "shadow"]),
    tracks: Object.freeze([
      { target: "body", duration: 170, yoyo: true, ease: "Sine.inOut", to: { y: -3 } },
      { target: "shadow", duration: 170, yoyo: true, ease: "Sine.inOut", to: { scaleX: 0.06, scaleY: -0.1 } }
    ])
  }),
  "punch-prepare": Object.freeze({
    id: "punch-prepare",
    label: "Puñetazo · preparación",
    description: "Carga el brazo delantero antes del avance.",
    category: "ataque",
    state: ANIMATION_STATES.ACTION,
    status: "integrated",
    loop: false,
    restore: false,
    requires: Object.freeze(["shoulderRight", "elbowRight", "wristRight"]),
    tracks: Object.freeze([
      { target: "shoulderRight", duration: 95, ease: "Sine.out", to: { angle: 12 } },
      { target: "elbowRight", duration: 95, ease: "Sine.out", to: { angle: 18 } },
      { target: "wristRight", duration: 95, ease: "Sine.out", to: { angle: -5 } }
    ])
  }),
  "punch-release": Object.freeze({
    id: "punch-release",
    label: "Puñetazo · impacto",
    description: "Extiende con rapidez el brazo delantero.",
    category: "ataque",
    state: ANIMATION_STATES.ACTION,
    status: "integrated",
    loop: false,
    restore: false,
    requires: Object.freeze(["shoulderRight", "elbowRight", "wristRight"]),
    tracks: Object.freeze([
      { target: "shoulderRight", duration: 115, ease: "Cubic.in", to: { angle: -68 } },
      { target: "elbowRight", duration: 105, ease: "Quad.in", to: { angle: -4 } },
      { target: "wristRight", duration: 105, ease: "Quad.in", to: { angle: 4 } }
    ])
  }),
  "punch-recover": Object.freeze({
    id: "punch-recover",
    label: "Puñetazo · recuperación",
    description: "Devuelve el brazo a la pose neutral.",
    category: "ataque",
    state: ANIMATION_STATES.ACTION,
    status: "integrated",
    loop: false,
    requires: Object.freeze(["shoulderRight", "elbowRight", "wristRight"]),
    tracks: Object.freeze([
      { target: "shoulderRight", duration: 210, ease: "Back.out", to: { angle: 0 } },
      { target: "elbowRight", duration: 190, ease: "Sine.out", to: { angle: 0 } },
      { target: "wristRight", duration: 180, ease: "Sine.out", to: { angle: 0 } }
    ])
  })
});

assertValidAnimationCatalog(PUPPET_ANIMATION_CLIPS, ANIMATION_PRIORITIES);

export const DEFAULT_IDLE_CLIP = "idle-natural";

export function animationClipList(category = null) {
  return Object.values(PUPPET_ANIMATION_CLIPS).filter((clip) => !category || clip.category === category);
}
