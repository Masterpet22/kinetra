# Kinetra

Kinetra es un editor web estático para ensamblar y animar personajes 2D construidos con sprites articulados. Permite importar imágenes propias, convertirlas en capas reales, construir un esqueleto jerárquico y exportar el personaje completo a un formato portable para juegos web.

[Conoce Kinetra](https://masterpet22.github.io/kinetra/landing/) · [Abre el editor](https://masterpet22.github.io/kinetra/)

## Crear un personaje propio

1. Usa `Archivo > Nuevo` y elige Humano masculino, Humano femenino o Proyecto vacío.
2. En `Ensamblaje`, pulsa `Importar imágenes`. Cada PNG, WebP o JPEG se guarda como recurso y capa independiente. También puedes importar PSD: cada capa con píxeles visibles se convierte en una capa del proyecto y en un PNG recortado al límite de sus píxeles no transparentes, nombrado según la capa original. En los nombres extraídos del PSD, los espacios en blanco se sustituyen por `_`. No se inicia ninguna descarga.
3. Añade huesos desde la ventana `Esqueleto`. El nuevo hueso será hijo del hueso seleccionado; nombre, padre y pivote pueden cambiarse desde el Inspector.
4. Selecciona una capa, asígnala a un hueso y calibra posición, rotación, escala y orden visual.
5. Cambia a `Animador`, crea poses y guarda los fotogramas clave.
6. En `Exportar`, descarga el paquete `.kinetra.json`. Las imágenes quedan incrustadas como data URLs, por lo que el archivo no depende de la instalación del editor.

Cada proyecto puede contener varios clips. El selector del encabezado permite crear, duplicar, renombrar, ordenar y eliminar clips; la vista previa puede reproducir cualquiera de ellos y la exportación conserva la colección completa.

Para que las articulaciones deformen zonas distintas, el personaje debe estar separado en imágenes por pieza (por ejemplo, brazo, antebrazo y mano). Una ilustración plana importada como una única capa se mueve como una sola pieza; el corte automático y la deformación por malla pertenecen a una etapa posterior.

La lectura de PSD utiliza ag-psd, cargada bajo demanda desde esm.sh; el documento se procesa en el navegador.

## Plantillas incluidas

- **Humano masculino:** personaje modular con 14 imágenes independientes y un rig humanoide.
- **Humano femenino:** personaje modular con 14 imágenes independientes y un rig humanoide calibrado para su anatomía.
- **Proyecto vacío:** sin recursos, capas ni huesos, para construir una marioneta desde cero.

Las plantillas son puntos de partida normales: sus capas, pivotes, jerarquías y animaciones pueden modificarse igual que las de un proyecto importado.

## Controles de transformación

- Haz clic en una articulación para seleccionarla. Usa el botón `+ / ✓` de la jerarquía o `Mayús` + clic en el lienzo para añadir o retirar puntos de la selección.
- Arrastra el centro o las flechas para mover la selección completa; las flechas restringen el movimiento a un eje.
- Si la selección contiene una cadena completa, cada descendiente hereda una sola vez el movimiento de su ancestro; el desplazamiento no se acumula entre cadera, rodilla y tobillo.
- Al arrastrar el extremo de cualquier cadena de tres huesos, Kinetra deriva la cadena desde la jerarquía y aplica cinemática inversa.
- Al arrastrar un hueso intermedio que tiene hijos, rota su hueso superior y conserva conectada toda la extremidad.
- El anillo rota y las manijas de esquina escalan; mantén `Mayús` durante el escalado para conservar la proporción.
- `Ctrl+Z` deshace tanto un borrador sin guardar como el último cambio confirmado. `Ctrl+Y` o `Ctrl+Mayús+Z` rehace.

## Paneles

El espacio de trabajo usa un sistema modular inspirado en aplicaciones como GIMP. Jerarquía, Inspector, Vista previa y Línea de tiempo pueden ocultarse o reactivarse desde el menú `Ventana`.

- Arrastra una ventana desde el asa de su cabecera al menos 8 píxeles para desacoplarla y moverla libremente dentro del escritorio de Kinetra; un clic o un movimiento mínimo no la despega. Las ventanas quedan contenidas dentro de la aplicación y no pueden perderse fuera de la página.
- Arrastra las divisiones verticales entre paneles laterales y el lienzo, o la horizontal sobre la línea de tiempo, para cambiar el tamaño de esas áreas. Los tamaños se guardan junto con la disposición; también puedes usar las flechas del teclado cuando el divisor está enfocado.
- Suéltala sobre la zona azul izquierda, derecha o inferior para acoplarla.
- Si una zona ya contiene otra ventana, ambas se organizan como pestañas.
- El botón de acoplamiento devuelve una ventana flotante a su último borde y el botón de cierre la oculta.
- `Restablecer disposición` recupera el espacio de trabajo original.
- En Esqueleto, Pistas y Capas, usa `Ctrl` + clic para alternar elementos, `Mayús` + clic o `Mayús` + flechas para seleccionar un rango, o el control `+ / ✓` para seleccionar varios elementos. El menú de acciones aparece cuando hay más de uno; permite mostrar/ocultar, bloquear/desbloquear, copiar, pegar, eliminar y cancelar la selección. Copiar/pegar funciona con `Ctrl+C` y `Ctrl+V`.
- Al importar o pegar un elemento con un nombre duplicado, puedes reemplazar los existentes, mantener todos o cancelar. La casilla del diálogo permite aplicar la decisión a todos los elementos duplicados restantes; si no se marca, se pregunta por cada elemento. Al mantenerlos, los elementos nuevos reciben un sufijo numérico (`Brazo 2`, `Brazo 3`, etc.).
- En Capas, el icono de lápiz de cada fila abre una caja de texto en el lugar del nombre, al estilo del Explorador de archivos. Pulsa `Enter` para confirmar o `Escape` para cancelar. Si el nombre ya existe, se conserva la capa y se añade el siguiente sufijo numérico; el nombre del recurso importado también se actualiza.
- En Capas, selecciona dos o más elementos y pulsa el icono de carpeta para crear un grupo. Los grupos se pueden contraer, expandir, renombrar o deshacer sin alterar el orden de dibujo ni la apariencia del personaje; su organización se conserva al guardar y exportar el proyecto.

Cada herramienta usa un tamaño flotante apropiado y el dock inferior mantiene una altura limitada. La composición de pestañas, los acoplamientos, tamaños y posiciones internas se conservan en el navegador.

## Apariencia y ayuda

- El selector central cambia entre los espacios `Animador` y `Ensamblaje`.
- El menú `Ver` ofrece los temas Noche, Grafito y Aurora; la elección se conserva en el navegador.
- Después de abrir un menú superior con un clic, puedes pasar el cursor sobre otro encabezado para cambiar directamente a ese menú. Al salir de toda la barra, el menú se cierra y el cambio por cursor se desactiva hasta el siguiente clic.
- `Ayuda` inicia recorridos guiados que cambian al espacio correspondiente y resaltan cada control explicado. Los atajos de teclado se mantienen como referencia rápida independiente.
- La Vista previa calcula el encuadre usando los límites transformados de todos los sprites visibles para mantener al personaje completo y centrado.

## Uso

Visita la [landing de producto](https://masterpet22.github.io/kinetra/landing/), abre el [editor publicado en GitHub Pages](https://masterpet22.github.io/kinetra/) o sirve el repositorio mediante un servidor HTTP local:

```bash
npm run serve
```

La aplicación no necesita backend ni proceso de compilación.

## Desarrollo

```bash
npm ci
npm run quality
npm run build
```

`npm run quality` ejecuta ESLint, `checkJs`, pruebas unitarias, presupuestos de tamaño, Playwright en Chromium y Firefox y auditoría de accesibilidad. `npm run build` crea en `dist/` el artefacto estático de producción, sin pruebas ni configuración de desarrollo. Durante el build, las URLs del punto de entrada, CSS, imágenes iniciales y todo el grafo de módulos JavaScript reciben un identificador `versión-commit`, por lo que un despliegue nuevo no reutiliza recursos de otro commit aunque conserve el mismo número de release.

La rama `main` se verifica y publica mediante flujos separados de GitHub Actions. Los tags `v*` publican una release únicamente cuando la versión coincide y todos los controles terminan correctamente.

La versión se define una sola vez en `package.json`. Para preparar una nueva versión usa `npm version patch`, `npm version minor` o `npm version major`; el script de ciclo de vida sincroniza automáticamente las referencias de caché del HTML, los módulos y las pruebas. También puedes ejecutar `npm run version:check` para verificar que no existan referencias desactualizadas.

Consulta [CHANGELOG.md](./CHANGELOG.md) para conocer los cambios publicados y [roadmap.md](./roadmap.md) para revisar las siguientes fases del proyecto.

## Licencia

Kinetra se distribuye bajo la [licencia MIT](./LICENSE).

## Compatibilidad de proyectos

Kinetra importa y exporta paquetes `kinetra/v2`. El paquete autocontenido incluye rig, capas, imágenes y clips de animación.

El trabajo local se guarda en IndexedDB: los metadatos quedan separados de las imágenes, almacenadas como `Blob`. El Studio informa cambios pendientes, guardado, recuperación y falta de cuota; si el almacenamiento falla, habilita una exportación de emergencia. Consulta [los límites del formato](./docs/LIMITS.md) y el [JSON Schema](./docs/kinetra-v2.schema.json).

## Runtime para juegos web

El módulo `src/animations/kinetra-runtime.js` no depende del DOM. Valida el paquete, interpola la animación y devuelve una matriz afín por capa, utilizable con Canvas 2D, PixiJS o Phaser:

```js
import { resolveKinetraFrame, validateKinetraProject } from "./src/animations/kinetra-runtime.js";

const character = await fetch("./personaje.kinetra.json").then((response) => response.json());
const errors = validateKinetraProject(character);
if (errors.length) throw new Error(errors.join("\n"));

const frame = resolveKinetraFrame(character, "saludo", performance.now());
for (const layer of frame.layers) {
  const image = images.get(layer.assetId);
  const crop = layer.crop ?? { x: 0, y: 0, width: image.width, height: image.height };
  const [a, b, c, d, e, f] = layer.matrix;
  context.setTransform(a, b, c, d, e, f);
  context.globalAlpha = layer.opacity;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -crop.width / 2,
    -crop.height / 2,
    crop.width,
    crop.height
  );
}
```

`frame.layers[n].asset` contiene los metadatos y el `src` incrustado del recurso correspondiente. Cuando varias piezas comparten un atlas, `frame.layers[n].crop` indica el rectángulo fuente. El motor del juego decide cómo precargar y centrar cada textura.

## Estructura

- `index.html`: entrada de la aplicación.
- `styles.css`: interfaz del editor.
- `src/studio/editor.js`: adaptador DOM y coordinador de interacciones.
- `src/studio/project-model.js`, `state.js`, `commands.js` e `history.js`: modelo de autoría y cambios reversibles.
- `src/studio/persistence.js` y `project-io.js`: IndexedDB, recuperación e importación/exportación.
- `src/studio/canvas-renderer.js`, `timeline.js`, `panels.js` y `tutorials.js`: módulos de interfaz sin efectos secundarios al importarse.
- `src/animations/kinetra-runtime.js`: runtime portable y contrato `kinetra/v2`.
- `src/animations/`: formatos de animación, runtime y validación de Kinetra v2.
- `assets/modular/man_sprites/runtime/`: sprites de demostración.
- `tests/`: pruebas del contrato y de la interfaz.

La distribución completa se describe en [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
