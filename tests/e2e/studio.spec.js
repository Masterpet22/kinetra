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

test("no contiene infracciones críticas de accesibilidad", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);
});
