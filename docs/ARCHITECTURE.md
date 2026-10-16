# Arquitectura del Studio

El Studio separa sus responsabilidades en módulos ESM sin efectos secundarios durante la importación:

- `project-model.js`: modelo de autoría, migraciones y operaciones multiclips.
- `state.js` y `commands.js`: estado observable y API única para comandos.
- `history.js`: comandos reversibles con presupuesto por memoria y recursos inmutables fuera de las entradas.
- `persistence.js`: IndexedDB, blobs, autoguardado, recuperación y estados de error.
- `project-io.js`: importación/exportación portable y exportación de emergencia.
- `canvas-renderer.js`: cálculos puros de render y calibración.
- `timeline.js`: operaciones puras de tiempo y claves.
- `panels.js` y `tutorials.js`: configuración de paneles y contenido guiado.
- `editor.js`: adaptador DOM y coordinador de interacciones.

`editor.js` supera temporalmente 800 líneas porque concentra los manejadores de puntero, accesibilidad del árbol, diálogos de duplicados e integración incremental del editor histórico. Es la única excepción: no define persistencia, modelo, historial, importación/exportación ni reglas de timeline. Mantener esos manejadores juntos evita romper gestos de arrastre durante la migración; cada nueva lógica de dominio debe implementarse en uno de los módulos anteriores y recibir pruebas unitarias.

Los módulos de dominio no consultan el DOM al importarse. `editor.js` inicia la aplicación explícitamente mediante `initialize()`.
