/** Kinetra: muestreador puro para el editor y adaptadores de runtimes. */
import { sampleKeyframeAnimationPose } from "./runtime.js?v=0.11.0";
import { assertValidKinetraClip, normalizeKinetraClip } from "./studio-format.js?v=0.11.0";

export function validateKinetraClipForEditor(clip, allowedTargets = null) {
  assertValidKinetraClip(clip, { allowedTargets, mode: "project" });
  return normalizeKinetraClip(clip);
}

export function sampleKinetraClip(clip, time, targets = null) {
  return sampleKeyframeAnimationPose(validateKinetraClipForEditor(clip, targets), time);
}
