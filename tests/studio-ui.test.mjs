import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, editor, tutorials, projectIo, panels] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/editor.js", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/tutorials.js", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/project-io.js", import.meta.url), "utf8"),
  readFile(new URL("../src/studio/panels.js", import.meta.url), "utf8")
]);

for (const mode of ["animador", "calibrador", "exportar", "proyecto"]) {
  assert.match(html, new RegExp(`data-mode=["']${mode}["']`), `Debe existir el modo ${mode}`);
}
assert.doesNotMatch(html, /data-mode=["']sprites["']/, "Calibrador y Sprites deben integrarse en Ensamblaje");
for (const id of ["canvas", "preview-canvas", "inspector-panel", "timeline-scroll", "tracks"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control ${id}`);
}
assert.doesNotMatch(html, /<iframe\b/i, "El Studio unificado no debe depender de vistas embebidas");
assert.match(html, /src=["']\.\/src\/studio\/editor\.js\?v=\d+\.\d+\.\d+["']/);
assert.match(
  html,
  /navigator\.serviceWorker\s*\.getRegistrations\(\)/,
  "El Studio debe retirar cachés heredadas antes de iniciar"
);
assert.match(html, /navigator\.serviceWorker\.controller/, "Debe detectar si un trabajador antiguo controla la carga");
assert.match(
  html,
  /sessionStorage\.setItem\(reloadKey, "true"\)/,
  "La recarga de retirada debe ejecutarse una sola vez"
);
assert.match(html, /window\.location\.reload\(\)/, "Debe abandonar el contexto del trabajador retirado");
assert.doesNotMatch(html, /window\.stop\(\)/, "La limpieza del Studio no debe abortar la navegación actual");
assert.match(html, /id=["']timeline-zoom["']/, "El timeline debe tener zoom temporal independiente");
assert.match(css, /--left-dock:\s*270px/);
assert.match(css, /--right-dock:\s*310px/);
assert.match(
  css,
  /\*\s*\{[^}]*user-select:\s*none/s,
  "Los elementos de la interfaz no deben permitir seleccionar texto accidentalmente"
);
assert.ok(
  css.includes(
    'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"])'
  ),
  "Los campos de texto deben conservar texto seleccionable"
);
assert.match(
  css,
  /\[contenteditable="true"\]\s*\{\s*user-select:\s*text/,
  "El contenido editable debe permitir selección de texto"
);
assert.match(css, /data-dock-zone=["']bottom["'][^}]*grid-column:\s*1\s*\/\s*-1/s);
assert.match(
  css,
  /\.layout-divider-bottom\s*\{[^}]*bottom:\s*calc\(var\(--bottom-dock\)\s*-\s*5px\)/,
  "El separador de la línea de tiempo debe quedar alineado con el borde del panel"
);
assert.match(
  css,
  /\.tree-row:focus-within\s*\{[^}]*outline:\s*2px solid var\(--cyan\)/,
  "El indicador cian de foco debe cubrir toda la fila de la capa"
);
assert.match(
  css,
  /\.tree-row \.tree-select:focus-visible\s*\{[^}]*outline:\s*none/,
  "El control del nombre no debe limitar el indicador de foco a su propio ancho"
);
assert.match(editor, /sampleKinetraClip/);
assert.match(editor, /studio-format\.js/, "El editor debe cargar el módulo de formato");
assert.match(editor, /validateKinetraProject/);
assert.doesNotMatch(editor, /export-clip|download-clip/);
assert.match(editor, /function restoreHistory/);
assert.match(
  editor,
  /window\.history\.replaceState/,
  "El historial del editor no debe ocultar el historial del navegador"
);
assert.doesNotMatch(editor, /let history\s*=/, "El historial serializable debe tener un nombre propio");
assert.match(editor, /lockedTargets/);
assert.match(editor, /timelineZoom/);
assert.match(editor, /TRANSFORM_FIELDS/);
assert.match(editor, /spriteEvents/);
assert.match(
  editor,
  /if \(rightTab === ["']curves["']\) drawCurve\(\)/,
  "El inspector solo debe actualizar la curva cuando esa ventana está activa"
);
assert.match(
  editor,
  /if \(width <= 0 \|\| height <= 0\) return;/,
  "El lienzo de curvas debe ignorar dimensiones nulas"
);
assert.doesNotMatch(
  editor,
  /x \+= width \/ 6|y \+= height \/ 4/,
  "La cuadrícula de curvas no debe usar incrementos que puedan valer cero"
);
assert.match(
  html,
  /data-tool=["']select["'][^>]*title=["']Seleccionar y mover objetivo \(V\).*selección múltiple["']/,
  "La herramienta principal debe anunciar el desplazamiento y la selección múltiple"
);
assert.match(
  editor,
  /beginTransformInteraction\(/,
  "El Animador debe iniciar interacciones desde los controles visuales"
);
assert.match(editor, /function localDelta\(/, "El arrastre debe convertir el movimiento al espacio local del hueso");
assert.match(
  editor,
  /\$\(id\)\.oninput = previewKeyFromInspector/,
  "Los campos de transformación deben previsualizar sus cambios"
);
assert.match(
  editor,
  /\$\(id\)\.onchange = previewKeyFromInspector/,
  "Los campos deben conservar el cambio como borrador hasta guardarlo"
);
for (const id of [
  "discard-key-draft",
  "duplicate-key",
  "reset-transform",
  "mirror-pose",
  "previous-key",
  "next-key",
  "ghost-label"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control ${id}`);
}
assert.match(html, /data-tool=["']scale["']/, "El Animador debe ofrecer escalado visual");
assert.match(editor, /sampledPose:\s*ghostPose/, "La vista fantasma debe dibujar una instantánea guardada exacta");
assert.doesNotMatch(editor, /time\s*[-+]\s*step/, "La vista fantasma no debe usar tiempos interpolados aproximados");
assert.match(
  editor,
  /let draftFrames = new Map\(\)/,
  "La pose en edición debe permanecer separada del proyecto guardado"
);
assert.match(editor, /function duplicateCurrentKey\(/);
assert.match(editor, /function mirrorCurrentPose\(/);
assert.match(editor, /function resetSelectedTransform\(/);
assert.match(editor, /function hitTransformGizmo\(/, "Los controles dibujados deben tener detección de impacto");
assert.match(editor, /constrainedWorldDelta\(/, "Las flechas deben restringir el movimiento a su eje");
assert.match(
  editor,
  /collapseHierarchicalSelection\(editableTargets, rigParents\(\)\)/,
  "Una selección padre-hijo no debe acumular el desplazamiento en cada nivel"
);
assert.match(
  editor,
  /shortestAngleDelta\(interaction\.startPointerAngle, pointerAngle\)/,
  "El anillo debe rotar según el ángulo del puntero"
);
assert.match(editor, /scaleFromDrag\(/, "Las manijas deben controlar la escala");
assert.match(
  editor,
  /let selectedTargets = new Set\(\["rig"\]\)/,
  "El editor debe conservar una selección múltiple de objetivos"
);
assert.match(
  editor,
  /event\.shiftKey && tool === "select"/,
  "Mayús debe añadir o retirar articulaciones de la selección"
);
assert.match(editor, /solveTwoBoneIk\(/, "Las extremidades deben usar cinemática inversa al arrastrar manos o pies");
assert.match(
  editor,
  /solveJointRotation\(/,
  "Los codos y rodillas deben rotar desde su hueso superior sin romper la cadena"
);
assert.match(editor, /className = "tree-multi"/, "El árbol debe ofrecer un control explícito de selección múltiple");
assert.match(editor, /rename\.append\(createIcon\("pencil"\)\)/, "Cada capa debe incluir un icono para renombrarla");
assert.match(
  editor,
  /rename\.onclick = \(\) => renameLayer\(item\)/,
  "El icono de renombrar debe actuar sobre la capa correspondiente"
);
assert.match(
  editor,
  /function uniqueDuplicateName\(name, existingNames\)/,
  "Renombrar debe seguir el sufijo numérico establecido para duplicados"
);
assert.match(editor, /function renameLayer\(item\)/, "La capa debe poder renombrarse desde su icono");
assert.match(
  editor,
  /input\.className = "tree-rename-input"/,
  "El renombrado debe abrir una caja de texto en la fila del elemento"
);
assert.match(
  editor,
  /input\.onkeydown = \(event\) => \{[\s\S]*?event\.key === "Enter"[\s\S]*?event\.key === "Escape"/,
  "Enter debe confirmar y Escape cancelar el renombrado en línea"
);
assert.doesNotMatch(editor, /window\.prompt/, "El renombrado no debe abrir una ventana del navegador");
assert.match(
  editor,
  /const uniqueName = uniqueDuplicateName\(\s*name,\s*project\.parts/,
  "El renombrado debe evitar duplicar nombres de capa"
);
assert.match(
  editor,
  /asset\.name = `\$\{safePngFilename\(uniqueName\)\}\$\{extension\}`/,
  "Renombrar una capa importada debe actualizar también el nombre de su recurso"
);
for (const action of ["visibility", "lock", "copy", "paste", "delete", "clear"]) {
  assert.equal(
    (html.match(new RegExp(`data-selection-action=["']${action}["']`, "g")) || []).length,
    3,
    `Cada panel debe ofrecer la acción múltiple ${action}`
  );
}
assert.equal(
  (html.match(/data-selection-action=["'][^"']+["'][^>]*aria-label=/g) || []).length,
  18,
  "Los botones de selección solo con iconos deben conservar etiquetas accesibles"
);
assert.doesNotMatch(
  html,
  /data-selection-action=["'][^"']+["'][^>]*><i[^>]*><span>/,
  "El menú de selección debe mostrar solo iconos"
);
assert.match(
  editor,
  /menu\.hidden = selection\.length < 2/,
  "El menú múltiple debe ocultarse con cero o un elemento seleccionado"
);
assert.match(
  editor,
  /pasteHierarchySelection\(activeHierarchyKind\)/,
  "Ctrl+V debe pegar elementos copiados de la jerarquía activa"
);
assert.match(
  editor,
  /function selectHierarchyItem\(/,
  "La jerarquía debe procesar los modificadores de selección estilo Explorer"
);
assert.match(editor, /event\.ctrlKey \|\| event\.metaKey/, "Ctrl+clic debe alternar elementos individuales");
assert.match(
  editor,
  /event\.shiftKey && activeHierarchyKind && event\.key === "ArrowUp"/,
  "Mayús+Flecha arriba debe extender la selección"
);
assert.match(
  editor,
  /event\.shiftKey && activeHierarchyKind && event\.key === "ArrowDown"/,
  "Mayús+Flecha abajo debe extender la selección"
);
assert.match(
  html,
  /id=["']duplicate-dialog["']/,
  "Los conflictos de nombres deben ofrecer opciones sin aceptar una decisión por defecto"
);
assert.match(
  html,
  /id=["']duplicate-apply-all["'][^>]*type=["']checkbox["']/,
  "La decisión de un conflicto debe poder aplicarse a todos los duplicados"
);
assert.match(html, /Aplicar esta decisión a los demás\s+elementos\s+duplicados/, "La casilla debe aclarar su alcance");
for (const choice of ["replace", "keep", "cancel"]) {
  assert.match(
    html,
    new RegExp(`data-duplicate-choice=["']${choice}["']`),
    `Debe ofrecer la decisión ${choice} para nombres duplicados`
  );
}
assert.match(
  editor,
  /function resolveDuplicateNames\(/,
  "La importación y el pegado deben resolver colisiones por nombre"
);
assert.match(
  editor,
  /async function importImageLayers\(files\)[\s\S]*?await resolveDuplicateNames\(/,
  "La importación debe resolver duplicados antes de modificar el proyecto"
);
assert.match(
  editor,
  /async function pasteHierarchySelection\(kind\)[\s\S]*?await resolveDuplicateNames\(\s*kind,\s*names,\s*project\.parts/,
  "El pegado de capas debe resolver duplicados"
);
assert.match(
  editor,
  /await resolveDuplicateNames\(\s*kind,\s*names,\s*project\.rig\.bones/,
  "El pegado de articulaciones debe resolver duplicados"
);
assert.match(
  editor,
  /await resolveDuplicateNames\(\s*kind,\s*names,\s*animationTargets\(\)/,
  "El pegado de pistas debe resolver duplicados"
);
assert.match(
  editor,
  /document\.querySelectorAll\("\[data-duplicate-choice\]"\)/,
  "Las opciones del diálogo deben resolverse al elegir"
);
assert.match(
  editor,
  /for \(const incomingName of incomingNames\)[\s\S]*?await askDuplicateChoice\(kind, incomingName\)/,
  "Cada conflicto debe poder resolverse por separado"
);
assert.match(
  editor,
  /if \(response\.applyToAll\) applyChoiceToAll = choice/,
  "La casilla debe reutilizar la decisión para los conflictos restantes"
);
assert.match(
  editor,
  /const replaceNames = new Set\(\s*importedLayers[\s\S]*?removeLayerItems\(conflicts\)/,
  "Reemplazar al importar debe eliminar las capas coincidentes antes de añadir las nuevas"
);
assert.doesNotMatch(editor, /resolution\.choice\b/, "Cada elemento debe conservar su decisión individual");
assert.match(
  editor,
  /duplicateDialogResolve = null;\s*resolve\?\.\(duplicateDialogChoice\)/,
  "Cerrar el diálogo debe finalizar la operación, incluso al cancelar"
);
for (const panel of ["skeleton", "tracks", "layers", "inspector", "presets", "curves", "timeline"]) {
  assert.match(html, new RegExp(`data-panel=["']${panel}["']`), `Debe existir el panel móvil ${panel}`);
  assert.match(html, new RegExp(`data-panel-toggle=["']${panel}["']`), `El panel ${panel} debe poder activarse`);
}
for (const menu of ["Archivo", "Edición", "Ver", "Ventana", "Ayuda"]) {
  assert.match(html, new RegExp(`<summary>${menu}</summary>`), `Debe existir el menú de aplicación ${menu}`);
}
assert.match(html, /id=["']workspace-menu["']/, "Los modos de trabajo deben integrarse con los menús de aplicación");
assert.match(html, /class=["']workspace-switcher["']/, "El selector de espacio debe ocupar el centro de la barra");
assert.match(
  css,
  /\.workspace-switcher\s*\{[^}]*left:\s*50%[^}]*translate\(-50%,\s*-50%\)/s,
  "El selector debe centrarse con independencia de los menús laterales"
);
assert.match(
  css,
  /\.app-menu-bar\s*\{[^}]*gap:\s*0\b/,
  "Los menús adyacentes no deben dejar huecos al mover el cursor"
);
assert.match(
  css,
  /\.app-menu-popover\s*\{[^}]*top:\s*calc\(100% - 1px\)/s,
  "El desplegable debe solapar el borde del menú para evitar interrupciones"
);
for (const tutorial of ["animador", "calibrador", "timeline", "paneles", "exportar"]) {
  assert.match(html, new RegExp(`data-tutorial=["']${tutorial}["']`), `Debe existir el tutorial ${tutorial}`);
}
assert.match(html, /id=["']tutorial-overlay["']/, "Los tutoriales deben ejecutarse como recorridos guiados");
assert.match(html, /id=["']tutorial-dimmers["']/, "El tutorial debe separar las zonas atenuadas de los resaltados");
assert.match(
  tutorials,
  /targets:\s*\["\[data-panel='layers'\]", "\[data-panel='inspector'\]"\]/,
  "El recorrido de ensamblaje debe resaltar las dos columnas completas"
);
assert.match(
  tutorials,
  /const TUTORIALS = Object\.freeze/,
  "Los recorridos deben definir pasos enfocados en herramientas reales"
);
assert.match(editor, /function startTutorial\(/, "Ayuda debe iniciar un recorrido guiado");
assert.match(editor, /function positionTutorial\(/, "El tutorial debe resaltar el control explicado");
assert.match(editor, /function visibleTutorialRect\(/, "El resaltado debe limitarse al área visible de cada columna");
assert.match(
  editor,
  /timeline\.getBoundingClientRect\(\)\.top/,
  "El margen del resaltado no debe invadir la línea de tiempo"
);
assert.match(editor, /parent\.clientWidth/, "El recorte debe respetar el área desplazable del panel");
assert.match(editor, /function subtractSpotlight\(/, "El atenuado debe dejar visibles varias zonas sin solaparlas");
assert.match(html, /id=["']help-dialog["']/, "Ayuda debe abrir los atajos en un modal independiente");
assert.match(html, /id=["']preview-toggle["']/, "La vista previa debe poder activarse desde Ventana");
assert.match(
  css,
  /scrollbar-color:\s*var\(--line-strong\)\s+var\(--panel-2\)/,
  "Las barras de desplazamiento deben usar colores de interfaz en Firefox"
);
assert.match(
  css,
  /\*::-webkit-scrollbar-thumb:hover\s*\{\s*background:\s*var\(--blue\)/,
  "El pulgar debe resaltar con el color de acento al pasar el puntero"
);
for (const theme of ["noche", "grafito", "aurora"]) {
  assert.match(html, new RegExp(`value=["']${theme}["'][^>]*data-theme-choice`), `Debe existir el tema ${theme}`);
}
assert.match(editor, /function applyTheme\(/, "El tema elegido debe aplicarse y persistirse");
assert.match(
  editor,
  /id="cancel-export" class="small-button">Cancelar<\/button>/,
  "La vista de exportación debe ofrecer cancelar"
);
assert.match(
  editor,
  /\$\("cancel-export"\)\.onclick = \(\) => setMode\(lastEditorMode\)/,
  "Cancelar debe volver al último espacio de edición"
);
assert.match(
  editor,
  /let lastEditorMode = "animador"/,
  "La vista de exportación debe tener un destino de cancelación predeterminado"
);
assert.match(editor, /function figureBounds\(/, "La vista previa debe encuadrar los límites reales del personaje");
assert.match(
  html,
  /id=["']image-files["'][^>]*accept=["'][^"']*\.psd[^"']*["'][^>]*multiple/,
  "Debe permitirse importar varias imágenes y documentos PSD como capas"
);
assert.match(html, /data-menu-command=["']import-images["']/, "Archivo debe ofrecer importación de imágenes");
for (const id of [
  "part-name",
  "part-bone",
  "add-bone",
  "delete-bone",
  "bone-name",
  "bone-parent",
  "bone-x",
  "bone-y"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control genérico ${id}`);
}
assert.match(editor, /function importImageLayers\(/, "Las imágenes deben convertirse en recursos y capas reales");
assert.match(
  editor,
  /function cropCanvasToVisiblePixels\(/,
  "Las capas PSD deben recortarse a sus píxeles no transparentes"
);
assert.match(editor, /async function extractPsdLayers\(/, "Los PSD deben separarse por capas y convertirse a PNG");
assert.match(
  editor,
  /hiddenLayersRevealed[\s\S]*?visible: true/,
  "Las capas PSD con píxeles deben mostrarse aunque estuvieran ocultas en el documento fuente"
);
assert.match(
  editor,
  /image\.onerror[\s\S]*?No se pudo visualizar la imagen de la capa/,
  "Los fallos de decodificación de sprites deben informarse al usuario"
);
assert.match(
  editor,
  /const layerName = String\(layer\.name \|\| "capa"\)\.replace\(\/\\s\/g, "_"\)/,
  "Los espacios en blanco de nombres PSD deben convertirse en guiones bajos"
);
assert.match(
  editor,
  /name: layerName,\s*filename,\s*blob/,
  "El nombre normalizado debe aplicarse a las capas PSD importadas"
);
assert.doesNotMatch(
  editor,
  /fflate|downloadPsdLayersZip|capas-psd\.zip/,
  "La importación PSD no debe descargar un ZIP"
);
assert.match(html, /id=["']new-project-dialog["']/, "Archivo > Nuevo debe abrir el selector de plantillas");
assert.match(
  html,
  /id=["']template-grid["']/,
  "El selector debe reservar un contenedor para las plantillas disponibles"
);
assert.match(editor, /PROJECT_TEMPLATES\.forEach/, "Las tarjetas deben generarse desde el catálogo de plantillas");
assert.match(
  editor,
  /drawTemplatePreview\(canvas, template\.id\)/,
  "Las tarjetas deben ensamblar una vista previa con las piezas reales"
);
assert.doesNotMatch(html, /data-project-template=["']dog["']/, "La plantilla de perro no debe ofrecerse");
assert.match(
  editor,
  /createProjectFromTemplate\(button\.dataset\.projectTemplate\)/,
  "El selector debe crear la plantilla elegida"
);
assert.match(editor, /function layerSourceRect\(/, "El editor debe recortar las piezas compartidas de un atlas");
assert.match(
  editor,
  /exportPortableBundle\(project\)/,
  "La exportación debe incrustar también los recursos de demostración"
);
assert.match(html, /id=["']clip-select["']/, "El Studio debe permitir seleccionar el clip activo");
assert.match(html, /id=["']preview-clip-select["']/, "La vista previa debe permitir seleccionar el clip activo");
for (const id of ["clip-new", "clip-duplicate", "clip-rename", "clip-up", "clip-down", "clip-delete"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Debe existir el control multiclips ${id}`);
}
assert.match(html, /id=["']save-state["']/, "El encabezado debe mostrar el estado de persistencia");
assert.match(html, /id=["']emergency-export["']/, "Debe existir la exportación de emergencia");
assert.match(editor, /function ikChainFor\(/, "La cinemática inversa debe derivarse de cualquier rig personalizado");
assert.match(editor, /function rigTree\(/, "La jerarquía visual debe generarse desde el rig del proyecto");
assert.match(html, /id=["']group-layers["'][^>]*disabled/, "Capas debe ofrecer la creación de grupos");
assert.match(editor, /function createLayerGroup\(/, "Debe poder crearse un grupo con las capas seleccionadas");
assert.match(
  editor,
  /if \(ids\.length < 2\) return status\("Selecciona al menos dos capas para agruparlas"\)/,
  "Crear grupos requiere al menos dos capas"
);
assert.match(editor, /item\.groupId = id/, "Las capas seleccionadas deben quedar vinculadas al nuevo grupo");
assert.match(editor, /function renderLayerGroup\(/, "Los grupos deben aparecer como contenedores en el árbol de capas");
assert.match(
  editor,
  /rename\.onclick = \(\) => renameLayerGroup\(group, name\)/,
  "Renombrar un grupo debe reemplazar su nombre por el campo de edición"
);
assert.match(
  editor,
  /row\.append\(icon, name, visibility, lock, rename, ungroup, toggle\)/,
  "El control para expandir el grupo debe aparecer después de los demás botones"
);
assert.match(
  editor,
  /const allVisible = items\.every\(\(item\) => item\.visible\)/,
  "La visibilidad del grupo debe reflejar el estado de sus capas"
);
assert.match(
  editor,
  /visibility\.title = allVisible \? "Ocultar grupo" : "Mostrar grupo"/,
  "Los grupos deben ofrecer una acción contextual para mostrar u ocultar sus capas"
);
assert.match(
  editor,
  /items\.forEach\(\(item\) => \{\s*item\.visible = !allVisible;\s*\}\)/,
  "La acción de visibilidad del grupo debe actualizar todas sus capas"
);
assert.match(
  editor,
  /const allLocked = items\.every\(\(item\) => lockedParts\.has\(item\.id\)\)/,
  "El bloqueo del grupo debe reflejar el estado de sus capas"
);
assert.match(
  editor,
  /lock\.title = allLocked \? "Desbloquear grupo" : "Bloquear grupo"/,
  "Los grupos deben ofrecer una acción contextual para bloquear o desbloquear sus capas"
);
assert.match(
  editor,
  /if \(allLocked\) lockedParts\.delete\(item\.id\);\s*else lockedParts\.add\(item\.id\)/,
  "La acción de bloqueo del grupo debe actualizar todas sus capas"
);
assert.match(
  editor,
  /group\.collapsed && !search \? "chevron-right" : "chevron-down"/,
  "Los grupos deben poder contraerse y expandirse"
);
assert.match(
  editor,
  /function renderLayers\(search, host\) \{[\s\S]*?groups\.forEach[\s\S]*?renderLayerGroup\([\s\S]*?orderedItems\s*\.filter\([\s\S]*?!item\.groupId \|\| !groupIds\.has\(item\.groupId\)/,
  "Los grupos deben mostrarse antes de las capas sin agrupar"
);
assert.match(editor, /function ungroupLayers\(group\)/, "Debe ser posible desagrupar conservando las capas");
assert.match(
  editor,
  /groupButton\.disabled = selection\.length < 2/,
  "El control de agrupación debe activarse solo con varias capas"
);
assert.match(
  editor,
  /layerGroups: candidate\.layerGroups \|\| \[\]/,
  "Los grupos deben conservarse al abrir un proyecto"
);
assert.match(
  editor,
  /function keepHierarchySelectionVisible\(panel, kind\)/,
  "La selección actual debe mantenerse visible en el panel de jerarquía"
);
assert.match(
  editor,
  /if \(rowBounds\.bottom > containerBounds\.bottom\)\s*scrollContainer\.scrollTop \+= rowBounds\.bottom - containerBounds\.bottom/,
  "El desplazamiento debe seguir la selección al bajar por la lista"
);
assert.match(
  editor,
  /refreshIcons\(panel\);\s*keepHierarchySelectionVisible\(panel, kind\)/,
  "Cada actualización del árbol debe mantener visible el elemento seleccionado"
);
assert.match(projectIo, /createKinetraBundle/, "La exportación debe producir un paquete Kinetra v2 para runtimes web");
assert.match(editor, /document\.addEventListener\(["']click["']/, "Los menús deben cerrarse al hacer clic fuera");
assert.match(
  editor,
  /menu\.addEventListener\("pointerleave", \(event\) => \{[\s\S]*?menu\.removeAttribute\("open"\)/,
  "Los menús de aplicación deben cerrarse al salir con el cursor"
);
assert.match(editor, /let appMenuHoverSwitch = false/, "El cambio por hover solo se activa después de abrir un menú");
assert.match(
  editor,
  /menu\.addEventListener\("toggle", \(\) => \{[\s\S]*?if \(menu\.open\) \{\s*if \(menuBar\) appMenuHoverSwitch = true/,
  "Abrir un menú superior debe habilitar el cambio por hover"
);
assert.match(
  editor,
  /menu\.addEventListener\("pointerenter", \(\) => \{\s*if \(!appMenuHoverSwitch\) return;[\s\S]*?menu\.open = true/,
  "Al estar el menú activo, pasar sobre otro encabezado debe cambiar el menú abierto"
);
assert.match(
  editor,
  /menuBar\.contains\(event\.relatedTarget\)/,
  "Moverse entre encabezados no debe desactivar el modo de cambio por hover"
);
assert.match(
  css,
  /\.app-menu-bar \.app-menu:not\(\[open\]\) > summary\s*\{[^}]*z-index:\s*241/s,
  "Los encabezados cerrados deben poder recibir hover aunque el desplegable actual los cubra"
);
assert.match(
  css,
  /\.app-menu-popover\s*\{[^}]*top:\s*calc\(100% - 1px\)/s,
  "Los menús desplegables deben solaparse ligeramente con el encabezado para permitir el paso del cursor"
);
assert.match(html, /unpkg\.com\/lucide@1\.57\.0/, "La interfaz debe usar una versión fija de Lucide");
assert.match(editor, /window\.lucide\?\.createIcons/, "Los iconos dinámicos deben usar Lucide");
for (const kind of ["skeleton", "tracks", "layers"]) {
  assert.match(
    html,
    new RegExp(`data-hierarchy-kind=["']${kind}["']`),
    `La subventana ${kind} debe tener contenido independiente`
  );
}
assert.match(
  editor,
  /timeline-scroll["']\)\.clientWidth/,
  "La línea de tiempo debe partir del ancho realmente disponible"
);
assert.match(
  editor,
  /clientWidth\s*-\s*18/,
  "La línea de tiempo debe reservar el canal de la barra vertical y evitar scroll horizontal al 100 %"
);
assert.match(css, /\.track-line\s*\{[^}]*min-width:\s*0/s, "Las pistas deben poder contraerse al ancho disponible");
assert.match(
  editor,
  /new ResizeObserver\(\(\) => renderTimeline\(\)\)/,
  "La línea de tiempo debe reaccionar al redimensionado de su panel"
);
assert.match(
  css,
  /\.workspace\s*\{[^}]*container-type:\s*inline-size/s,
  "La barra de herramientas debe responder al espacio del lienzo"
);
assert.match(css, /\.toolbar\s*\{[^}]*flex-wrap:\s*wrap/s, "Los controles no deben quedar ocultos bajo el inspector");
assert.match(editor, /function bindPanels\(/, "Los paneles deben poder desacoplarse y moverse");
for (const zone of ["left", "right", "bottom"]) {
  assert.match(html, new RegExp(`data-dock-target=["']${zone}["']`), `Debe existir la zona de acoplamiento ${zone}`);
}
assert.match(editor, /function dockPanel\(/, "Las ventanas deben poder acoplarse a una zona");
assert.match(editor, /function renderDockTabs\(/, "Las ventanas que comparten zona deben convertirse en pestañas");
for (const zone of ["left", "right", "bottom"]) {
  assert.match(
    html,
    new RegExp(`data-layout-divider=["']${zone}["']`),
    `Debe existir un divisor redimensionable para ${zone}`
  );
}
assert.match(
  editor,
  /document\.querySelectorAll\("\[data-layout-divider\]"\)/,
  "Los divisores deben responder al arrastre del puntero"
);
assert.match(
  editor,
  /divider\.onpointermove = \(event\) => \{\s*if \(dividerDrag === zone\) resize\(event\)/,
  "El arrastre debe actualizar el tamaño del área"
);
assert.match(panels, /sizes/, "Los tamaños personalizados deben persistirse con la distribución");
assert.match(
  css,
  /\.layout-divider-left,\s*\.layout-divider-right[^}]*cursor:\s*col-resize/,
  "Los divisores verticales deben mostrar cursor de redimensionado"
);
assert.match(
  css,
  /\.layout-divider-bottom[^}]*cursor:\s*row-resize/,
  "El divisor horizontal debe mostrar cursor de redimensionado"
);
assert.match(editor, /dockTargetAt\(/, "El arrastre debe detectar zonas de acoplamiento");
assert.match(panels, /PANEL_DRAG_THRESHOLD = 8/, "Un clic accidental no debe desacoplar un panel");
assert.match(
  editor,
  /Math\.hypot\(deltaX, deltaY\) < PANEL_DRAG_THRESHOLD/,
  "El panel solo debe desacoplarse tras superar el umbral mínimo de arrastre"
);
assert.match(
  editor,
  /if \(!completed\.active\) \{\s*updateDockOverlay\(null\);\s*return;/,
  "Soltar antes del umbral debe dejar el panel acoplado"
);
assert.match(
  css,
  /\.studio-shell\s*\{[^}]*position:\s*relative/s,
  "El escritorio debe contener las ventanas flotantes"
);
assert.match(
  css,
  /\.floating-panel\s*\{[^}]*position:\s*absolute\s*!important/s,
  "Las ventanas deben moverse dentro del escritorio, no respecto al navegador"
);
assert.doesNotMatch(
  css,
  /\.floating-panel\s*\{[^}]*position:\s*fixed/s,
  "Una ventana interna no debe escapar del espacio de trabajo"
);
assert.match(css, /--timeline-h:\s*clamp\(/, "El dock inferior debe tener una altura acotada");
assert.match(editor, /PANEL_FLOAT_SIZES/, "Cada ventana debe tener un tamaño flotante apropiado");
assert.match(editor, /function undo\(\)/, "Deshacer debe incluir borradores y cambios confirmados");
assert.match(
  html,
  /id=["']canvas["'][^>]*tabindex=["']0["']/,
  "El lienzo debe recibir el foco para los atajos de teclado"
);
assert.match(
  html,
  /assets\/brand\/kinetra-logo\.png\?v=\d+\.\d+\.\d+/,
  "La cabecera debe usar el logo oficial preparado para la aplicación"
);
assert.doesNotMatch(css, /\.brand-logo\s*\{[^}]*background:/s, "El logo no debe recuperar una placa de fondo");
assert.doesNotMatch(
  html,
  /<button[^>]*>Línea de tiempo<\/button>/,
  "Un rótulo sin acción no debe anunciarse como botón"
);
assert.doesNotMatch(
  html,
  /id=["']open-curves["']/,
  "La línea de tiempo no debe duplicar el acceso directo al panel Curvas"
);
assert.doesNotMatch(html, /id=["']pause["']/, "Reproducir y detener deben compartir un solo control");
assert.doesNotMatch(html, /id=["']view["']/, "No debe mostrarse un selector con una única vista disponible");
assert.match(
  editor,
  /header-play["']\)\.onclick\s*=\s*\(\)\s*=>\s*\(?playing\s*\?\s*pause\(\)\s*:\s*play\(\)\)?/,
  "La reproducción global debe alternar reproducir y detener"
);

console.log("Pruebas de interfaz de Kinetra superadas.");
