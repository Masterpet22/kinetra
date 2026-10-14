/**
 * Controlador visual de Kinetra.
 * Une calibración, autoría por fotogramas clave, timeline, historial y exportación.
 */
import {
  PUPPET_JOINTS as JOINTS,
  PUPPET_JOINT_PARENTS as PARENTS,
  PUPPET_PART_JOINTS as PART_JOINTS,
  PUPPET_TARGETS
} from "../animations/rig.js?v=0.3.0";
import { animationEase } from "../animations/runtime.js?v=0.3.0";
import {
  createStudioProject,
  normalizeStudioProject,
  parseStudioProject,
  serializeStudioProject,
  STUDIO_EASES,
  validateStudioProject
} from "../animations/studio-format.js?v=0.3.0";
import { sampleStudioAnimation } from "../animations/studio-runtime.js?v=0.3.0";
import {
  constrainedTranslation,
  GIZMO_METRICS,
  hitMoveGizmo,
  hitRotateGizmo,
  hitScaleGizmo,
  scaleFromDrag,
  shortestAngleDelta
} from "./gizmo.js?v=0.3.0";
import { solveTwoBoneIk } from "./ik.js?v=0.3.0";

const $ = (id) => document.getElementById(id);
const BASE_SCALE = 0.32;
const STORAGE_KEY = "kinetra:project";
const TARGETS = [...new Set(["rig", "torso", ...Object.keys(JOINTS)])];
const LABELS = {
  rig: "Torso",
  torso: "Pieza del torso",
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
};
const TREE = [{ id: "rig", children: [
  { id: "neck" },
  { id: "shoulderRight", children: [{ id: "elbowRight", children: [{ id: "wristRight" }] }] },
  { id: "shoulderLeft", children: [{ id: "elbowLeft", children: [{ id: "wristLeft" }] }] },
  { id: "hipRight", children: [{ id: "kneeRight", children: [{ id: "ankleRight" }] }] },
  { id: "hipLeft", children: [{ id: "kneeLeft", children: [{ id: "ankleLeft" }] }] }
]}];
const PRESET = [
  ["pie_derecho", -175.526, 732.316], ["brazo_izquierdo", 161.481, -174.474, "brazo_derecho"],
  ["mano_derecha", -291.203, 251.237], ["muslo_izquierdo", 117.315, 255.895],
  ["torso", -41, -72.5], ["muslo_derecho", -93.789, 261.869],
  ["pie_izquierdo", 153.763, 715.421], ["pierna_derecha", -140.026, 527.974],
  ["pierna_izquierda", 151.263, 520.474], ["brazo_derecho", -242.955, -164.184, "brazo_izquierdo"],
  ["antebrazo_derecho", -315.639, 62.658], ["antebrazo_izquierdo", 278.403, 24.447],
  ["mano_izquierda", 355.423, 215.474], ["cabeza", -10.737, -498.684]
];
const TRANSFORM_FIELDS = {
  x: "key-x", y: "key-y", angle: "key-angle", alpha: "key-alpha",
  scaleX: "key-scale-x", scaleY: "key-scale-y"
};
const MIRROR_TARGETS = Object.freeze({
  rig: "rig", torso: "torso", neck: "neck",
  shoulderRight: "shoulderLeft", shoulderLeft: "shoulderRight",
  elbowRight: "elbowLeft", elbowLeft: "elbowRight",
  wristRight: "wristLeft", wristLeft: "wristRight",
  hipRight: "hipLeft", hipLeft: "hipRight",
  kneeRight: "kneeLeft", kneeLeft: "kneeRight",
  ankleRight: "ankleLeft", ankleLeft: "ankleRight"
});
const IK_CHAINS = Object.freeze({
  wristRight: { upper: "shoulderRight", middle: "elbowRight" },
  wristLeft: { upper: "shoulderLeft", middle: "elbowLeft" },
  ankleRight: { upper: "hipRight", middle: "kneeRight" },
  ankleLeft: { upper: "hipLeft", middle: "kneeLeft" }
});

const freshParts = () => PRESET.map(([id, x, y, assetId], z) => ({
  id, x, y, assetId: assetId || id, rotation: 0, scaleX: 1, scaleY: 1, visible: true, z
}));
const freshProject = () => ({ version: 2, fps: 24, parts: freshParts(), clip: createStudioProject() });
const label = (id) => LABELS[id] || id.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());

let project = freshProject();
let mode = "animador";
let leftTab = "skeleton";
let rightTab = "inspector";
let tool = "select";
let selectedTarget = "rig";
let selectedTargets = new Set(["rig"]);
let selectedPart = "torso";
let selectedKeys = new Set();
let keyClipboard = [];
let hiddenTargets = new Set();
let lockedTargets = new Set();
let lockedParts = new Set();
let time = 0;
let zoom = 1;
let timelineZoom = 1;
let offsetX = 0;
let offsetY = 0;
let playing = false;
let lastTick = 0;
let animationFrame = 0;
let interaction = null;
let dragKey = null;
let undoHistory = [];
let historyIndex = -1;
let draftTime = null;
let draftFrames = new Map();
let ghostPose = null;
let ghostTime = null;

const canvas = $("canvas");
const context = canvas.getContext("2d");
const previewCanvas = $("preview-canvas");
const previewContext = previewCanvas.getContext("2d");
const images = {};

function status(message) { $("status").textContent = message; }
function duration() { return project.clip.animation.duration; }
function fps() { return Number(project.fps || 24); }
function part() { return project.parts.find((item) => item.id === selectedPart); }
function selectionLabel() { return selectedTargets.size > 1 ? `${selectedTargets.size} objetivos` : label(selectedTarget); }
function selectAnimationTarget(target, append = false) {
  if (!append) selectedTargets = new Set([target]);
  else if (selectedTargets.has(target) && selectedTargets.size > 1) selectedTargets.delete(target);
  else selectedTargets.add(target);
  selectedTarget = selectedTargets.has(target) ? target : [...selectedTargets].at(-1);
}
function committedPose(at = time) { return sampleStudioAnimation(project.clip, at, PUPPET_TARGETS); }
function frameTransform(frame = {}) {
  return Object.fromEntries(Object.keys(TRANSFORM_FIELDS)
    .filter((property) => Object.hasOwn(frame, property))
    .map((property) => [property, frame[property]]));
}
function pose(at = time) {
  const sampled = committedPose(at);
  if (draftTime !== null && Math.abs(at - draftTime) < 0.5) {
    draftFrames.forEach((frame, target) => {
      sampled[target] = { ...(sampled[target] || {}), ...frameTransform(frame) };
    });
  }
  return sampled;
}
function snapshot() { return JSON.stringify(project); }

function hasDraft() { return draftTime !== null && draftFrames.size > 0; }

function clearDraft() {
  draftTime = null;
  draftFrames.clear();
  updateDraftUI();
}

function beginDraft(at = Math.round(time)) {
  if (draftTime === at) return;
  draftTime = at;
  draftFrames = new Map();
}

function draftFrame(target) {
  if (draftTime !== Math.round(time)) return null;
  return draftFrames.get(target) || null;
}

function ensureDraftFrame(target) {
  const at = Math.round(time);
  beginDraft(at);
  if (!draftFrames.has(target)) {
    const sampled = committedPose(at)[target] || {};
    const saved = exactKey(target, at);
    draftFrames.set(target, { t: at, ...frameTransform(sampled), ...(saved ? structuredClone(saved) : {}) });
  }
  return draftFrames.get(target);
}

function setDraftFrame(target, frame) {
  const at = Math.round(time);
  beginDraft(at);
  draftFrames.set(target, { ...structuredClone(frame), t: at });
  selectedKeys = new Set([...draftFrames.keys()].map((item) => `${item}:${at}`));
  updateDraftUI();
}

function updateDraftUI() {
  const host = $("draft-status");
  if (!host) return;
  const dirty = hasDraft();
  host.classList.toggle("dirty", dirty);
  host.textContent = dirty
    ? draftTime === Math.round(time)
      ? `${draftFrames.size} objetivo(s) con cambios sin guardar · ${draftTime} ms`
      : `Borrador pendiente en ${draftTime} ms`
    : "Sin cambios pendientes";
  $("set-key")?.classList.toggle("dirty", dirty);
  if ($("discard-key-draft")) $("discard-key-draft").disabled = !dirty;
  updateHistoryButtons();
}

function setGhostFromCommitted(at) {
  ghostPose = structuredClone(committedPose(at));
  ghostTime = Math.round(at);
  updateGhostLabel();
}

function clearGhost() {
  ghostPose = null;
  ghostTime = null;
  updateGhostLabel();
}

function updateGhostLabel() {
  const output = $("ghost-label");
  if (output) output.textContent = ghostPose ? `Guardado · ${ghostTime} ms` : "Sin referencia";
}

function normalizeLoadedProject(candidate) {
  if (candidate?.clip) {
    if (!Array.isArray(candidate.parts)) throw new Error("El proyecto no contiene piezas");
    const clip = parseStudioProject(JSON.stringify(candidate.clip), { allowedTargets: PUPPET_TARGETS });
    return { version: 2, fps: Number(candidate.fps || 24), parts: candidate.parts, clip };
  }
  const clip = parseStudioProject(JSON.stringify(candidate), { allowedTargets: PUPPET_TARGETS });
  return { version: 2, fps: 24, parts: freshParts(), clip };
}

function loadInitialProject() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored) return normalizeLoadedProject(stored);
    const legacy = JSON.parse(localStorage.getItem("cronicas-studio:calibration:male") || "null");
    if (legacy?.version === 2 && Array.isArray(legacy.parts)) {
      const next = freshProject();
      const byId = new Map(legacy.parts.map((item) => [item.id, item]));
      next.parts.forEach((item) => Object.assign(item, byId.get(item.id) || {}));
      return next;
    }
  } catch (error) {
    console.warn("Se ignoró una copia local inválida", error);
  }
  return freshProject();
}

function saveLocal(message = null) {
  project.clip = normalizeStudioProject(project.clip);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    if (message) status(message);
  } catch (error) {
    console.warn("No se pudo guardar la copia local", error);
    status("El navegador no permitió guardar la copia local; exporta el proyecto para no perder cambios");
  }
}

function checkpoint() {
  const current = snapshot();
  if (undoHistory[historyIndex] === current) return;
  undoHistory.splice(historyIndex + 1);
  undoHistory.push(current);
  if (undoHistory.length > 80) undoHistory.shift();
  historyIndex = undoHistory.length - 1;
  updateHistoryButtons();
}

function commit(message) {
  saveLocal();
  checkpoint();
  if (message) status(message);
}

function restoreHistory(index) {
  if (index < 0 || index >= undoHistory.length) return;
  historyIndex = index;
  project = JSON.parse(undoHistory[historyIndex]);
  project.clip = normalizeStudioProject(project.clip);
  time = Math.min(time, duration());
  clearDraft();
  resetGhostFromProject(time);
  ensureImages();
  saveLocal();
  refresh();
  updateHistoryButtons();
}

function undo() {
  if (hasDraft()) {
    clearDraft();
    selectedKeys.clear();
    refresh();
    status("Cambios sin guardar deshechos");
    return;
  }
  if (historyIndex <= 0) return status("No hay cambios anteriores");
  restoreHistory(historyIndex - 1);
  status("Cambio deshecho");
}

function redo() {
  if (hasDraft()) return status("Guarda o descarta el borrador antes de rehacer");
  if (historyIndex >= undoHistory.length - 1) return status("No hay cambios para rehacer");
  restoreHistory(historyIndex + 1);
  status("Cambio rehecho");
}

function updateHistoryButtons() {
  $("undo").disabled = !hasDraft() && historyIndex <= 0;
  $("redo").disabled = historyIndex >= undoHistory.length - 1;
}

function ensureImages() {
  project.parts.forEach((item) => {
    if (images[item.id]?.dataset.assetId === item.assetId) return;
    const image = new Image();
    image.dataset.assetId = item.assetId;
    image.src = `./assets/modular/man_sprites/runtime/${encodeURIComponent(item.assetId || item.id)}.png`;
    image.onload = draw;
    images[item.id] = image;
  });
}

const multiply = (left, right) => [
  left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5]
];
const translate = (x = 0, y = 0) => [1, 0, 0, 1, x, y];
const rotate = (angle = 0) => {
  const radians = angle * Math.PI / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
};
const scale = (x = 1, y = x) => [x, 0, 0, y, 0, 0];
const point = (matrix, x, y) => ({ x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] });
function localDelta(matrix, x, y) {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < 1e-8) return { x, y };
  return {
    x: (matrix[3] * x - matrix[2] * y) / determinant,
    y: (-matrix[1] * x + matrix[0] * y) / determinant
  };
}
function transformMatrix(transform = {}) {
  return multiply(
    multiply(translate(transform.x || 0, transform.y || 0), rotate(transform.angle || 0)),
    scale(1 + (transform.scaleX || 0), 1 + (transform.scaleY || 0))
  );
}

function parentMatrixForTarget(target, state) {
  if (target === "rig") return [1, 0, 0, 1, 0, 0];
  if (target === "torso") return state.root;
  const parent = PARENTS[target];
  return parent ? state.joints[parent] : state.root;
}

function matrices(at = time, sampledPose = null) {
  const sampled = sampledPose || pose(at);
  const root = transformMatrix(sampled.rig);
  const memo = {};
  function joint(id) {
    if (memo[id]) return memo[id];
    const parent = PARENTS[id];
    const current = JOINTS[id];
    const from = parent ? JOINTS[parent] : { x: 0, y: 0 };
    const parentMatrix = parent ? joint(parent) : root;
    return (memo[id] = multiply(multiply(parentMatrix, translate(current.x - from.x, current.y - from.y)), transformMatrix(sampled[id])));
  }
  Object.keys(JOINTS).forEach(joint);
  return { joints: memo, pose: sampled, root };
}

function resizeCanvas(target, targetContext) {
  const box = target.getBoundingClientRect();
  const ratio = devicePixelRatio || 1;
  const width = Math.max(1, Math.round(box.width * ratio));
  const height = Math.max(1, Math.round(box.height * ratio));
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  targetContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  targetContext.imageSmoothingEnabled = false;
}

function origin() {
  const viewScale = BASE_SCALE * zoom;
  return { x: canvas.clientWidth / 2 + offsetX, y: canvas.clientHeight / 2 - 80 * viewScale + offsetY };
}

function toWorld(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const base = origin();
  const viewScale = BASE_SCALE * zoom;
  return { x: (clientX - box.left - base.x) / viewScale, y: (clientY - box.top - base.y) / viewScale };
}

function toCanvasPoint(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
}

function worldToCanvasPoint(x, y) {
  const base = origin();
  const viewScale = BASE_SCALE * zoom;
  return { x: base.x + x * viewScale, y: base.y + y * viewScale };
}

function targetHidden(partId) {
  if (hiddenTargets.has("rig")) return true;
  const target = PART_JOINTS[partId] || (partId === "torso" ? "torso" : null);
  return target ? hiddenTargets.has(target) : false;
}

function renderFigure(targetContext, at, { alpha = 1, tint = false, sampledPose = null } = {}) {
  const state = matrices(at, sampledPose);
  targetContext.save();
  targetContext.globalAlpha *= alpha;
  [...project.parts].sort((left, right) => left.z - right.z).forEach((item) => {
    if (!item.visible || targetHidden(item.id)) return;
    const image = images[item.id];
    if (!image?.complete || !image.naturalWidth) return;
    const jointId = PART_JOINTS[item.id];
    const targetId = jointId || (item.id === "torso" ? "torso" : "rig");
    const matrix = jointId
      ? state.joints[jointId]
      : multiply(state.root, targetId === "torso" ? transformMatrix(state.pose.torso) : [1, 0, 0, 1, 0, 0]);
    const anchor = jointId ? JOINTS[jointId] : { x: 0, y: 0 };
    const visibility = Math.max(0, Math.min(1, 1 + (state.pose.rig?.alpha || 0) + (state.pose[targetId]?.alpha || 0)));
    targetContext.save();
    targetContext.globalAlpha *= visibility;
    targetContext.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    targetContext.translate(item.x - anchor.x, item.y - anchor.y);
    targetContext.rotate(item.rotation * Math.PI / 180);
    targetContext.scale(item.scaleX, item.scaleY);
    targetContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    if (tint) {
      targetContext.globalCompositeOperation = "source-atop";
      targetContext.globalAlpha *= 0.45;
      targetContext.fillStyle = "#79b8ef";
      targetContext.fillRect(-image.naturalWidth / 2, -image.naturalHeight / 2, image.naturalWidth, image.naturalHeight);
    }
    targetContext.restore();
  });
  targetContext.restore();
}

function drawGrid(width, height, base, viewScale) {
  if (!$("grid").checked) return;
  const left = -base.x / viewScale;
  const right = (width - base.x) / viewScale;
  const top = -base.y / viewScale;
  const bottom = (height - base.y) / viewScale;
  context.strokeStyle = "#1e3449";
  context.lineWidth = 1 / viewScale;
  context.beginPath();
  for (let x = Math.ceil(left / 50) * 50; x < right; x += 50) { context.moveTo(x, top); context.lineTo(x, bottom); }
  for (let y = Math.ceil(top / 50) * 50; y < bottom; y += 50) { context.moveTo(left, y); context.lineTo(right, y); }
  context.stroke();
  context.strokeStyle = "#325979";
  context.beginPath();
  context.moveTo(0, top); context.lineTo(0, bottom); context.moveTo(left, 0); context.lineTo(right, 0); context.stroke();
}

function drawBones(at) {
  if (!$("bones").checked) return;
  const state = matrices(at);
  Object.entries(state.joints).forEach(([id, matrix]) => {
    const parent = PARENTS[id];
    const parentMatrix = parent ? state.joints[parent] : state.root;
    context.strokeStyle = selectedTargets.has(id) ? "#efbd67" : "#63c9ff";
    context.fillStyle = selectedTargets.has(id) ? "#ffd68e" : "#83d9ff";
    context.lineWidth = 3 / (BASE_SCALE * zoom);
    context.beginPath();
    context.moveTo(parentMatrix[4], parentMatrix[5]);
    context.lineTo(matrix[4], matrix[5]);
    context.stroke();
    context.beginPath();
    context.arc(matrix[4], matrix[5], 7 / (BASE_SCALE * zoom), 0, Math.PI * 2);
    context.fill();
  });
}

function targetMatrix(state, target = selectedTarget) {
  if (target === "rig") return state.root;
  if (target === "torso") return multiply(state.root, transformMatrix(state.pose.torso));
  return state.joints[target] || state.root;
}

function transformGizmoCenter(state, target = selectedTarget) {
  if (selectedTargets.size > 1 && target === selectedTarget) {
    const points = [...selectedTargets].map((item) => targetMatrix(state, item));
    const world = {
      x: points.reduce((sum, matrix) => sum + matrix[4], 0) / points.length,
      y: points.reduce((sum, matrix) => sum + matrix[5], 0) / points.length
    };
    return { world, canvas: worldToCanvasPoint(world.x, world.y) };
  }
  const matrix = targetMatrix(state, target);
  return {
    world: { x: matrix[4], y: matrix[5] },
    canvas: worldToCanvasPoint(matrix[4], matrix[5])
  };
}

function transformGizmoAngle(state, target = selectedTarget) {
  if (selectedTargets.size > 1 && target === selectedTarget) return 0;
  const matrix = tool === "select" ? parentMatrixForTarget(target, state) : targetMatrix(state, target);
  return Math.atan2(matrix[1], matrix[0]);
}

function rotateCanvasDelta(dx, dy, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: cosine * dx + sine * dy, y: -sine * dx + cosine * dy };
}

function constrainedWorldDelta(delta, axis, angle) {
  const local = rotateCanvasDelta(delta.x, delta.y, angle);
  const constrained = constrainedTranslation(local, axis);
  return rotateCanvasDelta(constrained.x, constrained.y, -angle);
}

function hitTransformGizmo(clientX, clientY, state = matrices(time)) {
  if (mode !== "animador" || tool === "pan") return null;
  const pointer = toCanvasPoint(clientX, clientY);
  const center = transformGizmoCenter(state).canvas;
  const delta = rotateCanvasDelta(pointer.x - center.x, pointer.y - center.y, transformGizmoAngle(state));
  const { x: dx, y: dy } = delta;
  if (tool === "select") {
    const axis = hitMoveGizmo(dx, dy);
    return axis ? { type: "translate", axis } : null;
  }
  if (tool === "rotate") return hitRotateGizmo(dx, dy) ? { type: "rotate" } : null;
  if (tool === "scale") {
    const handle = hitScaleGizmo(dx, dy);
    return handle ? { type: "scale", handle } : null;
  }
  return null;
}

function beginTransformInteraction(hit, state, world, canvasPoint) {
  const targets = [...selectedTargets].filter((target) => !lockedTargets.has(target));
  const gizmoAngle = transformGizmoAngle(state);
  if (hit.type === "translate") {
    const target = targets[0];
    const chain = targets.length === 1 ? IK_CHAINS[target] : null;
    if (chain && !lockedTargets.has(chain.upper) && !lockedTargets.has(chain.middle)) {
      const upper = state.joints[chain.upper];
      const middle = state.joints[chain.middle];
      const end = state.joints[target];
      return {
        type: "ik",
        axis: hit.axis,
        target,
        start: world,
        gizmoAngle,
        chain,
        points: {
          root: { x: upper[4], y: upper[5] },
          joint: { x: middle[4], y: middle[5] },
          end: { x: end[4], y: end[5] }
        },
        upperAngle: state.pose[chain.upper]?.angle || 0,
        middleAngle: state.pose[chain.middle]?.angle || 0,
        moved: false
      };
    }
    return {
      type: "translate",
      axis: hit.axis,
      start: world,
      gizmoAngle,
      targets: targets.map((target) => ({
        target,
        x: state.pose[target]?.x || 0,
        y: state.pose[target]?.y || 0,
        parentMatrix: parentMatrixForTarget(target, state)
      })),
      moved: false
    };
  }
  if (hit.type === "rotate") {
    const center = transformGizmoCenter(state).world;
    return {
      type: "rotate",
      center,
      startPointerAngle: Math.atan2(world.y - center.y, world.x - center.x) * 180 / Math.PI,
      targets: targets.map((target) => ({ target, angle: state.pose[target]?.angle || 0 })),
      moved: false
    };
  }
  return {
    type: "scale",
    startCanvas: canvasPoint,
    gizmoAngle,
    handle: hit.handle,
    targets: targets.map((target) => ({
      target,
      scaleX: state.pose[target]?.scaleX || 0,
      scaleY: state.pose[target]?.scaleY || 0
    })),
    moved: false
  };
}

function nearestCanvasTarget(clientX, clientY, state) {
  const pointer = toCanvasPoint(clientX, clientY);
  const candidates = [["rig", state.root], ...Object.entries(state.joints)];
  let result = null;
  candidates.forEach(([target, matrix]) => {
    const point = worldToCanvasPoint(matrix[4], matrix[5]);
    const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y);
    if (distance <= 22 && (!result || distance < result.distance)) result = { target, distance };
  });
  return result?.target || null;
}

function cursorForGizmoHit(hit) {
  if (!hit) return "default";
  if (hit.type === "rotate") return "crosshair";
  if (hit.type === "scale") return hit.handle.xSign === hit.handle.ySign ? "nwse-resize" : "nesw-resize";
  if (hit.axis === "x") return "ew-resize";
  if (hit.axis === "y") return "ns-resize";
  return "move";
}

function drawTransformGizmo(at) {
  if (mode !== "animador" || tool === "pan") return;
  const state = matrices(at);
  const center = transformGizmoCenter(state).world;
  const orientation = transformGizmoAngle(state);
  const inverseViewScale = 1 / (BASE_SCALE * zoom);
  context.save();
  context.translate(center.x, center.y);
  context.rotate(orientation);
  context.scale(inverseViewScale, inverseViewScale);
  context.lineWidth = 2;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#ffffff";
  context.beginPath();
  context.arc(0, 0, 5, 0, Math.PI * 2);
  context.fill();

  if (tool === "rotate") {
    context.strokeStyle = "#efbd67";
    context.beginPath();
    context.arc(0, 0, GIZMO_METRICS.rotateRadius, -Math.PI * 0.85, Math.PI * 0.85);
    context.stroke();
    context.fillStyle = "#efbd67";
    context.beginPath();
    context.moveTo(21, -24);
    context.lineTo(31, -23);
    context.lineTo(27, -14);
    context.closePath();
    context.fill();
  } else if (tool === "scale") {
    context.strokeStyle = "#b58cff";
    const half = GIZMO_METRICS.scaleHalfSize;
    context.strokeRect(-half, -half, half * 2, half * 2);
    [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([x, y]) => {
      context.fillStyle = "#b58cff";
      context.fillRect(x - 4, y - 4, 8, 8);
    });
  } else {
    context.strokeStyle = "#ff6b6b";
    context.fillStyle = "#ff6b6b";
    context.beginPath();
    context.moveTo(0, 0); context.lineTo(42, 0); context.stroke();
    context.beginPath();
    context.moveTo(42, 0); context.lineTo(33, -5); context.lineTo(33, 5); context.closePath(); context.fill();
    context.strokeStyle = "#6fe08b";
    context.fillStyle = "#6fe08b";
    context.beginPath();
    context.moveTo(0, 0); context.lineTo(0, 42); context.stroke();
    context.beginPath();
    context.moveTo(0, 42); context.lineTo(-5, 33); context.lineTo(5, 33); context.closePath(); context.fill();
  }
  context.restore();
}

function drawPreview() {
  resizeCanvas(previewCanvas, previewContext);
  const width = previewCanvas.clientWidth;
  const height = previewCanvas.clientHeight;
  previewContext.clearRect(0, 0, width, height);
  previewContext.fillStyle = "#091522";
  previewContext.fillRect(0, 0, width, height);
  previewContext.save();
  previewContext.translate(width / 2, height / 2 - 8);
  previewContext.scale(0.105, 0.105);
  previewContext.translate(0, -85);
  renderFigure(previewContext, mode === "animador" ? time : 0);
  previewContext.restore();
}

function draw() {
  resizeCanvas(canvas, context);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  const gradient = context.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height));
  gradient.addColorStop(0, "#0d2236");
  gradient.addColorStop(1, "#06111d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const base = origin();
  const viewScale = BASE_SCALE * zoom;
  context.save();
  context.translate(base.x, base.y);
  context.scale(viewScale, viewScale);
  drawGrid(width, height, base, viewScale);
  if (mode === "animador" && $("ghost").checked && ghostPose) {
    const ghostAlpha = Number($("ghost-alpha").value) / 100;
    renderFigure(context, ghostTime, { alpha: ghostAlpha, tint: true, sampledPose: ghostPose });
  }
  renderFigure(context, mode === "animador" ? time : 0);
  drawBones(mode === "animador" ? time : 0);
  drawTransformGizmo(mode === "animador" ? time : 0);
  context.restore();
  $("zoom-label").textContent = `${Math.round(zoom * 100)} %`;
  $("zoom").value = Math.round(zoom * 100);
  const pending = hasDraft() ? ` · Borrador ${draftTime} ms` : "";
  const selection = mode === "animador" ? ` · ${selectionLabel()}` : "";
  $("canvas-status").textContent = `Zoom: ${Math.round(zoom * 100)} % · ${label(mode)} · ${Math.round(time)} ms${selection}${pending}`;
  updateGhostLabel();
  drawPreview();
}

function exactKey(target = selectedTarget, at = Math.round(time)) {
  return (project.clip.animation.keys[target] || []).find((frame) => frame.t === at) || null;
}

function appendTreeNode(node, depth, search) {
  const visible = label(node.id).toLocaleLowerCase().includes(search) || (node.children || []).some((child) => label(child.id).toLocaleLowerCase().includes(search));
  if (!visible) return;
  const row = document.createElement("div");
  row.className = `tree-row${selectedTargets.has(node.id) ? " active" : ""}`;
  row.style.paddingLeft = `${depth * 17}px`;
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.textContent = node.children?.length ? "◇" : "○";
  const button = document.createElement("button");
  button.className = "tree-select";
  button.textContent = label(node.id);
  button.onclick = (event) => {
    selectAnimationTarget(node.id, event.shiftKey);
    selectedKeys.clear();
    refresh();
    status(event.shiftKey ? `${selectionLabel()} seleccionados` : `${label(node.id)} seleccionado`);
  };
  const toggle = document.createElement("button");
  toggle.className = "tree-toggle";
  toggle.textContent = hiddenTargets.has(node.id) ? "○" : "◉";
  toggle.title = "Mostrar u ocultar en el lienzo";
  toggle.onclick = () => { hiddenTargets.has(node.id) ? hiddenTargets.delete(node.id) : hiddenTargets.add(node.id); renderTree(); draw(); };
  const lock = document.createElement("button");
  lock.className = "tree-toggle";
  lock.textContent = lockedTargets.has(node.id) ? "◆" : "◇";
  lock.title = lockedTargets.has(node.id) ? "Desbloquear edición" : "Bloquear edición";
  lock.onclick = () => {
    lockedTargets.has(node.id) ? lockedTargets.delete(node.id) : lockedTargets.add(node.id);
    selectedKeys.clear();
    refresh();
  };
  row.append(icon, button, toggle, lock);
  $("tree").append(row);
  (node.children || []).forEach((child) => appendTreeNode(child, depth + 1, search));
}

function renderLayers(search) {
  [...project.parts].sort((left, right) => right.z - left.z).forEach((item) => {
    if (!label(item.id).toLocaleLowerCase().includes(search)) return;
    const row = document.createElement("div");
    row.className = `tree-row${selectedPart === item.id ? " active" : ""}`;
    const icon = document.createElement("span");
    icon.className = "tree-icon";
    icon.textContent = "◇";
    const button = document.createElement("button");
    button.className = "tree-select";
    button.textContent = label(item.id);
    button.onclick = () => { selectedPart = item.id; refresh(); };
    const toggle = document.createElement("button");
    toggle.className = "tree-toggle";
    toggle.textContent = item.visible ? "◉" : "○";
    toggle.onclick = () => { item.visible = !item.visible; commit("Visibilidad actualizada"); refresh(); };
    const lock = document.createElement("button");
    lock.className = "tree-toggle";
    lock.textContent = lockedParts.has(item.id) ? "◆" : "◇";
    lock.title = lockedParts.has(item.id) ? "Desbloquear edición" : "Bloquear edición";
    lock.onclick = () => {
      lockedParts.has(item.id) ? lockedParts.delete(item.id) : lockedParts.add(item.id);
      refresh();
    };
    row.append(icon, button, toggle, lock);
    $("tree").append(row);
  });
}

function renderTree() {
  $("tree").replaceChildren();
  const search = $("search").value.trim().toLocaleLowerCase();
  if (leftTab === "layers" || mode === "calibrador" || mode === "sprites") renderLayers(search);
  else if (leftTab === "tracks") {
    TARGETS.filter((target) => (project.clip.animation.keys[target] || []).length || !search)
      .filter((target) => label(target).toLocaleLowerCase().includes(search))
      .forEach((target) => appendTreeNode({ id: target }, 0, search));
  } else TREE.forEach((node) => appendTreeNode(node, 0, search));
  $("tree-meta").textContent = `${project.clip.rig} · ${project.clip.anatomy} · ${Object.keys(project.clip.animation.keys).length} pistas`;
}

function renderInspector() {
  const calibration = mode === "calibrador" || mode === "sprites";
  $("animation-inspector").hidden = calibration;
  $("calibration-inspector").hidden = !calibration;
  $("selected-name").textContent = calibration ? label(selectedPart) : selectionLabel();
  $("selected-type").textContent = calibration
    ? `Pieza · Capa ${part()?.z ?? 0}`
    : selectedTargets.size > 1
      ? `Selección múltiple · Principal: ${label(selectedTarget)}`
      : `Hueso · Objetivo: ${selectedTarget}`;
  if (calibration) {
    const current = part();
    if (!current) return;
    $("part-x").value = current.x;
    $("part-y").value = current.y;
    $("part-rotation").value = current.rotation;
    $("part-scale").value = Math.abs(current.scaleX);
    ["part-x", "part-y", "part-rotation", "part-scale", "flip-part", "layer-up", "layer-down"]
      .forEach((id) => { $(id).disabled = lockedParts.has(current.id); });
    return;
  }
  const sampled = pose()[selectedTarget] || {};
  const key = draftFrame(selectedTarget) || exactKey();
  Object.entries(TRANSFORM_FIELDS).forEach(([property, id]) => { $(id).value = Number(key?.[property] ?? sampled[property] ?? 0).toFixed(property.startsWith("scale") || property === "alpha" ? 2 : 1); });
  $("key-ease").value = key?.ease || "Linear";
  [...Object.values(TRANSFORM_FIELDS), "key-ease", "set-key", "delete-key"]
    .forEach((id) => { $(id).disabled = lockedTargets.has(selectedTarget); });
  ["reset-transform", "mirror-pose"].forEach((id) => { $(id).disabled = lockedTargets.has(selectedTarget); });
  updateDraftUI();
  const clip = project.clip.animation;
  $("clip-label").value = clip.label;
  $("clip-description").value = clip.description;
  $("clip-category").value = clip.category;
  $("clip-state").value = clip.state;
  if (rightTab === "curves") drawCurve();
}

function renderPresets() {
  const host = $("preset-grid");
  host.replaceChildren();
  const presets = [
    ["Linear", "Lineal"], ["Sine.inOut", "Suave"], ["Cubic.out", "Impacto"], ["Back.out", "Rebote"]
  ];
  presets.forEach(([value, text]) => {
    const button = document.createElement("button");
    button.className = "small-button";
    button.textContent = text;
    button.onclick = () => { $("key-ease").value = value; showRightTab("curves"); };
    host.append(button);
  });
}

function drawCurve() {
  const curveCanvas = $("curve-canvas");
  const width = curveCanvas.clientWidth;
  const height = curveCanvas.clientHeight;
  // El canvas mide 0 × 0 mientras su pestaña está oculta. Además de ser un
  // trabajo inútil, usar width / 6 como incremento en ese estado produce un
  // bucle infinito (0 += 0) que termina agotando la memoria del renderer.
  if (width <= 0 || height <= 0) return;
  const curveContext = curveCanvas.getContext("2d");
  resizeCanvas(curveCanvas, curveContext);
  const ease = $("key-ease").value || "Linear";
  curveContext.clearRect(0, 0, width, height);
  curveContext.strokeStyle = "#213952";
  curveContext.lineWidth = 1;
  curveContext.beginPath();
  for (let column = 0; column <= 6; column += 1) {
    const x = column / 6 * width;
    curveContext.moveTo(x, 0);
    curveContext.lineTo(x, height);
  }
  for (let row = 0; row <= 4; row += 1) {
    const y = row / 4 * height;
    curveContext.moveTo(0, y);
    curveContext.lineTo(width, y);
  }
  curveContext.stroke();
  curveContext.strokeStyle = "#58a6ff";
  curveContext.lineWidth = 3;
  curveContext.beginPath();
  for (let index = 0; index <= 80; index += 1) {
    const progress = index / 80;
    const value = ease === "Linear" ? progress : animationEase(progress, ease);
    const x = progress * width;
    const y = height - value * height;
    if (!index) curveContext.moveTo(x, y); else curveContext.lineTo(x, y);
  }
  curveContext.stroke();
  $("curve-label").textContent = `${ease} · compartida con el runtime`;
}

function setTime(next, rebuild = false) {
  time = Math.max(0, Math.min(duration(), next));
  updateTimeDisplays();
  updateDraftUI();
  draw();
  if (rebuild) { renderInspector(); renderTimeline(); }
}

function updateTimeDisplays() {
  $("scrub").max = duration();
  $("scrub").value = time;
  $("clock").textContent = `${(time / 1000).toFixed(2)} / ${(duration() / 1000).toFixed(2)} s`;
  $("preview-duration").textContent = `${duration()} ms · ${fps()} fps`;
  document.querySelectorAll(".playhead").forEach((cursor) => { cursor.style.left = `${time / duration() * 100}%`; });
}

function selectKey(target, at, append = false) {
  if (!append) selectedKeys.clear();
  const key = `${target}:${at}`;
  if (append && selectedKeys.has(key)) selectedKeys.delete(key); else selectedKeys.add(key);
  selectAnimationTarget(target, append);
  time = at;
  setGhostFromCommitted(at);
  refresh();
}

function allKeyTimes() {
  return [...new Set(Object.values(project.clip.animation.keys)
    .flatMap((frames) => frames.map((frame) => frame.t)))]
    .sort((left, right) => left - right);
}

function resetGhostFromProject(preferredTime = time) {
  const times = allKeyTimes();
  if (!times.length) return clearGhost();
  const at = [...times].reverse().find((candidate) => candidate <= preferredTime) ?? times[0];
  setGhostFromCommitted(at);
}

function goToAdjacentKey(direction) {
  const times = allKeyTimes();
  const next = direction < 0
    ? [...times].reverse().find((at) => at < time - 0.5)
    : times.find((at) => at > time + 0.5);
  if (next === undefined) return status(direction < 0 ? "No hay una clave anterior" : "No hay una clave siguiente");
  time = next;
  const targets = TARGETS.filter((target) => exactKey(target, next));
  selectedKeys = new Set(targets.map((target) => `${target}:${next}`));
  if (targets.length && !targets.includes(selectedTarget)) selectAnimationTarget(targets[0]);
  setGhostFromCommitted(next);
  refresh();
  status(`Clave ${direction < 0 ? "anterior" : "siguiente"}: ${next} ms`);
}

function snapTime(raw) {
  const frame = 1000 / fps();
  return Math.max(0, Math.min(duration(), Math.round(Math.round(raw / frame) * frame)));
}

function timelineLineClick(event, line) {
  if (event.target !== line) return;
  const box = line.getBoundingClientRect();
  setTime(snapTime((event.clientX - box.left) / box.width * duration()), true);
}

function makePlayhead() {
  const cursor = document.createElement("div");
  cursor.className = "playhead";
  cursor.style.left = `${time / duration() * 100}%`;
  return cursor;
}

function makeTrackRow(target) {
  const row = document.createElement("div");
  row.className = "track-row";
  const trackLabel = document.createElement("div");
  trackLabel.className = `track-label${selectedTargets.has(target) ? " active" : ""}`;
  const button = document.createElement("button");
  button.textContent = label(target);
  button.onclick = (event) => { selectAnimationTarget(target, event.shiftKey); refresh(); };
  trackLabel.append(button);
  const line = document.createElement("div");
  line.className = "track-line";
  line.onclick = (event) => timelineLineClick(event, line);
  (project.clip.animation.keys[target] || []).forEach((frame) => {
    const marker = document.createElement("button");
    const identity = `${target}:${frame.t}`;
    const pending = draftTime === frame.t && draftFrames.has(target);
    marker.className = `key-marker${selectedKeys.has(identity) ? " selected" : ""}${lockedTargets.has(target) ? " locked" : ""}${pending ? " draft" : ""}`;
    marker.style.left = `${frame.t / duration() * 100}%`;
    marker.title = `${frame.t} ms · ${Object.entries(frame).filter(([field]) => field !== "t" && field !== "ease").map(([field, value]) => `${field}: ${value}`).join(" ")}`;
    marker.onpointerdown = (event) => {
      event.stopPropagation();
      if (lockedTargets.has(target)) return status(`${label(target)} está bloqueado`);
      marker.setPointerCapture(event.pointerId);
      if (!event.shiftKey && !selectedKeys.has(identity)) selectedKeys.clear();
      selectedKeys.add(identity);
      selectAnimationTarget(target, event.shiftKey);
      time = frame.t;
      marker.classList.add("selected");
      updateTimeDisplays();
      draw();
      dragKey = { marker, target, originalTime: frame.t, startX: event.clientX, width: line.clientWidth };
    };
    marker.onpointermove = (event) => {
      if (!dragKey || dragKey.marker !== marker) return;
      const delta = (event.clientX - dragKey.startX) / dragKey.width * duration();
      const next = snapTime(dragKey.originalTime + delta);
      marker.style.left = `${next / duration() * 100}%`;
      marker.dataset.nextTime = String(next);
    };
    marker.onpointerup = () => {
      if (!dragKey || dragKey.marker !== marker) return;
      const next = Number(marker.dataset.nextTime ?? dragKey.originalTime);
      const frames = project.clip.animation.keys[target];
      const moving = frames.find((item) => item.t === dragKey.originalTime);
      if (moving && next !== moving.t) {
        const occupied = frames.find((item) => item !== moving && item.t === next);
        if (occupied) Object.assign(occupied, moving);
        else moving.t = next;
        frames.sort((left, right) => left.t - right.t);
        selectedKeys = new Set([`${target}:${next}`]);
        time = next;
        commit("Fotograma desplazado");
      }
      dragKey = null;
      refresh();
    };
    marker.onclick = (event) => { event.stopPropagation(); selectKey(target, frame.t, event.shiftKey); };
    line.append(marker);
  });
  if (draftTime !== null && draftFrames.has(target) && !exactKey(target, draftTime)) {
    const marker = document.createElement("span");
    marker.className = "key-marker selected draft";
    marker.style.left = `${draftTime / duration() * 100}%`;
    marker.title = `${draftTime} ms · borrador sin guardar`;
    line.append(marker);
  }
  line.append(makePlayhead());
  row.append(trackLabel, line);
  return row;
}

function makeEventRow() {
  const row = document.createElement("div");
  row.className = "track-row";
  const trackLabel = document.createElement("div");
  trackLabel.className = "track-label";
  trackLabel.textContent = "⚡ Eventos de sprite";
  const line = document.createElement("div");
  line.className = "track-line";
  line.onclick = (event) => timelineLineClick(event, line);
  project.clip.animation.spriteEvents.forEach((event, index) => {
    const marker = document.createElement("button");
    marker.className = "event-marker";
    marker.style.left = `${event.t / duration() * 100}%`;
    marker.textContent = `${event.slot}: ${event.variant}`;
    marker.title = "Clic derecho para eliminar";
    marker.onclick = () => setTime(event.t, true);
    marker.oncontextmenu = (mouseEvent) => {
      mouseEvent.preventDefault();
      project.clip.animation.spriteEvents.splice(index, 1);
      commit("Evento eliminado");
      refresh();
    };
    line.append(marker);
  });
  line.append(makePlayhead());
  row.append(trackLabel, line);
  return row;
}

function makeSpriteRow() {
  const row = document.createElement("div");
  row.className = "track-row";
  const trackLabel = document.createElement("div");
  trackLabel.className = "track-label";
  trackLabel.textContent = "◇ Referencia de sprites";
  const line = document.createElement("div");
  line.className = "track-line";
  const count = Math.max(8, Math.min(24, Math.round(duration() / 80)));
  for (let index = 0; index <= count; index += 1) {
    const image = document.createElement("img");
    image.className = "sprite-frame";
    image.alt = "";
    image.src = "./assets/modular/man_sprites/runtime/torso.png";
    image.style.left = `${index / count * 100}%`;
    line.append(image);
  }
  line.append(makePlayhead());
  row.append(trackLabel, line);
  return row;
}

function renderRuler() {
  const ruler = $("ruler");
  ruler.replaceChildren();
  const frameCount = Math.max(1, Math.round(duration() / 1000 * fps()));
  const every = Math.max(1, Math.ceil(frameCount / 16));
  for (let frame = 0; frame <= frameCount; frame += every) {
    const tick = document.createElement("span");
    tick.className = "ruler-tick";
    tick.style.left = `${frame / frameCount * 100}%`;
    tick.textContent = frame;
    ruler.append(tick);
  }
  ruler.append(makePlayhead());
}

function renderTimeline() {
  $("timeline-content").style.width = `${Math.round(1000 * timelineZoom)}px`;
  renderRuler();
  const host = $("tracks");
  host.replaceChildren();
  TARGETS.forEach((target) => host.append(makeTrackRow(target)));
  host.append(makeEventRow(), makeSpriteRow());
  updateTimeDisplays();
}

function gameValidationErrors() {
  return validateStudioProject(normalizeStudioProject(project.clip), { mode: "game", allowedTargets: PUPPET_TARGETS });
}

function renderModeOverlay() {
  const overlay = $("mode-overlay");
  overlay.hidden = !["exportar", "proyecto"].includes(mode);
  if (overlay.hidden) return;
  if (mode === "exportar") {
    const errors = gameValidationErrors();
    overlay.innerHTML = `<h2>Exportar</h2><p class="muted">El proyecto conserva calibración y clip. El clip para el juego solo se descarga cuando supera el contrato.</p><div class="summary-grid"><div class="summary-card"><strong>Proyecto de Studio</strong><span>${project.parts.length} piezas · ${Object.keys(project.clip.animation.keys).length} pistas</span><div class="button-row"><button id="download-project" class="small-button primary">Descargar proyecto</button></div></div><div class="summary-card"><strong>Candidato para el juego</strong><span>${errors.length ? `${errors.length} observaciones` : "Validación superada"}</span><div class="button-row"><button id="download-clip" class="small-button primary" ${errors.length ? "disabled" : ""}>Exportar clip</button></div></div></div>${errors.length ? `<h3>Falta resolver</h3><ul class="validation-list">${errors.map((error) => `<li>${error}</li>`).join("")}</ul>` : ""}`;
    $("download-project").onclick = exportProject;
    $("download-clip").onclick = exportClip;
  } else {
    overlay.innerHTML = `<h2>Proyecto</h2><div class="summary-grid"><div class="summary-card"><strong>${project.clip.animation.label}</strong><span>ID: ${project.clip.animation.id}<br>Rig: ${project.clip.rig}<br>Anatomía: ${project.clip.anatomy}<br>Estado: ${project.clip.animation.status}</span></div><div class="summary-card"><strong>Persistencia</strong><span>Guardado local versionado y exportación explícita. No se almacenan credenciales.</span></div></div><div class="button-row"><button id="new-project" class="small-button danger">Crear proyecto nuevo</button></div>`;
    $("new-project").onclick = () => {
      if (!confirm("¿Crear un proyecto nuevo? El proyecto actual quedará reemplazado en el guardado local.")) return;
      project = freshProject();
      selectAnimationTarget("rig");
      selectedPart = "torso";
      selectedKeys.clear();
      time = 0;
      clearDraft();
      clearGhost();
      ensureImages();
      commit("Proyecto nuevo creado");
      setMode("animador");
    };
  }
}

function refresh() {
  project.clip = normalizeStudioProject(project.clip);
  $("project-name").value = project.clip.animation.id;
  $("duration").value = duration();
  $("loop").checked = project.clip.animation.loop;
  $("fps").value = String(fps());
  renderTree();
  renderInspector();
  renderTimeline();
  renderPresets();
  renderModeOverlay();
  draw();
  updateHistoryButtons();
}

function showRightTab(next) {
  rightTab = next;
  document.querySelectorAll("[data-right-tab]").forEach((button) => button.classList.toggle("active", button.dataset.rightTab === next));
  $("inspector-panel").hidden = next !== "inspector";
  $("presets-panel").hidden = next !== "presets";
  $("curves-panel").hidden = next !== "curves";
  if (next === "curves") drawCurve();
}

function setMode(next) {
  mode = next;
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === next));
  if (next === "calibrador" || next === "sprites") leftTab = "layers";
  if (next === "animador") leftTab = "skeleton";
  document.querySelectorAll("[data-left-tab]").forEach((button) => button.classList.toggle("active", button.dataset.leftTab === leftTab));
  $("ghost").disabled = next !== "animador";
  setTool(tool);
  window.history.replaceState(null, "", `#${next}`);
  refresh();
}

function setTool(next) {
  tool = next;
  canvas.style.cursor = "";
  document.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === next));
  $("viewport").classList.remove("select", "pan", "rotate", "scale");
  $("viewport").classList.add(next);
  draw();
}

function readTransformFields() {
  const frame = { t: Math.round(time) };
  Object.entries(TRANSFORM_FIELDS).forEach(([property, id]) => {
    const value = Number($(id).value);
    if (Number.isFinite(value)) frame[property] = value;
  });
  const ease = $("key-ease").value;
  if (ease && ease !== "Linear") frame.ease = ease;
  return frame;
}

function upsertKey(target, frame) {
  const keys = project.clip.animation.keys;
  const frames = keys[target] || [];
  const existing = frames.find((item) => item.t === frame.t);
  if (existing) Object.assign(existing, frame); else frames.push(frame);
  frames.sort((left, right) => left.t - right.t);
  keys[target] = frames;
  if (!project.clip.animation.requires.includes(target)) project.clip.animation.requires.push(target);
}

function setKey() {
  if (!hasDraft()) setDraftFrame(selectedTarget, readTransformFields());
  if (draftTime !== Math.round(time)) return status(`El borrador pendiente pertenece a ${draftTime} ms`);
  const editable = [...draftFrames.entries()].filter(([target]) => !lockedTargets.has(target));
  if (!editable.length) return status("Los objetivos del borrador están bloqueados");
  const at = draftTime;
  editable.forEach(([target, frame]) => upsertKey(target, structuredClone(frame)));
  selectedKeys = new Set(editable.map(([target]) => `${target}:${at}`));
  clearDraft();
  commit(`${editable.length} objetivo(s) guardado(s) en ${at} ms`);
  setGhostFromCommitted(at);
  time = at;
  refresh();
}

function previewKeyFromInspector() {
  if (lockedTargets.has(selectedTarget)) return;
  const frame = readTransformFields();
  setDraftFrame(selectedTarget, frame);
  draw();
  renderTimeline();
  status(`Vista previa sin guardar: ${label(selectedTarget)}`);
}

function discardKeyDraft() {
  if (!hasDraft()) return status("No hay cambios pendientes");
  const discardedTime = draftTime;
  clearDraft();
  selectedKeys.clear();
  refresh();
  status(`Cambios de ${discardedTime} ms descartados`);
}

function resetSelectedTransform() {
  if (lockedTargets.has(selectedTarget)) return status(`${label(selectedTarget)} está bloqueado`);
  setDraftFrame(selectedTarget, {
    t: Math.round(time), x: 0, y: 0, angle: 0, alpha: 0, scaleX: 0, scaleY: 0
  });
  refresh();
  status(`Transformación restablecida en borrador: ${label(selectedTarget)}`);
}

function mirrorTransform(transform = {}) {
  const mirrored = { x: 0, y: 0, angle: 0, alpha: 0, scaleX: 0, scaleY: 0 };
  Object.keys(TRANSFORM_FIELDS).forEach((property) => {
    if (Object.hasOwn(transform, property)) mirrored[property] = transform[property];
  });
  mirrored.x *= -1;
  mirrored.angle *= -1;
  return mirrored;
}

function mirrorCurrentPose() {
  const at = Math.round(time);
  beginDraft(at);
  const sampled = pose(time);
  const active = new Set([...Object.keys(project.clip.animation.keys), ...draftFrames.keys()]);
  [...active].forEach((target) => {
    const counterpart = MIRROR_TARGETS[target];
    if (counterpart) active.add(counterpart);
  });
  if (!active.size) active.add(selectedTarget);
  const mirrored = [];
  active.forEach((sourceTarget) => {
    const target = MIRROR_TARGETS[sourceTarget];
    if (!target || lockedTargets.has(target)) return;
    mirrored.push([target, { t: at, ...mirrorTransform(sampled[sourceTarget]) }]);
  });
  mirrored.forEach(([target, frame]) => draftFrames.set(target, frame));
  selectedKeys = new Set(mirrored.map(([target]) => `${target}:${at}`));
  updateDraftUI();
  refresh();
  status(`Pose reflejada en borrador · ${mirrored.length} objetivo(s)`);
}

function duplicateCurrentKey() {
  if (hasDraft()) return status("Guarda o descarta el borrador antes de duplicar");
  const at = Math.round(time);
  const source = TARGETS.map((target) => [target, exactKey(target, at)]).filter(([, frame]) => frame);
  if (!source.length) return status("No hay claves guardadas en el tiempo actual");
  const next = snapTime(at + 1000 / fps());
  if (next === at) return status("No hay espacio para duplicar antes del final");
  setGhostFromCommitted(at);
  source.forEach(([target, frame]) => upsertKey(target, { ...structuredClone(frame), t: next }));
  selectedKeys = new Set(source.map(([target]) => `${target}:${next}`));
  time = next;
  commit(`${source.length} clave(s) duplicadas en ${next} ms`);
  refresh();
}

function deleteSelectedKeys() {
  if (lockedTargets.has(selectedTarget) && !selectedKeys.size) return status(`${label(selectedTarget)} está bloqueado`);
  if (!selectedKeys.size) {
    const key = exactKey();
    if (key) selectedKeys.add(`${selectedTarget}:${key.t}`);
  }
  selectedKeys.forEach((identity) => {
    const separator = identity.lastIndexOf(":");
    const target = identity.slice(0, separator);
    if (lockedTargets.has(target)) return;
    const at = Number(identity.slice(separator + 1));
    const remaining = (project.clip.animation.keys[target] || []).filter((frame) => frame.t !== at);
    if (remaining.length) project.clip.animation.keys[target] = remaining;
    else {
      delete project.clip.animation.keys[target];
      project.clip.animation.requires = project.clip.animation.requires.filter((item) => item !== target);
    }
  });
  selectedKeys.clear();
  clearDraft();
  commit("Fotogramas eliminados");
  refresh();
}

function copySelectedKeys() {
  const selected = [...selectedKeys].map((identity) => {
    const separator = identity.lastIndexOf(":");
    const target = identity.slice(0, separator);
    const at = Number(identity.slice(separator + 1));
    const frame = (project.clip.animation.keys[target] || []).find((item) => item.t === at);
    return frame ? { target, frame: structuredClone(frame) } : null;
  }).filter(Boolean);
  if (!selected.length && exactKey()) selected.push({ target: selectedTarget, frame: structuredClone(exactKey()) });
  if (!selected.length) return status("Selecciona al menos una clave");
  const first = Math.min(...selected.map(({ frame }) => frame.t));
  keyClipboard = selected.map(({ target, frame }) => ({ target, frame: { ...frame, t: frame.t - first } }));
  status(`${keyClipboard.length} clave(s) copiadas`);
}

function pasteKeys(offset = time) {
  if (!keyClipboard.length) return status("No hay claves copiadas");
  selectedKeys.clear();
  keyClipboard.forEach(({ target, frame }) => {
    const pasted = { ...structuredClone(frame), t: Math.min(duration(), snapTime(offset + frame.t)) };
    upsertKey(target, pasted);
    selectedKeys.add(`${target}:${pasted.t}`);
  });
  commit(`${keyClipboard.length} clave(s) pegadas`);
  refresh();
}

function download(name, contents) {
  const blob = new Blob([contents], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportProject() {
  project.clip = normalizeStudioProject(project.clip);
  download("kinetra-proyecto.json", JSON.stringify(project, null, 2));
  status("Proyecto exportado");
}

function exportClip() {
  try {
    const contents = serializeStudioProject(project.clip, { mode: "game", allowedTargets: PUPPET_TARGETS });
    const name = `${project.clip.animation.id.replace(/[^a-z0-9_-]/gi, "_")}.json`;
    download(name, contents);
    status("Clip candidato exportado");
  } catch (error) {
    status(error.message);
  }
}

function play() {
  if (playing) return;
  if (hasDraft()) return status("Guarda o descarta el borrador antes de reproducir");
  if (time >= duration()) time = 0;
  playing = true;
  lastTick = performance.now();
  $("preview-state").textContent = "●";
  animationFrame = requestAnimationFrame(tick);
}

function pause() {
  playing = false;
  cancelAnimationFrame(animationFrame);
  $("preview-state").textContent = "○";
}

function tick(now) {
  if (!playing) return;
  time += now - lastTick;
  lastTick = now;
  if (time >= duration()) {
    if (project.clip.animation.loop) time %= duration();
    else { time = duration(); pause(); }
  }
  updateTimeDisplays();
  draw();
  if (playing) animationFrame = requestAnimationFrame(tick);
}

function bindControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => { button.onclick = () => setMode(button.dataset.mode); });
  document.querySelectorAll("[data-left-tab]").forEach((button) => {
    button.onclick = () => {
      leftTab = button.dataset.leftTab;
      document.querySelectorAll("[data-left-tab]").forEach((item) => item.classList.toggle("active", item === button));
      renderTree();
    };
  });
  document.querySelectorAll("[data-right-tab]").forEach((button) => { button.onclick = () => showRightTab(button.dataset.rightTab); });
  document.querySelectorAll("[data-tool]").forEach((button) => { button.onclick = () => setTool(button.dataset.tool); });
  $("search").oninput = renderTree;
  $("undo").onclick = undo;
  $("redo").onclick = redo;
  $("save-local").onclick = () => {
    saveLocal(hasDraft() ? "Proyecto guardado; el borrador del fotograma sigue pendiente" : "Proyecto guardado en este navegador");
  };
  $("open-file").onclick = () => $("file").click();
  $("project-name").onchange = () => {
    project.clip.animation.id = $("project-name").value.trim() || "nuevo_movimiento";
    commit("ID del proyecto actualizado");
    refresh();
  };
  $("header-play").onclick = play;
  $("preview-play").onclick = () => playing ? pause() : play();
  $("play").onclick = play;
  $("pause").onclick = pause;
  $("first").onclick = () => setTime(0, true);
  $("previous-key").onclick = () => goToAdjacentKey(-1);
  $("last").onclick = () => setTime(duration(), true);
  $("next-key").onclick = () => goToAdjacentKey(1);
  $("scrub").oninput = () => setTime(Number($("scrub").value), true);
  $("fps").onchange = () => { project.fps = Number($("fps").value); commit("FPS de visualización actualizado"); refresh(); };
  $("duration").onchange = () => {
    const next = Number($("duration").value);
    if (!Number.isFinite(next) || next < 100 || next > 60000) return status("Duración fuera de rango");
    project.clip.animation.duration = next;
    Object.entries(project.clip.animation.keys).forEach(([target, frames]) => { project.clip.animation.keys[target] = frames.filter((frame) => frame.t <= next); });
    project.clip.animation.spriteEvents = project.clip.animation.spriteEvents.filter((event) => event.t <= next);
    time = Math.min(time, next);
    commit("Duración actualizada");
    refresh();
  };
  $("loop").onchange = () => { project.clip.animation.loop = $("loop").checked; commit("Bucle actualizado"); refresh(); };
  $("timeline-zoom").oninput = () => {
    timelineZoom = Number($("timeline-zoom").value) / 100;
    renderTimeline();
  };
  $("set-key").onclick = setKey;
  $("discard-key-draft").onclick = discardKeyDraft;
  $("duplicate-key").onclick = duplicateCurrentKey;
  $("reset-transform").onclick = resetSelectedTransform;
  $("mirror-pose").onclick = mirrorCurrentPose;
  $("delete-key").onclick = deleteSelectedKeys;
  Object.values(TRANSFORM_FIELDS).forEach((id) => {
    $(id).oninput = previewKeyFromInspector;
    $(id).onchange = previewKeyFromInspector;
  });
  $("key-ease").onchange = () => {
    previewKeyFromInspector();
    if (rightTab === "curves") drawCurve();
  };
  $("add-event").onclick = () => {
    const slot = $("event-slot").value.trim();
    const variant = $("event-variant").value.trim();
    if (!slot || !variant) return status("Completa la ranura y la variante");
    project.clip.animation.spriteEvents.push({ t: Math.round(time), slot, variant });
    project.clip.animation.spriteEvents.sort((left, right) => left.t - right.t);
    commit("Evento de sprite insertado");
    refresh();
  };
  [["clip-label", "label"], ["clip-description", "description"], ["clip-category", "category"], ["clip-state", "state"]].forEach(([id, property]) => {
    $(id).onchange = () => { project.clip.animation[property] = $(id).value.trim(); commit("Metadatos actualizados"); refresh(); };
  });
  ["part-x", "part-y", "part-rotation", "part-scale"].forEach((id) => {
    $(id).onchange = () => {
      const current = part();
      if (lockedParts.has(current.id)) return status(`${label(current.id)} está bloqueado`);
      current.x = Number($("part-x").value);
      current.y = Number($("part-y").value);
      current.rotation = Number($("part-rotation").value);
      const magnitude = Number($("part-scale").value);
      current.scaleX = Math.sign(current.scaleX || 1) * magnitude;
      current.scaleY = Math.sign(current.scaleY || 1) * magnitude;
      commit("Calibración actualizada");
      refresh();
    };
  });
  $("flip-part").onclick = () => {
    if (lockedParts.has(part().id)) return status(`${label(part().id)} está bloqueado`);
    part().scaleX *= -1;
    commit("Pieza volteada");
    refresh();
  };
  const moveLayer = (delta) => {
    const current = part();
    if (lockedParts.has(current.id)) return status(`${label(current.id)} está bloqueado`);
    const other = project.parts.find((item) => item.z === current.z + delta);
    if (other) { other.z = current.z; current.z += delta; commit("Orden de capas actualizado"); refresh(); }
  };
  $("layer-up").onclick = () => moveLayer(1);
  $("layer-down").onclick = () => moveLayer(-1);
  $("copy-keys").onclick = copySelectedKeys;
  $("paste-keys").onclick = () => pasteKeys();
  $("open-curves").onclick = () => showRightTab("curves");
  $("fit").onclick = () => { zoom = 1; offsetX = 0; offsetY = 0; draw(); };
  $("zoomin").onclick = () => { zoom = Math.min(2.2, zoom * 1.12); draw(); };
  $("zoomout").onclick = () => { zoom = Math.max(0.4, zoom / 1.12); draw(); };
  $("zoom").oninput = () => { zoom = Number($("zoom").value) / 100; draw(); };
  $("fullscreen").onclick = () => $("viewport").requestFullscreen?.();
  ["grid", "bones", "ghost", "ghost-alpha"].forEach((id) => { $(id).oninput = draw; });
  $("file").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      project = normalizeLoadedProject(JSON.parse(await file.text()));
      selectAnimationTarget("rig");
      selectedPart = "torso";
      selectedKeys.clear();
      time = 0;
      clearDraft();
      resetGhostFromProject(0);
      ensureImages();
      commit("Proyecto importado");
      refresh();
    } catch (error) {
      status(`No se pudo importar: ${error.message}`);
    }
    event.target.value = "";
  };
}

function bindCanvas() {
  canvas.onwheel = (event) => {
    event.preventDefault();
    zoom = Math.max(0.4, Math.min(2.2, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    draw();
  };
  canvas.onpointerdown = (event) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    const world = toWorld(event.clientX, event.clientY);
    if (tool === "pan") {
      interaction = { type: "pan", x: event.clientX, y: event.clientY, offsetX, offsetY };
      return;
    }
    if (mode === "calibrador" || mode === "sprites") {
      let chosen = null;
      let distance = Infinity;
      [...project.parts].sort((left, right) => right.z - left.z).forEach((item) => {
        const image = images[item.id];
        const width = image?.naturalWidth || 120;
        const height = image?.naturalHeight || 120;
        const score = Math.hypot((world.x - item.x) / (width / 2), (world.y - item.y) / (height / 2));
        if (score < 1.4 && score < distance) { chosen = item.id; distance = score; }
      });
      if (chosen) {
        selectedPart = chosen;
        if (!lockedParts.has(chosen)) interaction = { type: "piece", start: world, x: part().x, y: part().y, moved: false };
        refresh();
      }
      return;
    }
    const state = matrices(time);
    const chosen = nearestCanvasTarget(event.clientX, event.clientY, state);
    if (event.shiftKey && tool === "select" && chosen) {
      selectAnimationTarget(chosen, true);
      selectedKeys.clear();
      refresh();
      status(`${selectionLabel()} seleccionados · arrastra el manipulador para moverlos juntos`);
      return;
    }
    const gizmoHit = hitTransformGizmo(event.clientX, event.clientY, state);
    if (gizmoHit) {
      if (![...selectedTargets].some((target) => !lockedTargets.has(target))) return status("Todos los objetivos seleccionados están bloqueados");
      interaction = beginTransformInteraction(gizmoHit, state, world, toCanvasPoint(event.clientX, event.clientY));
      canvas.style.cursor = cursorForGizmoHit(gizmoHit);
      status(gizmoHit.type === "translate"
        ? `Moviendo ${selectionLabel()}${gizmoHit.axis === "free" ? " libremente" : ` sobre el eje ${gizmoHit.axis.toUpperCase()}`}`
        : gizmoHit.type === "rotate"
          ? `Rotando ${selectionLabel()} desde el anillo`
          : `Escalando ${selectionLabel()} desde la manija`);
      return;
    }

    if (!chosen) return;
    selectAnimationTarget(chosen);
    selectedKeys.clear();
    if (tool === "select" && !lockedTargets.has(chosen)) {
      interaction = beginTransformInteraction(
        { type: "translate", axis: "free" },
        state,
        world,
        toCanvasPoint(event.clientX, event.clientY)
      );
    }
    refresh();
    if (tool !== "select") status(`${label(chosen)} seleccionado; arrastra ${tool === "rotate" ? "el anillo" : "una manija"} para transformarlo`);
  };
  canvas.onpointermove = (event) => {
    if (!interaction) {
      if (tool === "pan") canvas.style.cursor = "grab";
      else if (mode === "animador") {
        const state = matrices(time);
        const hit = hitTransformGizmo(event.clientX, event.clientY, state);
        canvas.style.cursor = cursorForGizmoHit(hit);
      }
      return;
    }
    const world = toWorld(event.clientX, event.clientY);
    if (interaction.type === "pan") {
      offsetX = interaction.offsetX + event.clientX - interaction.x;
      offsetY = interaction.offsetY + event.clientY - interaction.y;
      draw();
    } else if (interaction.type === "piece") {
      part().x = interaction.x + world.x - interaction.start.x;
      part().y = interaction.y + world.y - interaction.start.y;
      interaction.moved = true;
      draw();
    } else if (interaction.type === "translate") {
      const worldDelta = constrainedWorldDelta({
        x: world.x - interaction.start.x,
        y: world.y - interaction.start.y
      }, interaction.axis, interaction.gizmoAngle);
      interaction.targets.forEach((item) => {
        const delta = localDelta(item.parentMatrix, worldDelta.x, worldDelta.y);
        const current = ensureDraftFrame(item.target);
        setDraftFrame(item.target, {
          ...current,
          x: item.x + delta.x,
          y: item.y + delta.y
        });
      });
      interaction.moved = true;
      draw();
      renderInspector();
    } else if (interaction.type === "ik") {
      const delta = constrainedWorldDelta({
        x: world.x - interaction.start.x,
        y: world.y - interaction.start.y
      }, interaction.axis, interaction.gizmoAngle);
      const target = {
        x: interaction.points.end.x + delta.x,
        y: interaction.points.end.y + delta.y
      };
      const solved = solveTwoBoneIk(interaction.points.root, interaction.points.joint, interaction.points.end, target);
      if (!solved) return status("La cadena no tiene longitud suficiente para aplicar cinemática inversa");
      const upperFrame = ensureDraftFrame(interaction.chain.upper);
      const middleFrame = ensureDraftFrame(interaction.chain.middle);
      setDraftFrame(interaction.chain.upper, { ...upperFrame, angle: interaction.upperAngle + solved.upperDelta });
      setDraftFrame(interaction.chain.middle, { ...middleFrame, angle: interaction.middleAngle + solved.lowerDelta });
      interaction.moved = true;
      draw();
      renderInspector();
    } else if (interaction.type === "rotate") {
      const pointerAngle = Math.atan2(world.y - interaction.center.y, world.x - interaction.center.x) * 180 / Math.PI;
      const delta = shortestAngleDelta(interaction.startPointerAngle, pointerAngle);
      interaction.targets.forEach((item) => {
        const angle = Math.max(-360, Math.min(360, item.angle + delta));
        const current = ensureDraftFrame(item.target);
        setDraftFrame(item.target, { ...current, angle });
      });
      interaction.moved = true;
      draw();
      renderInspector();
    } else if (interaction.type === "scale") {
      const point = toCanvasPoint(event.clientX, event.clientY);
      const canvasDelta = rotateCanvasDelta(
        point.x - interaction.startCanvas.x,
        point.y - interaction.startCanvas.y,
        interaction.gizmoAngle
      );
      interaction.targets.forEach((item) => {
        const nextScale = scaleFromDrag(
          { scaleX: item.scaleX, scaleY: item.scaleY },
          canvasDelta,
          interaction.handle,
          { uniform: event.shiftKey }
        );
        const current = ensureDraftFrame(item.target);
        setDraftFrame(item.target, { ...current, ...nextScale });
      });
      interaction.moved = true;
      draw();
      renderInspector();
    }
  };
  canvas.onpointerup = () => {
    const completed = interaction;
    if (completed?.moved && completed.type === "piece") commit("Pieza desplazada");
    interaction = null;
    canvas.style.cursor = "";
    refresh();
    if (completed?.moved && completed.type !== "piece") {
      const action = completed.type === "translate" ? "Posición" : completed.type === "ik" ? "Cadena IK" : completed.type === "rotate" ? "Rotación" : "Escala";
      status(`${action} actualizada en borrador; pulsa Guardar fotograma`);
    }
  };
  canvas.onpointercancel = canvas.onpointerup;
  canvas.onpointerleave = () => { if (!interaction) canvas.style.cursor = ""; };
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    if (editing) return;
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === "z" && event.shiftKey) { event.preventDefault(); redo(); return; }
    if (command && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
    if (command && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
    if (command && event.key.toLowerCase() === "c") { event.preventDefault(); copySelectedKeys(); }
    else if (command && event.key.toLowerCase() === "v") { event.preventDefault(); pasteKeys(); }
    else if (command && event.key.toLowerCase() === "d") { event.preventDefault(); copySelectedKeys(); pasteKeys(time + 1000 / fps()); }
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelectedKeys(); }
    else if (event.key === " ") { event.preventDefault(); playing ? pause() : play(); }
    else if (event.key.toLowerCase() === "v") setTool("select");
    else if (event.key.toLowerCase() === "h") setTool("pan");
    else if (event.key.toLowerCase() === "r") setTool("rotate");
    else if (event.key.toLowerCase() === "s") setTool("scale");
    else if (event.shiftKey && event.key === "ArrowRight") { event.preventDefault(); goToAdjacentKey(1); }
    else if (event.shiftKey && event.key === "ArrowLeft") { event.preventDefault(); goToAdjacentKey(-1); }
    else if (event.key === "ArrowRight") setTime(time + 1000 / fps(), true);
    else if (event.key === "ArrowLeft") setTime(time - 1000 / fps(), true);
  }, { capture: true });
}

function initialize() {
  project = loadInitialProject();
  project.clip = normalizeStudioProject(project.clip);
  STUDIO_EASES.forEach((ease) => {
    const option = document.createElement("option");
    option.value = ease;
    option.textContent = ease;
    $("key-ease").append(option);
  });
  ensureImages();
  bindControls();
  bindCanvas();
  bindKeyboard();
  window.addEventListener("resize", draw);
  resetGhostFromProject(0);
  checkpoint();
  const requestedMode = location.hash.slice(1);
  setMode(["animador", "calibrador", "sprites", "exportar", "proyecto"].includes(requestedMode) ? requestedMode : "animador");
}

initialize();
