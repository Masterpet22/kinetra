import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, editor] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/editor.js", import.meta.url), "utf8")
]);

for (const mode of ["animador", "calibrador", "sprites", "exportar", "proyecto"]) {
  assert.match(html, new RegExp(`data-mode=["']${mode}["']`), `Debe existir el modo ${mode}`);
}
for (const id of ["canvas", "preview-canvas", "tree", "inspector-panel", "timeline-scroll", "tracks"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control ${id}`);
}
assert.doesNotMatch(html, /<iframe\b/i, "El Studio unificado no debe depender de vistas embebidas");
assert.match(html, /src=["']\.\/src\/studio\/editor\.js\?v=0\.1\.0["']/);
assert.match(html, /navigator\.serviceWorker\.getRegistrations\(\)/, "El Studio debe retirar cachés heredadas antes de iniciar");
assert.doesNotMatch(html, /window\.stop\(\)/, "La limpieza del Studio no debe abortar la navegación actual");
assert.match(html, /id=["']timeline-zoom["']/, "El timeline debe tener zoom temporal independiente");
assert.match(css, /grid-template-columns:\s*270px\s+minmax\(480px,\s*1fr\)\s+310px/);
assert.match(css, /\.timeline\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
assert.match(editor, /sampleStudioAnimation/);
assert.match(editor, /studio-format\.js\?v=0\.1\.0/, "Los módulos internos deben invalidar la caché junto con el editor");
assert.match(editor, /validateStudioProject/);
assert.match(editor, /mode:\s*["']game["']/);
assert.match(editor, /function restoreHistory/);
assert.match(editor, /window\.history\.replaceState/, "El historial del editor no debe ocultar el historial del navegador");
assert.doesNotMatch(editor, /let history\s*=/, "El historial serializable debe tener un nombre propio");
assert.match(editor, /lockedTargets/);
assert.match(editor, /timelineZoom/);
assert.match(editor, /TRANSFORM_FIELDS/);
assert.match(editor, /spriteEvents/);
assert.match(editor, /if \(rightTab === ["']curves["']\) drawCurve\(\)/, "El inspector no debe dibujar una curva en una pestaña oculta");
assert.match(editor, /if \(width <= 0 \|\| height <= 0\) return;/, "El lienzo de curvas debe ignorar dimensiones nulas");
assert.doesNotMatch(editor, /x \+= width \/ 6|y \+= height \/ 4/, "La cuadrícula de curvas no debe usar incrementos que puedan valer cero");
assert.match(html, /data-tool=["']select["'][^>]*title=["']Seleccionar y mover objetivo \(V\)["']/, "La herramienta principal debe anunciar el desplazamiento de objetivos");
assert.match(editor, /interaction = \{\s*type: ["']translate["']/, "El Animador debe iniciar el arrastre de posición");
assert.match(editor, /function localDelta\(/, "El arrastre debe convertir el movimiento al espacio local del hueso");
assert.match(editor, /\$\(id\)\.oninput = previewKeyFromInspector/, "Los campos de transformación deben previsualizar sus cambios");
assert.match(editor, /\$\(id\)\.onchange = previewKeyFromInspector/, "Los campos deben conservar el cambio como borrador hasta guardarlo");
for (const id of ["discard-key-draft", "duplicate-key", "reset-transform", "mirror-pose", "previous-key", "next-key", "ghost-label"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control ${id}`);
}
assert.match(html, /data-tool=["']scale["']/, "El Animador debe ofrecer escalado visual");
assert.match(editor, /sampledPose:\s*ghostPose/, "La vista fantasma debe dibujar una instantánea guardada exacta");
assert.doesNotMatch(editor, /time\s*[-+]\s*step/, "La vista fantasma no debe usar tiempos interpolados aproximados");
assert.match(editor, /let draftFrames = new Map\(\)/, "La pose en edición debe permanecer separada del proyecto guardado");
assert.match(editor, /function duplicateCurrentKey\(/);
assert.match(editor, /function mirrorCurrentPose\(/);
assert.match(editor, /function resetSelectedTransform\(/);

console.log("Pruebas de interfaz de Kinetra superadas.");
