/**
 * Controlador visual de Kinetra.
 * Une calibración, autoría por fotogramas clave, timeline, historial y exportación.
 */
import {
  PUPPET_PART_JOINTS as PART_JOINTS,
  PUPPET_TARGETS
} from "../animations/rig.js?v=0.11.0";
import { animationEase } from "../animations/runtime.js?v=0.11.0";
import {
  createStudioProject,
  normalizeStudioProject,
  parseStudioProject,
  serializeStudioProject,
  STUDIO_EASES,
  validateStudioProject
} from "../animations/studio-format.js?v=0.11.0";
import { sampleStudioAnimation } from "../animations/studio-runtime.js?v=0.11.0";
import { createKinetraBundle } from "../animations/kinetra-runtime.js?v=0.11.0";
import {
  collapseHierarchicalSelection,
  constrainedTranslation,
  GIZMO_METRICS,
  hitMoveGizmo,
  hitRotateGizmo,
  hitScaleGizmo,
  scaleFromDrag,
  shortestAngleDelta
} from "./gizmo.js?v=0.11.0";
import { solveJointRotation, solveTwoBoneIk } from "./ik.js?v=0.11.0";
import { createTemplateProject } from "./templates.js?v=0.11.0";

const $ = (id) => document.getElementById(id);
const BASE_SCALE = 0.32;
const STORAGE_KEY = "kinetra:project";
const PANEL_STORAGE_KEY = "kinetra:panels";
const PREVIEW_STORAGE_KEY = "kinetra:preview-visible";
const THEME_STORAGE_KEY = "kinetra:theme";
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
const PANEL_DEFAULTS = Object.freeze({
  skeleton: { visible: true, dock: "left", lastDock: "left" },
  tracks: { visible: true, dock: "left", lastDock: "left" },
  layers: { visible: true, dock: "left", lastDock: "left" },
  inspector: { visible: true, dock: "right", lastDock: "right" },
  presets: { visible: true, dock: "right", lastDock: "right" },
  curves: { visible: true, dock: "right", lastDock: "right" },
  timeline: { visible: true, dock: "bottom", lastDock: "bottom" }
});
const PANEL_LABELS = Object.freeze({
  skeleton: "Esqueleto", tracks: "Pistas", layers: "Capas",
  inspector: "Inspector", presets: "Presets", curves: "Curvas",
  timeline: "Línea de tiempo"
});
const DOCK_ZONES = Object.freeze(["left", "right", "bottom"]);
const PANEL_LAYOUT_VERSION = 3;
const PANEL_FLOAT_SIZES = Object.freeze({
  skeleton: { width: 310, height: 470 },
  tracks: { width: 310, height: 430 },
  layers: { width: 310, height: 470 },
  inspector: { width: 350, height: 520 },
  presets: { width: 320, height: 260 },
  curves: { width: 420, height: 280 },
  timeline: { width: 760, height: 310 }
});
const WORKSPACE_LABELS = Object.freeze({ animador: "Animador", calibrador: "Ensamblaje", exportar: "Exportación", proyecto: "Proyecto" });
const HELP_TOPICS = Object.freeze({
  shortcuts: {
    title: "Atajos de teclado",
    body: `<div class="shortcut-grid"><kbd>V</kbd><span>Seleccionar y mover</span><kbd>H</kbd><span>Desplazar la vista</span><kbd>R</kbd><span>Rotar</span><kbd>S</kbd><span>Escalar</span><kbd>Espacio</kbd><span>Reproducir o detener</span><kbd>Ctrl Z</kbd><span>Deshacer</span><kbd>Ctrl Y</kbd><span>Rehacer</span><kbd>Ctrl C / V</kbd><span>Copiar o pegar claves</span><kbd>Mayús ← / →</kbd><span>Clave anterior o siguiente</span><kbd>Supr</kbd><span>Eliminar claves seleccionadas</span></div>`
  }
});
const TUTORIALS = Object.freeze({
  animador: {
    label: "Animador",
    mode: "animador",
    steps: [
      { target: "#workspace-menu", title: "Estás en el Animador", copy: "Este selector cambia de espacio sin separar el proyecto. El Animador modifica poses y crea fotogramas clave." },
      { target: "[data-panel='skeleton'] .tree", panel: "skeleton", title: "Selecciona articulaciones", copy: "Haz clic en una articulación. Con Mayús o el botón de suma puedes mantener varios puntos seleccionados." },
      { target: ".toolbar .tool-group:first-child", title: "Elige una transformación", copy: "Mover, rotar y escalar cambian la pose. La herramienta activa también puede elegirse con V, R o S." },
      { target: "#canvas", title: "Manipula el personaje", copy: "Arrastra el control del lienzo. Muñecas y tobillos resuelven la cadena completa; codos y rodillas conservan conectada la extremidad." },
      { target: "#set-key", panel: "inspector", title: "Guarda el fotograma", copy: "La pose queda como borrador hasta pulsar Guardar fotograma. Así puedes corregirla o deshacerla antes de confirmarla." },
      { target: "[data-panel='timeline']", panel: "timeline", title: "Construye el movimiento", copy: "Cambia el tiempo, crea otra pose y guarda una nueva clave. Kinetra interpolará el movimiento entre ambas." }
    ]
  },
  calibrador: {
    label: "Ensamblaje",
    mode: "calibrador",
    steps: [
      { target: "#workspace-menu", title: "Estás en Ensamblaje", copy: "Aquí ajustas los sprites sobre el esqueleto antes de animarlos." },
      { target: "#import-layers", panel: "layers", title: "Importa las piezas", copy: "Selecciona uno o varios PNG, WebP o JPEG. Cada archivo se convierte en un recurso y una capa independiente." },
      { target: "[data-panel='layers'] .tree", panel: "layers", title: "Organiza capas reales", copy: "Renombra, ordena, oculta, bloquea o elimina cualquier pieza importada." },
      { target: "#canvas", title: "Coloca el sprite", copy: "Arrastra la pieza directamente sobre el personaje para alinearla con su articulación." },
      { target: "#add-bone", panel: "skeleton", title: "Construye tu esqueleto", copy: "Añade huesos desde la raíz o como hijos del hueso seleccionado. La jerarquía ya no depende del humanoide de ejemplo." },
      { target: "#calibration-inspector", panel: "inspector", title: "Vincula y calibra", copy: "Asigna cada capa a un hueso y ajusta posición, rotación, escala, nombre, padre y pivote." }
    ]
  },
  timeline: {
    label: "Línea de tiempo",
    mode: "animador",
    steps: [
      { target: "[data-panel='timeline']", panel: "timeline", title: "Mapa de la animación", copy: "Cada fila corresponde a una articulación; los diamantes representan fotogramas clave." },
      { target: "#scrub", title: "Recorre el tiempo", copy: "Arrastra este control para revisar cualquier instante de la animación." },
      { target: "#play", title: "Reproduce y detén", copy: "El mismo botón alterna reproducción y detención para ahorrar espacio." },
      { target: "#timeline-zoom", title: "Ajusta la escala temporal", copy: "Amplía el tiempo cuando necesites separar y editar claves cercanas." },
      { target: "#copy-keys", title: "Reutiliza poses", copy: "Selecciona claves, cópialas y pégalas en otro instante para acelerar el trabajo." }
    ]
  },
  paneles: {
    label: "Paneles",
    mode: "animador",
    steps: [
      { target: "#window-menu > summary", title: "Activa cada módulo", copy: "El menú Ventana muestra u oculta Esqueleto, Capas, Inspector, Curvas, Línea de tiempo y Vista previa." },
      { target: "[data-panel='skeleton'] .panel-window-bar", panel: "skeleton", title: "Mueve una ventana", copy: "Arrastra el asa de la cabecera para convertir el panel en ventana flotante o llevarlo a otro borde." },
      { target: "[data-panel-float='skeleton']", title: "Desacopla con un clic", copy: "Este botón alterna entre ventana flotante y panel acoplado." },
      { target: "[data-panel-close='skeleton']", title: "Oculta sin perder", copy: "Cerrar solo oculta el módulo. Puedes recuperarlo en cualquier momento desde Ventana." }
    ]
  },
  exportar: {
    label: "Exportación",
    mode: "exportar",
    steps: [
      { target: "#mode-overlay", title: "Revisa el proyecto", copy: "Esta vista resume las piezas y pistas antes de crear los archivos finales." },
      { target: "#download-project", title: "Exporta el personaje completo", copy: "El paquete .kinetra.json incluye imágenes, capas, rig y animación para continuar editando o cargarlo en un juego web." },
      { target: "#download-clip", title: "Mantén proyectos heredados", copy: "El clip v1 se conserva para juegos antiguos que solo esperan el movimiento del humanoide original." }
    ]
  }
});

const prettyId = (id) => String(id).replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
const freshProject = () => createTemplateProject("male");
const freshRig = () => freshProject().rig;
const freshParts = () => freshProject().parts;

function rigJoints() {
  return Object.fromEntries((project.rig?.bones || []).map((bone) => [bone.id, { x: Number(bone.x) || 0, y: Number(bone.y) || 0 }]));
}
function rigParents() {
  return Object.fromEntries((project.rig?.bones || []).map((bone) => [bone.id, bone.parent || null]));
}
function animationTargets() {
  return [...new Set(["rig", "torso", ...(project.rig?.bones || []).map((bone) => bone.id)])];
}
function partBoneId(item) {
  return item?.boneId || PART_JOINTS[item?.id] || (item?.id === "torso" ? "rig" : "rig");
}
function rigTree() {
  const bones = project.rig?.bones || [];
  const children = new Map([["rig", []]]);
  bones.forEach((bone) => children.set(bone.id, []));
  bones.forEach((bone) => (children.get(bone.parent || "rig") || children.get("rig")).push(bone.id));
  const build = (id) => ({ id, children: (children.get(id) || []).map(build) });
  return [build("rig")];
}
function label(id) {
  if (id === "rig") return project.rig?.name || LABELS.rig;
  const bone = project.rig?.bones?.find((item) => item.id === id);
  return bone?.name || LABELS[id] || prettyId(id);
}

let project = freshProject();
let mode = "animador";
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
const initialPanelLayout = loadPanelLayout();
let panelStates = initialPanelLayout.panels;
let dockActive = initialPanelLayout.active;
let panelDrag = null;
let panelZ = 120;
let previewVisible = localStorage.getItem(PREVIEW_STORAGE_KEY) !== "false";
let theme = ["noche", "grafito", "aurora"].includes(localStorage.getItem(THEME_STORAGE_KEY))
  ? localStorage.getItem(THEME_STORAGE_KEY)
  : "noche";
let tutorialRun = null;

const canvas = $("canvas");
const context = canvas.getContext("2d");
const previewCanvas = $("preview-canvas");
const previewContext = previewCanvas.getContext("2d");
const images = {};

function status(message) { $("status").textContent = message; }

function createIcon(name, className = "") {
  const icon = document.createElement("i");
  icon.dataset.lucide = name;
  if (className) icon.className = className;
  return icon;
}

function refreshIcons(root = document) {
  window.lucide?.createIcons({ root, attrs: { "stroke-width": 1.8 } });
}

function closeApplicationMenus(except = null) {
  document.querySelectorAll(".app-menu[open]").forEach((menu) => {
    if (menu !== except) menu.removeAttribute("open");
  });
}

function loadPanelLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) || "{}");
    const storedPanels = saved.panels || saved;
    const panels = Object.fromEntries(Object.entries(PANEL_DEFAULTS).map(([id, defaults]) => {
      const stored = storedPanels[id] || {};
      const dock = DOCK_ZONES.includes(stored.dock) || stored.dock === "floating"
        ? stored.dock
        : stored.floating
          ? "floating"
          : defaults.dock;
      const floatingGeometry = saved.layoutVersion === PANEL_LAYOUT_VERSION
        ? Object.fromEntries(["left", "top", "width", "height"].filter((property) => Number.isFinite(stored[property])).map((property) => [property, stored[property]]))
        : {};
      return [id, {
        ...defaults,
        visible: stored.visible ?? defaults.visible,
        dock,
        lastDock: DOCK_ZONES.includes(stored.lastDock) ? stored.lastDock : defaults.lastDock,
        ...floatingGeometry
      }];
    }));
    return { panels, active: saved.layoutVersion === PANEL_LAYOUT_VERSION ? { ...(saved.active || {}) } : {} };
  } catch {
    return { panels: structuredClone(PANEL_DEFAULTS), active: {} };
  }
}

function savePanelStates() {
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ layoutVersion: PANEL_LAYOUT_VERSION, panels: panelStates, active: dockActive }));
}

function visiblePanelsInDock(zone) {
  return Object.keys(panelStates).filter((id) => panelStates[id].visible && panelStates[id].dock === zone);
}

function renderDockTabs(panelId) {
  const host = document.querySelector(`[data-dock-tabs="${panelId}"]`);
  const state = panelStates[panelId];
  const peers = state.dock === "floating" ? [panelId] : visiblePanelsInDock(state.dock);
  host.replaceChildren(...peers.map((id) => {
    const button = document.createElement("button");
    button.className = `dock-tab${id === panelId ? " active" : ""}`;
    button.textContent = PANEL_LABELS[id];
    button.title = id === panelId ? `${PANEL_LABELS[id]} · arrastra el asa para mover` : `Mostrar ${PANEL_LABELS[id]}`;
    button.onclick = (event) => {
      event.stopPropagation();
      dockActive[state.dock] = id;
      if (["inspector", "presets", "curves"].includes(id)) rightTab = id;
      applyPanelLayout();
      savePanelStates();
      if (id === "curves") requestAnimationFrame(drawCurve);
    };
    return button;
  }));
}

function applyPanelLayout() {
  const shell = document.querySelector(".studio-shell");
  DOCK_ZONES.forEach((zone) => {
    const peers = visiblePanelsInDock(zone);
    if (!peers.includes(dockActive[zone])) dockActive[zone] = peers[0] || null;
    shell.classList.toggle(`dock-${zone}-empty`, peers.length === 0);
  });
  Object.entries(panelStates).forEach(([id, state]) => {
    const panel = document.querySelector(`[data-panel="${id}"]`);
    const floating = state.dock === "floating";
    const active = floating || dockActive[state.dock] === id;
    panel.dataset.dockZone = state.dock;
    panel.classList.toggle("panel-hidden", !state.visible);
    panel.classList.toggle("dock-inactive", state.visible && !active);
    panel.classList.toggle("floating-panel", state.visible && floating);
    if (floating) {
      const defaults = PANEL_FLOAT_SIZES[id];
      state.width = Math.max(230, Math.min(Number.isFinite(state.width) ? state.width : defaults.width, shell.clientWidth - 16));
      state.height = Math.max(170, Math.min(Number.isFinite(state.height) ? state.height : defaults.height, shell.clientHeight - 16));
      state.left = Math.max(8, Math.min(Number.isFinite(state.left) ? state.left : 18, shell.clientWidth - state.width - 8));
      state.top = Math.max(8, Math.min(Number.isFinite(state.top) ? state.top : 18, shell.clientHeight - state.height - 8));
      panel.style.left = `${state.left}px`;
      panel.style.top = `${state.top}px`;
      panel.style.width = `${state.width}px`;
      panel.style.height = `${state.height}px`;
    } else {
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
      panel.style.removeProperty("width");
      panel.style.removeProperty("height");
      panel.style.removeProperty("z-index");
    }
    document.querySelectorAll(`[data-panel-toggle="${id}"]`).forEach((toggle) => { toggle.checked = state.visible; });
    document.querySelectorAll(`[data-panel-float="${id}"]`).forEach((button) => {
      button.title = floating ? `Acoplar en ${state.lastDock}` : "Desacoplar panel";
      button.setAttribute("aria-pressed", String(floating));
    });
    renderDockTabs(id);
  });
  refreshIcons();
  requestAnimationFrame(draw);
}

function setPanelVisible(id, visible) {
  panelStates[id].visible = visible;
  if (visible && panelStates[id].dock !== "floating") dockActive[panelStates[id].dock] = id;
  if (visible && ["inspector", "presets", "curves"].includes(id)) rightTab = id;
  applyPanelLayout();
  savePanelStates();
  if (visible && id === "curves") requestAnimationFrame(drawCurve);
}

function setPanelFloating(id, floating) {
  const panel = document.querySelector(`[data-panel="${id}"]`);
  const state = panelStates[id];
  if (floating && state.dock !== "floating") {
    const rect = panel.getBoundingClientRect();
    const shell = document.querySelector(".studio-shell");
    const shellRect = shell.getBoundingClientRect();
    const defaults = PANEL_FLOAT_SIZES[id];
    const width = Math.min(Number.isFinite(state.width) ? state.width : defaults.width, shell.clientWidth - 16);
    const height = Math.min(Number.isFinite(state.height) ? state.height : defaults.height, shell.clientHeight - 16);
    Object.assign(state, {
      visible: true,
      lastDock: state.dock,
      dock: "floating",
      left: Math.max(8, Math.min(rect.left - shellRect.left, shell.clientWidth - width - 8)),
      top: Math.max(8, Math.min(rect.top - shellRect.top, shell.clientHeight - height - 8)),
      width,
      height
    });
  } else if (!floating) {
    state.dock = DOCK_ZONES.includes(state.lastDock) ? state.lastDock : PANEL_DEFAULTS[id].dock;
    dockActive[state.dock] = id;
  }
  applyPanelLayout();
  savePanelStates();
}

function dockPanel(id, zone) {
  if (!DOCK_ZONES.includes(zone)) return;
  Object.assign(panelStates[id], { visible: true, dock: zone, lastDock: zone });
  dockActive[zone] = id;
  applyPanelLayout();
  savePanelStates();
  status(`${PANEL_LABELS[id]} acoplado ${zone === "bottom" ? "abajo" : `a la ${zone === "left" ? "izquierda" : "derecha"}`}`);
}

function dockTargetAt(clientX, clientY) {
  const rect = document.querySelector(".studio-shell").getBoundingClientRect();
  const sideWidth = Math.max(170, Math.min(300, rect.width * 0.24));
  const bottomHeight = Math.max(150, Math.min(280, rect.height * 0.3));
  if (clientY >= rect.bottom - bottomHeight) return "bottom";
  if (clientX <= rect.left + sideWidth) return "left";
  if (clientX >= rect.right - sideWidth) return "right";
  return null;
}

function updateDockOverlay(target) {
  const overlay = $("dock-overlay");
  overlay.hidden = !panelDrag;
  overlay.querySelectorAll("[data-dock-target]").forEach((item) => {
    item.classList.toggle("active", item.dataset.dockTarget === target);
  });
}

function bindPanels() {
  document.querySelectorAll("[data-panel-toggle]").forEach((toggle) => {
    toggle.onchange = () => setPanelVisible(toggle.dataset.panelToggle, toggle.checked);
  });
  document.querySelectorAll("[data-panel-close]").forEach((button) => {
    button.onclick = () => setPanelVisible(button.dataset.panelClose, false);
  });
  document.querySelectorAll("[data-panel-float]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.panelFloat;
      setPanelFloating(id, panelStates[id].dock !== "floating");
    };
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.addEventListener("pointerdown", () => {
      if (panel.classList.contains("floating-panel")) panel.style.zIndex = String(++panelZ);
    });
  });
  document.querySelectorAll("[data-panel-handle]").forEach((handle) => {
    handle.onpointerdown = (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const id = handle.dataset.panelHandle;
      const panel = document.querySelector(`[data-panel="${id}"]`);
      if (panelStates[id].dock !== "floating") setPanelFloating(id, true);
      panel.style.zIndex = String(++panelZ);
      panelDrag = { id, startX: event.clientX, startY: event.clientY, left: panelStates[id].left, top: panelStates[id].top, drop: null };
      updateDockOverlay(null);
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    handle.onpointermove = (event) => {
      if (!panelDrag || panelDrag.id !== handle.dataset.panelHandle) return;
      const state = panelStates[panelDrag.id];
      const panel = document.querySelector(`[data-panel="${panelDrag.id}"]`);
      const shell = document.querySelector(".studio-shell");
      const maxLeft = Math.max(8, shell.clientWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, shell.clientHeight - panel.offsetHeight - 8);
      state.left = Math.max(8, Math.min(maxLeft, panelDrag.left + event.clientX - panelDrag.startX));
      state.top = Math.max(8, Math.min(maxTop, panelDrag.top + event.clientY - panelDrag.startY));
      panel.style.left = `${state.left}px`;
      panel.style.top = `${state.top}px`;
      panelDrag.drop = dockTargetAt(event.clientX, event.clientY);
      updateDockOverlay(panelDrag.drop);
    };
    handle.onpointerup = () => {
      if (!panelDrag || panelDrag.id !== handle.dataset.panelHandle) return;
      const completed = panelDrag;
      const panel = document.querySelector(`[data-panel="${completed.id}"]`);
      panelStates[completed.id].width = panel.offsetWidth;
      panelStates[completed.id].height = panel.offsetHeight;
      panelDrag = null;
      updateDockOverlay(null);
      if (completed.drop) dockPanel(completed.id, completed.drop);
      else savePanelStates();
    };
    handle.onpointercancel = handle.onpointerup;
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.addEventListener("pointerup", () => {
      const id = panel.dataset.panel;
      if (panelStates[id].dock !== "floating") return;
      panelStates[id].width = panel.offsetWidth;
      panelStates[id].height = panel.offsetHeight;
      savePanelStates();
    });
  });
  $("reset-panels").onclick = () => {
    panelStates = structuredClone(PANEL_DEFAULTS);
    dockActive = { left: "skeleton", right: "inspector", bottom: "timeline" };
    rightTab = "inspector";
    applyPanelLayout();
    savePanelStates();
    status("Disposición de paneles restablecida");
  };
  applyPanelLayout();
}
function duration() { return project.clip.animation.duration; }
function fps() { return Number(project.fps || 24); }
function part() { return project.parts.find((item) => item.id === selectedPart); }
function selectedBone() { return project.rig?.bones?.find((item) => item.id === selectedTarget) || null; }
function isBoneDescendant(candidateId, ancestorId) {
  const parents = rigParents();
  let current = candidateId;
  while (current) {
    if (current === ancestorId) return true;
    current = parents[current];
  }
  return false;
}
function middleChainFor(target) {
  const parents = rigParents();
  const hasChild = (project.rig?.bones || []).some((bone) => bone.parent === target);
  return hasChild && parents[target] ? { upper: parents[target] } : null;
}
function ikChainFor(target) {
  const parents = rigParents();
  const middle = parents[target];
  const upper = middle && parents[middle];
  return upper ? { upper, middle } : null;
}
function selectionLabel() { return selectedTargets.size > 1 ? `${selectedTargets.size} objetivos` : label(selectedTarget); }
function selectAnimationTarget(target, append = false) {
  if (!append) selectedTargets = new Set([target]);
  else if (selectedTargets.has(target) && selectedTargets.size > 1) selectedTargets.delete(target);
  else selectedTargets.add(target);
  selectedTarget = selectedTargets.has(target) ? target : [...selectedTargets].at(-1);
}
function committedPose(at = time) { return sampleStudioAnimation(project.clip, at, animationTargets()); }
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
  if (candidate?.schema === "kinetra/v2") {
    const rig = candidate.rig || freshRig();
    const allowedTargets = ["rig", "torso", ...(rig.bones || []).map((bone) => bone.id)];
    const baseClip = createStudioProject({ rig: rig.id || "custom", anatomy: "custom" });
    baseClip.animation = candidate.clips?.[0] || baseClip.animation;
    const clip = parseStudioProject(JSON.stringify(baseClip), { allowedTargets });
    return {
      version: 4,
      fps: Number(candidate.fps || 24),
      assets: candidate.assets || [],
      rig,
      parts: (candidate.layers || []).map((item, z) => ({ visible: true, rotation: 0, scaleX: 1, scaleY: 1, z, ...item })),
      clip
    };
  }
  if (candidate?.clip) {
    if (!Array.isArray(candidate.parts)) throw new Error("El proyecto no contiene piezas");
    const rig = candidate.rig?.bones ? candidate.rig : freshRig();
    const allowedTargets = ["rig", "torso", ...rig.bones.map((bone) => bone.id)];
    const clip = parseStudioProject(JSON.stringify(candidate.clip), { allowedTargets });
    const parts = candidate.parts.map((item, z) => ({
      name: item.name || LABELS[item.id] || prettyId(item.id),
      source: candidate.assets?.some((asset) => asset.id === item.assetId) ? "asset" : "builtin",
      boneId: PART_JOINTS[item.id] || (item.id === "torso" ? "rig" : "rig"),
      visible: true,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      z,
      ...item
    }));
    return { version: 4, fps: Number(candidate.fps || 24), assets: candidate.assets || [], rig, parts, clip };
  }
  const clip = parseStudioProject(JSON.stringify(candidate), { allowedTargets: PUPPET_TARGETS });
  return { version: 4, fps: 24, assets: [], rig: freshRig(), parts: freshParts(), clip };
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
  normalizeLayerOrder();
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
    const asset = project.assets?.find((entry) => entry.id === item.assetId);
    const source = asset?.src || `./assets/modular/man_sprites/runtime/${encodeURIComponent(item.assetId || item.id)}.png`;
    if (images[item.id]?.dataset.source === source) return;
    const image = new Image();
    image.dataset.assetId = item.assetId;
    image.dataset.source = source;
    image.src = source;
    image.onload = draw;
    images[item.id] = image;
  });
}

function layerSourceRect(item, image) {
  const crop = item.crop;
  if (!crop) return { x: 0, y: 0, width: image?.naturalWidth || 120, height: image?.naturalHeight || 120 };
  return {
    x: Number(crop.x) || 0,
    y: Number(crop.y) || 0,
    width: Math.max(1, Number(crop.width) || 1),
    height: Math.max(1, Number(crop.height) || 1)
  };
}

function normalizeLayerOrder() {
  [...project.parts]
    .sort((left, right) => (Number(left.z) || 0) - (Number(right.z) || 0))
    .forEach((item, index) => { item.z = index; });
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
  const parent = rigParents()[target];
  return parent ? state.joints[parent] : state.root;
}

function matrices(at = time, sampledPose = null) {
  const sampled = sampledPose || pose(at);
  const root = transformMatrix(sampled.rig);
  const joints = rigJoints();
  const parents = rigParents();
  const memo = {};
  const resolving = new Set();
  function joint(id) {
    if (memo[id]) return memo[id];
    if (resolving.has(id) || !joints[id]) return root;
    resolving.add(id);
    const parent = parents[id];
    const current = joints[id];
    const from = parent ? joints[parent] || { x: 0, y: 0 } : { x: 0, y: 0 };
    const parentMatrix = parent ? joint(parent) : root;
    memo[id] = multiply(multiply(parentMatrix, translate(current.x - from.x, current.y - from.y)), transformMatrix(sampled[id]));
    resolving.delete(id);
    return memo[id];
  }
  Object.keys(joints).forEach(joint);
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
  const item = project.parts.find((partItem) => partItem.id === partId);
  const target = partBoneId(item);
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
    const source = layerSourceRect(item, image);
    const targetId = partBoneId(item);
    const jointId = targetId !== "rig" && targetId !== "torso" ? targetId : null;
    const matrix = jointId && state.joints[jointId]
      ? state.joints[jointId]
      : multiply(state.root, targetId === "torso" ? transformMatrix(state.pose.torso) : [1, 0, 0, 1, 0, 0]);
    const anchor = jointId ? rigJoints()[jointId] || { x: 0, y: 0 } : { x: 0, y: 0 };
    const visibility = Math.max(0, Math.min(1, 1 + (state.pose.rig?.alpha || 0) + (state.pose[targetId]?.alpha || 0)));
    targetContext.save();
    targetContext.globalAlpha *= visibility;
    targetContext.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    targetContext.translate(item.x - anchor.x, item.y - anchor.y);
    targetContext.rotate(item.rotation * Math.PI / 180);
    targetContext.scale(item.scaleX, item.scaleY);
    targetContext.drawImage(
      image,
      source.x, source.y, source.width, source.height,
      -source.width / 2, -source.height / 2, source.width, source.height
    );
    if (tint) {
      targetContext.globalCompositeOperation = "source-atop";
      targetContext.globalAlpha *= 0.45;
      targetContext.fillStyle = "#79b8ef";
      targetContext.fillRect(-source.width / 2, -source.height / 2, source.width, source.height);
    }
    targetContext.restore();
  });
  targetContext.restore();
}

function figureBounds(at) {
  const state = matrices(at);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = ({ x, y }) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  project.parts.forEach((item) => {
    if (!item.visible || targetHidden(item.id)) return;
    const image = images[item.id];
    if (!image?.complete || !image.naturalWidth) return;
    const source = layerSourceRect(item, image);
    const targetId = partBoneId(item);
    const jointId = targetId !== "rig" && targetId !== "torso" ? targetId : null;
    const parentMatrix = jointId && state.joints[jointId]
      ? state.joints[jointId]
      : multiply(state.root, targetId === "torso" ? transformMatrix(state.pose.torso) : [1, 0, 0, 1, 0, 0]);
    const anchor = jointId ? rigJoints()[jointId] || { x: 0, y: 0 } : { x: 0, y: 0 };
    const matrix = multiply(
      multiply(
        multiply(parentMatrix, translate(item.x - anchor.x, item.y - anchor.y)),
        rotate(item.rotation)
      ),
      scale(item.scaleX, item.scaleY)
    );
    const halfWidth = source.width / 2;
    const halfHeight = source.height / 2;
    include(point(matrix, -halfWidth, -halfHeight));
    include(point(matrix, halfWidth, -halfHeight));
    include(point(matrix, -halfWidth, halfHeight));
    include(point(matrix, halfWidth, halfHeight));
  });
  if (!Number.isFinite(minX)) {
    [state.root, ...Object.values(state.joints)].forEach((matrix) => include({ x: matrix[4], y: matrix[5] }));
    minX -= 90;
    maxX += 90;
    minY -= 90;
    maxY += 90;
  }
  return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function themeColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
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
  const parents = rigParents();
  Object.entries(state.joints).forEach(([id, matrix]) => {
    const parent = parents[id];
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
  const editableTargets = [...selectedTargets].filter((target) => !lockedTargets.has(target));
  const targets = collapseHierarchicalSelection(editableTargets, rigParents());
  const gizmoAngle = transformGizmoAngle(state);
  if (hit.type === "translate") {
    const target = targets[0];
    const middleChain = editableTargets.length === 1 ? middleChainFor(target) : null;
    if (middleChain && !lockedTargets.has(middleChain.upper)) {
      const upper = state.joints[middleChain.upper];
      const middle = state.joints[target];
      return {
        type: "joint",
        axis: hit.axis,
        target,
        start: world,
        gizmoAngle,
        chain: middleChain,
        points: {
          root: { x: upper[4], y: upper[5] },
          joint: { x: middle[4], y: middle[5] }
        },
        upperAngle: state.pose[middleChain.upper]?.angle || 0,
        moved: false
      };
    }
    const chain = editableTargets.length === 1 ? ikChainFor(target) : null;
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
  previewContext.fillStyle = themeColor("--preview-bg", "#091522");
  previewContext.fillRect(0, 0, width, height);
  const at = mode === "animador" ? time : 0;
  const bounds = figureBounds(at);
  const margin = 12;
  const fit = Math.min((width - margin * 2) / bounds.width, (height - margin * 2) / bounds.height);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  previewContext.save();
  previewContext.translate(width / 2, height / 2);
  previewContext.scale(fit, fit);
  previewContext.translate(-centerX, -centerY);
  renderFigure(previewContext, at);
  previewContext.restore();
}

function draw() {
  resizeCanvas(canvas, context);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  const gradient = context.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height));
  gradient.addColorStop(0, themeColor("--canvas-center", "#0d2236"));
  gradient.addColorStop(1, themeColor("--canvas-edge", "#06111d"));
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
  document.querySelectorAll("[data-view-toggle]").forEach((toggle) => {
    toggle.checked = $(toggle.dataset.viewToggle).checked;
  });
  const pending = hasDraft() ? ` · Borrador ${draftTime} ms` : "";
  const selection = mode === "animador" ? ` · ${selectionLabel()}` : "";
  $("canvas-status").textContent = `Zoom: ${Math.round(zoom * 100)} % · ${label(mode)} · ${Math.round(time)} ms${selection}${pending}`;
  updateGhostLabel();
  drawPreview();
}

function exactKey(target = selectedTarget, at = Math.round(time)) {
  return (project.clip.animation.keys[target] || []).find((frame) => frame.t === at) || null;
}

function appendTreeNode(node, depth, search, host) {
  const visible = label(node.id).toLocaleLowerCase().includes(search) || (node.children || []).some((child) => label(child.id).toLocaleLowerCase().includes(search));
  if (!visible) return;
  const row = document.createElement("div");
  row.className = `tree-row${selectedTargets.has(node.id) ? " active" : ""}`;
  row.style.paddingLeft = `${depth * 17}px`;
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.append(createIcon(node.children?.length ? "git-branch" : "circle"));
  const multi = document.createElement("button");
  multi.className = "tree-multi";
  multi.append(createIcon(selectedTargets.has(node.id) ? "check" : "plus"));
  multi.title = selectedTargets.has(node.id) ? "Quitar de la selección múltiple" : "Añadir a la selección múltiple";
  multi.setAttribute("aria-label", `${selectedTargets.has(node.id) ? "Quitar" : "Añadir"} ${label(node.id)} ${selectedTargets.has(node.id) ? "de" : "a"} la selección múltiple`);
  multi.setAttribute("aria-pressed", String(selectedTargets.has(node.id)));
  multi.onclick = () => {
    selectAnimationTarget(node.id, true);
    selectedKeys.clear();
    refresh();
    status(`${selectionLabel()} seleccionados`);
  };
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
  toggle.append(createIcon(hiddenTargets.has(node.id) ? "eye-off" : "eye"));
  toggle.title = "Mostrar u ocultar en el lienzo";
  toggle.onclick = () => { hiddenTargets.has(node.id) ? hiddenTargets.delete(node.id) : hiddenTargets.add(node.id); renderTree(); draw(); };
  const lock = document.createElement("button");
  lock.className = "tree-toggle";
  lock.append(createIcon(lockedTargets.has(node.id) ? "lock-keyhole" : "lock-keyhole-open"));
  lock.title = lockedTargets.has(node.id) ? "Desbloquear edición" : "Bloquear edición";
  lock.onclick = () => {
    lockedTargets.has(node.id) ? lockedTargets.delete(node.id) : lockedTargets.add(node.id);
    selectedKeys.clear();
    refresh();
  };
  row.append(icon, multi, button, toggle, lock);
  host.append(row);
  (node.children || []).forEach((child) => appendTreeNode(child, depth + 1, search, host));
}

function renderLayers(search, host) {
  [...project.parts].sort((left, right) => right.z - left.z).forEach((item) => {
    const itemLabel = item.name || label(item.id);
    if (!itemLabel.toLocaleLowerCase().includes(search)) return;
    const row = document.createElement("div");
    row.className = `tree-row${selectedPart === item.id ? " active" : ""}`;
    const icon = document.createElement("span");
    icon.className = "tree-icon";
    icon.append(createIcon("layers-3"));
    const button = document.createElement("button");
    button.className = "tree-select";
    button.textContent = itemLabel;
    button.onclick = () => { selectedPart = item.id; refresh(); };
    const toggle = document.createElement("button");
    toggle.className = "tree-toggle";
    toggle.append(createIcon(item.visible ? "eye" : "eye-off"));
    toggle.onclick = () => { item.visible = !item.visible; commit("Visibilidad actualizada"); refresh(); };
    const lock = document.createElement("button");
    lock.className = "tree-toggle";
    lock.append(createIcon(lockedParts.has(item.id) ? "lock-keyhole" : "lock-keyhole-open"));
    lock.title = lockedParts.has(item.id) ? "Desbloquear edición" : "Bloquear edición";
    lock.onclick = () => {
      lockedParts.has(item.id) ? lockedParts.delete(item.id) : lockedParts.add(item.id);
      refresh();
    };
    row.append(icon, button, toggle, lock);
    host.append(row);
  });
}

function renderTree() {
  document.querySelectorAll("[data-hierarchy-kind]").forEach((panel) => {
    const kind = panel.dataset.hierarchyKind;
    const host = panel.querySelector("[data-hierarchy-tree]");
    const search = panel.querySelector("[data-hierarchy-search]").value.trim().toLocaleLowerCase();
    host.replaceChildren();
    if (kind === "layers") renderLayers(search, host);
    else if (kind === "tracks") {
      animationTargets().filter((target) => (project.clip.animation.keys[target] || []).length || !search)
        .filter((target) => label(target).toLocaleLowerCase().includes(search))
        .forEach((target) => appendTreeNode({ id: target }, 0, search, host));
    } else rigTree().forEach((node) => appendTreeNode(node, 0, search, host));
    const description = kind === "layers"
      ? `${project.parts.length} capas reales · ${(project.assets || []).length} recursos importados`
      : `${project.rig?.name || project.clip.rig} · ${(project.rig?.bones || []).length} huesos · ${Object.keys(project.clip.animation.keys).length} pistas`;
    panel.querySelector("[data-hierarchy-meta]").textContent = description;
    refreshIcons(panel);
  });
}

function renderInspector() {
  const calibration = mode === "calibrador";
  $("animation-inspector").hidden = calibration;
  $("calibration-inspector").hidden = !calibration;
  const currentPart = part();
  $("selected-name").textContent = calibration ? currentPart?.name || "Sin capas" : selectionLabel();
  $("selected-type").textContent = calibration
    ? currentPart
      ? `Capa ${currentPart.z + 1} · Hueso: ${label(partBoneId(currentPart))}`
      : "Importa una imagen para crear la primera capa"
    : selectedTargets.size > 1
      ? `Selección múltiple · Principal: ${label(selectedTarget)}`
      : `Hueso · Objetivo: ${selectedTarget}`;
  if (calibration) {
    const current = currentPart;
    $("part-name").value = current?.name || "";
    $("part-bone").replaceChildren(...animationTargets()
      .filter((target) => target !== "torso")
      .map((target) => new Option(label(target), target, false, current && partBoneId(current) === target)));
    $("part-x").value = current?.x ?? 0;
    $("part-y").value = current?.y ?? 0;
    $("part-rotation").value = current?.rotation ?? 0;
    $("part-scale").value = Math.abs(current?.scaleX ?? 1);
    ["part-name", "part-bone", "part-x", "part-y", "part-rotation", "part-scale", "flip-part", "layer-up", "layer-down", "remove-part"]
      .forEach((id) => { $(id).disabled = !current || lockedParts.has(current.id); });

    const bone = selectedBone();
    $("bone-name").value = bone?.name || project.rig?.name || "Rig";
    $("bone-x").value = bone?.x ?? 0;
    $("bone-y").value = bone?.y ?? 0;
    $("bone-parent").replaceChildren(
      new Option("Rig (raíz)", ""),
      ...(project.rig?.bones || [])
        .filter((candidate) => candidate.id !== bone?.id && !isBoneDescendant(candidate.id, bone?.id))
        .map((candidate) => new Option(candidate.name || candidate.id, candidate.id, false, bone?.parent === candidate.id))
    );
    ["bone-name", "bone-parent", "bone-x", "bone-y", "inspector-delete-bone"]
      .forEach((id) => { $(id).disabled = !bone; });
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
  const targets = animationTargets().filter((target) => exactKey(target, next));
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
  trackLabel.append(createIcon("zap"), document.createTextNode("Eventos de sprite"));
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
  trackLabel.append(createIcon("images"), document.createTextNode("Referencia de sprites"));
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
  const availableWidth = Math.max(0, $("timeline-scroll").clientWidth - 18);
  $("timeline-content").style.width = `${Math.round(availableWidth * timelineZoom)}px`;
  renderRuler();
  const host = $("tracks");
  host.replaceChildren();
  animationTargets().forEach((target) => host.append(makeTrackRow(target)));
  host.append(makeEventRow(), makeSpriteRow());
  updateTimeDisplays();
  refreshIcons($("timeline-content"));
}

function gameValidationErrors() {
  return validateStudioProject(normalizeStudioProject(project.clip), { mode: "game", allowedTargets: animationTargets() });
}

function safeId(value, fallback) {
  const normalized = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function uniqueId(base, used) {
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) candidate = `${base}_${index++}`;
  return candidate;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function importImageLayers(files) {
  const accepted = [...files].filter((file) => /^image\/(png|webp|jpeg)$/.test(file.type));
  if (!accepted.length) return status("Selecciona imágenes PNG, WebP o JPEG");
  const total = accepted.reduce((sum, file) => sum + file.size, 0);
  if (total > 24 * 1024 * 1024) return status("Las imágenes superan 24 MB; reduce su tamaño antes de importarlas");
  const usedAssets = new Set((project.assets || []).map((asset) => asset.id));
  const usedLayers = new Set(project.parts.map((item) => item.id));
  const anchorId = selectedTarget !== "torso" && animationTargets().includes(selectedTarget) ? selectedTarget : "rig";
  const anchor = anchorId === "rig" ? { x: 0, y: 0 } : rigJoints()[anchorId] || { x: 0, y: 0 };
  let lastLayer = null;
  for (const file of accepted) {
    const base = safeId(file.name.replace(/\.[^.]+$/, ""), "capa");
    const assetId = uniqueId(`asset_${base}`, usedAssets);
    usedAssets.add(assetId);
    const layerId = uniqueId(base, usedLayers);
    usedLayers.add(layerId);
    const src = await readFileAsDataUrl(file);
    project.assets.push({ id: assetId, name: file.name, type: file.type, size: file.size, src });
    lastLayer = {
      id: layerId,
      name: file.name.replace(/\.[^.]+$/, ""),
      assetId,
      source: "asset",
      boneId: anchorId,
      x: anchor.x,
      y: anchor.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      visible: true,
      z: project.parts.length
    };
    project.parts.push(lastLayer);
  }
  normalizeLayerOrder();
  selectedPart = lastLayer.id;
  ensureImages();
  commit(`${accepted.length} imagen(es) importadas como capas reales`);
  setMode("calibrador");
  showRightTab("layers");
}

function removeSelectedLayer() {
  const current = part();
  if (!current) return;
  if (!confirm(`¿Eliminar la capa “${current.name || current.id}”?`)) return;
  project.parts = project.parts.filter((item) => item.id !== current.id);
  normalizeLayerOrder();
  delete images[current.id];
  if (current.source === "asset" && !project.parts.some((item) => item.assetId === current.assetId)) {
    project.assets = project.assets.filter((asset) => asset.id !== current.assetId);
  }
  lockedParts.delete(current.id);
  selectedPart = project.parts.at(-1)?.id || "";
  commit("Capa eliminada");
  refresh();
}

function addBone() {
  const parent = selectedTarget !== "rig" && selectedBone() ? selectedTarget : null;
  const parentBone = parent ? project.rig.bones.find((bone) => bone.id === parent) : null;
  const used = new Set(project.rig.bones.map((bone) => bone.id));
  const id = uniqueId("hueso", used);
  project.rig.bones.push({
    id,
    name: `Hueso ${project.rig.bones.length + 1}`,
    parent,
    x: (parentBone?.x || 0),
    y: (parentBone?.y || 0) + 140
  });
  project.rig.id = "custom";
  project.rig.name = project.rig.name === "Humanoide" ? "Rig personalizado" : project.rig.name;
  project.clip.rig = "custom";
  project.clip.anatomy = "custom";
  selectAnimationTarget(id);
  commit("Hueso añadido al rig");
  refresh();
}

function removeSelectedBone() {
  const bone = selectedBone();
  if (!bone) return status("Selecciona un hueso; el rig raíz no se puede eliminar");
  if (!confirm(`¿Eliminar el hueso “${bone.name || bone.id}”? Sus hijos se vincularán a su padre.`)) return;
  project.rig.bones.forEach((candidate) => {
    if (candidate.parent === bone.id) candidate.parent = bone.parent || null;
  });
  project.parts.forEach((item) => {
    if (partBoneId(item) === bone.id) item.boneId = bone.parent || "rig";
  });
  project.rig.bones = project.rig.bones.filter((candidate) => candidate.id !== bone.id);
  project.rig.id = "custom";
  project.clip.rig = "custom";
  project.clip.anatomy = "custom";
  delete project.clip.animation.keys[bone.id];
  project.clip.animation.requires = project.clip.animation.requires.filter((target) => target !== bone.id);
  hiddenTargets.delete(bone.id);
  lockedTargets.delete(bone.id);
  selectAnimationTarget(bone.parent || "rig");
  commit("Hueso eliminado y dependencias reasignadas");
  refresh();
}

function createNewProject() {
  closeApplicationMenus();
  $("new-project-dialog").showModal();
  refreshIcons($("new-project-dialog"));
}

function createProjectFromTemplate(templateId) {
  pause();
  project = createTemplateProject(templateId);
  normalizeLayerOrder();
  selectAnimationTarget("rig");
  selectedPart = project.parts.find((item) => partBoneId(item) === "rig")?.id || project.parts[0]?.id || "";
  selectedKeys.clear();
  hiddenTargets.clear();
  lockedTargets.clear();
  lockedParts.clear();
  time = 0;
  clearDraft();
  clearGhost();
  ensureImages();
  $("new-project-dialog").close();
  const templateName = templateId === "female" ? "humano femenino" : templateId === "dog" ? "perro" : templateId === "blank" ? "proyecto vacío" : "humano masculino";
  commit(`Plantilla ${templateName} creada`);
  setMode("calibrador");
}

function applyPreviewVisibility() {
  document.querySelector(".preview-card").hidden = !previewVisible;
  $("preview-toggle").checked = previewVisible;
  localStorage.setItem(PREVIEW_STORAGE_KEY, String(previewVisible));
  if (previewVisible) requestAnimationFrame(drawPreview);
}

function applyTheme(next, persist = true) {
  theme = ["noche", "grafito", "aurora"].includes(next) ? next : "noche";
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-choice]").forEach((input) => { input.checked = input.value === theme; });
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, theme);
  draw();
}

function openHelpDialog(topic) {
  const content = HELP_TOPICS[topic];
  if (!content) return;
  closeApplicationMenus();
  $("help-dialog-title").textContent = content.title;
  $("help-dialog-body").innerHTML = content.body;
  $("help-dialog").showModal();
}

function currentTutorialStep() {
  if (!tutorialRun) return null;
  return TUTORIALS[tutorialRun.topic]?.steps[tutorialRun.index] || null;
}

function positionTutorial() {
  const step = currentTutorialStep();
  if (!step) return;
  const target = document.querySelector(step.target) || $("workspace-menu");
  const rect = target.getBoundingClientRect();
  const padding = 7;
  const spotlight = $("tutorial-spotlight");
  spotlight.style.left = `${Math.max(3, rect.left - padding)}px`;
  spotlight.style.top = `${Math.max(3, rect.top - padding)}px`;
  spotlight.style.width = `${Math.min(innerWidth - 6, rect.width + padding * 2)}px`;
  spotlight.style.height = `${Math.min(innerHeight - 6, rect.height + padding * 2)}px`;

  const card = $("tutorial-card");
  const cardRect = card.getBoundingClientRect();
  const gap = 16;
  let left = Math.min(Math.max(12, rect.left), innerWidth - cardRect.width - 12);
  let top = rect.bottom + gap;
  if (top + cardRect.height > innerHeight - 12) top = rect.top - cardRect.height - gap;
  if (top < 12) {
    top = Math.min(Math.max(12, rect.top), innerHeight - cardRect.height - 12);
    left = rect.right + gap;
    if (left + cardRect.width > innerWidth - 12) left = rect.left - cardRect.width - gap;
    left = Math.min(Math.max(12, left), innerWidth - cardRect.width - 12);
  }
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function renderTutorialStep() {
  const tutorial = tutorialRun && TUTORIALS[tutorialRun.topic];
  const step = currentTutorialStep();
  if (!tutorial || !step) return;
  if (step.panel) showRightTab(step.panel);
  closeApplicationMenus();
  $("tutorial-overlay").hidden = false;
  $("tutorial-progress").textContent = `${tutorial.label} · ${tutorialRun.index + 1} de ${tutorial.steps.length}`;
  $("tutorial-title").textContent = step.title;
  $("tutorial-copy").textContent = step.copy;
  $("tutorial-back").disabled = tutorialRun.index === 0;
  const last = tutorialRun.index === tutorial.steps.length - 1;
  $("tutorial-next").innerHTML = last
    ? `Finalizar <i data-lucide="check"></i>`
    : `Siguiente <i data-lucide="arrow-right"></i>`;
  refreshIcons($("tutorial-next"));
  requestAnimationFrame(() => {
    const target = document.querySelector(step.target);
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    requestAnimationFrame(positionTutorial);
  });
  $("tutorial-next").focus();
}

function startTutorial(topic) {
  const tutorial = TUTORIALS[topic];
  if (!tutorial) return;
  closeApplicationMenus();
  if ($("help-dialog").open) $("help-dialog").close();
  setMode(tutorial.mode);
  tutorialRun = { topic, index: 0 };
  renderTutorialStep();
}

function moveTutorial(direction) {
  if (!tutorialRun) return;
  const steps = TUTORIALS[tutorialRun.topic].steps;
  const next = tutorialRun.index + direction;
  if (next >= steps.length) return closeTutorial();
  tutorialRun.index = Math.max(0, next);
  renderTutorialStep();
}

function closeTutorial() {
  tutorialRun = null;
  $("tutorial-overlay").hidden = true;
}

function renderModeOverlay() {
  const overlay = $("mode-overlay");
  overlay.hidden = !["exportar", "proyecto"].includes(mode);
  if (overlay.hidden) return;
  if (mode === "exportar") {
    const errors = gameValidationErrors();
    overlay.innerHTML = `<h2>Exportar</h2><p class="muted">Kinetra v2 conserva rig, capas, imágenes y animación en un paquete JSON autocontenido para aplicaciones web. El clip heredado mantiene compatibilidad con juegos que ya usan cronicas-studio/v1.</p><div class="summary-grid"><div class="summary-card"><strong>Paquete Kinetra v2</strong><span>${project.rig.bones.length} huesos · ${project.parts.length} capas · ${project.assets.length} recursos importados</span><div class="button-row"><button id="download-project" class="small-button primary">Exportar .kinetra.json</button></div></div><div class="summary-card"><strong>Clip heredado v1</strong><span>${errors.length ? `${errors.length} observaciones` : "Validación superada"}</span><div class="button-row"><button id="download-clip" class="small-button" ${errors.length ? "disabled" : ""}>Exportar solo movimiento</button></div></div></div>${errors.length ? `<h3>Falta resolver para el clip v1</h3><ul class="validation-list">${errors.map((error) => `<li>${error}</li>`).join("")}</ul>` : ""}`;
    $("download-project").onclick = exportProject;
    $("download-clip").onclick = exportClip;
  } else {
    overlay.innerHTML = `<h2>Proyecto</h2><div class="summary-grid"><div class="summary-card"><strong>${project.clip.animation.label}</strong><span>ID: ${project.clip.animation.id}<br>Rig: ${project.rig.name}<br>${project.rig.bones.length} huesos · ${project.parts.length} capas<br>Estado: ${project.clip.animation.status}</span></div><div class="summary-card"><strong>Kinetra v2</strong><span>Los recursos importados, la jerarquía y las animaciones viajan juntos en la exportación para web.</span></div></div><div class="button-row"><button id="new-project" class="small-button danger">Crear proyecto nuevo</button></div>`;
    $("new-project").onclick = createNewProject;
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
  const state = panelStates[next];
  if (!state) return;
  state.visible = true;
  if (state.dock !== "floating") dockActive[state.dock] = next;
  applyPanelLayout();
  savePanelStates();
  if (next === "curves") requestAnimationFrame(drawCurve);
}

function setMode(next) {
  if (next === "sprites") next = "calibrador";
  mode = next;
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === next));
  $("workspace-menu-label").textContent = WORKSPACE_LABELS[next] || "Espacio";
  const preferredPanel = next === "calibrador" ? "layers" : next === "animador" ? "skeleton" : null;
  if (preferredPanel && panelStates[preferredPanel].visible && panelStates[preferredPanel].dock !== "floating") {
    dockActive[panelStates[preferredPanel].dock] = preferredPanel;
    applyPanelLayout();
  }
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
  const source = animationTargets().map((target) => [target, exactKey(target, at)]).filter(([, frame]) => frame);
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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("No se pudo incrustar un recurso"));
    reader.readAsDataURL(blob);
  });
}

async function portableAuthoringProject() {
  const portable = structuredClone(project);
  const knownAssets = new Map((portable.assets || []).map((asset) => [asset.id, asset]));
  for (const layer of portable.parts) {
    const existing = knownAssets.get(layer.assetId);
    if (existing?.src?.startsWith("data:")) {
      layer.source = "asset";
      continue;
    }
    const source = existing?.src || `./assets/modular/man_sprites/runtime/${encodeURIComponent(layer.assetId || layer.id)}.png`;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`No se pudo incrustar el recurso ${layer.assetId}`);
    const blob = await response.blob();
    const asset = {
      id: layer.assetId,
      name: `${layer.assetId}.png`,
      type: blob.type || "image/png",
      size: blob.size,
      src: await blobToDataUrl(blob)
    };
    if (existing) Object.assign(existing, asset);
    else portable.assets.push(asset);
    knownAssets.set(asset.id, existing || asset);
    layer.source = "asset";
  }
  return portable;
}

async function exportProject() {
  project.clip = normalizeStudioProject(project.clip);
  try {
    status("Preparando paquete portable…");
    const bundle = createKinetraBundle(await portableAuthoringProject());
    const name = `${project.clip.animation.id.replace(/[^a-z0-9_-]/gi, "_")}.kinetra.json`;
    download(name, JSON.stringify(bundle, null, 2));
    status("Proyecto Kinetra v2 exportado con rig, capas e imágenes incrustadas");
  } catch (error) {
    status(error.message);
  }
}

function exportClip() {
  try {
    const contents = serializeStudioProject(project.clip, { mode: "game", allowedTargets: animationTargets() });
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
  updatePlaybackButtons();
  animationFrame = requestAnimationFrame(tick);
}

function pause() {
  playing = false;
  cancelAnimationFrame(animationFrame);
  updatePlaybackButtons();
}

function updatePlaybackButtons() {
  $("preview-state").classList.toggle("active", playing);
  $("preview-state").setAttribute("aria-label", playing ? "Reproduciendo" : "Detenido");
  document.querySelectorAll(".playback-toggle").forEach((button) => {
    button.dataset.playing = String(playing);
    button.setAttribute("aria-label", playing ? "Detener" : "Reproducir");
    button.title = playing ? "Detener (Espacio)" : "Reproducir (Espacio)";
  });
  const label = $("header-play").querySelector(".playback-label");
  if (label) label.textContent = playing ? "Detener" : "Reproducir";
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
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => {
      setMode(button.dataset.mode);
      closeApplicationMenus();
    };
  });
  document.querySelectorAll("[data-tool]").forEach((button) => { button.onclick = () => setTool(button.dataset.tool); });
  document.querySelectorAll("[data-hierarchy-search]").forEach((input) => { input.oninput = renderTree; });
  document.querySelectorAll("[data-view-toggle]").forEach((toggle) => {
    toggle.onchange = () => {
      $(toggle.dataset.viewToggle).checked = toggle.checked;
      draw();
    };
  });
  document.querySelectorAll("[data-theme-choice]").forEach((input) => {
    input.onchange = () => {
      applyTheme(input.value);
      closeApplicationMenus();
      status(`Tema ${input.parentElement.textContent.trim()} activado`);
    };
  });
  const menuCommands = {
    new: createNewProject,
    open: () => $("file").click(),
    "import-images": () => $("image-files").click(),
    save: () => saveLocal(hasDraft() ? "Proyecto guardado; el borrador del fotograma sigue pendiente" : "Proyecto guardado en este navegador"),
    "export-project": exportProject,
    "export-clip": exportClip,
    undo,
    redo,
    fit: () => $("fit").click(),
    fullscreen: () => $("fullscreen").click(),
    shortcuts: () => openHelpDialog("shortcuts")
  };
  document.querySelectorAll("[data-menu-command]").forEach((button) => {
    button.onclick = () => {
      menuCommands[button.dataset.menuCommand]?.();
      button.closest("details")?.removeAttribute("open");
    };
  });
  document.querySelectorAll(".app-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      document.querySelectorAll(".app-menu[open]").forEach((other) => { if (other !== menu) other.removeAttribute("open"); });
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".app-menu")) closeApplicationMenus();
  });
  document.querySelectorAll("[data-tutorial]").forEach((button) => {
    button.onclick = () => startTutorial(button.dataset.tutorial);
  });
  $("help-dialog-close").onclick = () => $("help-dialog").close();
  $("help-dialog").onclick = (event) => { if (event.target === $("help-dialog")) $("help-dialog").close(); };
  $("new-project-close").onclick = () => $("new-project-dialog").close();
  $("new-project-dialog").onclick = (event) => { if (event.target === $("new-project-dialog")) $("new-project-dialog").close(); };
  document.querySelectorAll("[data-project-template]").forEach((button) => {
    button.onclick = () => createProjectFromTemplate(button.dataset.projectTemplate);
  });
  $("tutorial-close").onclick = closeTutorial;
  $("tutorial-back").onclick = () => moveTutorial(-1);
  $("tutorial-next").onclick = () => moveTutorial(1);
  $("preview-toggle").onchange = () => {
    previewVisible = $("preview-toggle").checked;
    applyPreviewVisibility();
  };
  $("undo").onclick = undo;
  $("redo").onclick = redo;
  $("save-local").onclick = () => {
    saveLocal(hasDraft() ? "Proyecto guardado; el borrador del fotograma sigue pendiente" : "Proyecto guardado en este navegador");
  };
  $("import-layers").onclick = () => $("image-files").click();
  $("delete-layer").onclick = removeSelectedLayer;
  $("remove-part").onclick = removeSelectedLayer;
  $("add-bone").onclick = addBone;
  $("inspector-add-bone").onclick = addBone;
  $("delete-bone").onclick = removeSelectedBone;
  $("inspector-delete-bone").onclick = removeSelectedBone;
  $("image-files").onchange = async () => {
    try {
      await importImageLayers($("image-files").files);
    } catch (error) {
      status(`No se pudieron importar las imágenes: ${error.message}`);
    } finally {
      $("image-files").value = "";
    }
  };
  $("part-name").onchange = () => {
    if (!part()) return;
    part().name = $("part-name").value.trim() || part().id;
    commit("Capa renombrada");
    refresh();
  };
  $("part-bone").onchange = () => {
    if (!part()) return;
    part().boneId = $("part-bone").value || "rig";
    commit("Capa vinculada al hueso");
    refresh();
  };
  $("bone-name").onchange = () => {
    const bone = selectedBone();
    if (!bone) return;
    bone.name = $("bone-name").value.trim() || bone.id;
    commit("Hueso renombrado");
    refresh();
  };
  $("bone-parent").onchange = () => {
    const bone = selectedBone();
    if (!bone) return;
    bone.parent = $("bone-parent").value || null;
    commit("Jerarquía del rig actualizada");
    refresh();
  };
  const updateBonePivot = () => {
    const bone = selectedBone();
    if (!bone) return;
    bone.x = Number($("bone-x").value) || 0;
    bone.y = Number($("bone-y").value) || 0;
    commit("Pivote del hueso actualizado");
    refresh();
  };
  $("bone-x").onchange = updateBonePivot;
  $("bone-y").onchange = updateBonePivot;
  $("project-name").onchange = () => {
    project.clip.animation.id = $("project-name").value.trim() || "nuevo_movimiento";
    commit("ID del proyecto actualizado");
    refresh();
  };
  $("header-play").onclick = () => playing ? pause() : play();
  $("preview-play").onclick = () => playing ? pause() : play();
  $("play").onclick = () => playing ? pause() : play();
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
      if (!current) return status("Importa o selecciona una capa para calibrarla");
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
    const current = part();
    if (!current) return status("Importa o selecciona una capa para voltearla");
    if (lockedParts.has(current.id)) return status(`${current.name || current.id} está bloqueado`);
    current.scaleX *= -1;
    commit("Pieza volteada");
    refresh();
  };
  const moveLayer = (delta) => {
    const current = part();
    if (!current) return status("Importa o selecciona una capa para ordenarla");
    if (lockedParts.has(current.id)) return status(`${current.name || current.id} está bloqueado`);
    normalizeLayerOrder();
    const ordered = [...project.parts].sort((left, right) => left.z - right.z);
    const index = ordered.indexOf(current);
    const other = ordered[index + delta];
    if (!other) return status(delta > 0 ? "La capa ya está al frente" : "La capa ya está al fondo");
    [current.z, other.z] = [other.z, current.z];
    commit("Orden de capas actualizado");
    refresh();
  };
  $("layer-up").onclick = () => moveLayer(1);
  $("layer-down").onclick = () => moveLayer(-1);
  $("copy-keys").onclick = copySelectedKeys;
  $("paste-keys").onclick = () => pasteKeys();
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
      normalizeLayerOrder();
      selectAnimationTarget("rig");
      selectedPart = project.parts.find((item) => item.id === "torso")?.id || project.parts[0]?.id || "";
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
    if (mode === "calibrador") {
      let chosen = null;
      let distance = Infinity;
      [...project.parts].sort((left, right) => right.z - left.z).forEach((item) => {
        const image = images[item.id];
        const source = layerSourceRect(item, image);
        const width = source.width;
        const height = source.height;
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
    } else if (interaction.type === "joint") {
      const delta = constrainedWorldDelta({
        x: world.x - interaction.start.x,
        y: world.y - interaction.start.y
      }, interaction.axis, interaction.gizmoAngle);
      const target = {
        x: interaction.points.joint.x + delta.x,
        y: interaction.points.joint.y + delta.y
      };
      const solved = solveJointRotation(interaction.points.root, interaction.points.joint, target);
      if (!solved) return status("La articulación no puede rotar desde esa posición");
      const upperFrame = ensureDraftFrame(interaction.chain.upper);
      setDraftFrame(interaction.chain.upper, { ...upperFrame, angle: interaction.upperAngle + solved.angleDelta });
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
      const action = completed.type === "translate" ? "Posición" : completed.type === "ik" ? "Cadena IK" : completed.type === "joint" ? "Articulación" : completed.type === "rotate" ? "Rotación" : "Escala";
      status(`${action} actualizada en borrador; pulsa Guardar fotograma`);
    }
  };
  canvas.onpointercancel = canvas.onpointerup;
  canvas.onpointerleave = () => { if (!interaction) canvas.style.cursor = ""; };
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (tutorialRun) {
      if (event.key === "Escape") { event.preventDefault(); closeTutorial(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); moveTutorial(1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); moveTutorial(-1); }
      return;
    }
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
  normalizeLayerOrder();
  STUDIO_EASES.forEach((ease) => {
    const option = document.createElement("option");
    option.value = ease;
    option.textContent = ease;
    $("key-ease").append(option);
  });
  ensureImages();
  bindPanels();
  bindControls();
  bindCanvas();
  bindKeyboard();
  applyTheme(theme, false);
  applyPreviewVisibility();
  updatePlaybackButtons();
  const timelineResize = new ResizeObserver(() => renderTimeline());
  timelineResize.observe($("timeline-scroll"));
  window.addEventListener("resize", () => {
    draw();
    if (tutorialRun) positionTutorial();
  });
  window.addEventListener("load", () => refreshIcons());
  resetGhostFromProject(0);
  checkpoint();
  const requestedMode = location.hash.slice(1);
  const initialMode = requestedMode === "sprites" ? "calibrador" : requestedMode;
  setMode(["animador", "calibrador", "exportar", "proyecto"].includes(initialMode) ? initialMode : "animador");
}

initialize();
