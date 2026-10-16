import { createKinetraClip, normalizeKinetraClip } from "../animations/studio-format.js";

export const AUTHORING_VERSION = 5;

function safeId(value, fallback = "clip") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function uniqueClipId(project, requested, ignoredId = null) {
  const used = new Set(project.clips.filter((clip) => clip.id !== ignoredId).map((clip) => clip.id));
  const base = safeId(requested, "clip");
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}_${suffix++}`;
  return id;
}

/**
 * Mantiene `project.clip` como alias no serializable del clip activo para que
 * los controladores visuales puedan migrar sin crear dos fuentes de verdad.
 */
export function attachActiveClip(project) {
  Object.defineProperty(project, "clip", {
    configurable: true,
    enumerable: false,
    get() {
      return this.clips.find((clip) => clip.id === this.activeClipId) || this.clips[0];
    },
    set(value) {
      const normalized = normalizeKinetraClip(value);
      const index = this.clips.findIndex((clip) => clip.id === this.activeClipId);
      if (index >= 0) this.clips[index] = normalized;
      else this.clips.push(normalized);
      this.activeClipId = normalized.id;
    }
  });
  return project;
}

export function migrateAuthoringProject(source) {
  if (!source || typeof source !== "object") throw new Error("El proyecto de autoría debe ser un objeto");
  const clips = (
    Array.isArray(source.clips) && source.clips.length
      ? source.clips
      : source.clip
        ? [source.clip]
        : [createKinetraClip()]
  ).map(normalizeKinetraClip);
  const activeClipId = clips.some((clip) => clip.id === source.activeClipId) ? source.activeClipId : clips[0].id;
  const migrated = {
    version: AUTHORING_VERSION,
    projectId: source.projectId || activeClipId,
    fps: Number(source.fps || 24),
    templateId: source.templateId,
    assets: structuredClone(source.assets || []),
    layerGroups: structuredClone(source.layerGroups || []),
    rig: structuredClone(source.rig || { id: "custom", name: "Rig personalizado", bones: [] }),
    parts: structuredClone(source.parts || source.layers || []),
    clips,
    activeClipId
  };
  return attachActiveClip(migrated);
}

export function serializeAuthoringProject(project) {
  return structuredClone({
    version: AUTHORING_VERSION,
    projectId: project.projectId || project.activeClipId,
    fps: Number(project.fps || 24),
    ...(project.templateId ? { templateId: project.templateId } : {}),
    assets: project.assets || [],
    layerGroups: project.layerGroups || [],
    rig: project.rig,
    parts: project.parts || [],
    clips: project.clips.map(normalizeKinetraClip),
    activeClipId: project.activeClipId
  });
}

export function selectClip(project, clipId) {
  if (!project.clips.some((clip) => clip.id === clipId)) throw new Error(`No existe el clip ${clipId}`);
  project.activeClipId = clipId;
  return project.clip;
}

export function createClip(project, options = {}) {
  const id = uniqueClipId(project, options.id || options.label || "nuevo_clip");
  const clip = createKinetraClip({ ...options, id, label: options.label || id });
  project.clips.push(clip);
  project.activeClipId = clip.id;
  return clip;
}

export function duplicateClip(project, clipId = project.activeClipId) {
  const source = project.clips.find((clip) => clip.id === clipId);
  if (!source) throw new Error(`No existe el clip ${clipId}`);
  const copy = structuredClone(source);
  copy.id = uniqueClipId(project, `${source.id}_copia`);
  copy.label = `${source.label || source.id} copia`;
  const index = project.clips.indexOf(source);
  project.clips.splice(index + 1, 0, copy);
  project.activeClipId = copy.id;
  return copy;
}

/** @param {Record<string, any>} project @param {string} clipId @param {Record<string, any>} options */
export function renameClip(project, clipId, options = {}) {
  const { id, label } = options;
  const clip = project.clips.find((item) => item.id === clipId);
  if (!clip) throw new Error(`No existe el clip ${clipId}`);
  const nextId = uniqueClipId(project, id || clip.id, clip.id);
  clip.id = nextId;
  clip.label = String(label || clip.label || nextId).trim() || nextId;
  if (project.activeClipId === clipId) project.activeClipId = nextId;
  return clip;
}

export function moveClip(project, clipId, delta) {
  const from = project.clips.findIndex((clip) => clip.id === clipId);
  const to = Math.max(0, Math.min(project.clips.length - 1, from + delta));
  if (from < 0 || from === to) return false;
  const [clip] = project.clips.splice(from, 1);
  project.clips.splice(to, 0, clip);
  return true;
}

export function deleteClip(project, clipId = project.activeClipId) {
  if (project.clips.length <= 1) throw new Error("El proyecto debe conservar al menos un clip");
  const index = project.clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) throw new Error(`No existe el clip ${clipId}`);
  project.clips.splice(index, 1);
  if (project.activeClipId === clipId) {
    project.activeClipId = project.clips[Math.min(index, project.clips.length - 1)].id;
  }
  return project.clip;
}
