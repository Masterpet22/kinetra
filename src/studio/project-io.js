import { createKinetraBundle } from "../animations/kinetra-runtime.js";
import { serializeAuthoringProject } from "./project-model.js";

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("No se pudo incrustar un recurso"));
    reader.readAsDataURL(blob);
  });
}

export async function portableAuthoringProject(project) {
  const portable = serializeAuthoringProject(project);
  const knownAssets = new Map((portable.assets || []).map((asset) => [asset.id, asset]));
  for (const layer of portable.parts) {
    const existing = knownAssets.get(layer.assetId);
    if (existing?.src?.startsWith("data:")) {
      layer.source = "asset";
      continue;
    }
    const inMemory = project.assets.find((asset) => asset.id === layer.assetId);
    const source = inMemory?.blob || inMemory?.src || existing?.src;
    if (!source) throw new Error(`No se encontró el recurso ${layer.assetId}`);
    const blob = source instanceof Blob ? source : await (await fetch(source)).blob();
    const asset = {
      ...existing,
      id: layer.assetId,
      name: existing?.name || `${layer.assetId}.png`,
      type: blob.type || existing?.type || "image/png",
      size: blob.size,
      src: await blobToDataUrl(blob)
    };
    if (existing) Object.assign(existing, asset);
    else portable.assets.push(asset);
    knownAssets.set(asset.id, asset);
    layer.source = "asset";
  }
  return portable;
}

export async function exportPortableBundle(project) {
  return createKinetraBundle(await portableAuthoringProject(project));
}

export function downloadJson(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
