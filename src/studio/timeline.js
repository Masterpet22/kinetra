export function collectKeyTimes(clip) {
  return [...new Set(Object.values(clip.keys || {}).flatMap((frames) => frames.map((frame) => frame.t)))].sort(
    (left, right) => left - right
  );
}

export function previousKeyTime(clip, time) {
  return collectKeyTimes(clip).findLast((candidate) => candidate < time);
}

export function keyIdentitiesAtTime(clip, time, targets = Object.keys(clip.keys || {})) {
  return new Set(
    targets
      .filter((target) => (clip.keys[target] || []).some((frame) => frame.t === time))
      .map((target) => `${target}:${time}`)
  );
}

export function clampTimelineTime(clip, time) {
  return Math.max(0, Math.min(clip.duration, time));
}

export function parseKeyIdentity(identity) {
  const separator = identity.lastIndexOf(":");
  return {
    target: identity.slice(0, separator),
    time: Number(identity.slice(separator + 1))
  };
}

export function selectedKeyframes(clip, identities) {
  return [...identities]
    .map((identity) => {
      const { target, time } = parseKeyIdentity(identity);
      const frame = (clip.keys[target] || []).find((item) => item.t === time);
      return frame ? { identity, target, time, frame } : null;
    })
    .filter(Boolean);
}

export function clampKeyframeDelta(keyframes, delta, duration) {
  if (!keyframes.length) return 0;
  const first = Math.min(...keyframes.map(({ time }) => time));
  const last = Math.max(...keyframes.map(({ time }) => time));
  return Math.max(-first, Math.min(duration - last, delta));
}

export function moveKeyframes(clip, identities, requestedDelta) {
  const keyframes = selectedKeyframes(clip, identities);
  const delta = clampKeyframeDelta(keyframes, requestedDelta, clip.duration);
  if (!keyframes.length || delta === 0) {
    return { count: keyframes.length, delta, identities: new Set(identities), overwritten: 0 };
  }

  const byTarget = new Map();
  keyframes.forEach((keyframe) => {
    if (!byTarget.has(keyframe.target)) byTarget.set(keyframe.target, []);
    byTarget.get(keyframe.target).push(keyframe);
  });

  let overwritten = 0;
  byTarget.forEach((moving, target) => {
    const sourceTimes = new Set(moving.map(({ time }) => time));
    const destinationTimes = new Set(moving.map(({ time }) => time + delta));
    const frames = clip.keys[target] || [];
    clip.keys[target] = frames.filter((frame) => {
      const replace = !sourceTimes.has(frame.t) && destinationTimes.has(frame.t);
      if (replace) overwritten += 1;
      return !replace;
    });
    moving.forEach(({ frame }) => {
      frame.t += delta;
    });
    clip.keys[target].sort((left, right) => left.t - right.t);
  });

  return {
    count: keyframes.length,
    delta,
    identities: new Set(keyframes.map(({ target, time }) => `${target}:${time + delta}`)),
    overwritten
  };
}

export function trimClipToDuration(clip, duration) {
  clip.duration = duration;
  Object.entries(clip.keys).forEach(([target, frames]) => {
    clip.keys[target] = frames.filter((frame) => frame.t <= duration);
  });
  clip.spriteEvents = clip.spriteEvents.filter((event) => event.t <= duration);
  return clip;
}
