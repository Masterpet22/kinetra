export const PUPPET_JOINTS = Object.freeze({
  neck: { x: 0, y: -315 },
  shoulderRight: { x: -207, y: -310 },
  elbowRight: { x: -305, y: -38 },
  wristRight: { x: -304, y: 169 },
  shoulderLeft: { x: 139, y: -310 },
  elbowLeft: { x: 232, y: -57 },
  wristLeft: { x: 319, y: 134 },
  hipRight: { x: -94, y: 142 },
  kneeRight: { x: -124, y: 407 },
  ankleRight: { x: -153, y: 674 },
  hipLeft: { x: 112, y: 142 },
  kneeLeft: { x: 139, y: 401 },
  ankleLeft: { x: 151, y: 670 }
});

export const PUPPET_JOINT_PARENTS = Object.freeze({
  neck: null,
  shoulderRight: null,
  elbowRight: "shoulderRight",
  wristRight: "elbowRight",
  shoulderLeft: null,
  elbowLeft: "shoulderLeft",
  wristLeft: "elbowLeft",
  hipRight: null,
  kneeRight: "hipRight",
  ankleRight: "kneeRight",
  hipLeft: null,
  kneeLeft: "hipLeft",
  ankleLeft: "kneeLeft"
});

export const PUPPET_PART_JOINTS = Object.freeze({
  cabeza: "neck",
  brazo_derecho: "shoulderRight",
  antebrazo_derecho: "elbowRight",
  mano_derecha: "wristRight",
  brazo_izquierdo: "shoulderLeft",
  antebrazo_izquierdo: "elbowLeft",
  mano_izquierda: "wristLeft",
  muslo_derecho: "hipRight",
  pierna_derecha: "kneeRight",
  pie_derecho: "ankleRight",
  muslo_izquierdo: "hipLeft",
  pierna_izquierda: "kneeLeft",
  pie_izquierdo: "ankleLeft"
});

export const PUPPET_TARGETS = Object.freeze([
  "body", "rig", "shadow", "torso", ...Object.keys(PUPPET_JOINTS)
]);
