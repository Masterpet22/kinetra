import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, editor] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/editor.js", import.meta.url), "utf8")
]);

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const attribute = (tag, name) => tag.match(new RegExp(`${name}=["']([^"']+)["']`))?.[1] || null;
const genericActions = ["data-mode", "data-tool", "data-menu-command", "data-panel-float", "data-panel-close", "data-tutorial"];
const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);

assert.ok(buttons.length > 30, "La auditoría debe abarcar los controles estáticos del Studio");

for (const tag of buttons) {
  if (genericActions.some((name) => attribute(tag, name))) continue;
  const id = attribute(tag, "id");
  assert.ok(id, `Botón sin identidad ni acción genérica: ${tag}`);
  const directHandler = new RegExp(`\\$\\(["']${escape(id)}["']\\)\\.onclick\\s*=`);
  assert.match(editor, directHandler, `El botón #${id} debe tener un manejador explícito`);
}

for (const id of ["download-project", "download-clip", "new-project"]) {
  assert.match(editor, new RegExp(`id=["']${id}["']`), `Debe renderizarse el botón dinámico #${id}`);
  assert.match(editor, new RegExp(`\\$\\(["']${id}["']\\)\\.onclick\\s*=`), `El botón dinámico #${id} debe tener acción`);
}

assert.match(editor, /function updatePlaybackButtons\(/, "Los tres accesos de reproducción deben compartir estado visible");
assert.match(editor, /preview-play["']\)\.onclick\s*=\s*\(\)\s*=>\s*playing\s*\?\s*pause\(\)\s*:\s*play\(\)/);
assert.match(editor, /header-play["']\)\.onclick\s*=\s*\(\)\s*=>\s*playing\s*\?\s*pause\(\)\s*:\s*play\(\)/);
assert.match(editor, /\$\(["']play["']\)\.onclick\s*=\s*\(\)\s*=>\s*playing\s*\?\s*pause\(\)\s*:\s*play\(\)/);

console.log(`Auditoría de ${buttons.length + 3} botones de Kinetra superada.`);
