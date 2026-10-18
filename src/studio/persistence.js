import { migrateAuthoringProject, serializeAuthoringProject } from "./project-model.js";

export const DATABASE_NAME = "kinetra-studio";
export const DATABASE_VERSION = 1;
export const AUTOSAVE_DELAY = 700;

export function readStorageValue(storage, key, fallback = null) {
  try {
    return storage?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageValue(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageValue(storage, key) {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export class KinetraStorageError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = "KinetraStorageError";
    this.code = code;
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  /** @type {Promise<void>} */
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function openKinetraDatabase(indexedDBFactory = globalThis.indexedDB) {
  if (!indexedDBFactory) throw new KinetraStorageError("unavailable", "IndexedDB no está disponible en este navegador");
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("projects")) database.createObjectStore("projects", { keyPath: "key" });
      if (!database.objectStoreNames.contains("assets")) database.createObjectStore("assets", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dataUrlToBlob(source) {
  const response = await fetch(source);
  if (!response.ok) throw new Error("No se pudo decodificar el recurso incrustado");
  return response.blob();
}

async function assetBlob(asset) {
  if (asset.blob instanceof Blob) return asset.blob;
  if (typeof asset.src !== "string") return null;
  if (asset.src.startsWith("data:") || asset.src.startsWith("blob:")) {
    const response = await fetch(asset.src);
    if (!response.ok) throw new Error(`No se pudo leer ${asset.name || asset.id}`);
    return response.blob();
  }
  return null;
}

export async function separateProjectAssets(project) {
  const metadata = serializeAuthoringProject(project);
  const blobs = [];
  metadata.assets = await Promise.all(
    metadata.assets.map(async (asset) => {
      const blob = await assetBlob(asset);
      if (!blob) return { ...asset };
      blobs.push({ id: asset.id, blob, type: blob.type || asset.type, size: blob.size, updatedAt: Date.now() });
      const rest = { ...asset };
      delete rest.src;
      return { ...rest, type: blob.type || asset.type, size: blob.size, src: `idb:${asset.id}` };
    })
  );
  return { metadata, blobs };
}

export async function hydrateProjectAssets(metadata, loadBlob) {
  const hydrated = structuredClone(metadata);
  hydrated.assets = await Promise.all(
    (hydrated.assets || []).map(async (asset) => {
      if (!String(asset.src || "").startsWith("idb:")) return asset;
      const record = await loadBlob(asset.id);
      if (!record?.blob) throw new KinetraStorageError("missing-asset", `Falta el recurso local ${asset.id}`);
      return { ...asset, src: URL.createObjectURL(record.blob), blob: record.blob, size: record.blob.size };
    })
  );
  return migrateAuthoringProject(hydrated);
}

export async function createIndexedDbAdapter({ indexedDBFactory = globalThis.indexedDB } = {}) {
  const database = await openKinetraDatabase(indexedDBFactory);
  return {
    async save(key, project, { dirty = false } = {}) {
      const { metadata, blobs } = await separateProjectAssets(project);
      const transaction = database.transaction(["projects", "assets"], "readwrite");
      const assetStore = transaction.objectStore("assets");
      blobs.forEach((record) => assetStore.put(record));
      transaction.objectStore("projects").put({ key, updatedAt: Date.now(), dirty, project: metadata });
      await transactionDone(transaction);
    },
    async load(key) {
      const transaction = database.transaction(["projects", "assets"], "readonly");
      const record = await requestResult(transaction.objectStore("projects").get(key));
      if (!record) return null;
      const assetStore = transaction.objectStore("assets");
      const project = await hydrateProjectAssets(record.project, (id) => requestResult(assetStore.get(id)));
      await transactionDone(transaction);
      return { ...record, project };
    },
    async clearRecovery() {
      const transaction = database.transaction("projects", "readwrite");
      transaction.objectStore("projects").delete("recovery");
      await transactionDone(transaction);
    },
    close() {
      database.close();
    }
  };
}

function storageFailure(error) {
  if (error?.name === "QuotaExceededError" || error?.code === 22) {
    return new KinetraStorageError("quota", "No hay espacio suficiente para guardar el proyecto", error);
  }
  return error instanceof KinetraStorageError
    ? error
    : new KinetraStorageError("write", "No se pudo guardar el proyecto en IndexedDB", error);
}

export function createPersistenceController({ adapter, onState = (_state) => {}, delay = AUTOSAVE_DELAY }) {
  let timer = 0;
  let pendingProject = null;
  let dirty = false;

  async function write(project, { explicit = false, recovery = true } = {}) {
    clearTimeout(timer);
    timer = 0;
    pendingProject = project;
    onState({ state: "saving", dirty: true, message: explicit ? "Guardando…" : "Autoguardando…" });
    try {
      await adapter.save("current", project, { dirty: false });
      if (recovery) await adapter.save("recovery", project, { dirty: true });
      dirty = false;
      onState({ state: "saved", dirty: false, message: "Guardado" });
      return true;
    } catch (error) {
      dirty = true;
      const failure = storageFailure(error);
      onState({
        state: failure.code === "quota" ? "quota" : "error",
        dirty: true,
        message: failure.message,
        error: failure
      });
      throw failure;
    }
  }

  function schedule(project) {
    pendingProject = project;
    dirty = true;
    clearTimeout(timer);
    onState({ state: "pending", dirty: true, message: "Cambios pendientes" });
    timer = setTimeout(() => {
      write(pendingProject).catch(() => {});
    }, delay);
  }

  async function saveNow(project = pendingProject) {
    if (!project) return false;
    return write(project, { explicit: true });
  }

  async function saveRecovery(project = pendingProject) {
    if (!project) return;
    try {
      await adapter.save("recovery", project, { dirty: true });
    } catch (error) {
      onState({ state: "error", dirty: true, message: storageFailure(error).message, error });
    }
  }

  async function loadLatest() {
    const [current, recovery] = await Promise.all([adapter.load("current"), adapter.load("recovery")]);
    if (recovery?.dirty && (!current || recovery.updatedAt > current.updatedAt)) {
      onState({ state: "recovered", dirty: true, message: "Copia de recuperación restaurada" });
      return { ...recovery, recovered: true };
    }
    return current ? { ...current, recovered: false } : null;
  }

  return { schedule, saveNow, saveRecovery, loadLatest, isDirty: () => dirty };
}

export function readLegacyProject(storage, key = "kinetra:project") {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const source = target?.getItem(key);
    return source ? migrateAuthoringProject(JSON.parse(source)) : null;
  } catch {
    return null;
  }
}
