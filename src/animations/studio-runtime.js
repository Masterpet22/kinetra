/** Kinetra: muestreador puro para el editor y adaptadores de runtimes. */
import { sampleKeyframeAnimationPose } from "./runtime.js";
import { assertValidKinetraClip, normalizeKinetraClip } from "./studio-format.js";

export function validateKinetraClipForEditor(clip, allowedTargets = null) {
  assertValidKinetraClip(clip, { allowedTargets, mode: "project" });
  return normalizeKinetraClip(clip);
}

export function sampleKinetraClip(clip, time, targets = null) {
  return sampleKeyframeAnimationPose(validateKinetraClipForEditor(clip, targets), time);
}
