export const TRANSFORM_PROPERTIES = Object.freeze(["x", "y", "angle", "scaleX", "scaleY", "alpha"]);

export function addAnimationOffsets(base, offsets = {}) {
  return Object.fromEntries(Object.entries(offsets).map(([property, value]) => [property, base[property] + value]));
}

export function animationEase(progress, ease = "Sine.inOut") {
  const clamped = Math.max(0, Math.min(1, progress));
  if (ease === "Linear") return clamped;
  const [family = "Sine", direction = "inOut"] = ease.split(".");
  const easeIn = (value) => {
    if (family === "Quad") return value * value;
    if (family === "Cubic") return value * value * value;
    if (family === "Back") {
      const overshoot = 1.70158;
      return (overshoot + 1) * value * value * value - overshoot * value * value;
    }
    return 1 - Math.cos((value * Math.PI) / 2);
  };
  if (direction === "in") return easeIn(clamped);
  if (direction === "out") return 1 - easeIn(1 - clamped);
  return clamped < 0.5 ? easeIn(clamped * 2) / 2 : 1 - easeIn((1 - clamped) * 2) / 2;
}

export function isKeyframeAnimationClip(clip) {
  return Boolean(clip?.keys && typeof clip.keys === "object" && !Array.isArray(clip.keys));
}

function animationTime(clip, elapsed) {
  const duration = Math.max(1, Number(clip?.duration || 0));
  return clip?.loop
    ? ((Number(elapsed || 0) % duration) + duration) % duration
    : Math.max(0, Math.min(duration, Number(elapsed || 0)));
}

/** Devuelve la última variante solicitada para cada ranura en el tiempo indicado. */
export function sampleSpriteVariants(clip, elapsed) {
  const time = animationTime(clip, elapsed);
  const variants = {};
  [...(clip?.spriteEvents || [])]
    .sort((left, right) => left.t - right.t)
    .forEach((event) => {
      if (event.t <= time && event.slot && event.variant) variants[event.slot] = event.variant;
    });
  return variants;
}

const matchesSpriteIdentity = (item, identity) =>
  Boolean(item && [item.id, item.name, item.assetId].some((value) => value === identity));

/** Capas auxiliares usadas como variantes, no como piezas independientes. */
export function spriteVariantSourceIds(layers, clip) {
  const slotIds = new Set(
    (clip?.spriteEvents || [])
      .map((event) => (layers || []).find((layer) => matchesSpriteIdentity(layer, event.slot))?.id)
      .filter(Boolean)
  );
  return new Set(
    (clip?.spriteEvents || [])
      .map((event) => (layers || []).find((layer) => matchesSpriteIdentity(layer, event.variant))?.id)
      .filter((id) => id && !slotIds.has(id))
  );
}

/**
 * Resuelve el recurso visible de una capa. Una variante puede apuntar al ID o
 * nombre de otra capa (reutilizando también su recorte) o directamente a un
 * recurso. Si el evento es externo o no se puede resolver, conserva la imagen
 * original para que la previsualización nunca deje un hueco en el personaje.
 */
export function resolveSpriteLayerVariant(layers, assets, clip, elapsed, layer) {
  const variants = sampleSpriteVariants(clip, elapsed);
  const entry = Object.entries(variants).find(([slot]) => matchesSpriteIdentity(layer, slot));
  if (!entry) return { assetId: layer.assetId, crop: layer.crop || null, variant: null, resolved: true };

  const variant = entry[1];
  const nestedVariant =
    (layer.variants || []).find((candidate) => matchesSpriteIdentity(candidate, variant)) ||
    (layers || [])
      .flatMap((candidate) => candidate.variants || [])
      .find((candidate) => matchesSpriteIdentity(candidate, variant));
  const variantLayer = (layers || []).find((candidate) => matchesSpriteIdentity(candidate, variant));
  const assetId =
    nestedVariant?.assetId ||
    variantLayer?.assetId ||
    (assets || []).find((asset) => matchesSpriteIdentity(asset, variant))?.id;
  if (!assetId) return { assetId: layer.assetId, crop: layer.crop || null, variant, resolved: false };
  return {
    assetId,
    crop: nestedVariant?.crop || variantLayer?.crop || null,
    variant,
    resolved: true
  };
}

function sampleKeyframeProperty(frames, property, time) {
  const keys = frames.filter((frame) => Number.isFinite(frame[property]));
  if (!keys.length) return undefined;
  if (time <= keys[0].t) return keys[0][property];
  if (time >= keys[keys.length - 1].t) return keys[keys.length - 1][property];
  for (let index = 1; index < keys.length; index += 1) {
    const next = keys[index];
    if (time > next.t) continue;
    const previous = keys[index - 1];
    const rawProgress = (time - previous.t) / (next.t - previous.t || 1);
    const progress = next.ease && next.ease !== "Linear" ? animationEase(rawProgress, next.ease) : rawProgress;
    return previous[property] + (next[property] - previous[property]) * progress;
  }
  return keys[keys.length - 1][property];
}

/** Muestrea offsets relativos de un clip exportado por Kinetra. */
export function sampleKeyframeAnimationPose(clip, elapsed) {
  if (!isKeyframeAnimationClip(clip)) return {};
  const time = animationTime(clip, elapsed);
  const pose = {};
  Object.entries(clip.keys).forEach(([target, original]) => {
    const frames = [...original].sort((left, right) => left.t - right.t);
    if (!frames.length) return;
    const transform = {};
    TRANSFORM_PROPERTIES.forEach((property) => {
      const value = sampleKeyframeProperty(frames, property, time);
      if (value !== undefined) transform[property] = value;
    });
    if (Object.keys(transform).length) pose[target] = transform;
  });
  return pose;
}
