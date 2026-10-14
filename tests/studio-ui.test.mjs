import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, editor] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/editor.js", import.meta.url), "utf8")
]);

for (const mode of ["animador", "calibrador", "exportar", "proyecto"]) {
  assert.match(html, new RegExp(`data-mode=["']${mode}["']`), `Debe existir el modo ${mode}`);
}
assert.doesNotMatch(html, /data-mode=["']sprites["']/, "Calibrador y Sprites deben integrarse en Ensamblaje");
for (const id of ["canvas", "preview-canvas", "inspector-panel", "timeline-scroll", "tracks"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control ${id}`);
}
assert.doesNotMatch(html, /<iframe\b/i, "El Studio unificado no debe depender de vistas embebidas");
assert.match(html, /src=["']\.\/src\/studio\/editor\.js\?v=0\.9\.0["']/);
assert.match(html, /navigator\.serviceWorker\.getRegistrations\(\)/, "El Studio debe retirar cachés heredadas antes de iniciar");
assert.doesNotMatch(html, /window\.stop\(\)/, "La limpieza del Studio no debe abortar la navegación actual");
assert.match(html, /id=["']timeline-zoom["']/, "El timeline debe tener zoom temporal independiente");
assert.match(css, /--left-dock:\s*270px/);
assert.match(css, /--right-dock:\s*310px/);
assert.match(css, /data-dock-zone=["']bottom["'][^}]*grid-column:\s*1\s*\/\s*-1/s);
assert.match(editor, /sampleStudioAnimation/);
assert.match(editor, /studio-format\.js\?v=0\.9\.0/, "Los módulos internos deben invalidar la caché junto con el editor");
assert.match(editor, /validateStudioProject/);
assert.match(editor, /mode:\s*["']game["']/);
assert.match(editor, /function restoreHistory/);
assert.match(editor, /window\.history\.replaceState/, "El historial del editor no debe ocultar el historial del navegador");
assert.doesNotMatch(editor, /let history\s*=/, "El historial serializable debe tener un nombre propio");
assert.match(editor, /lockedTargets/);
assert.match(editor, /timelineZoom/);
assert.match(editor, /TRANSFORM_FIELDS/);
assert.match(editor, /spriteEvents/);
assert.match(editor, /if \(rightTab === ["']curves["']\) drawCurve\(\)/, "El inspector solo debe actualizar la curva cuando esa ventana está activa");
assert.match(editor, /if \(width <= 0 \|\| height <= 0\) return;/, "El lienzo de curvas debe ignorar dimensiones nulas");
assert.doesNotMatch(editor, /x \+= width \/ 6|y \+= height \/ 4/, "La cuadrícula de curvas no debe usar incrementos que puedan valer cero");
assert.match(html, /data-tool=["']select["'][^>]*title=["']Seleccionar y mover objetivo \(V\).*selección múltiple["']/, "La herramienta principal debe anunciar el desplazamiento y la selección múltiple");
assert.match(editor, /beginTransformInteraction\(/, "El Animador debe iniciar interacciones desde los controles visuales");
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
assert.match(editor, /function hitTransformGizmo\(/, "Los controles dibujados deben tener detección de impacto");
assert.match(editor, /constrainedWorldDelta\(/, "Las flechas deben restringir el movimiento a su eje");
assert.match(editor, /collapseHierarchicalSelection\(editableTargets, PARENTS\)/, "Una selección padre-hijo no debe acumular el desplazamiento en cada nivel");
assert.match(editor, /shortestAngleDelta\(interaction\.startPointerAngle, pointerAngle\)/, "El anillo debe rotar según el ángulo del puntero");
assert.match(editor, /scaleFromDrag\(/, "Las manijas deben controlar la escala");
assert.match(editor, /let selectedTargets = new Set\(\["rig"\]\)/, "El editor debe conservar una selección múltiple de objetivos");
assert.match(editor, /event\.shiftKey && tool === "select"/, "Mayús debe añadir o retirar articulaciones de la selección");
assert.match(editor, /solveTwoBoneIk\(/, "Las extremidades deben usar cinemática inversa al arrastrar manos o pies");
assert.match(editor, /solveJointRotation\(/, "Los codos y rodillas deben rotar desde su hueso superior sin romper la cadena");
assert.match(editor, /className = "tree-multi"/, "El árbol debe ofrecer un control explícito de selección múltiple");
for (const panel of ["skeleton", "tracks", "layers", "inspector", "presets", "curves", "timeline"]) {
  assert.match(html, new RegExp(`data-panel=["']${panel}["']`), `Debe existir el panel móvil ${panel}`);
  assert.match(html, new RegExp(`data-panel-toggle=["']${panel}["']`), `El panel ${panel} debe poder activarse`);
}
for (const menu of ["Archivo", "Edición", "Ver", "Ventana", "Ayuda"]) {
  assert.match(html, new RegExp(`<summary>${menu}</summary>`), `Debe existir el menú de aplicación ${menu}`);
}
assert.match(html, /id=["']workspace-menu["']/, "Los modos de trabajo deben integrarse con los menús de aplicación");
assert.match(html, /class=["']workspace-switcher["']/, "El selector de espacio debe ocupar el centro de la barra");
assert.match(css, /\.workspace-switcher\s*\{[^}]*left:\s*50%[^}]*translate\(-50%,\s*-50%\)/s, "El selector debe centrarse con independencia de los menús laterales");
for (const tutorial of ["animador", "calibrador", "timeline", "paneles", "exportar"]) {
  assert.match(html, new RegExp(`data-tutorial=["']${tutorial}["']`), `Debe existir el tutorial ${tutorial}`);
}
assert.match(html, /id=["']tutorial-overlay["']/, "Los tutoriales deben ejecutarse como recorridos guiados");
assert.match(editor, /const TUTORIALS = Object\.freeze/, "Los recorridos deben definir pasos enfocados en herramientas reales");
assert.match(editor, /function startTutorial\(/, "Ayuda debe iniciar un recorrido guiado");
assert.match(editor, /function positionTutorial\(/, "El tutorial debe resaltar el control explicado");
assert.match(html, /id=["']help-dialog["']/, "Ayuda debe abrir los atajos en un modal independiente");
assert.match(html, /id=["']preview-toggle["']/, "La vista previa debe poder activarse desde Ventana");
for (const theme of ["noche", "grafito", "aurora"]) {
  assert.match(html, new RegExp(`value=["']${theme}["'][^>]*data-theme-choice`), `Debe existir el tema ${theme}`);
}
assert.match(editor, /function applyTheme\(/, "El tema elegido debe aplicarse y persistirse");
assert.match(editor, /function figureBounds\(/, "La vista previa debe encuadrar los límites reales del personaje");
assert.match(editor, /document\.addEventListener\(["']click["']/, "Los menús deben cerrarse al hacer clic fuera");
assert.match(html, /unpkg\.com\/lucide@1\.57\.0/, "La interfaz debe usar una versión fija de Lucide");
assert.match(editor, /window\.lucide\?\.createIcons/, "Los iconos dinámicos deben usar Lucide");
for (const kind of ["skeleton", "tracks", "layers"]) {
  assert.match(html, new RegExp(`data-hierarchy-kind=["']${kind}["']`), `La subventana ${kind} debe tener contenido independiente`);
}
assert.match(editor, /timeline-scroll["']\)\.clientWidth/, "La línea de tiempo debe partir del ancho realmente disponible");
assert.match(editor, /clientWidth\s*-\s*18/, "La línea de tiempo debe reservar el canal de la barra vertical y evitar scroll horizontal al 100 %");
assert.match(css, /\.track-line\s*\{[^}]*min-width:\s*0/s, "Las pistas deben poder contraerse al ancho disponible");
assert.match(editor, /new ResizeObserver\(\(\) => renderTimeline\(\)\)/, "La línea de tiempo debe reaccionar al redimensionado de su panel");
assert.match(css, /\.workspace\s*\{[^}]*container-type:\s*inline-size/s, "La barra de herramientas debe responder al espacio del lienzo");
assert.match(css, /\.toolbar\s*\{[^}]*flex-wrap:\s*wrap/s, "Los controles no deben quedar ocultos bajo el inspector");
assert.match(editor, /function bindPanels\(/, "Los paneles deben poder desacoplarse y moverse");
for (const zone of ["left", "right", "bottom"]) {
  assert.match(html, new RegExp(`data-dock-target=["']${zone}["']`), `Debe existir la zona de acoplamiento ${zone}`);
}
assert.match(editor, /function dockPanel\(/, "Las ventanas deben poder acoplarse a una zona");
assert.match(editor, /function renderDockTabs\(/, "Las ventanas que comparten zona deben convertirse en pestañas");
assert.match(editor, /dockTargetAt\(/, "El arrastre debe detectar zonas de acoplamiento");
assert.match(css, /\.studio-shell\s*\{[^}]*position:\s*relative/s, "El escritorio debe contener las ventanas flotantes");
assert.match(css, /\.floating-panel\s*\{[^}]*position:\s*absolute\s*!important/s, "Las ventanas deben moverse dentro del escritorio, no respecto al navegador");
assert.doesNotMatch(css, /\.floating-panel\s*\{[^}]*position:\s*fixed/s, "Una ventana interna no debe escapar del espacio de trabajo");
assert.match(css, /--timeline-h:\s*clamp\(/, "El dock inferior debe tener una altura acotada");
assert.match(editor, /PANEL_FLOAT_SIZES/, "Cada ventana debe tener un tamaño flotante apropiado");
assert.match(editor, /function undo\(\)/, "Deshacer debe incluir borradores y cambios confirmados");
assert.match(html, /id=["']canvas["'][^>]*tabindex=["']0["']/, "El lienzo debe recibir el foco para los atajos de teclado");
assert.match(html, /assets\/brand\/kinetra-logo\.png\?v=0\.9\.0/, "La cabecera debe usar el logo oficial preparado para la aplicación");
assert.doesNotMatch(css, /\.brand-logo\s*\{[^}]*background:/s, "El logo no debe recuperar una placa de fondo");
assert.doesNotMatch(html, /<button[^>]*>Línea de tiempo<\/button>/, "Un rótulo sin acción no debe anunciarse como botón");
assert.doesNotMatch(html, /id=["']open-curves["']/, "La línea de tiempo no debe duplicar el acceso directo al panel Curvas");
assert.doesNotMatch(html, /id=["']pause["']/, "Reproducir y detener deben compartir un solo control");
assert.doesNotMatch(html, /id=["']view["']/, "No debe mostrarse un selector con una única vista disponible");
assert.match(editor, /header-play["']\)\.onclick\s*=\s*\(\)\s*=>\s*playing\s*\?\s*pause\(\)\s*:\s*play\(\)/, "La reproducción global debe alternar reproducir y detener");

console.log("Pruebas de interfaz de Kinetra superadas.");
