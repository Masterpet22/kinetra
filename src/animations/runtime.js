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

export function animationTrackProgress(track, elapsed, loop) {
  const time = Math.max(0, elapsed - (track.delay || 0));
  if (loop) {
    const cycle = track.yoyo ? track.duration * 2 : track.duration;
    let progress = (time % cycle) / track.duration;
    if (track.yoyo && progress > 1) progress = 2 - progress;
    return animationEase(progress, track.ease);
  }
  let progress = time / track.duration;
  if (track.yoyo) progress = progress <= 1 ? progress : Math.max(0, 2 - progress);
  else progress = Math.min(1, progress);
  return animationEase(progress, track.ease);
}

export function sampleAnimationPose(clip, elapsed) {
  if (isKeyframeAnimationClip(clip)) return sampleKeyframeAnimationPose(clip, elapsed);
  const pose = {};
  clip.tracks.forEach((track) => {
    const enterDuration = track.from ? Number(clip.enterDuration || 0) : 0;
    const entering = enterDuration > 0 && elapsed < enterDuration;
    const progress = entering
      ? animationEase(elapsed / enterDuration, "Cubic.out")
      : animationTrackProgress(track, elapsed - enterDuration, clip.loop);
    pose[track.target] ||= {};
    Object.entries(track.to || {}).forEach(([property, end]) => {
      const from = Number(track.from?.[property] || 0);
      pose[track.target][property] = entering ? from * progress : from + (end - from) * progress;
    });
    Object.entries(track.from || {}).forEach(([property, start]) => {
      if (!(property in (track.to || {}))) pose[track.target][property] = start;
    });
  });
  return pose;
}

export function animationClipDuration(clip) {
  if (isKeyframeAnimationClip(clip)) return Number(clip.duration || 0);
  return Number(clip.enterDuration || 0) + Math.max(...clip.tracks.map((track) =>
    (track.delay || 0) + track.duration * (track.yoyo ? 2 : 1)
  ));
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
