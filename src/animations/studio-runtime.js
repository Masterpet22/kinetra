/** Kinetra: muestreador puro para el editor y adaptadores de runtimes. */
import { sampleKeyframeAnimationPose } from "./runtime.js?v=0.1.0";
import { assertValidStudioProject, normalizeStudioProject, STUDIO_SCHEMA } from "./studio-format.js?v=0.1.0";

export { STUDIO_SCHEMA };

export function validateStudioAnimation(project, allowedTargets = null) {
  assertValidStudioProject(project, { allowedTargets, mode: "project" });
  return normalizeStudioProject(project).animation;
}

export function sampleStudioAnimation(project,time,targets=null) {
  const clip=validateStudioAnimation(project,targets);
  return sampleKeyframeAnimationPose(clip,time);
}
