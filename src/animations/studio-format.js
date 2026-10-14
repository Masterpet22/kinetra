/**
 * Contrato serializable de Kinetra.
 *
 * Mantiene separados el proyecto editable, la anatomía y el movimiento, y
 * ofrece una entrada única para crear, normalizar, validar e importar JSON.
 */
import { PUPPET_TARGETS } from "./rig.js?v=0.7.1";
import { TRANSFORM_PROPERTIES } from "./runtime.js?v=0.7.1";

export const STUDIO_SCHEMA = "cronicas-studio/v1";
export const STUDIO_STATES = Object.freeze(["idle", "locomotion", "action", "hit", "defeated"]);
export const STUDIO_STATUSES = Object.freeze(["draft", "integrated"]);
export const STUDIO_EASES = Object.freeze([
  "Linear",
  "Sine.in", "Sine.out", "Sine.inOut",
  "Quad.in", "Quad.out", "Quad.inOut",
  "Cubic.in", "Cubic.out", "Cubic.inOut",
  "Back.in", "Back.out", "Back.inOut"
]);

const TRANSFORM_SET = new Set(TRANSFORM_PROPERTIES);
const FRAME_FIELDS = new Set(["t", "ease", ...TRANSFORM_PROPERTIES]);
const STATE_SET = new Set(STUDIO_STATES);
const STATUS_SET = new Set(STUDIO_STATUSES);
const EASE_SET = new Set(STUDIO_EASES);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function pushStringError(errors, value, path, required = true) {
  // Los metadatos opcionales pueden permanecer vacíos mientras el proyecto es
  // un borrador. El modo `game` vuelve a exigirlos antes de exportar.
  if (!required && (value === undefined || (typeof value === "string" && !value.trim()))) return;
  if (!nonEmptyString(value)) errors.push(`${path}: debe ser un texto no vacío`);
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeFrame(frame) {
  const normalized = { t: frame.t };
  TRANSFORM_PROPERTIES.forEach((property) => {
    if (Object.hasOwn(frame, property)) normalized[property] = frame[property];
  });
  if (frame.ease !== undefined) normalized.ease = frame.ease;
  return normalized;
}

/**
 * Devuelve todos los errores del proyecto para mostrarlos juntos en el editor.
 * `mode: "project"` acepta borradores; `mode: "game"` exige un clip publicable.
 */
export function validateStudioProject(project, {
  allowedTargets = PUPPET_TARGETS,
  mode = "project"
} = {}) {
  const errors = [];
  if (!isRecord(project)) return ["proyecto: debe ser un objeto"];
  if (project.schema !== STUDIO_SCHEMA) errors.push(`schema: debe ser ${STUDIO_SCHEMA}`);
  pushStringError(errors, project.rig, "rig");
  pushStringError(errors, project.anatomy, "anatomy");
  if (!isRecord(project.animation)) {
    errors.push("animation: debe ser un objeto");
    return errors;
  }

  if (mode !== "project" && mode !== "game") errors.push("mode: debe ser project o game");
  const gameReady = mode === "game";
  const clip = project.animation;
  pushStringError(errors, clip.id, "animation.id");
  pushStringError(errors, clip.label, "animation.label", gameReady);
  pushStringError(errors, clip.description, "animation.description", gameReady);
  pushStringError(errors, clip.category, "animation.category", gameReady);
  pushStringError(errors, clip.state, "animation.state", gameReady);
  pushStringError(errors, clip.status, "animation.status", gameReady);

  if (clip.state !== undefined && !STATE_SET.has(clip.state)) {
    errors.push(`animation.state: estado desconocido ${clip.state}`);
  }
  if (clip.status !== undefined && !STATUS_SET.has(clip.status)) {
    errors.push(`animation.status: estado desconocido ${clip.status}`);
  }
  if (!Number.isFinite(clip.duration) || clip.duration < 100 || clip.duration > 60000) {
    errors.push("animation.duration: debe estar entre 100 y 60000 ms");
  }
  if (typeof clip.loop !== "boolean") errors.push("animation.loop: debe ser booleano");
  if (clip.restore !== undefined && typeof clip.restore !== "boolean") {
    errors.push("animation.restore: debe ser booleano");
  }

  const allowed = allowedTargets == null ? null : new Set(allowedTargets);
  if (clip.requires !== undefined && !Array.isArray(clip.requires)) {
    errors.push("animation.requires: debe ser una lista");
  } else if (Array.isArray(clip.requires)) {
    const seen = new Set();
    clip.requires.forEach((target, index) => {
      const path = `animation.requires[${index}]`;
      if (!nonEmptyString(target)) errors.push(`${path}: debe ser un identificador`);
      else if (seen.has(target)) errors.push(`${path}: objetivo duplicado ${target}`);
      else if (allowed && !allowed.has(target)) errors.push(`${path}: objetivo desconocido ${target}`);
      seen.add(target);
    });
    if (gameReady && !clip.requires.length) errors.push("animation.requires: el clip publicable debe declarar objetivos");
  } else if (gameReady) {
    errors.push("animation.requires: es obligatorio para exportar al juego");
  }

  if (!isRecord(clip.keys)) {
    errors.push("animation.keys: debe ser un objeto de pistas");
  } else {
    const trackEntries = Object.entries(clip.keys);
    if (gameReady && !trackEntries.length) errors.push("animation.keys: el clip publicable necesita al menos una pista");
    trackEntries.forEach(([target, frames]) => {
      const path = `animation.keys.${target}`;
      if (allowed && !allowed.has(target)) errors.push(`${path}: objetivo desconocido`);
      if (!Array.isArray(frames)) {
        errors.push(`${path}: debe ser una lista de fotogramas`);
        return;
      }
      if (gameReady && !frames.length) errors.push(`${path}: la pista publicable no puede estar vacía`);
      const times = new Set();
      frames.forEach((frame, index) => {
        const framePath = `${path}[${index}]`;
        if (!isRecord(frame)) {
          errors.push(`${framePath}: debe ser un objeto`);
          return;
        }
        if (!Number.isFinite(frame.t) || frame.t < 0 || frame.t > clip.duration) {
          errors.push(`${framePath}.t: debe estar dentro de la duración del clip`);
        } else if (times.has(frame.t)) {
          errors.push(`${framePath}.t: tiempo duplicado ${frame.t}`);
        }
        times.add(frame.t);

        const properties = Object.keys(frame).filter((field) => TRANSFORM_SET.has(field));
        if (!properties.length) errors.push(`${framePath}: falta una transformación`);
        properties.forEach((property) => {
          if (!Number.isFinite(frame[property])) errors.push(`${framePath}.${property}: debe ser numérico`);
        });
        Object.keys(frame).forEach((field) => {
          if (!FRAME_FIELDS.has(field)) errors.push(`${framePath}.${field}: propiedad desconocida`);
        });
        if (frame.ease !== undefined && !EASE_SET.has(frame.ease)) {
          errors.push(`${framePath}.ease: curva no compatible ${frame.ease}`);
        }
      });
    });
  }

  if (clip.spriteEvents !== undefined && !Array.isArray(clip.spriteEvents)) {
    errors.push("animation.spriteEvents: debe ser una lista");
  } else {
    (clip.spriteEvents || []).forEach((event, index) => {
      const path = `animation.spriteEvents[${index}]`;
      if (!isRecord(event)) {
        errors.push(`${path}: debe ser un objeto`);
        return;
      }
      if (!Number.isFinite(event.t) || event.t < 0 || event.t > clip.duration) {
        errors.push(`${path}.t: debe estar dentro de la duración del clip`);
      }
      pushStringError(errors, event.slot, `${path}.slot`);
      pushStringError(errors, event.variant, `${path}.variant`);
    });
  }

  if (gameReady && isRecord(clip.keys) && Array.isArray(clip.requires)) {
    const required = new Set(clip.requires);
    Object.keys(clip.keys).forEach((target) => {
      if (!required.has(target)) errors.push(`animation.requires: falta el objetivo animado ${target}`);
    });
  }

  return errors;
}

export function assertValidStudioProject(project, options) {
  const errors = validateStudioProject(project, options);
  if (errors.length) throw new Error(`Proyecto de Studio inválido:\n${errors.join("\n")}`);
  return project;
}

/** Convierte JSON antiguos de la fase prototipo al orden canónico de v1. */
export function normalizeStudioProject(project) {
  const clip = project.animation;
  const keys = Object.fromEntries(
    Object.entries(clip.keys || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([target, frames]) => [
        target,
        [...frames].map(normalizeFrame).sort((left, right) => left.t - right.t)
      ])
  );
  const requiredTargets = sortedUnique([...(clip.requires || []), ...Object.keys(keys)]);
  const spriteEvents = [...(clip.spriteEvents || [])]
    .map((event) => ({ t: event.t, slot: event.slot, variant: event.variant }))
    .sort((left, right) => left.t - right.t || left.slot.localeCompare(right.slot));

  return {
    schema: project.schema,
    rig: project.rig,
    anatomy: project.anatomy,
    animation: {
      id: clip.id,
      label: clip.label ?? clip.id,
      description: clip.description ?? "",
      category: clip.category ?? "acción",
      state: clip.state ?? "action",
      status: clip.status ?? "draft",
      duration: clip.duration,
      loop: clip.loop,
      ...(clip.restore === undefined ? {} : { restore: clip.restore }),
      requires: requiredTargets,
      keys,
      spriteEvents
    }
  };
}

export function createStudioProject({
  id = "nuevo_movimiento",
  label = "Nuevo movimiento",
  description = "Animación creada en Kinetra.",
  category = "acción",
  state = "action",
  duration = 1000,
  loop = false,
  rig = "humanoid",
  anatomy = "male"
} = {}) {
  return normalizeStudioProject({
    schema: STUDIO_SCHEMA,
    rig,
    anatomy,
    animation: {
      id,
      label,
      description,
      category,
      state,
      status: "draft",
      duration,
      loop,
      requires: [],
      keys: {},
      spriteEvents: []
    }
  });
}

export function serializeStudioProject(project, options = {}) {
  assertValidStudioProject(project, options);
  return JSON.stringify(normalizeStudioProject(project), null, 2);
}

export function parseStudioProject(source, options = {}) {
  let project;
  try {
    project = JSON.parse(source);
  } catch (error) {
    throw new Error(`JSON de Studio inválido: ${error.message}`);
  }
  assertValidStudioProject(project, options);
  return normalizeStudioProject(project);
}
