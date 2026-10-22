import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X1E5WQAAAABJRU5ErkJggg==",
  "base64"
);

async function switchWorkspace(page, mode) {
  await page.locator("#workspace-menu > summary").click();
  await page.locator(`#workspace-menu [data-mode='${mode}']`).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#canvas")).toBeVisible();
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase("kinetra-studio");
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = resolve;
    });
  });
  await page.reload();
  await expect(page.locator("#clip-select option")).toHaveCount(1);
});

test("crea, duplica, persiste, exporta y reimporta un proyecto multiclips", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Caminar"));
  await page.locator("#clip-new").click();
  await expect(page.locator("#clip-select option")).toHaveCount(2);
  await page.locator("#clip-duplicate").click();
  await expect(page.locator("#clip-select option")).toHaveCount(3);

  await switchWorkspace(page, "calibrador");
  await page.locator("#image-files").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: tinyPng });
  await expect(page.locator("[data-panel='layers'] .tree-row", { hasText: "pixel" })).toHaveCount(1);

  await page.locator(".dock-tab:visible", { hasText: "Esqueleto" }).click();
  await page.locator("[data-panel='skeleton'] .tree-row", { hasText: "Cuello" }).click();
  await page.locator("#bone-x").fill("12");
  await page.locator("#bone-x").press("Tab");
  await switchWorkspace(page, "animador");
  await page.locator("#key-angle").fill("15");
  await page.locator("#set-key").click();
  await page.locator("#save-local").click();
  await expect(page.locator("#save-state")).toContainText("Guardado");

  await page.reload();
  await expect(page.locator("#clip-select option")).toHaveCount(3);
  const downloadPromise = page.waitForEvent("download");
  await page.locator(".app-menu-bar .app-menu").first().locator("summary").click();
  await page.locator("[data-menu-command='export-project']").click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.locator("#file").setInputFiles(path);
  await expect(page.locator("#clip-select option")).toHaveCount(3);
});

test("deshacer/rehacer y controles de clips no pierden el estado", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  await page.locator("#part-x").fill("25");
  await page.locator("#part-x").press("Tab");
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await expect(page.locator("#part-x")).toHaveValue("25");
  await page.screenshot({ path: test.info().outputPath("studio-desktop.png"), fullPage: true });
});

test("reordena como un bloque las capas seleccionadas y muestra el punto de inserción", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  const layerRows = page.locator("[data-panel='layers'] [data-hierarchy-tree] .tree-row[data-hierarchy-id]");
  const initialOrder = await layerRows.evaluateAll((rows) => rows.map((row) => row.dataset.hierarchyId));
  const [firstId, secondId, , , targetId, nextId] = initialOrder;

  await page.locator(`[data-panel='layers'] [data-hierarchy-id='${firstId}'] .tree-select`).click();
  await page
    .locator(`[data-panel='layers'] [data-hierarchy-id='${secondId}'] .tree-select`)
    .click({ modifiers: ["Control"] });

  const source = page.locator(`[data-panel='layers'] [data-hierarchy-id='${firstId}']`);
  const tree = page.locator("[data-panel='layers'] [data-hierarchy-tree]");
  const sourceBounds = await source.boundingBox();
  const nextBounds = await tree.locator(`[data-hierarchy-id='${nextId}']`).boundingBox();
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2 + 8);
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, nextBounds.y + 1, {
    steps: 8
  });
  await expect(tree.locator(".layer-drop-before, .layer-drop-after")).toHaveCount(1);
  await page.mouse.up();

  const finalOrder = await layerRows.evaluateAll((rows) => rows.map((row) => row.dataset.hierarchyId));
  expect(finalOrder.slice(0, 5)).toEqual([initialOrder[2], initialOrder[3], targetId, firstId, secondId]);
});

test("agrupa las capas seleccionadas al soltarlas sobre otra capa", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  const tree = page.locator("[data-panel='layers'] [data-hierarchy-tree]");
  const layerRows = tree.locator(".tree-row[data-hierarchy-id]");
  const [firstId, secondId, targetId] = await layerRows
    .evaluateAll((rows) => rows.slice(0, 3).map((row) => row.dataset.hierarchyId));
  await tree.locator(`[data-hierarchy-id='${firstId}'] .tree-select`).click();
  await tree.locator(`[data-hierarchy-id='${secondId}'] .tree-select`).click({ modifiers: ["Control"] });

  const sourceBounds = await tree.locator(`[data-hierarchy-id='${firstId}']`).boundingBox();
  const targetBounds = await tree.locator(`[data-hierarchy-id='${targetId}']`).boundingBox();
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2 + 8);
  await page.mouse.move(targetBounds.x + targetBounds.width / 2, targetBounds.y + targetBounds.height / 2, {
    steps: 8
  });
  const adjustedTargetBounds = await tree.locator(`[data-hierarchy-id='${targetId}']`).boundingBox();
  await page.mouse.move(
    adjustedTargetBounds.x + adjustedTargetBounds.width / 2,
    adjustedTargetBounds.y + adjustedTargetBounds.height / 2
  );
  await expect(tree.locator(`[data-hierarchy-id='${targetId}']`)).toHaveClass(/layer-group-target/);
  await page.mouse.up();

  await expect(tree.locator(".tree-group-row")).toHaveCount(1);
  await expect(tree.locator(".tree-layer-in-group")).toHaveCount(3);
});

test("inicia aunque el navegador rechace las preferencias locales", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Access denied", "SecurityError");
    };
  });
  await page.reload();
  await expect(page.locator("#save-state")).not.toHaveText("Error de inicio");
  await expect(page.locator("[data-panel='layers'] .tree-row")).toHaveCount(14);
});

test("aísla copias incompatibles de IndexedDB y arranca con un proyecto limpio", async ({ page }) => {
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kinetra-studio", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("projects", "readwrite");
    const damaged = { clips: [], rig: null, parts: "incompatible", assets: [] };
    transaction.objectStore("projects").put({ key: "current", updatedAt: 2, dirty: false, project: damaged });
    transaction.objectStore("projects").put({ key: "recovery", updatedAt: 3, dirty: true, project: damaged });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(page.locator("#save-state")).toHaveText("Proyecto local incompatible aislado; se inició uno nuevo");
  await expect(page.locator("[data-panel='layers'] .tree-row")).toHaveCount(14);
  const quarantineCount = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("kinetra-studio", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("quarantine", "readonly");
    const count = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("quarantine").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return count;
  });
  expect(quarantineCount).toBe(2);
});

test("no contiene infracciones críticas de accesibilidad", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);
});
