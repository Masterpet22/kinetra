/**
 * Controlador visual de Kinetra.
 * Une calibración, autoría por fotogramas clave, timeline, historial y exportación.
 */
import { PUPPET_PART_JOINTS as PART_JOINTS } from "../animations/rig.js";
import { animationEase } from "../animations/runtime.js";
import { normalizeKinetraClip, parseKinetraClip, STUDIO_EASES } from "../animations/studio-format.js";
import { sampleKinetraClip } from "../animations/studio-runtime.js";
import { validateKinetraProject } from "../animations/kinetra-runtime.js";
import {
  collapseHierarchicalSelection,
  constrainedTranslation,
  GIZMO_METRICS,
  hitMoveGizmo,
  hitRotateGizmo,
  hitScaleGizmo,
  scaleFromDrag,
  shortestAngleDelta
} from "./gizmo.js";
import { solveJointRotation, solveTwoBoneIk } from "./ik.js";
import { createTemplateProject, PROJECT_TEMPLATES } from "./templates.js";
import {
  attachActiveClip,
  createClip,
  deleteClip,
  duplicateClip,
  migrateAuthoringProject,
  moveClip,
  renameClip,
  selectClip
} from "./project-model.js";
import { createCommandHistory } from "./history.js";
import { createCommandBus } from "./commands.js";
import { createStudioState } from "./state.js";
import {
  createIndexedDbAdapter,
  createPersistenceController,
  readLegacyProject,
  readStorageValue,
  removeStorageValue,
  writeStorageValue
} from "./persistence.js";
import { downloadJson, exportPortableBundle } from "./project-io.js";
import { effectiveLayerRotation } from "./canvas-renderer.js";
import { collectKeyTimes, clampTimelineTime, trimClipToDuration } from "./timeline.js";
import {
  DOCK_ZONES,
  PANEL_DEFAULTS,
  PANEL_DRAG_THRESHOLD,
  PANEL_FLOAT_SIZES,
  PANEL_LABELS,
  PANEL_LAYOUT_VERSION,
  panelLayoutPayload
} from "./panels.js";
import { HELP_TOPICS, TUTORIALS } from "./tutorials.js";

const $ = (id) => document.getElementById(id);
const BASE_SCALE = 0.32;
const STORAGE_KEY = "kinetra:project";
const PANEL_STORAGE_KEY = "kinetra:panels";
const PREVIEW_STORAGE_KEY = "kinetra:preview-visible";
const THEME_STORAGE_KEY = "kinetra:theme";
const preferenceStorage = (() => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
})();
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
  x: "key-x",
  y: "key-y",
  angle: "key-angle",
  alpha: "key-alpha",
  scaleX: "key-scale-x",
  scaleY: "key-scale-y"
};
const MIRROR_TARGETS = Object.freeze({
  rig: "rig",
  torso: "torso",
  neck: "neck",
  shoulderRight: "shoulderLeft",
  shoulderLeft: "shoulderRight",
  elbowRight: "elbowLeft",
  elbowLeft: "elbowRight",
  wristRight: "wristLeft",
  wristLeft: "wristRight",
  hipRight: "hipLeft",
  hipLeft: "hipRight",
  kneeRight: "kneeLeft",
  kneeLeft: "kneeRight",
  ankleRight: "ankleLeft",
  ankleLeft: "ankleRight"
});
const WORKSPACE_LABELS = Object.freeze({
  animador: "Animador",
  calibrador: "Ensamblaje",
  exportar: "Exportación",
  proyecto: "Proyecto"
});

const prettyId = (id) =>
  String(id)
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
const freshProject = () => migrateAuthoringProject({ ...createTemplateProject("male"), layerGroups: [] });

function rigJoints() {
  return Object.fromEntries(
    (project.rig?.bones || []).map((bone) => [bone.id, { x: Number(bone.x) || 0, y: Number(bone.y) || 0 }])
  );
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
function layerGroups() {
  if (!Array.isArray(project.layerGroups)) project.layerGroups = [];
  project.layerGroups = project.layerGroups.filter((group) => group && typeof group.id === "string" && group.id);
  project.layerGroups.forEach((group, index) => {
    group.name = String(group.name || `Grupo ${index + 1}`);
    group.collapsed = Boolean(group.collapsed);
  });
  const validGroupIds = new Set(project.layerGroups.map((group) => group.id));
  project.parts.forEach((item) => {
    if (item.groupId && !validGroupIds.has(item.groupId)) delete item.groupId;
  });
  return project.layerGroups;
}
function label(id) {
  if (id === "rig") return project.rig?.name || LABELS.rig;
  const bone = project.rig?.bones?.find((item) => item.id === id);
  return bone?.name || LABELS[id] || prettyId(id);
}

let project = freshProject();
let mode = "animador";
let lastEditorMode = "animador";
let rightTab = "inspector";
let tool = "select";
let selectedTarget = "rig";
let selectedTargets = new Set(["rig"]);
let selectedPart = "torso";
let selectedParts = new Set(["torso"]);
let selectedKeys = new Set();
let keyClipboard = [];
let hierarchyClipboard = null;
let activeHierarchyKind = null;
let appMenuHoverSwitch = false;
const hierarchyAnchors = { skeleton: null, tracks: null, layers: null };
const hierarchyFocus = { skeleton: null, tracks: null, layers: null };
let duplicateDialogResolve = null;
let duplicateDialogChoice = "cancel";
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
const commandHistory = createCommandHistory();
let persistence = null;
const studioState = createStudioState(project);
const commandBus = createCommandBus({
  getProject: () => project,
  setProject: (next, reason) => {
    project = next;
    studioState.setProject(next, reason);
  },
  history: commandHistory,
  persist: (next, { immediate }) => {
    if (immediate) return persistence?.saveNow(next) || Promise.resolve();
    persistence?.schedule(next);
    return Promise.resolve();
  }
});
function replaceProject(next, reason) {
  project = next;
  studioState.setProject(next, reason);
  return project;
}
let draftTime = null;
let draftFrames = new Map();
let ghostPose = null;
let ghostTime = null;
const initialPanelLayout = loadPanelLayout();
let panelStates = initialPanelLayout.panels;
let dockActive = initialPanelLayout.active;
let layoutSizes = initialPanelLayout.sizes;
let panelDrag = null;
let dividerDrag = null;
let panelZ = 120;
let previewVisible = readStorageValue(preferenceStorage, PREVIEW_STORAGE_KEY) !== "false";
const storedTheme = readStorageValue(preferenceStorage, THEME_STORAGE_KEY);
let theme = ["noche", "grafito", "aurora"].includes(storedTheme) ? storedTheme : "noche";
let tutorialRun = null;

const canvas = $("canvas");
const context = canvas.getContext("2d");
const previewCanvas = $("preview-canvas");
const previewContext = previewCanvas.getContext("2d");
const images = {};

function status(message) {
  $("status").textContent = message;
}

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
    const saved = JSON.parse(readStorageValue(preferenceStorage, PANEL_STORAGE_KEY, "{}"));
    const storedPanels = saved.panels || saved;
    const panels = Object.fromEntries(
      Object.entries(PANEL_DEFAULTS).map(([id, defaults]) => {
        const stored = storedPanels[id] || {};
        const dock =
          DOCK_ZONES.includes(stored.dock) || stored.dock === "floating"
            ? stored.dock
            : stored.floating
              ? "floating"
              : defaults.dock;
        const floatingGeometry =
          saved.layoutVersion === PANEL_LAYOUT_VERSION
            ? Object.fromEntries(
                ["left", "top", "width", "height"]
                  .filter((property) => Number.isFinite(stored[property]))
                  .map((property) => [property, stored[property]])
              )
            : {};
        return [
          id,
          {
            ...defaults,
            visible: stored.visible ?? defaults.visible,
            dock,
            lastDock: DOCK_ZONES.includes(stored.lastDock) ? stored.lastDock : defaults.lastDock,
            ...floatingGeometry
          }
        ];
      })
    );
    const sizes =
      saved.layoutVersion === PANEL_LAYOUT_VERSION
        ? Object.fromEntries(
            ["left", "right", "bottom"]
              .filter((zone) => Number.isFinite(saved.sizes?.[zone]))
              .map((zone) => [zone, saved.sizes[zone]])
          )
        : {};
    return { panels, active: saved.layoutVersion === PANEL_LAYOUT_VERSION ? { ...(saved.active || {}) } : {}, sizes };
  } catch {
    return { panels: structuredClone(PANEL_DEFAULTS), active: {} };
  }
}

function savePanelStates() {
  writeStorageValue(
    preferenceStorage,
    PANEL_STORAGE_KEY,
    JSON.stringify(panelLayoutPayload(panelStates, dockActive, layoutSizes))
  );
}

function visiblePanelsInDock(zone) {
  return Object.keys(panelStates).filter((id) => panelStates[id].visible && panelStates[id].dock === zone);
}

function renderDockTabs(panelId) {
  const host = document.querySelector(`[data-dock-tabs="${panelId}"]`);
  const state = panelStates[panelId];
  const peers = state.dock === "floating" ? [panelId] : visiblePanelsInDock(state.dock);
  host.replaceChildren(
    ...peers.map((id) => {
      const button = document.createElement("button");
      button.className = `dock-tab${id === panelId ? " active" : ""}`;
      button.textContent = PANEL_LABELS[id];
      button.title =
        id === panelId ? `${PANEL_LABELS[id]} · arrastra el asa para mover` : `Mostrar ${PANEL_LABELS[id]}`;
      button.onclick = (event) => {
        event.stopPropagation();
        dockActive[state.dock] = id;
        if (["inspector", "presets", "curves"].includes(id)) rightTab = id;
        applyPanelLayout();
        savePanelStates();
        if (id === "curves") requestAnimationFrame(drawCurve);
      };
      return button;
    })
  );
}

function applyPanelLayout() {
  const shell = document.querySelector(".studio-shell");
  ["left", "right", "bottom"].forEach((zone) => {
    const property = `--${zone}-dock`;
    if (Number.isFinite(layoutSizes[zone])) shell.style.setProperty(property, `${layoutSizes[zone]}px`);
    else shell.style.removeProperty(property);
  });
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
      state.width = Math.max(
        230,
        Math.min(Number.isFinite(state.width) ? state.width : defaults.width, shell.clientWidth - 16)
      );
      state.height = Math.max(
        170,
        Math.min(Number.isFinite(state.height) ? state.height : defaults.height, shell.clientHeight - 16)
      );
      state.left = Math.max(
        8,
        Math.min(Number.isFinite(state.left) ? state.left : 18, shell.clientWidth - state.width - 8)
      );
      state.top = Math.max(
        8,
        Math.min(Number.isFinite(state.top) ? state.top : 18, shell.clientHeight - state.height - 8)
      );
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
    document.querySelectorAll(`[data-panel-toggle="${id}"]`).forEach((toggle) => {
      toggle.checked = state.visible;
    });
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
  status(
    `${PANEL_LABELS[id]} acoplado ${zone === "bottom" ? "abajo" : `a la ${zone === "left" ? "izquierda" : "derecha"}`}`
  );
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
  const currentDockSize = (zone, shell) => {
    const numeric = Number.parseFloat(getComputedStyle(shell).getPropertyValue(`--${zone}-dock`));
    if (Number.isFinite(numeric)) return numeric;
    if (Number.isFinite(layoutSizes[zone])) return layoutSizes[zone];
    if (zone === "bottom")
      return document.querySelector('[data-panel="timeline"]')?.getBoundingClientRect().height || 220;
    return zone === "left" ? 270 : 310;
  };
  const centerMinimum = (width) => Math.min(480, Math.max(180, width * 0.3));
  document.querySelectorAll("[data-layout-divider]").forEach((divider) => {
    const zone = divider.dataset.layoutDivider;
    const resize = (event) => {
      const shell = document.querySelector(".studio-shell");
      const bounds = shell.getBoundingClientRect();
      const minimumCenter = centerMinimum(bounds.width);
      if (zone === "left") {
        const right = currentDockSize("right", shell);
        layoutSizes.left = Math.max(170, Math.min(bounds.width - right - minimumCenter, event.clientX - bounds.left));
      } else if (zone === "right") {
        const left = currentDockSize("left", shell);
        layoutSizes.right = Math.max(200, Math.min(bounds.width - left - minimumCenter, bounds.right - event.clientX));
      } else {
        layoutSizes.bottom = Math.max(150, Math.min(bounds.height - 220, bounds.bottom - event.clientY));
      }
      shell.style.setProperty(`--${zone}-dock`, `${layoutSizes[zone]}px`);
      divider.setAttribute("aria-valuenow", String(Math.round(layoutSizes[zone])));
      requestAnimationFrame(draw);
    };
    divider.onpointerdown = (event) => {
      if (event.button !== 0) return;
      dividerDrag = zone;
      divider.setPointerCapture(event.pointerId);
      resize(event);
      event.preventDefault();
    };
    divider.onpointermove = (event) => {
      if (dividerDrag === zone) resize(event);
    };
    divider.onpointerup = () => {
      if (dividerDrag !== zone) return;
      dividerDrag = null;
      savePanelStates();
    };
    divider.onpointercancel = divider.onpointerup;
    divider.onkeydown = (event) => {
      const direction =
        event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : 0;
      if (!direction) return;
      event.preventDefault();
      const shell = document.querySelector(".studio-shell");
      const property = zone === "bottom" ? "--bottom-dock" : `--${zone}-dock`;
      const current = Number.parseFloat(getComputedStyle(shell).getPropertyValue(property));
      const factor = zone === "right" || zone === "bottom" ? -direction : direction;
      const bounds = shell.getBoundingClientRect();
      const right = currentDockSize("right", shell);
      const left = currentDockSize("left", shell);
      const minimumCenter = centerMinimum(bounds.width);
      const max =
        zone === "bottom"
          ? bounds.height - 220
          : zone === "left"
            ? bounds.width - right - minimumCenter
            : bounds.width - left - minimumCenter;
      layoutSizes[zone] = Math.max(
        zone === "right" ? 200 : zone === "bottom" ? 150 : 170,
        Math.min(max, current + factor * 12)
      );
      shell.style.setProperty(property, `${layoutSizes[zone]}px`);
      divider.setAttribute("aria-valuenow", String(Math.round(layoutSizes[zone])));
      savePanelStates();
      requestAnimationFrame(draw);
    };
  });
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
      panel.style.zIndex = String(++panelZ);
      panelDrag = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        left: panelStates[id].left,
        top: panelStates[id].top,
        drop: null,
        active: panelStates[id].dock === "floating"
      };
      if (panelDrag.active) updateDockOverlay(null);
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    handle.onpointermove = (event) => {
      if (!panelDrag || panelDrag.id !== handle.dataset.panelHandle) return;
      if (!panelDrag.active) {
        const deltaX = event.clientX - panelDrag.startX;
        const deltaY = event.clientY - panelDrag.startY;
        if (Math.hypot(deltaX, deltaY) < PANEL_DRAG_THRESHOLD) return;
        const id = panelDrag.id;
        setPanelFloating(id, true);
        const state = panelStates[id];
        panelDrag = {
          ...panelDrag,
          startX: event.clientX,
          startY: event.clientY,
          left: state.left,
          top: state.top,
          active: true
        };
        updateDockOverlay(null);
      }
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
      panelDrag = null;
      if (!completed.active) {
        updateDockOverlay(null);
        return;
      }
      const panel = document.querySelector(`[data-panel="${completed.id}"]`);
      panelStates[completed.id].width = panel.offsetWidth;
      panelStates[completed.id].height = panel.offsetHeight;
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
    layoutSizes = {};
    rightTab = "inspector";
    applyPanelLayout();
    savePanelStates();
    status("Disposición de paneles restablecida");
  };
  applyPanelLayout();
  document.querySelectorAll("[data-layout-divider]").forEach((divider) => {
    const shell = document.querySelector(".studio-shell");
    divider.setAttribute("aria-valuenow", String(Math.round(currentDockSize(divider.dataset.layoutDivider, shell))));
  });
}
function duration() {
  return project.clip.duration;
}
function fps() {
  return Number(project.fps || 24);
}
function part() {
  return project.parts.find((item) => item.id === selectedPart);
}
function selectedBone() {
  return project.rig?.bones?.find((item) => item.id === selectedTarget) || null;
}
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
function selectionLabel() {
  if (!selectedTargets.size) return "Sin selección";
  return selectedTargets.size > 1 ? `${selectedTargets.size} objetivos` : label(selectedTarget);
}
function selectAnimationTarget(target, append = false) {
  if (!append) selectedTargets = new Set([target]);
  else if (selectedTargets.has(target)) selectedTargets.delete(target);
  else selectedTargets.add(target);
  selectedTarget = selectedTargets.has(target) ? target : [...selectedTargets].at(-1) || "rig";
}
function selectLayer(id, append = false) {
  if (!append) selectedParts = new Set([id]);
  else if (selectedParts.has(id)) selectedParts.delete(id);
  else selectedParts.add(id);
  selectedPart = selectedParts.has(id) ? id : [...selectedParts].at(-1) || project.parts.at(-1)?.id || "";
}
function committedPose(at = time) {
  return sampleKinetraClip(project.clip, at, animationTargets());
}
function frameTransform(frame = {}) {
  return Object.fromEntries(
    Object.keys(TRANSFORM_FIELDS)
      .filter((property) => Object.hasOwn(frame, property))
      .map((property) => [property, frame[property]])
  );
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
function hasDraft() {
  return draftTime !== null && draftFrames.size > 0;
}

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
  const errors = validateKinetraProject(candidate);
  if (errors.length) throw new Error(`Proyecto Kinetra v2 inválido:\n${errors.join("\n")}`);
  if (!candidate.clips.length) throw new Error("El proyecto Kinetra v2 debe incluir al menos un clip");
  const rig = candidate.rig;
  const allowedTargets = ["rig", "torso", ...rig.bones.map((bone) => bone.id)];
  const clips = candidate.clips.map((clip) => parseKinetraClip(JSON.stringify(clip), { allowedTargets }));
  return migrateAuthoringProject({
    version: 4,
    projectId: candidate.name || clips[0].id,
    fps: Number(candidate.fps || 24),
    assets: candidate.assets,
    layerGroups: candidate.layerGroups || [],
    rig,
    parts: candidate.layers.map((item, z) => ({ visible: true, rotation: 0, scaleX: 1, scaleY: 1, z, ...item })),
    clips,
    activeClipId: clips[0].id
  });
}

function updatePersistenceState(detail) {
  const output = $("save-state");
  if (output) {
    output.dataset.state = detail.state;
    output.textContent = detail.message;
  }
  const emergency = $("emergency-export");
  if (emergency) emergency.hidden = !["error", "quota"].includes(detail.state);
}

async function loadInitialProject() {
  try {
    const adapter = await createIndexedDbAdapter();
    persistence = createPersistenceController({ adapter, onState: updatePersistenceState });
    const saved = await persistence.loadLatest();
    if (saved?.project) return attachActiveClip(saved.project);
    const legacy = readLegacyProject(preferenceStorage, STORAGE_KEY);
    if (legacy) {
      await persistence.saveNow(legacy);
      removeStorageValue(preferenceStorage, STORAGE_KEY);
      updatePersistenceState({ state: "migrated", message: "Proyecto local migrado" });
      return legacy;
    }
  } catch (error) {
    console.warn("No se pudo iniciar la persistencia escalable", error);
    updatePersistenceState({ state: "error", message: "Persistencia no disponible" });
  }
  return freshProject();
}

async function saveLocal(message = null) {
  project.clip = normalizeKinetraClip(project.clip);
  try {
    if (!persistence) throw new Error("La persistencia local no está disponible");
    await persistence.saveNow(project);
    if (message) status(message);
  } catch (error) {
    console.warn("No se pudo guardar la copia local", error);
    status(`${error.message}. Usa la exportación de emergencia para no perder cambios.`);
  }
}

function checkpoint() {
  commandHistory.reset(project);
  updateHistoryButtons();
}

function commit(message) {
  commandBus.commit(message);
  if (message) status(message);
  updateHistoryButtons();
}

function restoreHistory(result) {
  if (!result) return false;
  project = result.project;
  normalizeLayerOrder();
  time = Math.min(time, duration());
  clearDraft();
  resetGhostFromProject(time);
  ensureImages();
  refresh();
  updateHistoryButtons();
  return true;
}

function undo() {
  if (hasDraft()) {
    clearDraft();
    selectedKeys.clear();
    refresh();
    status("Cambios sin guardar deshechos");
    return;
  }
  if (!restoreHistory(commandBus.undo())) return status("No hay cambios anteriores");
  status("Cambio deshecho");
}

function redo() {
  if (hasDraft()) return status("Guarda o descarta el borrador antes de rehacer");
  if (!restoreHistory(commandBus.redo())) return status("No hay cambios para rehacer");
  status("Cambio rehecho");
}

function updateHistoryButtons() {
  $("undo").disabled = !hasDraft() && !commandHistory.canUndo();
  $("redo").disabled = !commandHistory.canRedo();
}

function ensureImages() {
  project.parts.forEach((item) => {
    const asset = project.assets?.find((entry) => entry.id === item.assetId);
    const source =
      asset?.src || `./assets/modular/man_sprites/runtime/${encodeURIComponent(item.assetId || item.id)}.png`;
    if (images[item.id]?.dataset.source === source) return;
    const image = new Image();
    image.dataset.assetId = item.assetId;
    image.dataset.source = source;
    image.src = source;
    image.onload = draw;
    image.onerror = () => {
      image.dataset.state = "error";
      status(`No se pudo visualizar la imagen de la capa “${item.name || item.id}”`);
    };
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
    .forEach((item, index) => {
      item.z = index;
    });
}

const multiply = (left, right) => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5]
];
const translate = (x = 0, y = 0) => [1, 0, 0, 1, x, y];
const rotate = (angle = 0) => {
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
};
const scale = (x = 1, y = x) => [x, 0, 0, y, 0, 0];
const point = (matrix, x, y) => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5]
});
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
    memo[id] = multiply(
      multiply(parentMatrix, translate(current.x - from.x, current.y - from.y)),
      transformMatrix(sampled[id])
    );
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
  [...project.parts]
    .sort((left, right) => left.z - right.z)
    .forEach((item) => {
      if (!item.visible || targetHidden(item.id)) return;
      const image = images[item.id];
      if (!image?.complete || !image.naturalWidth) return;
      const source = layerSourceRect(item, image);
      const targetId = partBoneId(item);
      const jointId = targetId !== "rig" && targetId !== "torso" ? targetId : null;
      const matrix =
        jointId && state.joints[jointId]
          ? state.joints[jointId]
          : multiply(state.root, targetId === "torso" ? transformMatrix(state.pose.torso) : [1, 0, 0, 1, 0, 0]);
      const anchor = jointId ? rigJoints()[jointId] || { x: 0, y: 0 } : { x: 0, y: 0 };
      const visibility = Math.max(
        0,
        Math.min(1, 1 + (state.pose.rig?.alpha || 0) + (state.pose[targetId]?.alpha || 0))
      );
      targetContext.save();
      targetContext.globalAlpha *= visibility;
      targetContext.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
      targetContext.translate(item.x - anchor.x, item.y - anchor.y);
      targetContext.rotate((effectiveLayerRotation(item) * Math.PI) / 180);
      targetContext.scale(item.scaleX, item.scaleY);
      targetContext.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        -source.width / 2,
        -source.height / 2,
        source.width,
        source.height
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
    const parentMatrix =
      jointId && state.joints[jointId]
        ? state.joints[jointId]
        : multiply(state.root, targetId === "torso" ? transformMatrix(state.pose.torso) : [1, 0, 0, 1, 0, 0]);
    const anchor = jointId ? rigJoints()[jointId] || { x: 0, y: 0 } : { x: 0, y: 0 };
    const matrix = multiply(
      multiply(
        multiply(parentMatrix, translate(item.x - anchor.x, item.y - anchor.y)),
        rotate(effectiveLayerRotation(item))
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
  for (let x = Math.ceil(left / 50) * 50; x < right; x += 50) {
    context.moveTo(x, top);
    context.lineTo(x, bottom);
  }
  for (let y = Math.ceil(top / 50) * 50; y < bottom; y += 50) {
    context.moveTo(left, y);
    context.lineTo(right, y);
  }
  context.stroke();
  context.strokeStyle = "#325979";
  context.beginPath();
  context.moveTo(0, top);
  context.lineTo(0, bottom);
  context.moveTo(left, 0);
  context.lineTo(right, 0);
  context.stroke();
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
      startPointerAngle: (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI,
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
    [
      [-half, -half],
      [half, -half],
      [-half, half],
      [half, half]
    ].forEach(([x, y]) => {
      context.fillStyle = "#b58cff";
      context.fillRect(x - 4, y - 4, 8, 8);
    });
  } else {
    context.strokeStyle = "#ff6b6b";
    context.fillStyle = "#ff6b6b";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(42, 0);
    context.stroke();
    context.beginPath();
    context.moveTo(42, 0);
    context.lineTo(33, -5);
    context.lineTo(33, 5);
    context.closePath();
    context.fill();
    context.strokeStyle = "#6fe08b";
    context.fillStyle = "#6fe08b";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, 42);
    context.stroke();
    context.beginPath();
    context.moveTo(0, 42);
    context.lineTo(-5, 33);
    context.lineTo(5, 33);
    context.closePath();
    context.fill();
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
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    20,
    width / 2,
    height / 2,
    Math.max(width, height)
  );
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
  $("canvas-status").textContent =
    `Zoom: ${Math.round(zoom * 100)} % · ${label(mode)} · ${Math.round(time)} ms${selection}${pending}`;
  updateGhostLabel();
  drawPreview();
}

function exactKey(target = selectedTarget, at = Math.round(time)) {
  return (project.clip.keys[target] || []).find((frame) => frame.t === at) || null;
}

function appendTreeNode(node, depth, search, host) {
  const visible =
    label(node.id).toLocaleLowerCase().includes(search) ||
    (node.children || []).some((child) => label(child.id).toLocaleLowerCase().includes(search));
  if (!visible) return;
  const row = document.createElement("div");
  row.className = `tree-row${selectedTargets.has(node.id) ? " active" : ""}`;
  row.dataset.hierarchyId = node.id;
  row.style.paddingLeft = `${depth * 17}px`;
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.append(createIcon(node.children?.length ? "git-branch" : "circle"));
  const multi = document.createElement("button");
  multi.className = "tree-multi";
  multi.append(createIcon(selectedTargets.has(node.id) ? "check" : "plus"));
  multi.title = selectedTargets.has(node.id) ? "Quitar de la selección múltiple" : "Añadir a la selección múltiple";
  multi.setAttribute(
    "aria-label",
    `${selectedTargets.has(node.id) ? "Quitar" : "Añadir"} ${label(node.id)} ${selectedTargets.has(node.id) ? "de" : "a"} la selección múltiple`
  );
  multi.setAttribute("aria-pressed", String(selectedTargets.has(node.id)));
  multi.onclick = () => {
    const kind = host.closest("[data-hierarchy-kind]")?.dataset.hierarchyKind || "skeleton";
    hierarchyAnchors[kind] = hierarchyAnchors[kind] || node.id;
    selectHierarchyItem(kind, node.id, { ctrlKey: true, metaKey: false, shiftKey: false });
    status(`${selectionLabel()} seleccionados`);
  };
  const button = document.createElement("button");
  button.className = "tree-select";
  button.textContent = label(node.id);
  button.onclick = (event) => {
    const kind = host.closest("[data-hierarchy-kind]")?.dataset.hierarchyKind || "skeleton";
    selectHierarchyItem(kind, node.id, event);
    status(
      hierarchySelection(kind).length > 1 ? `${selectionLabel()} seleccionados` : `${label(node.id)} seleccionado`
    );
  };
  const toggle = document.createElement("button");
  toggle.className = "tree-toggle";
  toggle.append(createIcon(hiddenTargets.has(node.id) ? "eye-off" : "eye"));
  toggle.title = "Mostrar u ocultar en el lienzo";
  toggle.onclick = () => {
    hiddenTargets.has(node.id) ? hiddenTargets.delete(node.id) : hiddenTargets.add(node.id);
    renderTree();
    draw();
  };
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

function renderLayerRow(item, host) {
  const itemLabel = item.name || label(item.id);
  const row = document.createElement("div");
  row.className = `tree-row${selectedParts.has(item.id) ? " active" : ""}`;
  row.dataset.hierarchyId = item.id;
  if (item.groupId) row.classList.add("tree-layer-in-group");
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.append(createIcon("layers-3"));
  const multi = document.createElement("button");
  multi.className = "tree-multi";
  multi.append(createIcon(selectedParts.has(item.id) ? "check" : "plus"));
  multi.title = selectedParts.has(item.id) ? "Quitar de la selección múltiple" : "Añadir a la selección múltiple";
  multi.setAttribute(
    "aria-label",
    `${selectedParts.has(item.id) ? "Quitar" : "Añadir"} ${itemLabel} ${selectedParts.has(item.id) ? "de" : "a"} la selección múltiple`
  );
  multi.setAttribute("aria-pressed", String(selectedParts.has(item.id)));
  multi.onclick = () => {
    hierarchyAnchors.layers = hierarchyAnchors.layers || item.id;
    selectHierarchyItem("layers", item.id, { ctrlKey: true, metaKey: false, shiftKey: false });
    status(selectedParts.size > 1 ? `${selectedParts.size} capas seleccionadas` : "Selección cancelada");
  };
  const button = document.createElement("button");
  button.className = "tree-select";
  button.textContent = itemLabel;
  button.onclick = (event) => {
    selectHierarchyItem("layers", item.id, event);
  };
  const toggle = document.createElement("button");
  toggle.className = "tree-toggle";
  toggle.append(createIcon(item.visible ? "eye" : "eye-off"));
  toggle.title = item.visible ? "Ocultar capa" : "Mostrar capa";
  toggle.setAttribute("aria-label", toggle.title);
  toggle.onclick = () => {
    item.visible = !item.visible;
    commit("Visibilidad actualizada");
    refresh();
  };
  const lock = document.createElement("button");
  lock.className = "tree-toggle";
  lock.append(createIcon(lockedParts.has(item.id) ? "lock-keyhole" : "lock-keyhole-open"));
  lock.title = lockedParts.has(item.id) ? "Desbloquear edición" : "Bloquear edición";
  lock.setAttribute("aria-label", lock.title);
  lock.onclick = () => {
    lockedParts.has(item.id) ? lockedParts.delete(item.id) : lockedParts.add(item.id);
    refresh();
  };
  const rename = document.createElement("button");
  rename.className = "tree-toggle";
  rename.append(createIcon("pencil"));
  rename.title = `Renombrar ${itemLabel}`;
  rename.setAttribute("aria-label", `Renombrar ${itemLabel}`);
  rename.onclick = () => renameLayer(item);
  row.append(icon, multi, button, toggle, lock, rename);
  host.append(row);
}

function renderLayerGroup(group, items, host, search) {
  const groupMatches = group.name.toLocaleLowerCase().includes(search);
  const matchingItems =
    search && !groupMatches
      ? items.filter((item) => (item.name || label(item.id)).toLocaleLowerCase().includes(search))
      : items;
  if (search && !groupMatches && !matchingItems.length) return;

  const row = document.createElement("div");
  row.className = "tree-row tree-group-row";
  row.dataset.layerGroupId = group.id;
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.append(createIcon("folder"));
  const name = document.createElement("button");
  name.className = "tree-select";
  name.textContent = group.name;
  name.title = `Seleccionar las ${items.length} capas del grupo`;
  name.onclick = () => {
    selectedParts = new Set(items.map((item) => item.id));
    selectedPart = items.at(-1)?.id || "";
    activeHierarchyKind = "layers";
    refresh();
  };
  const allVisible = items.every((item) => item.visible);
  const visibility = document.createElement("button");
  visibility.className = "tree-toggle";
  visibility.append(createIcon(allVisible ? "eye" : "eye-off"));
  visibility.title = allVisible ? "Ocultar grupo" : "Mostrar grupo";
  visibility.setAttribute("aria-label", visibility.title);
  visibility.onclick = () => {
    items.forEach((item) => {
      item.visible = !allVisible;
    });
    commit(allVisible ? "Grupo oculto" : "Grupo mostrado");
    refresh();
  };
  const allLocked = items.every((item) => lockedParts.has(item.id));
  const lock = document.createElement("button");
  lock.className = "tree-toggle";
  lock.append(createIcon(allLocked ? "lock-keyhole" : "lock-keyhole-open"));
  lock.title = allLocked ? "Desbloquear grupo" : "Bloquear grupo";
  lock.setAttribute("aria-label", lock.title);
  lock.onclick = () => {
    items.forEach((item) => {
      if (allLocked) lockedParts.delete(item.id);
      else lockedParts.add(item.id);
    });
    refresh();
    status(allLocked ? "Capas del grupo desbloqueadas" : "Capas del grupo bloqueadas");
  };
  const toggle = document.createElement("button");
  toggle.className = "tree-toggle tree-group-collapse";
  toggle.append(createIcon(group.collapsed && !search ? "chevron-right" : "chevron-down"));
  toggle.title = group.collapsed ? "Expandir grupo" : "Contraer grupo";
  toggle.setAttribute("aria-label", toggle.title);
  toggle.setAttribute("aria-expanded", String(!group.collapsed || Boolean(search)));
  toggle.onclick = () => {
    group.collapsed = !group.collapsed;
    renderTree();
  };
  const rename = document.createElement("button");
  rename.className = "tree-toggle";
  rename.append(createIcon("pencil"));
  rename.title = `Renombrar grupo ${group.name}`;
  rename.setAttribute("aria-label", rename.title);
  rename.onclick = () => renameLayerGroup(group, name);
  const ungroup = document.createElement("button");
  ungroup.className = "tree-toggle";
  ungroup.append(createIcon("folder-minus"));
  ungroup.title = "Desagrupar capas";
  ungroup.setAttribute("aria-label", ungroup.title);
  ungroup.onclick = () => ungroupLayers(group);
  row.append(icon, name, visibility, lock, rename, ungroup, toggle);
  host.append(row);

  if (!group.collapsed || search) matchingItems.forEach((item) => renderLayerRow(item, host));
}

function renderLayers(search, host) {
  const orderedItems = [...project.parts].sort((left, right) => right.z - left.z);
  const groups = layerGroups();
  const groupIds = new Set(groups.map((group) => group.id));
  groups.forEach((group) => {
    const items = orderedItems.filter((item) => item.groupId === group.id);
    if (items.length) renderLayerGroup(group, items, host, search);
  });
  orderedItems
    .filter((item) => !item.groupId || !groupIds.has(item.groupId))
    .forEach((item) => {
      if ((item.name || label(item.id)).toLocaleLowerCase().includes(search)) renderLayerRow(item, host);
    });
}

function uniqueDuplicateName(name, existingNames) {
  const counts = new Map();
  existingNames.forEach((existingName) => counts.set(existingName, (counts.get(existingName) || 0) + 1));
  if (!counts.has(name)) return name;
  let suffix = counts.get(name) + 1;
  let candidate = `${name} ${suffix}`;
  while (counts.has(candidate)) candidate = `${name} ${++suffix}`;
  return candidate;
}

function renameLayer(item) {
  const row = document.querySelector(`[data-hierarchy-kind="layers"] [data-hierarchy-id="${CSS.escape(item.id)}"]`);
  const nameButton = row?.querySelector(".tree-select");
  if (!row || !nameButton || row.querySelector(".tree-rename-input")) return;
  const input = document.createElement("input");
  input.className = "tree-rename-input";
  input.type = "text";
  input.maxLength = 80;
  input.value = item.name || item.id;
  input.setAttribute("aria-label", `Nuevo nombre para ${item.name || item.id}`);
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save) commitLayerName(item, input.value);
    renderTree();
    if (save) refresh();
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };
  input.onblur = () => finish(true);
  nameButton.replaceWith(input);
  input.focus();
  input.select();
}

function commitLayerName(item, requestedName) {
  const name = String(requestedName).trim().slice(0, 80);
  if (!name) return status("El nombre de la capa no puede estar vacío");
  const uniqueName = uniqueDuplicateName(
    name,
    project.parts.filter((candidate) => candidate.id !== item.id).map((candidate) => candidate.name || candidate.id)
  );
  item.name = uniqueName;
  const asset = project.assets?.find((candidate) => candidate.id === item.assetId);
  if (asset) {
    const extension = asset.name.match(/\.[^.]+$/)?.[0] || "";
    asset.name = `${safePngFilename(uniqueName)}${extension}`;
  }
  commit(uniqueName === name ? "Capa renombrada" : `Capa renombrada como ${uniqueName} para evitar duplicados`);
}

function renameLayerGroup(group, nameButton) {
  const input = document.createElement("input");
  input.className = "tree-rename-input";
  input.type = "text";
  input.maxLength = 80;
  input.value = group.name;
  input.setAttribute("aria-label", `Nuevo nombre para el grupo ${group.name}`);
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      const name = input.value.trim().slice(0, 80);
      if (!name) status("El nombre del grupo no puede estar vacío");
      else {
        group.name = uniqueDuplicateName(
          name,
          layerGroups()
            .filter((item) => item.id !== group.id)
            .map((item) => item.name)
        );
        commit("Grupo de capas renombrado");
      }
    }
    renderTree();
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };
  input.onblur = () => finish(true);
  nameButton.replaceWith(input);
  input.focus();
  input.select();
}

function pruneLayerGroups() {
  const nonEmptyGroupIds = new Set(project.parts.map((item) => item.groupId).filter(Boolean));
  project.layerGroups = layerGroups().filter((group) => nonEmptyGroupIds.has(group.id));
}

function createLayerGroup() {
  const ids = hierarchySelection("layers");
  if (ids.length < 2) return status("Selecciona al menos dos capas para agruparlas");
  const usedIds = new Set(layerGroups().map((group) => group.id));
  const groupNumber = layerGroups().length + 1;
  const id = uniqueId(`grupo_${groupNumber}`, usedIds);
  const name = uniqueDuplicateName(
    `Grupo ${groupNumber}`,
    layerGroups().map((group) => group.name)
  );
  const group = { id, name, collapsed: false };
  layerGroups().push(group);
  project.parts.forEach((item) => {
    if (ids.includes(item.id)) item.groupId = id;
  });
  pruneLayerGroups();
  commit(`${ids.length} capas agrupadas en ${name}`);
  refresh();
}

function ungroupLayers(group) {
  project.parts.forEach((item) => {
    if (item.groupId === group.id) delete item.groupId;
  });
  pruneLayerGroups();
  commit(`Grupo ${group.name} deshecho`);
  refresh();
}

function hierarchySelection(kind) {
  if (kind === "layers") return [...selectedParts].filter((id) => project.parts.some((item) => item.id === id));
  const validTargets = new Set(animationTargets());
  return [...selectedTargets].filter((target) => validTargets.has(target));
}

function visibleHierarchyItems(kind) {
  const panel = document.querySelector(`[data-hierarchy-kind="${kind}"]`);
  return [...(panel?.querySelectorAll("[data-hierarchy-tree] .tree-row") || [])].map((row) => row.dataset.hierarchyId);
}

function applyHierarchySelection(kind, ids) {
  if (kind === "layers") {
    selectedParts = new Set(ids);
    if (ids.length) selectedPart = ids.at(-1);
    else selectedPart = project.parts.at(-1)?.id || "";
  } else {
    selectedTargets = new Set(ids);
    selectedTarget = ids.at(-1) || "rig";
    selectedKeys.clear();
  }
}

function selectHierarchyItem(kind, id, event) {
  const order = visibleHierarchyItems(kind);
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  hierarchyFocus[kind] = id;
  if (shift) {
    const anchor = hierarchyAnchors[kind] || hierarchySelection(kind)[0] || id;
    if (!hierarchyAnchors[kind]) hierarchyAnchors[kind] = anchor;
    const start = order.indexOf(anchor);
    const end = order.indexOf(id);
    if (start >= 0 && end >= 0) {
      const range = order.slice(Math.min(start, end), Math.max(start, end) + 1);
      applyHierarchySelection(kind, ctrl ? [...new Set([...hierarchySelection(kind), ...range])] : range);
    } else {
      applyHierarchySelection(kind, ctrl ? [...new Set([...hierarchySelection(kind), id])] : [id]);
    }
  } else if (ctrl) {
    const selected = new Set(hierarchySelection(kind));
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    applyHierarchySelection(kind, [...selected]);
    hierarchyAnchors[kind] = id;
  } else {
    applyHierarchySelection(kind, [id]);
    hierarchyAnchors[kind] = id;
  }
  activeHierarchyKind = kind;
  refresh();
  const panel = document.querySelector(`[data-hierarchy-kind="${kind}"]`);
  panel?.querySelector(`[data-hierarchy-id="${CSS.escape(id)}"] .tree-select`)?.focus({ preventScroll: true });
}

function extendHierarchySelectionByArrow(kind, direction) {
  const order = visibleHierarchyItems(kind);
  if (!order.length) return false;
  const current = hierarchyFocus[kind] || hierarchySelection(kind).at(-1) || order[0];
  const index = order.indexOf(current);
  const next = order[Math.max(0, Math.min(order.length - 1, (index < 0 ? 0 : index) + direction))];
  if (!next) return false;
  selectHierarchyItem(kind, next, { shiftKey: true, ctrlKey: false, metaKey: false });
  return true;
}

function askDuplicateChoice(kind, name) {
  const dialog = $("duplicate-dialog");
  const elementType = kind === "layers" ? "una capa o archivo" : kind === "skeleton" ? "una articulación" : "una pista";
  $("duplicate-copy").textContent = `Ya existe ${elementType} con el nombre “${name}”. ¿Qué deseas hacer?`;
  $("duplicate-apply-all").checked = false;
  duplicateDialogChoice = "cancel";
  dialog.showModal();
  return new Promise((resolve) => {
    duplicateDialogResolve = (choice) =>
      resolve({
        choice,
        applyToAll: $("duplicate-apply-all").checked
      });
  });
}

async function resolveDuplicateNames(kind, incomingNames, existingNames) {
  const reservedNames = new Set(existingNames);
  const counts = new Map();
  existingNames.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  const names = [];
  const choices = [];
  const conflictingNames = new Set();
  const incomingCounts = new Map();
  let applyChoiceToAll = null;

  for (const incomingName of incomingNames) {
    const hasConflict = reservedNames.has(incomingName);
    let choice = "none";
    if (hasConflict) {
      conflictingNames.add(incomingName);
      if (applyChoiceToAll) {
        choice = applyChoiceToAll;
      } else {
        const response = await askDuplicateChoice(kind, incomingName);
        if (response.choice === "cancel") return null;
        choice = response.choice;
        if (response.applyToAll) applyChoiceToAll = choice;
      }
    }

    let resolvedName = incomingName;
    if (choice === "keep") {
      let suffix = (counts.get(incomingName) || 0) + 1;
      resolvedName = `${incomingName} ${suffix}`;
      while (reservedNames.has(resolvedName)) {
        resolvedName = `${incomingName} ${++suffix}`;
      }
      counts.set(incomingName, suffix);
    } else if (choice === "replace") {
      counts.set(incomingName, (incomingCounts.get(incomingName) || 0) + 1);
    } else {
      counts.set(incomingName, (counts.get(incomingName) || 0) + 1);
    }
    names.push(resolvedName);
    choices.push(choice);
    reservedNames.add(resolvedName);
    incomingCounts.set(incomingName, (incomingCounts.get(incomingName) || 0) + 1);
  }
  return { names, choices, conflictingNames: [...conflictingNames] };
}

function removeLayerItems(ids) {
  const removed = project.parts.filter((item) => ids.has(item.id));
  project.parts = project.parts.filter((item) => !ids.has(item.id));
  removed.forEach((item) => {
    delete images[item.id];
    lockedParts.delete(item.id);
  });
  const usedAssetIds = new Set(project.parts.map((item) => item.assetId));
  project.assets = project.assets.filter((asset) => usedAssetIds.has(asset.id));
  pruneLayerGroups();
  normalizeLayerOrder();
}

function updateMultiSelectionMenu(panel, kind) {
  const menu = panel.querySelector("[data-multi-menu]");
  const selection = hierarchySelection(kind);
  menu.hidden = selection.length < 2;
  const items = kind === "layers" ? selection.map((id) => project.parts.find((item) => item.id === id)) : selection;
  const visibilityState =
    kind === "layers" ? items.every((item) => item.visible) : items.every((id) => !hiddenTargets.has(id));
  const lockState =
    kind === "layers" ? items.every((item) => lockedParts.has(item.id)) : items.every((id) => lockedTargets.has(id));
  const visibilityButton = menu.querySelector('[data-selection-action="visibility"]');
  visibilityButton.title = visibilityState ? "Ocultar elementos seleccionados" : "Mostrar elementos seleccionados";
  visibilityButton.setAttribute("aria-label", visibilityButton.title);
  visibilityButton.querySelector("i, svg")?.replaceWith(createIcon(visibilityState ? "eye-off" : "eye"));
  const lockButton = menu.querySelector('[data-selection-action="lock"]');
  lockButton.title = lockState ? "Desbloquear elementos seleccionados" : "Bloquear elementos seleccionados";
  lockButton.setAttribute("aria-label", lockButton.title);
  lockButton.querySelector("i, svg")?.replaceWith(createIcon(lockState ? "lock-keyhole-open" : "lock-keyhole"));
  menu.querySelector('[data-selection-action="paste"]').disabled = hierarchyClipboard?.kind !== kind;
  const groupButton = panel.querySelector("#group-layers");
  if (groupButton) groupButton.disabled = selection.length < 2;
  refreshIcons(menu);
}

function copyHierarchySelection(kind) {
  const ids = hierarchySelection(kind);
  if (!ids.length) return status("Selecciona elementos para copiarlos");
  if (kind === "layers") {
    hierarchyClipboard = {
      kind,
      items: ids.map((id) => {
        const item = project.parts.find((candidate) => candidate.id === id);
        const asset = project.assets.find((candidate) => candidate.id === item.assetId);
        return { item: structuredClone(item), asset: asset ? structuredClone(asset) : null };
      })
    };
  } else if (kind === "skeleton") {
    const bones = project.rig.bones.filter((bone) => ids.includes(bone.id));
    if (!bones.length) return status("La selección no contiene articulaciones copiables");
    hierarchyClipboard = {
      kind,
      items: bones.map((bone) => ({
        bone: structuredClone(bone),
        keys: structuredClone(project.clip.keys[bone.id] || [])
      }))
    };
  } else {
    hierarchyClipboard = {
      kind,
      items: ids.map((target) => ({
        target,
        keys: structuredClone(project.clip.keys[target] || [])
      }))
    };
  }
  renderTree();
  status(`${ids.length} elementos copiados`);
}

async function pasteHierarchySelection(kind) {
  if (hierarchyClipboard?.kind !== kind) return status("No hay elementos compatibles copiados");
  if (hasDraft()) return status("Guarda o descarta el borrador antes de pegar");
  if (kind === "layers") {
    const names = hierarchyClipboard.items.map(({ item }) => item.name || item.id);
    const resolution = await resolveDuplicateNames(
      kind,
      names,
      project.parts.map((item) => item.name || item.id)
    );
    if (!resolution) return status("Pegado cancelado");
    const replaceNames = new Set(names.filter((name, index) => resolution.choices[index] === "replace"));
    if (replaceNames.size) {
      const conflicts = new Set(
        project.parts.filter((item) => replaceNames.has(item.name || item.id)).map((item) => item.id)
      );
      removeLayerItems(conflicts);
    }
    const usedLayers = new Set(project.parts.map((item) => item.id));
    const usedAssets = new Set(project.assets.map((asset) => asset.id));
    const pasted = [];
    hierarchyClipboard.items.forEach(({ item, asset }, index) => {
      const layer = structuredClone(item);
      const base = safeId(`${layer.id}_copia`, "capa_copia");
      layer.id = uniqueId(base, usedLayers);
      usedLayers.add(layer.id);
      layer.name = resolution.names[index];
      layer.z = project.parts.length;
      if (asset) {
        const assetCopy = structuredClone(asset);
        assetCopy.id = uniqueId(`${asset.id}_copia`, usedAssets);
        usedAssets.add(assetCopy.id);
        const extension = assetCopy.name.match(/\.[^.]+$/)?.[0] || ".png";
        assetCopy.name = `${layer.name}${extension}`;
        layer.assetId = assetCopy.id;
        project.assets.push(assetCopy);
      }
      project.parts.push(layer);
      pasted.push(layer.id);
    });
    if (!pasted.length) return status("Los elementos copiados no contienen recursos para pegar");
    selectedParts = new Set(pasted);
    selectedPart = pasted.at(-1);
    ensureImages();
    normalizeLayerOrder();
    commit(`${pasted.length} capa(s) pegadas`);
  } else if (kind === "skeleton") {
    const names = hierarchyClipboard.items.map(({ bone }) => bone.name || bone.id);
    const resolution = await resolveDuplicateNames(
      kind,
      names,
      project.rig.bones.map((bone) => bone.name || bone.id)
    );
    if (!resolution) return status("Pegado cancelado");
    const used = new Set(project.rig.bones.map((bone) => bone.id));
    const idMap = new Map();
    const replacements = new Map();
    const reservedReplacementIds = new Set();
    hierarchyClipboard.items.forEach(({ bone }, index) => {
      const replacement =
        resolution.choices[index] === "replace"
          ? project.rig.bones.find(
              (candidate) =>
                (candidate.name || candidate.id) === names[index] && !reservedReplacementIds.has(candidate.id)
            )
          : null;
      if (replacement) {
        idMap.set(bone.id, replacement.id);
        replacements.set(bone.id, replacement);
        reservedReplacementIds.add(replacement.id);
      } else {
        const id = uniqueId(safeId(resolution.names[index], "hueso"), used);
        idMap.set(bone.id, id);
        used.add(id);
      }
    });
    const pasted = [];
    hierarchyClipboard.items.forEach(({ bone, keys }, index) => {
      const parent =
        idMap.get(bone.parent) ||
        (bone.parent && bone.parent !== "rig" && !project.rig.bones.some((candidate) => candidate.id === bone.parent)
          ? null
          : bone.parent);
      const nextBone = { ...structuredClone(bone), id: idMap.get(bone.id), name: resolution.names[index], parent };
      const existing = replacements.get(bone.id);
      if (existing) Object.assign(existing, nextBone);
      else project.rig.bones.push(nextBone);
      project.clip.keys[nextBone.id] = structuredClone(keys);
      if (project.clip.requires.includes(bone.id) && !project.clip.requires.includes(nextBone.id)) {
        project.clip.requires.push(nextBone.id);
      }
      pasted.push(nextBone.id);
    });
    if (!pasted.length) return status("Los elementos copiados no contienen huesos para pegar");
    project.rig.id = "custom";
    selectedTargets = new Set(pasted);
    selectedTarget = pasted.at(-1);
    commit(`${pasted.length} articulación(es) pegadas`);
  } else {
    const destinations = hierarchySelection("tracks");
    const sources = hierarchyClipboard.items;
    const targets = destinations.length ? destinations : sources.map((source) => source.target);
    const names = targets.map((target) => label(target));
    const resolution = await resolveDuplicateNames(
      kind,
      names,
      animationTargets().map((target) => label(target))
    );
    if (!resolution) return status("Pegado cancelado");
    const pastedTargets = [];
    targets.forEach((target, index) => {
      const source = sources[destinations.length === sources.length ? index : 0];
      let destination = target;
      if (resolution.choices[index] === "keep") {
        const sourceBone = project.rig.bones.find((bone) => bone.id === target);
        const id = uniqueId(safeId(resolution.names[index], "pista"), new Set(animationTargets()));
        project.rig.bones.push({
          ...(sourceBone ? structuredClone(sourceBone) : { parent: null, x: 0, y: 0 }),
          id,
          name: resolution.names[index]
        });
        destination = id;
        pastedTargets.push(id);
      } else {
        pastedTargets.push(destination);
      }
      const frames = project.clip.keys[destination] || (project.clip.keys[destination] = []);
      if (resolution.choices[index] === "replace") frames.splice(0, frames.length);
      source.keys.forEach((frame) => {
        const existing = frames.find((candidate) => candidate.t === frame.t);
        if (existing) Object.assign(existing, structuredClone(frame));
        else frames.push(structuredClone(frame));
      });
      frames.sort((left, right) => left.t - right.t);
    });
    if (resolution.choices.includes("keep")) project.rig.id = "custom";
    selectedTargets = new Set(pastedTargets);
    selectedTarget = pastedTargets.at(-1) || "rig";
    commit(`${pastedTargets.length} pista(s) pegadas`);
  }
  refresh();
}

function setHierarchyVisibility(kind) {
  const ids = hierarchySelection(kind);
  const allVisible =
    kind === "layers"
      ? ids.every((id) => project.parts.find((item) => item.id === id)?.visible)
      : ids.every((id) => !hiddenTargets.has(id));
  if (kind === "layers") {
    project.parts.forEach((item) => {
      if (ids.includes(item.id)) item.visible = !allVisible;
    });
    commit(allVisible ? "Capas ocultas" : "Capas mostradas");
  } else {
    ids.forEach((id) => (allVisible ? hiddenTargets.add(id) : hiddenTargets.delete(id)));
  }
  refresh();
}

function setHierarchyLock(kind) {
  const ids = hierarchySelection(kind);
  const allLocked =
    kind === "layers" ? ids.every((id) => lockedParts.has(id)) : ids.every((id) => lockedTargets.has(id));
  const targetSet = kind === "layers" ? lockedParts : lockedTargets;
  ids.forEach((id) => (allLocked ? targetSet.delete(id) : targetSet.add(id)));
  selectedKeys.clear();
  refresh();
  status(allLocked ? "Elementos desbloqueados" : "Elementos bloqueados");
}

function deleteHierarchySelection(kind) {
  const ids = hierarchySelection(kind);
  if (ids.length < 2) return status("Selecciona al menos dos elementos para eliminarlos");
  if (
    !confirm(
      `¿Eliminar ${ids.length} elementos seleccionados de ${kind === "layers" ? "Capas" : kind === "tracks" ? "Pistas" : "Esqueleto"}?`
    )
  )
    return;
  if (kind === "layers") {
    const removed = project.parts.filter((item) => ids.includes(item.id));
    project.parts = project.parts.filter((item) => !ids.includes(item.id));
    removed.forEach((item) => {
      delete images[item.id];
      lockedParts.delete(item.id);
      if (item.source === "asset" && !project.parts.some((candidate) => candidate.assetId === item.assetId)) {
        project.assets = project.assets.filter((asset) => asset.id !== item.assetId);
      }
    });
    selectedParts = new Set();
    selectedPart = project.parts.at(-1)?.id || "";
    pruneLayerGroups();
    normalizeLayerOrder();
  } else if (kind === "skeleton") {
    const removeIds = new Set(ids.filter((id) => id !== "rig" && id !== "torso"));
    if (!removeIds.size) return status("El rig raíz no se puede eliminar");
    const parentById = rigParents();
    project.rig.bones.forEach((bone) => {
      if (removeIds.has(bone.id) || !removeIds.has(bone.parent)) return;
      let parent = parentById[bone.parent];
      while (parent && removeIds.has(parent)) parent = parentById[parent];
      bone.parent = parent || null;
    });
    project.parts.forEach((item) => {
      const target = partBoneId(item);
      if (!removeIds.has(target)) return;
      let parent = parentById[target];
      while (parent && removeIds.has(parent)) parent = parentById[parent];
      item.boneId = parent || "rig";
    });
    project.rig.bones = project.rig.bones.filter((bone) => !removeIds.has(bone.id));
    removeIds.forEach((id) => {
      delete project.clip.keys[id];
      project.clip.requires = project.clip.requires.filter((target) => target !== id);
      hiddenTargets.delete(id);
      lockedTargets.delete(id);
    });
    selectedTargets = new Set();
    selectedTarget = "rig";
    project.rig.id = "custom";
  } else {
    ids.forEach((target) => {
      delete project.clip.keys[target];
      project.clip.requires = project.clip.requires.filter((required) => required !== target);
      hiddenTargets.delete(target);
      lockedTargets.delete(target);
    });
    selectedTargets = new Set();
    selectedTarget = "rig";
    selectedKeys.clear();
  }
  commit(`${ids.length} elementos eliminados`);
  refresh();
}

function clearHierarchySelection(kind) {
  if (kind === "layers") {
    selectedParts.clear();
    selectedPart = project.parts.at(-1)?.id || "";
  } else {
    selectedTargets.clear();
    selectedTarget = "rig";
    selectedKeys.clear();
  }
  refresh();
  status("Selección cancelada");
}

function keepHierarchySelectionVisible(panel, kind) {
  const selected = hierarchySelection(kind);
  const selectedId = selected.at(-1) || hierarchyFocus[kind] || (kind === "layers" ? selectedPart : null);
  if (!selectedId) return;
  const rows = [...panel.querySelectorAll("[data-hierarchy-tree] .tree-row")];
  let row = rows.find((item) => item.dataset.hierarchyId === selectedId);
  if (!row && kind === "layers") {
    const part = project.parts.find((item) => item.id === selectedId);
    row = rows.find((item) => item.dataset.layerGroupId === part?.groupId);
  }
  const scrollContainer = panel.querySelector(".panel-body");
  if (!row || !scrollContainer) return;
  const rowBounds = row.getBoundingClientRect();
  const containerBounds = scrollContainer.getBoundingClientRect();
  if (rowBounds.top < containerBounds.top) scrollContainer.scrollTop += rowBounds.top - containerBounds.top;
  else if (rowBounds.bottom > containerBounds.bottom)
    scrollContainer.scrollTop += rowBounds.bottom - containerBounds.bottom;
}

function renderTree() {
  document.querySelectorAll("[data-hierarchy-kind]").forEach((panel) => {
    const kind = panel.dataset.hierarchyKind;
    const host = panel.querySelector("[data-hierarchy-tree]");
    const search = panel.querySelector("[data-hierarchy-search]").value.trim().toLocaleLowerCase();
    host.replaceChildren();
    if (kind === "layers") renderLayers(search, host);
    else if (kind === "tracks") {
      animationTargets()
        .filter((target) => (project.clip.keys[target] || []).length || !search)
        .filter((target) => label(target).toLocaleLowerCase().includes(search))
        .forEach((target) => appendTreeNode({ id: target }, 0, search, host));
    } else rigTree().forEach((node) => appendTreeNode(node, 0, search, host));
    const description =
      kind === "layers"
        ? `${project.parts.length} capas reales · ${(project.assets || []).length} recursos importados`
        : `${project.rig?.name || project.rig?.id || "Rig personalizado"} · ${(project.rig?.bones || []).length} huesos · ${Object.keys(project.clip.keys).length} pistas`;
    panel.querySelector("[data-hierarchy-meta]").textContent = description;
    updateMultiSelectionMenu(panel, kind);
    refreshIcons(panel);
    keepHierarchySelectionVisible(panel, kind);
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
      : selectedTargets.size
        ? `Hueso · Objetivo: ${selectedTarget}`
        : "Sin objetivo seleccionado";
  if (calibration) {
    const current = currentPart;
    $("part-name").value = current?.name || "";
    $("part-bone").replaceChildren(
      ...animationTargets()
        .filter((target) => target !== "torso")
        .map((target) => new Option(label(target), target, false, current && partBoneId(current) === target))
    );
    $("part-x").value = current?.x ?? 0;
    $("part-y").value = current?.y ?? 0;
    $("part-rotation").value = current?.rotation ?? 0;
    $("part-scale").value = Math.abs(current?.scaleX ?? 1);
    [
      "part-name",
      "part-bone",
      "part-x",
      "part-y",
      "part-rotation",
      "part-scale",
      "flip-part",
      "layer-up",
      "layer-down",
      "remove-part"
    ].forEach((id) => {
      $(id).disabled = !current || lockedParts.has(current.id);
    });

    const bone = selectedBone();
    $("bone-name").value = bone?.name || project.rig?.name || "Rig";
    $("bone-x").value = bone?.x ?? 0;
    $("bone-y").value = bone?.y ?? 0;
    $("bone-parent").replaceChildren(
      new Option("Rig (raíz)", ""),
      ...(project.rig?.bones || [])
        .filter((candidate) => candidate.id !== bone?.id && !isBoneDescendant(candidate.id, bone?.id))
        .map(
          (candidate) => new Option(candidate.name || candidate.id, candidate.id, false, bone?.parent === candidate.id)
        )
    );
    ["bone-name", "bone-parent", "bone-x", "bone-y", "inspector-delete-bone"].forEach((id) => {
      $(id).disabled = !bone;
    });
    return;
  }
  const sampled = pose()[selectedTarget] || {};
  const key = draftFrame(selectedTarget) || exactKey();
  Object.entries(TRANSFORM_FIELDS).forEach(([property, id]) => {
    $(id).value = Number(key?.[property] ?? sampled[property] ?? 0).toFixed(
      property.startsWith("scale") || property === "alpha" ? 2 : 1
    );
  });
  $("key-ease").value = key?.ease || "Linear";
  [...Object.values(TRANSFORM_FIELDS), "key-ease", "set-key", "delete-key"].forEach((id) => {
    $(id).disabled = lockedTargets.has(selectedTarget);
  });
  ["reset-transform", "mirror-pose"].forEach((id) => {
    $(id).disabled = lockedTargets.has(selectedTarget);
  });
  updateDraftUI();
  const clip = project.clip;
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
    ["Linear", "Lineal"],
    ["Sine.inOut", "Suave"],
    ["Cubic.out", "Impacto"],
    ["Back.out", "Rebote"]
  ];
  presets.forEach(([value, text]) => {
    const button = document.createElement("button");
    button.className = "small-button";
    button.textContent = text;
    button.onclick = () => {
      $("key-ease").value = value;
      showRightTab("curves");
    };
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
    const x = (column / 6) * width;
    curveContext.moveTo(x, 0);
    curveContext.lineTo(x, height);
  }
  for (let row = 0; row <= 4; row += 1) {
    const y = (row / 4) * height;
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
    if (!index) curveContext.moveTo(x, y);
    else curveContext.lineTo(x, y);
  }
  curveContext.stroke();
  $("curve-label").textContent = `${ease} · compartida con el runtime`;
}

function setTime(next, rebuild = false) {
  time = clampTimelineTime(project.clip, next);
  updateTimeDisplays();
  updateDraftUI();
  draw();
  if (rebuild) {
    renderInspector();
    renderTimeline();
  }
}

function updateTimeDisplays() {
  $("scrub").max = duration();
  $("scrub").value = time;
  $("clock").textContent = `${(time / 1000).toFixed(2)} / ${(duration() / 1000).toFixed(2)} s`;
  $("preview-duration").textContent = `${duration()} ms · ${fps()} fps`;
  document.querySelectorAll(".playhead").forEach((cursor) => {
    cursor.style.left = `${(time / duration()) * 100}%`;
  });
}

function selectKey(target, at, append = false) {
  if (!append) selectedKeys.clear();
  const key = `${target}:${at}`;
  if (append && selectedKeys.has(key)) selectedKeys.delete(key);
  else selectedKeys.add(key);
  selectAnimationTarget(target, append);
  time = at;
  setGhostFromCommitted(at);
  refresh();
}

function allKeyTimes() {
  return collectKeyTimes(project.clip);
}

function resetGhostFromProject(preferredTime = time) {
  const times = allKeyTimes();
  if (!times.length) return clearGhost();
  const at = [...times].reverse().find((candidate) => candidate <= preferredTime) ?? times[0];
  setGhostFromCommitted(at);
}

function goToAdjacentKey(direction) {
  const times = allKeyTimes();
  const next = direction < 0 ? [...times].reverse().find((at) => at < time - 0.5) : times.find((at) => at > time + 0.5);
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
  setTime(snapTime(((event.clientX - box.left) / box.width) * duration()), true);
}

function makePlayhead() {
  const cursor = document.createElement("div");
  cursor.className = "playhead";
  cursor.style.left = `${(time / duration()) * 100}%`;
  return cursor;
}

function makeTrackRow(target) {
  const row = document.createElement("div");
  row.className = "track-row";
  const trackLabel = document.createElement("div");
  trackLabel.className = `track-label${selectedTargets.has(target) ? " active" : ""}`;
  const button = document.createElement("button");
  button.textContent = label(target);
  button.onclick = (event) => {
    activeHierarchyKind = "tracks";
    selectAnimationTarget(target, event.shiftKey);
    refresh();
  };
  trackLabel.append(button);
  const line = document.createElement("div");
  line.className = "track-line";
  line.onclick = (event) => timelineLineClick(event, line);
  (project.clip.keys[target] || []).forEach((frame) => {
    const marker = document.createElement("button");
    const identity = `${target}:${frame.t}`;
    const pending = draftTime === frame.t && draftFrames.has(target);
    marker.className = `key-marker${selectedKeys.has(identity) ? " selected" : ""}${lockedTargets.has(target) ? " locked" : ""}${pending ? " draft" : ""}`;
    marker.style.left = `${(frame.t / duration()) * 100}%`;
    marker.title = `${frame.t} ms · ${Object.entries(frame)
      .filter(([field]) => field !== "t" && field !== "ease")
      .map(([field, value]) => `${field}: ${value}`)
      .join(" ")}`;
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
      const delta = ((event.clientX - dragKey.startX) / dragKey.width) * duration();
      const next = snapTime(dragKey.originalTime + delta);
      marker.style.left = `${(next / duration()) * 100}%`;
      marker.dataset.nextTime = String(next);
    };
    marker.onpointerup = () => {
      if (!dragKey || dragKey.marker !== marker) return;
      const next = Number(marker.dataset.nextTime ?? dragKey.originalTime);
      const frames = project.clip.keys[target];
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
    marker.onclick = (event) => {
      event.stopPropagation();
      selectKey(target, frame.t, event.shiftKey);
    };
    line.append(marker);
  });
  if (draftTime !== null && draftFrames.has(target) && !exactKey(target, draftTime)) {
    const marker = document.createElement("span");
    marker.className = "key-marker selected draft";
    marker.style.left = `${(draftTime / duration()) * 100}%`;
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
  project.clip.spriteEvents.forEach((event, index) => {
    const marker = document.createElement("button");
    marker.className = "event-marker";
    marker.style.left = `${(event.t / duration()) * 100}%`;
    marker.textContent = `${event.slot}: ${event.variant}`;
    marker.title = "Clic derecho para eliminar";
    marker.onclick = () => setTime(event.t, true);
    marker.oncontextmenu = (mouseEvent) => {
      mouseEvent.preventDefault();
      project.clip.spriteEvents.splice(index, 1);
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
    image.style.left = `${(index / count) * 100}%`;
    line.append(image);
  }
  line.append(makePlayhead());
  row.append(trackLabel, line);
  return row;
}

function renderRuler() {
  const ruler = $("ruler");
  ruler.replaceChildren();
  const frameCount = Math.max(1, Math.round((duration() / 1000) * fps()));
  const every = Math.max(1, Math.ceil(frameCount / 16));
  for (let frame = 0; frame <= frameCount; frame += every) {
    const tick = document.createElement("span");
    tick.className = "ruler-tick";
    tick.style.left = `${(frame / frameCount) * 100}%`;
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

function safeId(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo convertir una capa PSD a PNG"));
    }, "image/png");
  });
}

function safePngFilename(value) {
  const filename = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "");
  return filename || "capa";
}

function isPsdFile(file) {
  return /\.psd$/i.test(file.name) || /^image\/(?:vnd\.adobe\.photoshop|psd)$/i.test(file.type);
}

function cropCanvasToVisiblePixels(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  const cropped = document.createElement("canvas");
  cropped.width = right - left + 1;
  cropped.height = bottom - top + 1;
  cropped
    .getContext("2d")
    .drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return { canvas: cropped, left, top };
}

async function extractPsdLayers(file, usedFilenames) {
  const parser = await import("https://esm.sh/ag-psd@27.0.0?bundle");
  const psd = parser.readPsd(await file.arrayBuffer());
  const layers = [];
  const visit = (children, parentVisible = true) => {
    (children || []).forEach((layer) => {
      const visible = parentVisible && !layer.hidden;
      if (layer.children?.length) {
        visit(layer.children, visible);
      } else if (layer.canvas) {
        layers.push({ layer, visible });
      }
    });
  };
  visit(psd.children);
  if (!layers.length) throw new Error(`${file.name} no contiene capas con imagen`);

  const outputLayers = [];
  let expandedSize = 0;
  let transparentLayers = 0;
  let hiddenLayersRevealed = 0;
  for (const { layer, visible } of layers) {
    const bounds = cropCanvasToVisiblePixels(layer.canvas);
    if (!bounds) {
      transparentLayers += 1;
      continue;
    }
    const layerName = String(layer.name || "capa").replace(/\s/g, "_");
    const layerBase = safePngFilename(layerName);
    let filename = `${layerBase}.png`;
    let suffix = 2;
    while (usedFilenames.has(filename.toLowerCase())) filename = `${layerBase}_${suffix++}.png`;
    usedFilenames.add(filename.toLowerCase());
    const blob = await canvasToPngBlob(bounds.canvas);
    expandedSize += blob.size;
    if (expandedSize > 24 * 1024 * 1024) {
      throw new Error(`${file.name} genera más de 24 MB en PNG; reduce el tamaño del documento`);
    }
    if (!visible) hiddenLayersRevealed += 1;
    outputLayers.push({
      name: layerName,
      filename,
      blob,
      visible: true,
      x: (Number(layer.left) || 0) + bounds.left + bounds.canvas.width / 2 - psd.width / 2,
      y: (Number(layer.top) || 0) + bounds.top + bounds.canvas.height / 2 - psd.height / 2
    });
  }
  return { layers: outputLayers, transparentLayers, hiddenLayersRevealed };
}

async function importImageLayers(files) {
  const accepted = [...files].filter((file) => /^image\/(png|webp|jpeg)$/.test(file.type) || isPsdFile(file));
  if (!accepted.length) return status("Selecciona imágenes PNG, WebP, JPEG o documentos PSD");
  const total = accepted.reduce((sum, file) => sum + file.size, 0);
  if (total > 24 * 1024 * 1024) return status("Los archivos superan 24 MB; reduce su tamaño antes de importarlos");
  const anchorId = selectedTarget !== "torso" && animationTargets().includes(selectedTarget) ? selectedTarget : "rig";
  const anchor = anchorId === "rig" ? { x: 0, y: 0 } : rigJoints()[anchorId] || { x: 0, y: 0 };
  const importedLayers = [];
  const usedFilenames = new Set();
  let transparentLayers = 0;
  let hiddenLayersRevealed = 0;
  let expandedSize = 0;
  for (const file of accepted) {
    if (isPsdFile(file)) {
      const extracted = await extractPsdLayers(file, usedFilenames);
      transparentLayers += extracted.transparentLayers;
      hiddenLayersRevealed += extracted.hiddenLayersRevealed;
      for (const layer of extracted.layers) {
        expandedSize += layer.blob.size;
        importedLayers.push({
          name: layer.name,
          filename: layer.filename,
          type: "image/png",
          size: layer.blob.size,
          src: await readFileAsDataUrl(layer.blob),
          visible: layer.visible,
          x: anchor.x + layer.x,
          y: anchor.y + layer.y
        });
      }
    } else {
      importedLayers.push({
        name: file.name.replace(/\.[^.]+$/, ""),
        filename: file.name,
        type: file.type,
        size: file.size,
        src: await readFileAsDataUrl(file),
        visible: true,
        x: anchor.x,
        y: anchor.y
      });
      expandedSize += file.size;
    }
    if (expandedSize > 24 * 1024 * 1024) {
      throw new Error("Los recursos importados superan 24 MB; reduce el tamaño antes de importarlos");
    }
  }
  const resolution = await resolveDuplicateNames(
    "layers",
    importedLayers.map((item) => item.name),
    project.parts.map((item) => item.name || item.id)
  );
  if (!resolution) return status("Importación cancelada");
  const replaceNames = new Set(
    importedLayers.map((item, index) => (resolution.choices[index] === "replace" ? item.name : null)).filter(Boolean)
  );
  if (replaceNames.size) {
    const conflicts = new Set(
      project.parts.filter((item) => replaceNames.has(item.name || item.id)).map((item) => item.id)
    );
    removeLayerItems(conflicts);
  }
  const usedAssets = new Set((project.assets || []).map((asset) => asset.id));
  const usedLayers = new Set(project.parts.map((item) => item.id));
  importedLayers.forEach((item, index) => {
    item.name = resolution.names[index];
    const extension = item.filename.match(/\.[^.]+$/)?.[0] || (item.type === "image/png" ? ".png" : "");
    item.filename = `${safePngFilename(item.name)}${extension}`;
  });
  let lastLayer = null;
  for (const imported of importedLayers) {
    const base = safeId(imported.name, "capa");
    const assetId = uniqueId(`asset_${base}`, usedAssets);
    usedAssets.add(assetId);
    const layerId = uniqueId(base, usedLayers);
    usedLayers.add(layerId);
    project.assets.push({
      id: assetId,
      name: imported.filename,
      type: imported.type,
      size: imported.size,
      src: imported.src
    });
    lastLayer = {
      id: layerId,
      name: imported.name,
      assetId,
      source: "asset",
      boneId: anchorId,
      x: imported.x,
      y: imported.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      visible: imported.visible,
      z: project.parts.length
    };
    project.parts.push(lastLayer);
  }
  if (!lastLayer) {
    return status(
      transparentLayers
        ? `El PSD solo contiene capas totalmente transparentes (${transparentLayers}); no se importó ninguna`
        : "No hay imágenes visibles para importar"
    );
  }
  normalizeLayerOrder();
  selectedPart = lastLayer.id;
  selectedParts = new Set([lastLayer.id]);
  ensureImages();
  commit(`${importedLayers.length} imagen(es) importadas como capas reales`);
  const psdNotices = [];
  if (transparentLayers) psdNotices.push(`se omitieron ${transparentLayers} capa(s) totalmente transparentes`);
  if (hiddenLayersRevealed) psdNotices.push(`se mostraron ${hiddenLayersRevealed} capa(s) ocultas en el PSD`);
  if (psdNotices.length) status(`Importación completada: ${psdNotices.join("; ")}`);
  setMode("calibrador");
  showRightTab("layers");
}

function removeSelectedLayer() {
  const current = part();
  if (!current) return;
  if (!confirm(`¿Eliminar la capa “${current.name || current.id}”?`)) return;
  project.parts = project.parts.filter((item) => item.id !== current.id);
  pruneLayerGroups();
  normalizeLayerOrder();
  delete images[current.id];
  if (current.source === "asset" && !project.parts.some((item) => item.assetId === current.assetId)) {
    project.assets = project.assets.filter((asset) => asset.id !== current.assetId);
  }
  lockedParts.delete(current.id);
  selectedPart = project.parts.at(-1)?.id || "";
  selectedParts = selectedPart ? new Set([selectedPart]) : new Set();
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
    x: parentBone?.x || 0,
    y: (parentBone?.y || 0) + 140
  });
  project.rig.id = "custom";
  project.rig.name = project.rig.name === "Humanoide" ? "Rig personalizado" : project.rig.name;
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
  delete project.clip.keys[bone.id];
  project.clip.requires = project.clip.requires.filter((target) => target !== bone.id);
  hiddenTargets.delete(bone.id);
  lockedTargets.delete(bone.id);
  selectAnimationTarget(bone.parent || "rig");
  commit("Hueso eliminado y dependencias reasignadas");
  refresh();
}

function loadTemplateImage(asset) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve([asset.id, image]);
    image.onerror = () => reject(new Error(`No se pudo cargar ${asset.name}`));
    image.src = asset.src;
  });
}

async function drawTemplatePreview(canvas, templateId) {
  const template = createTemplateProject(templateId);
  const images = new Map(await Promise.all(template.assets.map(loadTemplateImage)));
  const drawable = template.parts
    .map((item) => {
      const image = images.get(item.assetId);
      if (!image) return null;
      const source = item.crop || { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
      const width = source.width * (item.scaleX ?? 1);
      const height = source.height * (item.scaleY ?? 1);
      return { item, image, source, width, height };
    })
    .filter(Boolean);
  if (!drawable.length || !canvas.isConnected) return;

  const bounds = drawable.reduce(
    (result, entry) => ({
      left: Math.min(result.left, entry.item.x - entry.width / 2),
      top: Math.min(result.top, entry.item.y - entry.height / 2),
      right: Math.max(result.right, entry.item.x + entry.width / 2),
      bottom: Math.max(result.bottom, entry.item.y + entry.height / 2)
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );
  const width = 420;
  const height = 260;
  const padding = 18;
  const scale = Math.min(
    (width - padding * 2) / Math.max(1, bounds.right - bounds.left),
    (height - padding * 2) / Math.max(1, bounds.bottom - bounds.top)
  );
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = false;
  context.translate(
    width / 2 - ((bounds.left + bounds.right) / 2) * scale,
    height / 2 - ((bounds.top + bounds.bottom) / 2) * scale
  );
  context.scale(scale, scale);
  drawable
    .sort((left, right) => left.item.z - right.item.z)
    .forEach(({ item, image, source, width: drawWidth, height: drawHeight }) => {
      context.save();
      context.translate(item.x, item.y);
      context.rotate((effectiveLayerRotation(item) * Math.PI) / 180);
      context.globalAlpha = item.opacity ?? 1;
      context.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      context.restore();
    });
}

function renderTemplateChooser() {
  const host = $("template-grid");
  host.replaceChildren();
  PROJECT_TEMPLATES.forEach((template) => {
    const button = document.createElement("button");
    button.className = "template-card";
    button.dataset.projectTemplate = template.id;
    const preview = document.createElement("span");
    preview.className = `template-preview${template.id === "blank" ? " blank" : ""}`;
    if (template.id === "blank") {
      preview.innerHTML = '<i data-lucide="file-plus-2"></i>';
    } else {
      const canvas = document.createElement("canvas");
      canvas.className = "template-preview-canvas";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Vista previa de ${template.name.toLowerCase()}`);
      preview.append(canvas);
      drawTemplatePreview(canvas, template.id).catch(() => preview.classList.add("failed"));
    }
    const name = document.createElement("strong");
    name.textContent = template.name;
    const description = document.createElement("small");
    description.textContent = template.description;
    button.append(preview, name, description);
    host.append(button);
  });
}

function createNewProject() {
  closeApplicationMenus();
  $("new-project-dialog").showModal();
  refreshIcons($("new-project-dialog"));
}

function createProjectFromTemplate(templateId) {
  pause();
  replaceProject(migrateAuthoringProject({ ...createTemplateProject(templateId), layerGroups: [] }), "new-project");
  normalizeLayerOrder();
  selectAnimationTarget("rig");
  selectedPart = project.parts.find((item) => partBoneId(item) === "rig")?.id || project.parts[0]?.id || "";
  selectedParts = selectedPart ? new Set([selectedPart]) : new Set();
  selectedKeys.clear();
  hiddenTargets.clear();
  lockedTargets.clear();
  lockedParts.clear();
  time = 0;
  clearDraft();
  clearGhost();
  ensureImages();
  $("new-project-dialog").close();
  const templateName =
    PROJECT_TEMPLATES.find((item) => item.id === templateId)?.name.toLowerCase() || "humano masculino";
  commit(`Plantilla ${templateName} creada`);
  setMode("calibrador");
}

function applyPreviewVisibility() {
  document.querySelector(".preview-card").hidden = !previewVisible;
  $("preview-toggle").checked = previewVisible;
  writeStorageValue(preferenceStorage, PREVIEW_STORAGE_KEY, String(previewVisible));
  if (previewVisible) requestAnimationFrame(drawPreview);
}

function applyTheme(next, persist = true) {
  theme = ["noche", "grafito", "aurora"].includes(next) ? next : "noche";
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-choice]").forEach((input) => {
    input.checked = input.value === theme;
  });
  if (persist) writeStorageValue(preferenceStorage, THEME_STORAGE_KEY, theme);
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

function tutorialTargets(step) {
  return (step.targets || [step.target])
    .map((selector) => document.querySelector(selector))
    .filter((target) => target && target.getClientRects().length);
}

function visibleTutorialRect(target) {
  const bounds = target.getBoundingClientRect();
  const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const dockedPanel = target.closest("[data-dock-zone]");
  if (["left", "right"].includes(dockedPanel?.dataset.dockZone)) {
    const timeline = document.querySelector("[data-dock-zone='bottom']");
    if (timeline) clip.bottom = Math.min(clip.bottom, timeline.getBoundingClientRect().top);
  }
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    const client = {
      left: bounds.left + parent.clientLeft,
      top: bounds.top + parent.clientTop,
      right: bounds.left + parent.clientLeft + parent.clientWidth,
      bottom: bounds.top + parent.clientTop + parent.clientHeight
    };
    if (["auto", "scroll", "hidden", "clip", "overlay"].includes(style.overflowX)) {
      clip.left = Math.max(clip.left, client.left);
      clip.right = Math.min(clip.right, client.right);
    }
    if (["auto", "scroll", "hidden", "clip", "overlay"].includes(style.overflowY)) {
      clip.top = Math.max(clip.top, client.top);
      clip.bottom = Math.min(clip.bottom, client.bottom);
    }
  }
  const rect = {
    left: Math.max(bounds.left, clip.left),
    top: Math.max(bounds.top, clip.top),
    right: Math.min(bounds.right, clip.right),
    bottom: Math.min(bounds.bottom, clip.bottom)
  };
  return rect.left < rect.right && rect.top < rect.bottom ? { rect, clip } : null;
}

function subtractSpotlight(rectangles, hole) {
  const next = [];
  rectangles.forEach((rect) => {
    const left = Math.max(rect.left, hole.left);
    const top = Math.max(rect.top, hole.top);
    const right = Math.min(rect.right, hole.right);
    const bottom = Math.min(rect.bottom, hole.bottom);
    if (left >= right || top >= bottom) {
      next.push(rect);
      return;
    }
    if (rect.top < top) next.push({ left: rect.left, top: rect.top, right: rect.right, bottom: top });
    if (bottom < rect.bottom) next.push({ left: rect.left, top: bottom, right: rect.right, bottom: rect.bottom });
    if (rect.left < left) next.push({ left: rect.left, top, right: left, bottom });
    if (right < rect.right) next.push({ left: right, top, right: rect.right, bottom });
  });
  return next;
}

function positionTutorial() {
  const step = currentTutorialStep();
  if (!step) return;
  const targets = tutorialTargets(step);
  const targetRects = (targets.length ? targets : [$("workspace-menu")]).map(visibleTutorialRect).filter(Boolean);
  if (!targetRects.length) return;
  const padding = 7;
  const holes = targetRects
    .map(({ rect, clip }) => ({
      left: Math.max(3, clip.left, rect.left - padding),
      top: Math.max(3, clip.top, rect.top - padding),
      right: Math.min(innerWidth - 3, clip.right, rect.right + padding),
      bottom: Math.min(innerHeight - 3, clip.bottom, rect.bottom + padding)
    }))
    .filter((rect) => rect.left < rect.right && rect.top < rect.bottom);

  const dimmers = $("tutorial-dimmers");
  const spotlights = $("tutorial-spotlights");
  let shaded = [{ left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
  holes.forEach((hole) => {
    shaded = subtractSpotlight(shaded, hole);
  });
  dimmers.replaceChildren(
    ...shaded.map((rect) => {
      const element = document.createElement("div");
      element.className = "tutorial-dimmer";
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.width = `${rect.right - rect.left}px`;
      element.style.height = `${rect.bottom - rect.top}px`;
      return element;
    })
  );
  spotlights.replaceChildren(
    ...holes.map((rect) => {
      const element = document.createElement("div");
      element.className = "tutorial-spotlight";
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.width = `${rect.right - rect.left}px`;
      element.style.height = `${rect.bottom - rect.top}px`;
      return element;
    })
  );

  const anchor = targetRects[0].rect;

  const card = $("tutorial-card");
  const cardRect = card.getBoundingClientRect();
  const gap = 16;
  const maxLeft = Math.max(12, innerWidth - cardRect.width - 12);
  const maxTop = Math.max(12, innerHeight - cardRect.height - 12);
  const clamp = (value, max) => Math.min(Math.max(12, value), max);
  const intersectsHole = (left, top) =>
    holes.some(
      (hole) =>
        left < hole.right && left + cardRect.width > hole.left && top < hole.bottom && top + cardRect.height > hole.top
    );
  let position;
  if (holes.length > 1) {
    const centered = {
      left: clamp((innerWidth - cardRect.width) / 2, maxLeft),
      top: clamp((innerHeight - cardRect.height) / 2, maxTop)
    };
    if (!intersectsHole(centered.left, centered.top)) position = centered;
  }
  if (!position) {
    const candidates = [
      { left: anchor.left, top: anchor.bottom + gap },
      { left: anchor.left, top: anchor.top - cardRect.height - gap },
      { left: anchor.right + gap, top: anchor.top },
      { left: anchor.left - cardRect.width - gap, top: anchor.top }
    ].map(({ left, top }) => ({ left: clamp(left, maxLeft), top: clamp(top, maxTop) }));
    position = candidates.find(({ left, top }) => !intersectsHole(left, top)) || candidates[0];
  }
  card.style.left = `${position.left}px`;
  card.style.top = `${position.top}px`;
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
    tutorialTargets(step).forEach((target) => target.scrollIntoView({ block: "nearest", inline: "nearest" }));
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
    overlay.innerHTML = `<h2>Exportar</h2><p class="muted">Kinetra v2 exporta el rig, las capas, las imágenes y todos los clips en un paquete autocontenido.</p><div class="summary-grid"><div class="summary-card"><strong>Paquete Kinetra v2</strong><span>${project.rig.bones.length} huesos · ${project.parts.length} capas · ${project.assets.length} recursos · ${project.clips.length} clips</span><div class="button-row"><button id="download-project" class="small-button primary">Exportar .kinetra.json</button></div></div></div><div class="export-actions"><button id="cancel-export" class="small-button">Cancelar</button></div>`;
    $("download-project").onclick = exportProject;
    $("cancel-export").onclick = () => setMode(lastEditorMode);
  } else {
    overlay.innerHTML = `<h2>Proyecto</h2><div class="summary-grid"><div class="summary-card"><strong>${project.clip.label}</strong><span>ID activo: ${project.clip.id}<br>Rig: ${project.rig.name}<br>${project.rig.bones.length} huesos · ${project.parts.length} capas · ${project.clips.length} clips<br>Estado: ${project.clip.status}</span></div><div class="summary-card"><strong>Kinetra v2</strong><span>Los recursos importados, la jerarquía y todas las animaciones viajan juntos en la exportación para web.</span></div></div><div class="button-row"><button id="new-project" class="small-button danger">Crear proyecto nuevo</button></div>`;
    $("new-project").onclick = createNewProject;
  }
}

function renderClipSelectors() {
  const options = project.clips.map(
    (clip) => new Option(clip.label || clip.id, clip.id, false, clip.id === project.activeClipId)
  );
  $("clip-select").replaceChildren(...options);
  $("preview-clip-select").replaceChildren(
    ...project.clips.map((clip) => new Option(clip.label || clip.id, clip.id, false, clip.id === project.activeClipId))
  );
  const index = project.clips.findIndex((clip) => clip.id === project.activeClipId);
  $("clip-delete").disabled = project.clips.length <= 1;
  $("clip-up").disabled = index <= 0;
  $("clip-down").disabled = index < 0 || index >= project.clips.length - 1;
}

function activateClip(clipId) {
  if (clipId === project.activeClipId) return;
  pause();
  selectClip(project, clipId);
  time = 0;
  selectedKeys.clear();
  clearDraft();
  resetGhostFromProject(0);
  persistence?.schedule(project);
  refresh();
  status(`Clip “${project.clip.label}” activo`);
}

function refresh() {
  project.clip = normalizeKinetraClip(project.clip);
  $("project-name").value = project.clip.id;
  $("duration").value = duration();
  $("loop").checked = project.clip.loop;
  $("fps").value = String(fps());
  renderClipSelectors();
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
  if (mode !== "exportar" && mode !== "proyecto" && ["animador", "calibrador"].includes(mode)) lastEditorMode = mode;
  mode = next;
  document
    .querySelectorAll("[data-mode]")
    .forEach((button) => button.classList.toggle("active", button.dataset.mode === next));
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
  document
    .querySelectorAll("[data-tool]")
    .forEach((button) => button.classList.toggle("active", button.dataset.tool === next));
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
  const keys = project.clip.keys;
  const frames = keys[target] || [];
  const existing = frames.find((item) => item.t === frame.t);
  if (existing) Object.assign(existing, frame);
  else frames.push(frame);
  frames.sort((left, right) => left.t - right.t);
  keys[target] = frames;
  if (!project.clip.requires.includes(target)) project.clip.requires.push(target);
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
    t: Math.round(time),
    x: 0,
    y: 0,
    angle: 0,
    alpha: 0,
    scaleX: 0,
    scaleY: 0
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
  const active = new Set([...Object.keys(project.clip.keys), ...draftFrames.keys()]);
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
  const source = animationTargets()
    .map((target) => [target, exactKey(target, at)])
    .filter(([, frame]) => frame);
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
    const remaining = (project.clip.keys[target] || []).filter((frame) => frame.t !== at);
    if (remaining.length) project.clip.keys[target] = remaining;
    else {
      delete project.clip.keys[target];
      project.clip.requires = project.clip.requires.filter((item) => item !== target);
    }
  });
  selectedKeys.clear();
  clearDraft();
  commit("Fotogramas eliminados");
  refresh();
}

function copySelectedKeys() {
  const selected = [...selectedKeys]
    .map((identity) => {
      const separator = identity.lastIndexOf(":");
      const target = identity.slice(0, separator);
      const at = Number(identity.slice(separator + 1));
      const frame = (project.clip.keys[target] || []).find((item) => item.t === at);
      return frame ? { target, frame: structuredClone(frame) } : null;
    })
    .filter(Boolean);
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

async function exportProject() {
  project.clip = normalizeKinetraClip(project.clip);
  try {
    status("Preparando paquete portable…");
    const bundle = await exportPortableBundle(project);
    const name = `${(project.projectId || project.clip.id).replace(/[^a-z0-9_-]/gi, "_")}.kinetra.json`;
    downloadJson(name, bundle);
    status(`Proyecto Kinetra v2 exportado con ${project.clips.length} clips`);
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
    if (project.clip.loop) time %= duration();
    else {
      time = duration();
      pause();
    }
  }
  updateTimeDisplays();
  draw();
  if (playing) animationFrame = requestAnimationFrame(tick);
}

function bindControls() {
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.target.closest("[data-hierarchy-kind]")) activeHierarchyKind = null;
    },
    true
  );
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => {
      setMode(button.dataset.mode);
      closeApplicationMenus();
    };
  });
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.onclick = () => setTool(button.dataset.tool);
  });
  document.querySelectorAll("[data-hierarchy-search]").forEach((input) => {
    input.oninput = renderTree;
  });
  document.querySelectorAll("[data-hierarchy-kind]").forEach((panel) => {
    const kind = panel.dataset.hierarchyKind;
    panel.addEventListener("pointerdown", () => {
      activeHierarchyKind = kind;
    });
    panel.querySelectorAll("[data-selection-action]").forEach((button) => {
      button.onclick = () => {
        activeHierarchyKind = kind;
        const action = button.dataset.selectionAction;
        if (action === "visibility") setHierarchyVisibility(kind);
        else if (action === "lock") setHierarchyLock(kind);
        else if (action === "copy") copyHierarchySelection(kind);
        else if (action === "paste") pasteHierarchySelection(kind);
        else if (action === "delete") deleteHierarchySelection(kind);
        else if (action === "clear") clearHierarchySelection(kind);
      };
    });
  });
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
    save: () =>
      saveLocal(
        hasDraft()
          ? "Proyecto guardado; el borrador del fotograma sigue pendiente"
          : "Proyecto guardado en este navegador"
      ),
    "export-project": exportProject,
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
    const menuBar = menu.closest(".app-menu-bar");
    menu.addEventListener("toggle", () => {
      if (menu.open) {
        if (menuBar) appMenuHoverSwitch = true;
        document.querySelectorAll(".app-menu[open]").forEach((other) => {
          if (other !== menu) other.removeAttribute("open");
        });
      } else if (menuBar && !menuBar.querySelector(".app-menu[open]")) {
        appMenuHoverSwitch = false;
      }
    });
    if (menuBar) {
      menu.addEventListener("pointerenter", () => {
        if (!appMenuHoverSwitch) return;
        document.querySelectorAll(".app-menu[open]").forEach((other) => {
          if (other !== menu) other.removeAttribute("open");
        });
        menu.open = true;
      });
    }
    menu.addEventListener("pointerleave", (event) => {
      if (event.relatedTarget instanceof Node && menu.contains(event.relatedTarget)) return;
      menu.removeAttribute("open");
      if (menuBar && !(event.relatedTarget instanceof Node && menuBar.contains(event.relatedTarget))) {
        appMenuHoverSwitch = false;
      }
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".app-menu")) closeApplicationMenus();
  });
  document.querySelectorAll("[data-tutorial]").forEach((button) => {
    button.onclick = () => startTutorial(button.dataset.tutorial);
  });
  $("help-dialog-close").onclick = () => $("help-dialog").close();
  $("help-dialog").onclick = (event) => {
    if (event.target === $("help-dialog")) $("help-dialog").close();
  };
  document.querySelectorAll("[data-duplicate-choice]").forEach((button) => {
    button.onclick = () => {
      duplicateDialogChoice = button.dataset.duplicateChoice;
      $("duplicate-dialog").close();
    };
  });
  $("duplicate-dialog").addEventListener("close", () => {
    const resolve = duplicateDialogResolve;
    duplicateDialogResolve = null;
    resolve?.(duplicateDialogChoice);
  });
  $("new-project-close").onclick = () => $("new-project-dialog").close();
  $("new-project-dialog").onclick = (event) => {
    if (event.target === $("new-project-dialog")) $("new-project-dialog").close();
  };
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
    saveLocal(
      hasDraft()
        ? "Proyecto guardado; el borrador del fotograma sigue pendiente"
        : "Proyecto guardado en este navegador"
    );
  };
  $("emergency-export").onclick = exportProject;
  $("clip-select").onchange = () => activateClip($("clip-select").value);
  $("preview-clip-select").onchange = () => activateClip($("preview-clip-select").value);
  $("clip-new").onclick = () => {
    const label = prompt("Nombre del nuevo clip", "Nuevo clip");
    if (!label) return;
    createClip(project, { label });
    time = 0;
    clearDraft();
    commit("Clip creado");
    refresh();
  };
  $("clip-duplicate").onclick = () => {
    duplicateClip(project);
    time = 0;
    clearDraft();
    commit("Clip duplicado");
    refresh();
  };
  $("clip-rename").onclick = () => {
    const label = prompt("Nuevo nombre del clip", project.clip.label || project.clip.id);
    if (!label) return;
    renameClip(project, project.activeClipId, { label });
    commit("Clip renombrado");
    refresh();
  };
  $("clip-up").onclick = () => {
    if (moveClip(project, project.activeClipId, -1)) commit("Clip reordenado");
    refresh();
  };
  $("clip-down").onclick = () => {
    if (moveClip(project, project.activeClipId, 1)) commit("Clip reordenado");
    refresh();
  };
  $("clip-delete").onclick = () => {
    if (!confirm(`¿Eliminar el clip “${project.clip.label || project.clip.id}”?`)) return;
    try {
      deleteClip(project);
      time = 0;
      clearDraft();
      commit("Clip eliminado");
      refresh();
    } catch (error) {
      status(error.message);
    }
  };
  $("import-layers").onclick = () => $("image-files").click();
  $("group-layers").onclick = createLayerGroup;
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
    commitLayerName(part(), $("part-name").value);
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
    renameClip(project, project.activeClipId, { id: $("project-name").value.trim() || "nuevo_movimiento" });
    commit("ID del clip actualizado");
    refresh();
  };
  $("header-play").onclick = () => (playing ? pause() : play());
  $("preview-play").onclick = () => (playing ? pause() : play());
  $("play").onclick = () => (playing ? pause() : play());
  $("first").onclick = () => setTime(0, true);
  $("previous-key").onclick = () => goToAdjacentKey(-1);
  $("last").onclick = () => setTime(duration(), true);
  $("next-key").onclick = () => goToAdjacentKey(1);
  $("scrub").oninput = () => setTime(Number($("scrub").value), true);
  $("fps").onchange = () => {
    project.fps = Number($("fps").value);
    commit("FPS de visualización actualizado");
    refresh();
  };
  $("duration").onchange = () => {
    const next = Number($("duration").value);
    if (!Number.isFinite(next) || next < 100 || next > 60000) return status("Duración fuera de rango");
    trimClipToDuration(project.clip, next);
    time = Math.min(time, next);
    commit("Duración actualizada");
    refresh();
  };
  $("loop").onchange = () => {
    project.clip.loop = $("loop").checked;
    commit("Bucle actualizado");
    refresh();
  };
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
    project.clip.spriteEvents.push({ t: Math.round(time), slot, variant });
    project.clip.spriteEvents.sort((left, right) => left.t - right.t);
    commit("Evento de sprite insertado");
    refresh();
  };
  [
    ["clip-label", "label"],
    ["clip-description", "description"],
    ["clip-category", "category"],
    ["clip-state", "state"]
  ].forEach(([id, property]) => {
    $(id).onchange = () => {
      project.clip[property] = $(id).value.trim();
      commit("Metadatos actualizados");
      refresh();
    };
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
  $("fit").onclick = () => {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    draw();
  };
  $("zoomin").onclick = () => {
    zoom = Math.min(2.2, zoom * 1.12);
    draw();
  };
  $("zoomout").onclick = () => {
    zoom = Math.max(0.4, zoom / 1.12);
    draw();
  };
  $("zoom").oninput = () => {
    zoom = Number($("zoom").value) / 100;
    draw();
  };
  $("fullscreen").onclick = () => $("viewport").requestFullscreen?.();
  ["grid", "bones", "ghost", "ghost-alpha"].forEach((id) => {
    $(id).oninput = draw;
  });
  $("file").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      replaceProject(normalizeLoadedProject(JSON.parse(await file.text())), "open-project");
      normalizeLayerOrder();
      selectAnimationTarget("rig");
      selectedPart = project.parts.find((item) => item.id === "torso")?.id || project.parts[0]?.id || "";
      selectedParts = selectedPart ? new Set([selectedPart]) : new Set();
      selectedKeys.clear();
      time = 0;
      clearDraft();
      resetGhostFromProject(0);
      ensureImages();
      commandHistory.reset(project);
      persistence?.schedule(project);
      status(`Proyecto importado con ${project.clips.length} clips`);
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
      [...project.parts]
        .sort((left, right) => right.z - left.z)
        .forEach((item) => {
          const image = images[item.id];
          const source = layerSourceRect(item, image);
          const width = source.width;
          const height = source.height;
          const score = Math.hypot((world.x - item.x) / (width / 2), (world.y - item.y) / (height / 2));
          if (score < 1.4 && score < distance) {
            chosen = item.id;
            distance = score;
          }
        });
      if (chosen) {
        selectLayer(chosen);
        if (!lockedParts.has(chosen))
          interaction = { type: "piece", start: world, x: part().x, y: part().y, moved: false };
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
      if (![...selectedTargets].some((target) => !lockedTargets.has(target)))
        return status("Todos los objetivos seleccionados están bloqueados");
      interaction = beginTransformInteraction(gizmoHit, state, world, toCanvasPoint(event.clientX, event.clientY));
      canvas.style.cursor = cursorForGizmoHit(gizmoHit);
      status(
        gizmoHit.type === "translate"
          ? `Moviendo ${selectionLabel()}${gizmoHit.axis === "free" ? " libremente" : ` sobre el eje ${gizmoHit.axis.toUpperCase()}`}`
          : gizmoHit.type === "rotate"
            ? `Rotando ${selectionLabel()} desde el anillo`
            : `Escalando ${selectionLabel()} desde la manija`
      );
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
    if (tool !== "select")
      status(
        `${label(chosen)} seleccionado; arrastra ${tool === "rotate" ? "el anillo" : "una manija"} para transformarlo`
      );
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
      const worldDelta = constrainedWorldDelta(
        {
          x: world.x - interaction.start.x,
          y: world.y - interaction.start.y
        },
        interaction.axis,
        interaction.gizmoAngle
      );
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
      const delta = constrainedWorldDelta(
        {
          x: world.x - interaction.start.x,
          y: world.y - interaction.start.y
        },
        interaction.axis,
        interaction.gizmoAngle
      );
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
      const delta = constrainedWorldDelta(
        {
          x: world.x - interaction.start.x,
          y: world.y - interaction.start.y
        },
        interaction.axis,
        interaction.gizmoAngle
      );
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
      const pointerAngle = (Math.atan2(world.y - interaction.center.y, world.x - interaction.center.x) * 180) / Math.PI;
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
        const nextScale = scaleFromDrag({ scaleX: item.scaleX, scaleY: item.scaleY }, canvasDelta, interaction.handle, {
          uniform: event.shiftKey
        });
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
      const action =
        completed.type === "translate"
          ? "Posición"
          : completed.type === "ik"
            ? "Cadena IK"
            : completed.type === "joint"
              ? "Articulación"
              : completed.type === "rotate"
                ? "Rotación"
                : "Escala";
      status(`${action} actualizada en borrador; pulsa Guardar fotograma`);
    }
  };
  canvas.onpointercancel = canvas.onpointerup;
  canvas.onpointerleave = () => {
    if (!interaction) canvas.style.cursor = "";
  };
}

function bindKeyboard() {
  window.addEventListener(
    "keydown",
    (event) => {
      if (tutorialRun) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeTutorial();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          moveTutorial(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveTutorial(-1);
        }
        return;
      }
      const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if (editing) return;
      const command = event.ctrlKey || event.metaKey;
      const activeSelection = activeHierarchyKind ? hierarchySelection(activeHierarchyKind) : [];
      if (event.shiftKey && activeHierarchyKind && event.key === "ArrowUp") {
        event.preventDefault();
        extendHierarchySelectionByArrow(activeHierarchyKind, -1);
        return;
      }
      if (event.shiftKey && activeHierarchyKind && event.key === "ArrowDown") {
        event.preventDefault();
        extendHierarchySelectionByArrow(activeHierarchyKind, 1);
        return;
      }
      if (command && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (command && event.key.toLowerCase() === "c") {
        event.preventDefault();
        if (activeHierarchyKind && activeSelection.length) copyHierarchySelection(activeHierarchyKind);
        else copySelectedKeys();
      } else if (command && event.key.toLowerCase() === "v") {
        if (activeHierarchyKind && hierarchyClipboard?.kind === activeHierarchyKind) {
          event.preventDefault();
          pasteHierarchySelection(activeHierarchyKind);
        } else {
          event.preventDefault();
          pasteKeys();
        }
      } else if (command && event.key.toLowerCase() === "d") {
        event.preventDefault();
        copySelectedKeys();
        pasteKeys(time + 1000 / fps());
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedKeys();
      } else if (event.key === " ") {
        event.preventDefault();
        playing ? pause() : play();
      } else if (event.key.toLowerCase() === "v") setTool("select");
      else if (event.key.toLowerCase() === "h") setTool("pan");
      else if (event.key.toLowerCase() === "r") setTool("rotate");
      else if (event.key.toLowerCase() === "s") setTool("scale");
      else if (event.shiftKey && event.key === "ArrowRight") {
        event.preventDefault();
        goToAdjacentKey(1);
      } else if (event.shiftKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goToAdjacentKey(-1);
      } else if (event.key === "ArrowRight") setTime(time + 1000 / fps(), true);
      else if (event.key === "ArrowLeft") setTime(time - 1000 / fps(), true);
    },
    { capture: true }
  );
}

async function initialize() {
  replaceProject(await loadInitialProject(), "initialize");
  project.clip = normalizeKinetraClip(project.clip);
  normalizeLayerOrder();
  STUDIO_EASES.forEach((ease) => {
    const option = document.createElement("option");
    option.value = ease;
    option.textContent = ease;
    $("key-ease").append(option);
  });
  ensureImages();
  renderTemplateChooser();
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
  window.addEventListener("pagehide", () => {
    persistence?.saveRecovery(project);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && persistence?.isDirty()) persistence.saveRecovery(project);
  });
  resetGhostFromProject(0);
  checkpoint();
  const requestedMode = location.hash.slice(1);
  const initialMode = requestedMode === "sprites" ? "calibrador" : requestedMode;
  setMode(["animador", "calibrador", "exportar", "proyecto"].includes(initialMode) ? initialMode : "animador");
}

initialize().catch((error) => {
  console.error(error);
  status(`No se pudo iniciar Kinetra: ${error.message}`);
  updatePersistenceState({ state: "error", message: "Error de inicio" });
});
