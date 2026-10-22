import {
  PUPPET_JOINTS,
  PUPPET_JOINT_PARENTS,
  PUPPET_NECK_CONTROL,
  PUPPET_PART_JOINTS,
  PUPPET_ROOT_POSITION_LOCK
} from "../animations/rig.js";
import { createKinetraClip } from "../animations/studio-format.js";

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
  {
    id: "brazo_izquierdo",
    name: "Brazo izquierdo",
    sourceId: "antebrazo_izquierdo",
    boneId: "shoulderLeft",
    crop: [1257, 693, 210, 292],
    x: 137.717778,
    y: -155.855556,
    z: 0
  },
  {
    id: "antebrazo_izquierdo",
    name: "Antebrazo izquierdo",
    sourceId: "brazo_izquierdo",
    boneId: "elbowLeft",
    crop: [1411, 959, 188, 231],
    x: 228.835556,
    y: 13.19,
    z: 1
  },
  {
    id: "mano_izquierda",
    name: "Mano izquierda",
    boneId: "wristLeft",
    crop: [1544, 1206, 117, 188],
    x: 304.218889,
    y: 166.491111,
    z: 2
  },
  {
    id: "muslo_izquierdo",
    name: "Muslo izquierdo",
    boneId: "hipLeft",
    crop: [1032, 1185, 189, 353],
    x: 69.366667,
    y: 227.555556,
    z: 3
  },
  {
    id: "pierna_izquierda",
    name: "Pierna izquierda",
    boneId: "kneeLeft",
    crop: [1042, 1553, 148, 250],
    x: 80.96,
    y: 460.936667,
    z: 4
  },
  {
    id: "pie_izquierdo",
    name: "Pie izquierdo",
    boneId: "ankleLeft",
    crop: [1063, 1809, 219, 179],
    x: 130.68,
    y: 613.31,
    z: 5
  },
  { id: "torso", name: "Pieza del torso", boneId: "rig", crop: [817, 652, 364, 616], x: -22, y: -56.32, z: 6 },
  {
    id: "muslo_derecho",
    name: "Muslo derecho",
    boneId: "hipRight",
    crop: [797, 1185, 199, 362],
    x: -87.894444,
    y: 231.515556,
    z: 7
  },
  {
    id: "pierna_derecha",
    name: "Pierna derecha",
    boneId: "kneeRight",
    crop: [766, 1563, 158, 251],
    x: -119.325556,
    y: 466.704444,
    z: 8
  },
  {
    id: "pie_derecho",
    name: "Pie derecho",
    boneId: "ankleRight",
    crop: [735, 1830, 148, 168],
    x: -147.533333,
    y: 616.533333,
    z: 9
  },
  {
    id: "brazo_derecho",
    name: "Brazo derecho",
    sourceId: "antebrazo_derecho",
    boneId: "shoulderRight",
    crop: [489, 673, 220, 312],
    x: -186.5,
    y: -143.822222,
    restRotation: -12,
    z: 10
  },
  {
    id: "antebrazo_derecho",
    name: "Antebrazo derecho",
    sourceId: "brazo_derecho",
    boneId: "elbowRight",
    crop: [449, 990, 117, 241],
    x: -235.77,
    y: 62.231111,
    restRotation: 6,
    z: 11
  },
  {
    id: "mano_derecha",
    name: "Mano derecha",
    boneId: "wristRight",
    crop: [459, 1235, 147, 190],
    x: -234.603333,
    y: 213.724444,
    restRotation: 4,
    z: 12
  },
  { id: "cabeza", name: "Cabeza", boneId: "neck", crop: [889, 253, 261, 393], x: -3.96, y: -443.06, z: 13 }
];

const FEMALE_JOINTS = Object.freeze({
  neck: { x: 0, y: -292.2 },
  shoulderRight: { x: -167.78, y: -271.37 },
  elbowRight: { x: -224.11, y: -24.14 },
  wristRight: { x: -249.54, y: 145.85 },
  shoulderLeft: { x: 95.36, y: -269.89 },
  elbowLeft: { x: 198.12, y: -60.41 },
  wristLeft: { x: 284.58, y: 96.99 },
  hipRight: { x: -92.4, y: 140.8 },
  kneeRight: { x: -106.54, y: 370.16 },
  ankleRight: { x: -136.24, y: 556.99 },
  hipLeft: { x: 88, y: 140.8 },
  kneeLeft: { x: 84.57, y: 363.76 },
  ankleLeft: { x: 86.01, y: 550.29 }
});

export const PROJECT_TEMPLATES = Object.freeze([
  { id: "male", name: "Humano masculino", description: "Personaje modular masculino de 14 piezas." },
  { id: "female", name: "Humano femenino", description: "Personaje modular femenino de 14 piezas." },
  { id: "blank", name: "Proyecto vacío", description: "Empieza sin capas ni huesos." }
]);

const layer = ({ id, name, assetId, boneId = "rig", x, y, rotation = 0, restRotation = 0, z, crop, scale = 1 }) => ({
  id,
  name,
  assetId,
  source: "asset",
  boneId,
  x,
  y,
  rotation,
  ...(restRotation ? { restRotation } : {}),
  scaleX: scale,
  scaleY: scale,
  visible: true,
  z,
  ...(crop ? { crop } : {})
});

function humanoidRig(id, name, size = 1, joints = PUPPET_JOINTS, boneOptions = {}) {
  return {
    id,
    name,
    bones: Object.entries(joints).map(([boneId, pivot]) => ({
      id: boneId,
      name: HUMAN_LABELS[boneId] || boneId,
      parent: PUPPET_JOINT_PARENTS[boneId] || null,
      x: pivot.x * size,
      y: pivot.y * size,
      ...(boneOptions[boneId] || {})
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
  const rootBoneOptions = Object.fromEntries(
    Object.entries(PUPPET_JOINT_PARENTS)
      .filter(([boneId, parent]) => !parent && boneId !== "neck")
      .map(([boneId]) => [boneId, { motionLimits: PUPPET_ROOT_POSITION_LOCK }])
  );
  return {
    version: 4,
    fps: 24,
    templateId: "male",
    assets: splitAssets("male", MALE_PARTS),
    rig: humanoidRig("humanoid", "Humano masculino", 1, PUPPET_JOINTS, {
      ...rootBoneOptions,
      neck: PUPPET_NECK_CONTROL
    }),
    parts: MALE_PARTS.map((item, z) =>
      layer({
        id: item.id,
        name: item.name,
        x: item.x,
        y: item.y,
        z,
        assetId: `male_${item.sourceId || item.id}`,
        boneId: item.id === "torso" ? "torso" : PUPPET_PART_JOINTS[item.id] || "rig",
        crop: null
      })
    ),
    clip: createKinetraClip()
  };
}

function femaleProject() {
  const rootBoneOptions = Object.fromEntries(
    Object.entries(PUPPET_JOINT_PARENTS)
      .filter(([boneId, parent]) => !parent && boneId !== "neck")
      .map(([boneId]) => [boneId, { motionLimits: PUPPET_ROOT_POSITION_LOCK }])
  );
  return {
    version: 4,
    fps: 24,
    templateId: "female",
    assets: splitAssets("female", FEMALE_PARTS),
    rig: humanoidRig("humanoid_female", "Humano femenino", 1, FEMALE_JOINTS, {
      ...rootBoneOptions,
      neck: PUPPET_NECK_CONTROL
    }),
    parts: FEMALE_PARTS.map((item) =>
      layer({
        id: item.id,
        name: item.name,
        assetId: `female_${item.sourceId || item.id}`,
        boneId: item.id === "torso" ? "torso" : item.boneId,
        x: item.x,
        y: item.y,
        rotation: 0,
        restRotation: item.restRotation || 0,
        z: item.z,
        crop: { x: item.crop[0], y: item.crop[1], width: item.crop[2], height: item.crop[3] },
        scale: 0.88
      })
    ),
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
