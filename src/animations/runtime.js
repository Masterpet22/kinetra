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
    return 1 - Math.cos(value * Math.PI / 2);
  };
  if (direction === "in") return easeIn(clamped);
  if (direction === "out") return 1 - easeIn(1 - clamped);
  return clamped < 0.5
    ? easeIn(clamped * 2) / 2
    : 1 - easeIn((1 - clamped) * 2) / 2;
}

export function isKeyframeAnimationClip(clip) {
  return Boolean(clip?.keys && typeof clip.keys === "object" && !Array.isArray(clip.keys));
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
    const progress = next.ease && next.ease !== "Linear"
      ? animationEase(rawProgress, next.ease)
      : rawProgress;
    return previous[property] + (next[property] - previous[property]) * progress;
  }
  return keys[keys.length - 1][property];
}

/** Muestrea offsets relativos de un clip exportado por Kinetra. */
export function sampleKeyframeAnimationPose(clip, elapsed) {
  if (!isKeyframeAnimationClip(clip)) return {};
  const duration = Math.max(1, Number(clip.duration || 0));
  const time = clip.loop
    ? ((elapsed % duration) + duration) % duration
    : Math.max(0, Math.min(duration, elapsed));
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
