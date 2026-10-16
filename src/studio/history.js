import { migrateAuthoringProject, serializeAuthoringProject } from "./project-model.js";

export const DEFAULT_HISTORY_BUDGET = 5 * 1024 * 1024;

function withoutBinaryAssets(project) {
  const snapshot = serializeAuthoringProject(project);
  snapshot.assets = snapshot.assets.map((sourceAsset) => {
    const asset = { ...sourceAsset };
    const src = asset.src;
    delete asset.src;
    delete asset.blob;
    if (typeof src === "string" && !src.startsWith("data:") && !src.startsWith("blob:")) asset.src = src;
    return asset;
  });
  return snapshot;
}

function mergeAssets(snapshot, current) {
  const sources = new Map((current.assets || []).map((asset) => [asset.id, asset]));
  snapshot.assets = snapshot.assets.map((asset) => ({ ...sources.get(asset.id), ...asset }));
  return migrateAuthoringProject(snapshot);
}

export function createCommandHistory({ budgetBytes = DEFAULT_HISTORY_BUDGET } = {}) {
  let entries = [];
  let index = -1;
  let current = null;
  let bytes = 0;

  const encoded = (value) => JSON.stringify(value);
  const weight = (entry) => encoded(entry).length * 2;

  function reset(project) {
    entries = [];
    index = -1;
    current = withoutBinaryAssets(project);
    bytes = 0;
  }

  function record(label, project) {
    const after = withoutBinaryAssets(project);
    if (!current) return reset(project);
    if (encoded(current) === encoded(after)) return false;
    entries.splice(index + 1);
    const entry = { label: label || "Cambio", before: current, after };
    entry.bytes = weight(entry);
    entries.push(entry);
    index = entries.length - 1;
    current = after;
    bytes = entries.reduce((sum, item) => sum + item.bytes, 0);
    while (bytes > budgetBytes && entries.length > 1) {
      const removed = entries.shift();
      bytes -= removed.bytes;
      index -= 1;
    }
    return true;
  }

  function undo(project) {
    if (index < 0) return null;
    const entry = entries[index--];
    current = entry.before;
    return { project: mergeAssets(structuredClone(entry.before), project), label: entry.label };
  }

  function redo(project) {
    if (index + 1 >= entries.length) return null;
    const entry = entries[++index];
    current = entry.after;
    return { project: mergeAssets(structuredClone(entry.after), project), label: entry.label };
  }

  return {
    reset,
    record,
    undo,
    redo,
    canUndo: () => index >= 0,
    canRedo: () => index + 1 < entries.length,
    stats: () => ({ entries: entries.length, index, bytes, budgetBytes })
  };
}
