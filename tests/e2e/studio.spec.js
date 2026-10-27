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

test("indica si las herramientas transforman capas o huesos", async ({ page }) => {
  await expect(page.locator("#tool-context-kind")).toHaveText("Esqueleto");
  await expect(page.locator("[data-tool='rotate']")).toHaveAttribute("title", /Rotar hueso o selección/);
  await switchWorkspace(page, "calibrador");
  await expect(page.locator("#tool-context-kind")).toHaveText("Capa seleccionada");
  await expect(page.locator("#tool-context-target")).not.toBeEmpty();
  await expect(page.locator("[data-tool='rotate']")).toHaveAttribute("title", /Rotar capa/);
});

test("refleja la capa seleccionada horizontal y verticalmente", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  await page.locator("#flip-part").click();
  await expect(page.locator("#status")).toContainText("volteada horizontalmente");
  await page.locator("#flip-part-y").click();
  await expect(page.locator("#status")).toContainText("volteada verticalmente");
});

test("escala una capa desde el visor y ajusta el personaje a la vista", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  await page.locator("[data-tool='scale']").click();
  const canvas = page.locator("#canvas");
  const box = await canvas.boundingBox();
  const centerX = box.x + box.width / 2 - 7;
  const centerY = box.y + box.height / 2 - 44;
  const initialScale = Number(await page.locator("#part-scale").inputValue());
  await page.mouse.move(centerX - 58, centerY - 99);
  await page.mouse.down();
  await page.mouse.move(centerX - 100, centerY - 140, { steps: 8 });
  await expect(page.locator("#transform-readout")).toBeVisible();
  await expect(page.locator("#transform-readout")).toContainText("Escala:");
  await expect(page.locator("#transform-readout")).toContainText("%");
  await page.mouse.up();
  await expect(page.locator("#transform-readout")).toBeHidden();
  expect(Number(await page.locator("#part-scale").inputValue())).toBeGreaterThan(initialScale);

  await page.locator("#fit").click();
  await expect(page.locator("#status")).toContainText("ajustado y centrado");
});

test("muestra posición y rotación junto al cursor durante el arrastre", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  const canvas = page.locator("#canvas");
  const box = await canvas.boundingBox();
  const centerX = box.x + box.width / 2 - 7;
  const centerY = box.y + box.height / 2 - 44;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 25, centerY + 15, { steps: 4 });
  await expect(page.locator("#transform-readout")).toContainText(/Posición · X: .* · Y: /);
  await page.mouse.up();

  await page.locator("[data-tool='rotate']").click();
  const movedCenterX = centerX + 25;
  const movedCenterY = centerY + 15;
  await page.mouse.move(movedCenterX - 116, movedCenterY - 90);
  await page.mouse.down();
  await page.mouse.move(movedCenterX - 85, movedCenterY - 65, { steps: 5 });
  await expect(page.locator("#transform-readout")).toContainText(/Rotación: .*°/);
  await page.mouse.up();
});

test("aplica una curva de interpolación a los cambios pendientes", async ({ page }) => {
  await page.locator(".dock-tab:visible", { hasText: "Interpolación" }).click();
  await page.locator("#preset-grid button", { hasText: "Sobrepaso" }).click();
  await expect(page.locator("#status")).toContainText("Interpolación “Sobrepaso” aplicada");
  await page.locator(".dock-tab:visible", { hasText: "Inspector" }).click();
  await expect(page.locator("#draft-status")).toContainText("cambios sin guardar");
});

test("dibuja huesos libres y encadena desde una articulación existente", async ({ page }) => {
  const treeRows = page.locator("[data-panel='skeleton'] [data-hierarchy-tree] .tree-row[data-hierarchy-id]");
  const initialCount = await treeRows.count();

  await page.locator("#add-bone").click();
  await expect(page.locator("#add-bone")).toHaveAttribute("aria-pressed", "true");
  const canvas = page.locator("#canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 45, box.y + 45);
  await page.mouse.down();
  await page.mouse.move(box.x + 145, box.y + 75, { steps: 5 });
  await page.mouse.up();
  await expect(treeRows).toHaveCount(initialCount + 2);

  await page.locator("#add-bone").click();
  const centeredBox = await canvas.boundingBox();
  const center = { x: centeredBox.x + centeredBox.width / 2, y: centeredBox.y + centeredBox.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 90, center.y + 50, { steps: 5 });
  await page.mouse.up();
  await expect(treeRows).toHaveCount(initialCount + 3);

  await page.keyboard.press("Escape");
  await expect(page.locator("#add-bone")).toHaveAttribute("aria-pressed", "false");
});

test("ajusta capas a la cuadrícula y rotaciones a intervalos de 15 grados", async ({ page }) => {
  await switchWorkspace(page, "calibrador");
  const canvas = page.locator("#canvas");
  const box = await canvas.boundingBox();
  const centerX = box.x + box.width / 2 - 7;
  const centerY = box.y + box.height / 2 - 44;

  await page.locator("#snap-grid").check();
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 27, centerY + 18, { steps: 4 });
  await page.mouse.up();
  expect(Number(await page.locator("#part-x").inputValue()) % 50).toBe(0);
  expect(Number(await page.locator("#part-y").inputValue()) % 50).toBe(0);

  await page.locator("[data-tool='rotate']").click();
  const movedCenterX = box.x + box.width / 2;
  const movedCenterY = box.y + box.height / 2;
  await page.mouse.move(movedCenterX - 116, movedCenterY - 90);
  await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(movedCenterX - 85, movedCenterY - 65, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  expect(Number(await page.locator("#part-rotation").inputValue()) % 15).toBe(0);
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
  const [firstId, secondId, targetId] = await layerRows.evaluateAll((rows) =>
    rows.slice(0, 3).map((row) => row.dataset.hierarchyId)
  );
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

test("desplaza juntas varias claves seleccionadas", async ({ page }) => {
  await page.locator("#scrub").evaluate((input) => {
    input.value = "200";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#set-key").click();
  await page.locator("#scrub").evaluate((input) => {
    input.value = "400";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#key-x").fill("12");
  await page.locator("#set-key").click();

  const markers = page.locator(".key-marker:not(.draft):not(.locked)");
  await expect(markers).not.toHaveCount(0);
  await markers.nth(0).click();
  await page
    .locator(".key-marker:not(.draft):not(.locked)")
    .nth(1)
    .click({ modifiers: ["Shift"] });
  await expect(page.locator(".key-marker.selected:not(.draft)")).toHaveCount(2);

  const before = await page
    .locator(".key-marker.selected:not(.draft)")
    .evaluateAll((items) => items.map((item) => Number.parseFloat(item.style.left)));
  const source = page.locator(".key-marker.selected:not(.draft)").first();
  const bounds = await source.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();

  const selected = page.locator(".key-marker.selected:not(.draft)");
  await expect(selected).toHaveCount(2);
  const after = await selected.evaluateAll((items) => items.map((item) => Number.parseFloat(item.style.left)));
  expect(after[0]).toBeGreaterThan(before[0]);
  expect(after[0] - before[0]).toBeCloseTo(after[1] - before[1], 5);
});

test("selecciona una columna de claves desde la regla temporal", async ({ page }) => {
  await page.locator("#scrub").evaluate((input) => {
    input.value = "250";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#set-key").click();
  await page.locator(".track-label button").nth(1).click();
  await page.locator("#set-key").click();
  await expect(page.locator("[data-key-identity$=':250']")).toHaveCount(2);

  const ruler = page.locator("#ruler");
  const bounds = await ruler.boundingBox();
  await page.mouse.click(bounds.x + bounds.width * 0.25, bounds.y + bounds.height / 2);
  await expect(page.locator("[data-key-identity$=':250'].selected")).toHaveCount(2);
});

test("muestra como referencia la clave anterior y ninguna para la primera", async ({ page }) => {
  for (const at of [200, 400]) {
    await page.locator("#scrub").evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, at);
    await page.locator("#set-key").click();
  }

  await page.locator("[data-key-identity='rig:200']").click();
  await expect(page.locator("#ghost-label")).toHaveText("Sin fotograma de referencia");
  await page.locator("[data-key-identity='rig:400']").click();
  await expect(page.locator("#ghost-label")).toHaveText("Fotograma guardado · 200 ms");
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
