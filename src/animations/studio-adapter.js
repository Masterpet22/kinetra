/**
 * Adaptador entre proyectos exportados por Kinetra y el catálogo
 * declarativo que consume PuppetAnimationController.
 */
import { assertValidStudioProject, normalizeStudioProject } from "./studio-format.js";

export function studioProjectToAnimationClip(project, { requireGameReady = true } = {}) {
  assertValidStudioProject(project, { mode: requireGameReady ? "game" : "project" });
  const normalized = normalizeStudioProject(project);
  const clip = normalized.animation;
  return {
    format: "keyframes",
    id: clip.id,
    label: clip.label,
    description: clip.description,
    category: clip.category,
    state: clip.state,
    status: clip.status,
    loop: clip.loop,
    ...(clip.restore === undefined ? {} : { restore: clip.restore }),
    duration: clip.duration,
    requires: [...clip.requires],
    keys: structuredClone(clip.keys),
    spriteEvents: structuredClone(clip.spriteEvents),
    source: {
      schema: normalized.schema,
      rig: normalized.rig,
      anatomy: normalized.anatomy
    }
  };
}

export function studioProjectsToAnimationCatalog(projects, options) {
  if (!Array.isArray(projects)) throw new Error("La biblioteca de Kinetra debe ser una lista");
  const catalog = {};
  projects.forEach((project) => {
    const clip = studioProjectToAnimationClip(project, options);
    if (catalog[clip.id]) throw new Error(`ID de animación duplicado: ${clip.id}`);
    catalog[clip.id] = clip;
  });
  return catalog;
}
