function angleBetween(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function angleDelta(from, to) {
  let delta = (to - from) * 180 / Math.PI;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

/** Resuelve una cadena de dos segmentos y devuelve deltas angulares locales. */
export function solveTwoBoneIk(root, joint, end, target) {
  const upperLength = distance(root, joint);
  const lowerLength = distance(joint, end);
  if (upperLength < 1e-6 || lowerLength < 1e-6) return null;

  const targetAngle = angleBetween(root, target);
  const rawDistance = distance(root, target);
  const minimum = Math.max(1e-4, Math.abs(upperLength - lowerLength) + 1e-4);
  const maximum = Math.max(minimum, upperLength + lowerLength - 1e-4);
  const reach = Math.max(minimum, Math.min(maximum, rawDistance));
  const cosine = Math.max(-1, Math.min(1,
    (upperLength ** 2 + reach ** 2 - lowerLength ** 2) / (2 * upperLength * reach)
  ));
  const offset = Math.acos(cosine);
  const candidates = [targetAngle + offset, targetAngle - offset].map((angle) => ({
    x: root.x + Math.cos(angle) * upperLength,
    y: root.y + Math.sin(angle) * upperLength
  }));
  const solvedJoint = distance(candidates[0], joint) <= distance(candidates[1], joint) ? candidates[0] : candidates[1];
  const solvedEnd = {
    x: root.x + Math.cos(targetAngle) * reach,
    y: root.y + Math.sin(targetAngle) * reach
  };

  const currentUpper = angleBetween(root, joint);
  const currentLower = angleBetween(joint, end);
  const desiredUpper = angleBetween(root, solvedJoint);
  const desiredLower = angleBetween(solvedJoint, solvedEnd);
  const upperDelta = angleDelta(currentUpper, desiredUpper);
  const lowerDelta = angleDelta(currentLower + upperDelta * Math.PI / 180, desiredLower);

  return { upperDelta, lowerDelta, joint: solvedJoint, end: solvedEnd };
}
