export const effectiveLayerRotation = (layer) => (layer.restRotation || 0) + (layer.rotation || 0);

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
