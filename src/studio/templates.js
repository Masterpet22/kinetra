import {
  PUPPET_JOINTS,
  PUPPET_JOINT_PARENTS,
  PUPPET_PART_JOINTS
} from "../animations/rig.js?v=0.11.0";
import { createStudioProject } from "../animations/studio-format.js?v=0.11.0";

const HUMAN_LABELS = Object.freeze({
  neck: "Cuello",
  shoulderRight: "Hombro derecho",
  elbowRight: "Codo derecho",
  wristRight: "Muñeca derecha",
  shoulderLeft: "Hombro izquierdo",
  elbowLeft: "Codo izquierdo",
  wristLeft: "Muñeca izquierda",
  hipRight: "Cadera derecha",
  kneeRight: "Rodilla derecha",
  ankleRight: "Tobillo derecho",
  hipLeft: "Cadera izquierda",
  kneeLeft: "Rodilla izquierda",
  ankleLeft: "Tobillo izquierdo"
});

const MALE_PARTS = [
  ["pie_derecho", "Pie derecho", -175.526, 732.316],
  ["brazo_izquierdo", "Brazo izquierdo", 161.481, -174.474, "brazo_derecho"],
  ["mano_derecha", "Mano derecha", -291.203, 251.237],
  ["muslo_izquierdo", "Muslo izquierdo", 117.315, 255.895],
  ["torso", "Pieza del torso", -41, -72.5],
  ["muslo_derecho", "Muslo derecho", -93.789, 261.869],
  ["pie_izquierdo", "Pie izquierdo", 153.763, 715.421],
  ["pierna_derecha", "Pierna derecha", -140.026, 527.974],
  ["pierna_izquierda", "Pierna izquierda", 151.263, 520.474],
  ["brazo_derecho", "Brazo derecho", -242.955, -164.184, "brazo_izquierdo"],
  ["antebrazo_derecho", "Antebrazo derecho", -315.639, 62.658],
  ["antebrazo_izquierdo", "Antebrazo izquierdo", 278.403, 24.447],
  ["mano_izquierda", "Mano izquierda", 355.423, 215.474],
  ["cabeza", "Cabeza", -10.737, -498.684]
];

export const PROJECT_TEMPLATES = Object.freeze([
  { id: "male", name: "Humano masculino", description: "La marioneta original de Kinetra.", preview: "./assets/templates/male/preview.png" },
  { id: "female", name: "Humano femenino", description: "Personaje modular femenino de 14 capas.", preview: "./assets/templates/female/preview.png" },
  { id: "dog", name: "Perro", description: "Cuadrúpedo modular con cuatro cadenas IK.", preview: "./assets/templates/dog/preview.png" },
  { id: "blank", name: "Proyecto vacío", description: "Empieza sin capas ni huesos.", preview: null }
]);

const atlasCell = (index) => {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const x = Math.floor(column * 1024 / 3);
  const y = Math.floor(row * 1536 / 5);
  return {
    x,
    y,
    width: Math.floor((column + 1) * 1024 / 3) - x,
    height: Math.floor((row + 1) * 1536 / 5) - y
  };
};

const layer = ({ id, name, assetId, boneId = "rig", x, y, z, crop, scale = 1 }) => ({
  id,
  name,
  assetId,
  source: "asset",
  boneId,
  x,
  y,
  rotation: 0,
  scaleX: scale,
  scaleY: scale,
  visible: true,
  z,
  ...(crop ? { crop } : {})
});

function humanoidRig(id, name, size = 1) {
  return {
    id,
    name,
    bones: Object.entries(PUPPET_JOINTS).map(([boneId, pivot]) => ({
      id: boneId,
      name: HUMAN_LABELS[boneId] || boneId,
      parent: PUPPET_JOINT_PARENTS[boneId] || null,
      x: pivot.x * size,
      y: pivot.y * size
    }))
  };
}

function maleProject() {
  return {
    version: 4,
    fps: 24,
    templateId: "male",
    assets: [],
    rig: humanoidRig("humanoid", "Humano masculino"),
    parts: MALE_PARTS.map(([id, name, x, y, assetId], z) => layer({
      id,
      name,
      x,
      y,
      z,
      assetId: assetId || id,
      boneId: PUPPET_PART_JOINTS[id] || "rig"
    })).map((item) => ({ ...item, source: "builtin" })),
    clip: createStudioProject({ rig: "humanoid", anatomy: "male" })
  };
}

const FEMALE_PARTS = [
  ["female_left_upper_arm", "Brazo izquierdo", 5, "shoulderLeft", 180, -180, 0],
  ["female_left_forearm", "Antebrazo izquierdo", 6, "elbowLeft", 275, 45, 1],
  ["female_left_hand", "Mano izquierda", 7, "wristLeft", 330, 230, 2],
  ["female_left_thigh", "Muslo izquierdo", 11, "hipLeft", 105, 250, 3],
  ["female_left_shin", "Pierna izquierda", 12, "kneeLeft", 125, 510, 4],
  ["female_left_foot", "Pie izquierdo", 13, "ankleLeft", 145, 700, 5],
  ["female_torso", "Torso", 1, "rig", 0, -80, 6],
  ["female_right_thigh", "Muslo derecho", 8, "hipRight", -100, 250, 7],
  ["female_right_shin", "Pierna derecha", 9, "kneeRight", -120, 510, 8],
  ["female_right_foot", "Pie derecho", 10, "ankleRight", -140, 700, 9],
  ["female_right_upper_arm", "Brazo derecho", 2, "shoulderRight", -190, -180, 10],
  ["female_right_forearm", "Antebrazo derecho", 3, "elbowRight", -270, 45, 11],
  ["female_right_hand", "Mano derecha", 4, "wristRight", -320, 230, 12],
  ["female_head", "Cabeza", 0, "neck", -10, -500, 13]
];

function femaleProject() {
  const assetId = "female_atlas";
  const size = 0.88;
  return {
    version: 4,
    fps: 24,
    templateId: "female",
    assets: [{ id: assetId, name: "Plantilla femenina", type: "image/png", src: "./assets/templates/female/atlas.png" }],
    rig: humanoidRig("humanoid_female", "Humano femenino", size),
    parts: FEMALE_PARTS.map(([id, name, cell, boneId, x, y, z]) => layer({
      id, name, assetId, boneId, x: x * size, y: y * size, z, crop: atlasCell(cell), scale: 1.23
    })),
    clip: createStudioProject({ rig: "humanoid_female", anatomy: "female" })
  };
}

const DOG_BONES = [
  ["neck", "Cuello", null, 285, -155],
  ["tail", "Cola", null, -300, -105],
  ["shoulderRight", "Hombro delantero cercano", null, 175, 15],
  ["elbowRight", "Codo delantero cercano", "shoulderRight", 190, 205],
  ["wristRight", "Pata delantera cercana", "elbowRight", 205, 385],
  ["shoulderLeft", "Hombro delantero lejano", null, 115, 30],
  ["elbowLeft", "Codo delantero lejano", "shoulderLeft", 125, 200],
  ["wristLeft", "Pata delantera lejana", "elbowLeft", 135, 385],
  ["hipRight", "Cadera trasera cercana", null, -175, 15],
  ["kneeRight", "Rodilla trasera cercana", "hipRight", -195, 205],
  ["ankleRight", "Pata trasera cercana", "kneeRight", -215, 385],
  ["hipLeft", "Cadera trasera lejana", null, -115, 30],
  ["kneeLeft", "Rodilla trasera lejana", "hipLeft", -125, 200],
  ["ankleLeft", "Pata trasera lejana", "kneeLeft", -135, 385]
];

const DOG_CROPS = [
  { x: 0, y: 0, width: 455, height: 330 },
  { x: 450, y: 0, width: 325, height: 330 },
  { x: 770, y: 0, width: 254, height: 330 },
  ...Array.from({ length: 12 }, (_, index) => atlasCell(index + 3))
];

const DOG_PARTS = [
  ["dog_body", "Cuerpo", 0, "rig", 0, -45, 7],
  ["dog_head", "Cabeza", 1, "neck", 300, -150, 14],
  ["dog_tail", "Cola", 2, "tail", -350, -105, 6],
  ["dog_front_near_upper", "Brazo delantero cercano", 3, "shoulderRight", 175, 105, 11],
  ["dog_front_near_lower", "Antebrazo delantero cercano", 4, "elbowRight", 190, 285, 12],
  ["dog_front_near_paw", "Pie delantero cercano", 5, "wristRight", 210, 410, 13],
  ["dog_front_far_upper", "Brazo delantero lejano", 6, "shoulderLeft", 115, 110, 3],
  ["dog_front_far_lower", "Antebrazo delantero lejano", 7, "elbowLeft", 125, 280, 4],
  ["dog_front_far_paw", "Pie delantero lejano", 8, "wristLeft", 140, 410, 5],
  ["dog_rear_near_upper", "Muslo trasero cercano", 9, "hipRight", -175, 105, 8],
  ["dog_rear_near_lower", "Pierna trasera cercana", 10, "kneeRight", -195, 285, 9],
  ["dog_rear_near_paw", "Pie trasero cercano", 11, "ankleRight", -220, 410, 10],
  ["dog_rear_far_upper", "Muslo trasero lejano", 12, "hipLeft", -115, 110, 0],
  ["dog_rear_far_lower", "Pierna trasera lejana", 13, "kneeLeft", -125, 280, 1],
  ["dog_rear_far_paw", "Pie trasero lejano", 14, "ankleLeft", -140, 410, 2]
];

function dogProject() {
  const assetId = "dog_atlas";
  return {
    version: 4,
    fps: 24,
    templateId: "dog",
    assets: [{ id: assetId, name: "Plantilla de perro", type: "image/png", src: "./assets/templates/dog/atlas.png" }],
    rig: {
      id: "dog",
      name: "Perro",
      bones: DOG_BONES.map(([id, name, parent, x, y]) => ({ id, name, parent, x, y }))
    },
    parts: DOG_PARTS.map(([id, name, cell, boneId, x, y, z]) => layer({
      id, name, assetId, boneId, x, y, z, crop: DOG_CROPS[cell], scale: 1.5
    })),
    clip: createStudioProject({ rig: "dog", anatomy: "quadruped" })
  };
}

function blankProject() {
  return {
    version: 4,
    fps: 24,
    templateId: "blank",
    assets: [],
    rig: { id: "custom", name: "Rig personalizado", bones: [] },
    parts: [],
    clip: createStudioProject({ rig: "custom", anatomy: "custom" })
  };
}

export function createTemplateProject(templateId = "male") {
  if (templateId === "female") return femaleProject();
  if (templateId === "dog") return dogProject();
  if (templateId === "blank") return blankProject();
  return maleProject();
}
