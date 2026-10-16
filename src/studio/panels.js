export const PANEL_DEFAULTS = Object.freeze({
  skeleton: { visible: true, dock: "left", lastDock: "left" },
  tracks: { visible: true, dock: "left", lastDock: "left" },
  layers: { visible: true, dock: "left", lastDock: "left" },
  inspector: { visible: true, dock: "right", lastDock: "right" },
  presets: { visible: true, dock: "right", lastDock: "right" },
  curves: { visible: true, dock: "right", lastDock: "right" },
  timeline: { visible: true, dock: "bottom", lastDock: "bottom" }
});

export const PANEL_LABELS = Object.freeze({
  skeleton: "Esqueleto",
  tracks: "Pistas",
  layers: "Capas",
  inspector: "Inspector",
  presets: "Presets",
  curves: "Curvas",
  timeline: "Línea de tiempo"
});
export const DOCK_ZONES = Object.freeze(["left", "right", "bottom"]);
export const PANEL_DRAG_THRESHOLD = 8;
export const PANEL_LAYOUT_VERSION = 3;
export const PANEL_FLOAT_SIZES = Object.freeze({
  skeleton: { width: 310, height: 470 },
  tracks: { width: 310, height: 430 },
  layers: { width: 310, height: 470 },
  inspector: { width: 350, height: 520 },
  presets: { width: 320, height: 260 },
  curves: { width: 420, height: 280 },
  timeline: { width: 760, height: 310 }
});

export function panelLayoutPayload(panels, active, sizes) {
  return { layoutVersion: PANEL_LAYOUT_VERSION, panels, active, sizes };
}
