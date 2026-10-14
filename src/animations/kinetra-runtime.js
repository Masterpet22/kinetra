/** Runtime portable de Kinetra v2: no depende del DOM ni del editor. */
import { sampleKeyframeAnimationPose } from "./runtime.js?v=0.10.0";

export const KINETRA_SCHEMA = "kinetra/v2";

export const multiplyMatrix = (left, right) => [
  left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5]
];

const translateMatrix = (x = 0, y = 0) => [1, 0, 0, 1, x, y];
const rotateMatrix = (angle = 0) => {
  const radians = angle * Math.PI / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
};
const scaleMatrix = (x = 1, y = x) => [x, 0, 0, y, 0, 0];

export function transformMatrix(transform = {}) {
  return multiplyMatrix(
    multiplyMatrix(translateMatrix(transform.x || 0, transform.y || 0), rotateMatrix(transform.angle || 0)),
    scaleMatrix(1 + (transform.scaleX || 0), 1 + (transform.scaleY || 0))
  );
}

export function validateKinetraProject(project) {
  const errors = [];
  if (!project || typeof project !== "object") return ["El proyecto debe ser un objeto"];
  if (project.schema !== KINETRA_SCHEMA) errors.push(`schema debe ser ${KINETRA_SCHEMA}`);
  if (!project.rig || !Array.isArray(project.rig.bones)) errors.push("rig.bones debe ser una lista");
  if (!Array.isArray(project.layers)) errors.push("layers debe ser una lista");
  if (!Array.isArray(project.assets)) errors.push("assets debe ser una lista");
  if (!Array.isArray(project.clips)) errors.push("clips debe ser una lista");
  const boneIds = new Set(["rig"]);
  (project.rig?.bones || []).forEach((bone, index) => {
    if (!bone?.id || boneIds.has(bone.id)) errors.push(`rig.bones[${index}].id inválido o duplicado`);
    else boneIds.add(bone.id);
    if (!Number.isFinite(bone?.x) || !Number.isFinite(bone?.y)) errors.push(`rig.bones[${index}] necesita pivote numérico`);
  });
  (project.rig?.bones || []).forEach((bone, index) => {
    if (bone.parent && !boneIds.has(bone.parent)) errors.push(`rig.bones[${index}].parent no existe`);
  });
  const assetIds = new Set();
  (project.assets || []).forEach((asset, index) => {
    if (!asset?.id || assetIds.has(asset.id)) errors.push(`assets[${index}].id inválido o duplicado`);
    else assetIds.add(asset.id);
    if (typeof asset?.src !== "string" || !asset.src) errors.push(`assets[${index}].src debe identificar la imagen`);
  });
  (project.rig?.bones || []).forEach((bone, index) => {
    const visited = new Set([bone.id]);
    let parent = bone.parent;
    while (parent) {
      if (visited.has(parent)) {
        errors.push(`rig.bones[${index}] forma un ciclo jerárquico`);
        break;
      }
      visited.add(parent);
      parent = project.rig.bones.find((candidate) => candidate.id === parent)?.parent || null;
    }
  });
  const layerIds = new Set();
  (project.layers || []).forEach((layer, index) => {
    if (!layer?.id || layerIds.has(layer.id)) errors.push(`layers[${index}].id inválido o duplicado`);
    layerIds.add(layer?.id);
    if (!assetIds.has(layer?.assetId) && layer?.source !== "builtin") errors.push(`layers[${index}].assetId no existe`);
    if (layer?.boneId && !boneIds.has(layer.boneId)) errors.push(`layers[${index}].boneId no existe`);
  });
  const clipIds = new Set();
  (project.clips || []).forEach((clip, index) => {
    if (!clip?.id || clipIds.has(clip.id)) errors.push(`clips[${index}].id inválido o duplicado`);
    else clipIds.add(clip.id);
    if (!Number.isFinite(clip?.duration) || clip.duration <= 0) errors.push(`clips[${index}].duration debe ser positivo`);
    if (!clip?.keys || typeof clip.keys !== "object" || Array.isArray(clip.keys)) errors.push(`clips[${index}].keys debe ser un objeto`);
    Object.entries(clip?.keys || {}).forEach(([target, frames]) => {
      if (!boneIds.has(target) && target !== "torso") errors.push(`clips[${index}].keys.${target} no pertenece al rig`);
      if (!Array.isArray(frames)) errors.push(`clips[${index}].keys.${target} debe ser una lista`);
    });
  });
  return errors;
}

export function sampleKinetraClip(project, clipId, time) {
  const clip = project.clips.find((item) => item.id === clipId) || project.clips[0];
  if (!clip) return {};
  return sampleKeyframeAnimationPose(clip, time);
}

export function resolveKinetraRig(project, pose = {}) {
  const bones = new Map((project.rig?.bones || []).map((bone) => [bone.id, bone]));
  const root = transformMatrix(pose.rig);
  const matrices = { rig: root };
  const resolving = new Set();
  function resolve(id) {
    if (matrices[id]) return matrices[id];
    const bone = bones.get(id);
    if (!bone || resolving.has(id)) return root;
    resolving.add(id);
    const parent = bone.parent && bones.has(bone.parent) ? bones.get(bone.parent) : null;
    const parentMatrix = parent ? resolve(parent.id) : root;
    const fromX = parent?.x || 0;
    const fromY = parent?.y || 0;
    matrices[id] = multiplyMatrix(
      multiplyMatrix(parentMatrix, translateMatrix(bone.x - fromX, bone.y - fromY)),
      transformMatrix(pose[id])
    );
    resolving.delete(id);
    return matrices[id];
  }
  bones.forEach((_, id) => resolve(id));
  return matrices;
}

/**
 * Resuelve una instantánea lista para Canvas, Phaser, PixiJS u otro motor web.
 * Cada capa devuelve su matriz afín [a,b,c,d,e,f] y el recurso que debe usar.
 */
export function resolveKinetraFrame(project, clipId, time) {
  const pose = sampleKinetraClip(project, clipId, time);
  const bones = resolveKinetraRig(project, pose);
  const rest = new Map((project.rig?.bones || []).map((bone) => [bone.id, bone]));
  const assets = new Map((project.assets || []).map((asset) => [asset.id, asset]));
  const layers = [...(project.layers || [])]
    .filter((layer) => layer.visible !== false)
    .sort((left, right) => (left.z || 0) - (right.z || 0))
    .map((layer) => {
      const boneId = layer.boneId || "rig";
      const anchor = rest.get(boneId) || { x: 0, y: 0 };
      const parent = bones[boneId] || bones.rig;
      const calibration = multiplyMatrix(
        multiplyMatrix(translateMatrix((layer.x || 0) - anchor.x, (layer.y || 0) - anchor.y), rotateMatrix(layer.rotation || 0)),
        scaleMatrix(layer.scaleX ?? 1, layer.scaleY ?? 1)
      );
      return {
        id: layer.id,
        assetId: layer.assetId,
        asset: assets.get(layer.assetId) || null,
        opacity: layer.opacity ?? 1,
        matrix: multiplyMatrix(parent, calibration)
      };
    });
  return { pose, bones, layers };
}

export function createKinetraBundle(authoringProject) {
  const bundle = {
    schema: KINETRA_SCHEMA,
    name: authoringProject.clip.animation.label,
    fps: Number(authoringProject.fps || 24),
    rig: structuredClone(authoringProject.rig),
    assets: structuredClone(authoringProject.assets || []),
    layers: structuredClone(authoringProject.parts || []),
    clips: [structuredClone(authoringProject.clip.animation)]
  };
  const errors = validateKinetraProject(bundle);
  if (errors.length) throw new Error(`Proyecto Kinetra v2 inválido:\n${errors.join("\n")}`);
  return bundle;
}
