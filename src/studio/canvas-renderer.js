export const effectiveLayerRotation = (layer) => (layer.restRotation || 0) + (layer.rotation || 0);

export function inverseTransformPoint(matrix, world) {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < 1e-8) return null;
  const x = world.x - matrix[4];
  const y = world.y - matrix[5];
  return {
    x: (matrix[3] * x - matrix[2] * y) / determinant,
    y: (-matrix[1] * x + matrix[0] * y) / determinant
  };
}

export function transformedRectContainsPoint(matrix, source, world) {
  const local = inverseTransformPoint(matrix, world);
  if (!local) return false;
  return Math.abs(local.x) <= source.width / 2 && Math.abs(local.y) <= source.height / 2;
}

export function layerRect(layer, source) {
  const width = source.width * (layer.scaleX ?? 1);
  const height = source.height * (layer.scaleY ?? 1);
  return {
    left: layer.x - width / 2,
    top: layer.y - height / 2,
    right: layer.x + width / 2,
    bottom: layer.y + height / 2,
    width,
    height
  };
}

export function unionBounds(entries) {
  return entries.reduce(
    (result, entry) => ({
      left: Math.min(result.left, entry.left),
      top: Math.min(result.top, entry.top),
      right: Math.max(result.right, entry.right),
      bottom: Math.max(result.bottom, entry.bottom)
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );
}
