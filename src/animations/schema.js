import { PUPPET_TARGETS } from "./rig.js";
import { TRANSFORM_PROPERTIES } from "./runtime.js";

const STATUSES = new Set(["draft", "integrated"]);

export function validateAnimationCatalog(catalog, priorities) {
  const errors = [];
  const knownTargets = new Set(PUPPET_TARGETS);
  const knownProperties = new Set(TRANSFORM_PROPERTIES);

  Object.entries(catalog).forEach(([key, clip]) => {
    const at = `clip "${key}"`;
    if (!clip || typeof clip !== "object") return errors.push(`${at}: debe ser un objeto`);
    if (clip.id !== key) errors.push(`${at}: id debe coincidir con la clave`);
    for (const field of ["label", "description", "category", "state", "status"]) {
      if (typeof clip[field] !== "string" || !clip[field].trim()) errors.push(`${at}: falta ${field}`);
    }
    if (!(clip.state in priorities)) errors.push(`${at}: estado desconocido ${clip.state}`);
    if (!STATUSES.has(clip.status)) errors.push(`${at}: status debe ser draft o integrated`);
    if (typeof clip.loop !== "boolean") errors.push(`${at}: loop debe ser booleano`);
    if (clip.restore !== undefined && typeof clip.restore !== "boolean") errors.push(`${at}: restore debe ser booleano`);
    if (!Array.isArray(clip.requires) || !clip.requires.length) errors.push(`${at}: requires debe declarar el rig necesario`);
    const required = new Set(clip.requires || []);
    required.forEach((target) => {
      if (!knownTargets.has(target)) errors.push(`${at}: requisito desconocido ${target}`);
    });
    const hasLegacyTracks = Array.isArray(clip.tracks) && clip.tracks.length > 0;
    const hasKeyframes = clip.keys && typeof clip.keys === "object" && !Array.isArray(clip.keys) && Object.keys(clip.keys).length > 0;
    if (hasLegacyTracks && hasKeyframes) errors.push(`${at}: no debe mezclar tracks heredados y keys`);
    if (!hasLegacyTracks && !hasKeyframes) errors.push(`${at}: debe incluir tracks o keys`);

    if (hasLegacyTracks) {
      clip.tracks.forEach((track, index) => {
        const trackAt = `${at}, pista ${index}`;
        if (!knownTargets.has(track.target)) errors.push(`${trackAt}: target desconocido ${track.target}`);
        if (!required.has(track.target)) errors.push(`${trackAt}: ${track.target} no está declarado en requires`);
        if (!Number.isFinite(track.duration) || track.duration <= 0) errors.push(`${trackAt}: duration debe ser positivo`);
        if (track.delay !== undefined && (!Number.isFinite(track.delay) || track.delay < 0)) errors.push(`${trackAt}: delay inválido`);
        if (!track.to || typeof track.to !== "object" || !Object.keys(track.to).length) errors.push(`${trackAt}: falta to`);
        for (const pose of [track.from, track.to]) {
          Object.entries(pose || {}).forEach(([property, value]) => {
            if (!knownProperties.has(property)) errors.push(`${trackAt}: propiedad desconocida ${property}`);
            if (!Number.isFinite(value)) errors.push(`${trackAt}: ${property} debe ser numérica`);
          });
        }
      });
    }

    if (hasKeyframes) {
      if (!Number.isFinite(clip.duration) || clip.duration <= 0) errors.push(`${at}: duration debe ser positivo`);
      Object.entries(clip.keys).forEach(([target, frames]) => {
        const trackAt = `${at}, pista ${target}`;
        if (!knownTargets.has(target)) errors.push(`${trackAt}: target desconocido`);
        if (!required.has(target)) errors.push(`${trackAt}: no está declarada en requires`);
        if (!Array.isArray(frames) || !frames.length) {
          errors.push(`${trackAt}: debe incluir fotogramas`);
          return;
        }
        const times = new Set();
        frames.forEach((frame, index) => {
          const frameAt = `${trackAt}, fotograma ${index}`;
          if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
            errors.push(`${frameAt}: debe ser un objeto`);
            return;
          }
          if (!Number.isFinite(frame.t) || frame.t < 0 || frame.t > clip.duration) errors.push(`${frameAt}: tiempo inválido`);
          else if (times.has(frame.t)) errors.push(`${frameAt}: tiempo duplicado`);
          times.add(frame.t);
          const properties = Object.entries(frame).filter(([property]) => knownProperties.has(property));
          if (!properties.length) errors.push(`${frameAt}: falta una transformación`);
          properties.forEach(([property, value]) => {
            if (!Number.isFinite(value)) errors.push(`${frameAt}: ${property} debe ser numérica`);
          });
          if (frame.ease !== undefined && (typeof frame.ease !== "string" || !frame.ease.trim())) errors.push(`${frameAt}: ease inválido`);
          Object.keys(frame).forEach((property) => {
            if (property !== "t" && property !== "ease" && !knownProperties.has(property)) errors.push(`${frameAt}: propiedad desconocida ${property}`);
          });
        });
      });
      if (clip.spriteEvents !== undefined && !Array.isArray(clip.spriteEvents)) errors.push(`${at}: spriteEvents debe ser una lista`);
    }
  });

  return errors;
}

export function assertValidAnimationCatalog(catalog, priorities) {
  const errors = validateAnimationCatalog(catalog, priorities);
  if (errors.length) throw new Error(`Catálogo de animaciones inválido:\n${errors.join("\n")}`);
  return catalog;
}
