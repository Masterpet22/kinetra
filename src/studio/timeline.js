export function collectKeyTimes(clip) {
  return [...new Set(Object.values(clip.keys || {}).flatMap((frames) => frames.map((frame) => frame.t)))].sort(
    (left, right) => left - right
  );
}

export function clampTimelineTime(clip, time) {
  return Math.max(0, Math.min(clip.duration, time));
}

export function trimClipToDuration(clip, duration) {
  clip.duration = duration;
  Object.entries(clip.keys).forEach(([target, frames]) => {
    clip.keys[target] = frames.filter((frame) => frame.t <= duration);
  });
  clip.spriteEvents = clip.spriteEvents.filter((event) => event.t <= duration);
  return clip;
}
