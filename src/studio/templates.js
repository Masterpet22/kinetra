import {
  PUPPET_JOINTS,
  PUPPET_JOINT_PARENTS,
  PUPPET_PART_JOINTS
} from "../animations/rig.js?v=0.11.0";
import { createKinetraClip } from "../animations/studio-format.js?v=0.11.0";

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
  { id: "pie_derecho", name: "Pie derecho", x: -175.526, y: 732.316 },
  { id: "brazo_izquierdo", name: "Brazo izquierdo", sourceId: "brazo_derecho", x: 161.481, y: -174.474 },
  { id: "mano_derecha", name: "Mano derecha", x: -291.203, y: 251.237 },
  { id: "muslo_izquierdo", name: "Muslo izquierdo", x: 117.315, y: 255.895 },
  { id: "torso", name: "Pieza del torso", x: -41, y: -72.5 },
  { id: "muslo_derecho", name: "Muslo derecho", x: -93.789, y: 261.869 },
  { id: "pie_izquierdo", name: "Pie izquierdo", x: 153.763, y: 715.421 },
  { id: "pierna_derecha", name: "Pierna derecha", x: -140.026, y: 527.974 },
  { id: "pierna_izquierda", name: "Pierna izquierda", x: 151.263, y: 520.474 },
  { id: "brazo_derecho", name: "Brazo derecho", sourceId: "brazo_izquierdo", x: -242.955, y: -164.184 },
  { id: "antebrazo_derecho", name: "Antebrazo derecho", x: -315.639, y: 62.658 },
  { id: "antebrazo_izquierdo", name: "Antebrazo izquierdo", x: 278.403, y: 24.447 },
  { id: "mano_izquierda", name: "Mano izquierda", x: 355.423, y: 215.474 },
  { id: "cabeza", name: "Cabeza", x: -10.737, y: -498.684 }
];

const FEMALE_PARTS = [
  { id: "brazo_izquierdo", name: "Brazo izquierdo", sourceId: "antebrazo_izquierdo", boneId: "shoulderLeft", crop: [1257, 693, 210, 292], x: 338, y: -185, z: 0 },
  { id: "antebrazo_izquierdo", name: "Antebrazo izquierdo", sourceId: "brazo_izquierdo", boneId: "elbowLeft", crop: [1411, 959, 188, 231], x: 481, y: 50.5, z: 1 },
  { id: "mano_izquierda", name: "Mano izquierda", boneId: "wristLeft", crop: [1544, 1206, 117, 188], x: 578.5, y: 276, z: 2 },
  { id: "muslo_izquierdo", name: "Muslo izquierdo", boneId: "hipLeft", crop: [1032, 1185, 189, 353], x: 102.5, y: 337.5, z: 3 },
  { id: "pierna_izquierda", name: "Pierna izquierda", boneId: "kneeLeft", crop: [1042, 1553, 148, 250], x: 92, y: 654, z: 4 },
  { id: "pie_izquierdo", name: "Pie izquierdo", boneId: "ankleLeft", crop: [1063, 1809, 219, 179], x: 148.5, y: 874.5, z: 5 },
  { id: "torso", name: "Pieza del torso", boneId: "rig", crop: [817, 652, 364, 616], x: -25, y: -64, z: 6 },
  { id: "muslo_derecho", name: "Muslo derecho", boneId: "hipRight", crop: [797, 1185, 199, 362], x: -127.5, y: 342, z: 7 },
  { id: "pierna_derecha", name: "Pierna derecha", boneId: "kneeRight", crop: [766, 1563, 158, 251], x: -179, y: 664.5, z: 8 },
  { id: "pie_derecho", name: "Pie derecho", boneId: "ankleRight", crop: [735, 1830, 148, 168], x: -215, y: 890, z: 9 },
  { id: "brazo_derecho", name: "Brazo derecho", sourceId: "antebrazo_derecho", boneId: "shoulderRight", crop: [489, 673, 220, 312], x: -425, y: -195, z: 10 },
  { id: "antebrazo_derecho", name: "Antebrazo derecho", sourceId: "brazo_derecho", boneId: "elbowRight", crop: [449, 990, 117, 241], x: -516.5, y: 86.5, z: 11 },
  { id: "mano_derecha", name: "Mano derecha", boneId: "wristRight", crop: [459, 1235, 147, 190], x: -491.5, y: 306, z: 12 },
  { id: "cabeza", name: "Cabeza", boneId: "neck", crop: [889, 253, 261, 393], x: -4.5, y: -574.5, z: 13 }
];

const FEMALE_JOINTS = Object.freeze({
  neck: { x: 0, y: -390 },
  shoulderRight: { x: -320, y: -345 },
  elbowRight: { x: -515, y: -35 },
  wristRight: { x: -515, y: 210 },
  shoulderLeft: { x: 320, y: -345 },
  elbowLeft: { x: 520, y: -45 },
  wristLeft: { x: 560, y: 195 },
  hipRight: { x: -105, y: 160 },
  kneeRight: { x: -180, y: 525 },
  ankleRight: { x: -210, y: 805 },
  hipLeft: { x: 100, y: 160 },
  kneeLeft: { x: 105, y: 525 },
  ankleLeft: { x: 115, y: 805 }
});

export const PROJECT_TEMPLATES = Object.freeze([
  { id: "male", name: "Humano masculino", description: "Personaje modular masculino de 14 piezas." },
  { id: "female", name: "Humano femenino", description: "Personaje modular femenino de 14 piezas." },
  { id: "blank", name: "Proyecto vacío", description: "Empieza sin capas ni huesos." }
]);

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

function humanoidRig(id, name, size = 1, joints = PUPPET_JOINTS) {
  return {
    id,
    name,
    bones: Object.entries(joints).map(([boneId, pivot]) => ({
      id: boneId,
      name: HUMAN_LABELS[boneId] || boneId,
      parent: PUPPET_JOINT_PARENTS[boneId] || null,
      x: pivot.x * size,
      y: pivot.y * size
    }))
  };
}

function splitAssets(templateId, parts) {
  return [...new Set(parts.map((item) => item.sourceId || item.id))].map((sourceId) => ({
    id: `${templateId}_${sourceId}`,
    name: `${sourceId}.png`,
    type: "image/png",
    src: `./assets/templates/${templateId}/${sourceId}.png`
  }));
}

function maleProject() {
  return {
    version: 4,
    fps: 24,
    templateId: "male",
    assets: splitAssets("male", MALE_PARTS),
    rig: humanoidRig("humanoid", "Humano masculino"),
    parts: MALE_PARTS.map((item, z) => layer({
      id: item.id,
      name: item.name,
      x: item.x,
      y: item.y,
      z,
      assetId: `male_${item.sourceId || item.id}`,
      boneId: PUPPET_PART_JOINTS[item.id] || "rig"
    })),
    clip: createKinetraClip()
  };
}

function femaleProject() {
  const size = 0.88;
  return {
    version: 4,
    fps: 24,
    templateId: "female",
    assets: splitAssets("female", FEMALE_PARTS),
    rig: humanoidRig("humanoid_female", "Humano femenino", size, FEMALE_JOINTS),
    parts: FEMALE_PARTS.map((item) => layer({
      id: item.id,
      name: item.name,
      assetId: `female_${item.sourceId || item.id}`,
      boneId: item.boneId,
      x: item.x * size,
      y: item.y * size,
      z: item.z,
      crop: { x: item.crop[0], y: item.crop[1], width: item.crop[2], height: item.crop[3] },
      scale: size
    })),
    clip: createKinetraClip()
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
    clip: createKinetraClip()
  };
}

export function createTemplateProject(templateId = "male") {
  if (templateId === "female") return femaleProject();
  if (templateId === "blank") return blankProject();
  return maleProject();
}
