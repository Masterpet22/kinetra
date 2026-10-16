# Roadmap de Kinetra

Este roadmap parte de `v0.11.0`, la primera línea base pública etiquetada. El orden prioriza la integridad de los proyectos y la confianza técnica antes de ampliar el conjunto de herramientas.

Las fechas son objetivos orientativos, no compromisos. Una fase se considera terminada únicamente cuando cumple sus criterios de aceptación y dispone de pruebas y documentación.

## Principios de producto

- **No perder trabajo:** abrir, guardar, deshacer, recuperar y exportar deben preservar toda la información del proyecto.
- **Formato portable:** `kinetra/v2` debe poder consumirse fuera del editor sin depender de su interfaz.
- **Interacción predecible:** cada herramienta debe ofrecer estado visible, historial coherente y controles accesibles.
- **Evolución compatible:** los cambios de esquema deben incluir validación, migración y documentación.
- **Rendimiento medible:** las decisiones sobre recursos, renderizado e historial deben verificarse con proyectos reales y límites explícitos.

## Fase 0 — Línea base pública `v0.11.0` · Completada

### Objetivo

Establecer una versión reproducible y documentada del editor funcional actual.

### Entregables

- Editor estático publicado en GitHub Pages.
- Formato `kinetra/v2` y runtime portable.
- Plantillas humana masculina, humana femenina, perro y proyecto vacío.
- Importación de imágenes y PSD, rigs personalizados, IK, timeline y exportación portable.
- Suite automatizada de formato, runtime, matemáticas e interfaz.
- Licencia MIT, changelog, roadmap, tag Git y release de GitHub.
- Versión sincronizada automáticamente desde `package.json`.

### Criterio de salida

- `npm test` termina correctamente.
- La rama `main` se publica mediante GitHub Actions.
- El tag `v0.11.0` identifica exactamente la línea base publicada.

## Fase 1 — Integridad de datos y recuperación · Completada en `v0.13.0`

### Objetivo

Eliminar los riesgos de pérdida silenciosa de animaciones y de agotamiento de almacenamiento o memoria.

### Entregables

1. **Proyectos con múltiples clips**
   - Modelo de autoría con una colección de clips y un clip activo.
   - Crear, duplicar, renombrar, ordenar y eliminar clips.
   - Importar y reexportar todos los clips sin descartarlos.
   - Selector de animación en el Studio y en la vista previa.

2. **Persistencia escalable**
   - Metadatos del proyecto separados de los recursos binarios.
   - Imágenes almacenadas en IndexedDB mediante `Blob`, sin duplicarlas como data URLs en cada guardado.
   - Indicador visible de guardado, error, espacio insuficiente y cambios pendientes.
   - Guardado automático con espera breve y guardado explícito inmediato.

3. **Historial eficiente**
   - Historial basado en comandos o parches reversibles.
   - Los recursos inmutables no se duplican en cada entrada de deshacer.
   - Límite configurable por memoria o peso, no sólo por cantidad de operaciones.

4. **Recuperación y migración**
   - Copia de recuperación ante cierre inesperado.
   - Migrador explícito desde la estructura de autoría actual.
   - Exportación de emergencia disponible aunque falle la persistencia local.

5. **Validación del proyecto**
   - JSON Schema publicado para `kinetra/v2`.
   - Límites de capas, huesos, clips, fotogramas, dimensiones y peso documentados.
   - Validación de MIME, data URLs, rectángulos de atlas y referencias cruzadas.

### Criterios de aceptación

- Un paquete con al menos cinco clips puede abrirse y reexportarse sin diferencias estructurales no justificadas.
- Un proyecto con 24 MB de imágenes puede guardarse, cerrarse y recuperarse sin depender del límite de `localStorage`.
- Cien transformaciones consecutivas no multiplican el peso de las imágenes dentro del historial.
- Las migraciones y escenarios de cuota insuficiente tienen pruebas automatizadas.

### Evidencia de entrega

- `tests/phase1.test.mjs` verifica cinco clips, migración, cuota insuficiente, recuperación real de un `Blob` de 24 MiB y cien transformaciones bajo presupuesto.
- `docs/kinetra-v2.schema.json` y `docs/LIMITS.md` publican el contrato y sus límites.
- El Studio muestra el estado de persistencia y mantiene disponible una exportación de emergencia.

## Fase 2 — Arquitectura, calidad y automatización · Completada en `v0.13.0`

### Objetivo

Reducir el riesgo de cambios en el Studio y convertir los flujos principales en comportamiento verificable de navegador.

### Entregables

1. **Modularización del editor**
   - Separar estado y selectores, comandos e historial, persistencia, importación/exportación, render Canvas, timeline, paneles y tutoriales.
   - Definir una única API de comandos para las mutaciones del proyecto.
   - Eliminar dependencias circulares y efectos secundarios durante la importación de módulos.

2. **Pruebas de extremo a extremo**
   - Playwright para crear un proyecto, importar recursos, editar el rig, crear claves, recargar, exportar y reimportar.
   - Pruebas de regresión para múltiples clips, duplicados, grupos y deshacer/rehacer.
   - Capturas visuales de los espacios principales en tamaños de escritorio soportados.

3. **Controles de calidad**
   - ESLint y formateo automático.
   - Comprobación de tipos mediante TypeScript o JavaScript con JSDoc y `checkJs`.
   - Auditoría automatizada de accesibilidad con axe-core.
   - Presupuesto de tamaño para JavaScript, CSS y recursos iniciales.

4. **CI y releases**
   - Flujo separado de verificación y despliegue.
   - Artefacto de producción que excluya pruebas y archivos de desarrollo.
   - Release automática desde tags `v*`, con notas derivadas del changelog.
   - Verificación de que la versión del paquete, recursos y tag coinciden.

### Criterios de aceptación

- Ningún módulo de interfaz supera aproximadamente 800 líneas sin una justificación documentada.
- Los flujos críticos se ejecutan en Chromium y Firefox dentro de CI.
- Un cambio no puede publicarse si falla lint, tipos, unidad, E2E o accesibilidad crítica.
- La creación de una release requiere únicamente actualizar el changelog y ejecutar `npm version`.

### Evidencia de entrega

- `docs/ARCHITECTURE.md` delimita los módulos y documenta la única excepción temporal al objetivo de 800 líneas.
- `tests/e2e/studio.spec.js` ejecuta los flujos críticos y axe-core en Chromium y Firefox.
- `npm run quality` agrupa lint, tipos, unidad, límites y E2E; los mismos controles bloquean despliegue y release en GitHub Actions.
- `npm run build` genera `dist/` sin pruebas ni configuración de desarrollo, y los tags `v*` crean una release con notas extraídas de este changelog.

## Fase 3 — Experiencia de escritorio y adaptación · Objetivo `v0.14.0`

### Objetivo

Hacer explícitos los tamaños soportados y mantener accesibles las herramientas en ventanas estrechas.

### Entregables

- Definición y documentación del viewport mínimo soportado.
- Modo compacto con paneles laterales convertidos en cajones o pestañas cuando no caben tres columnas.
- Línea de tiempo usable sin ocultar el inspector o el lienzo.
- Restauración segura de disposiciones guardadas después de cambios de tamaño o versión.
- Navegación completa por teclado para menús, jerarquías, timeline y diálogos.
- Indicadores consistentes de foco, selección, bloqueo, borrador y guardado.
- Preferencias para movimiento reducido y contraste revisado en los tres temas.

### Criterios de aceptación

- Todos los controles esenciales permanecen accesibles a 820 × 720 y 1366 × 768.
- No existen paneles activos completamente fuera del viewport.
- Las tareas básicas pueden completarse sin ratón, salvo la manipulación directa del canvas.
- Las auditorías WCAG 2.2 AA no registran errores críticos en las vistas principales.

## Fase 4 — Pipeline profesional de recursos · Objetivo `v0.15.0`

### Objetivo

Permitir proyectos más grandes sin bloquear la interfaz ni producir paquetes innecesariamente pesados.

### Entregables

- Procesamiento de PSD en Web Worker con progreso y cancelación.
- Previsualización de capas antes de confirmar una importación.
- Compresión y conversión opcional de imágenes a WebP o PNG optimizado.
- Generación y edición de atlas con deduplicación de recursos.
- Gestor de recursos para localizar capas huérfanas, reemplazar imágenes y liberar recursos sin uso.
- Diagnóstico de dimensiones excesivas, consumo estimado de memoria y peso exportado.
- Empaquetado opcional separado entre manifiesto JSON y recursos externos.

### Criterios de aceptación

- La importación de un PSD grande no bloquea las interacciones principales durante más de 100 ms continuos.
- Cancelar una importación no deja recursos ni capas parciales.
- El proyecto informa el peso antes de exportar y puede identificar los recursos dominantes.
- La eliminación de capas permite limpiar recursos realmente no utilizados.

## Fase 5 — Runtime e integraciones · Objetivo `v0.16.0`

### Objetivo

Convertir `kinetra/v2` en un formato fácil de integrar y mantener fuera del editor.

### Entregables

- Paquete versionado del runtime con exportaciones ESM documentadas.
- Ejemplos ejecutables para Canvas 2D, PixiJS y Phaser.
- Precarga y caché de recursos, reproducción, pausa, bucle, mezcla simple y eventos de sprite.
- Matriz de compatibilidad entre versión de editor, esquema y runtime.
- Migraciones deterministas de formatos anteriores soportados.
- Documentación de API, errores, rendimiento y ciclo de vida de recursos.

### Criterios de aceptación

- Cada integración reproduce el mismo paquete de referencia con resultados equivalentes.
- El runtime cuenta con pruebas de compatibilidad para todos los paquetes de ejemplo publicados.
- Los cambios incompatibles de formato requieren una nueva versión de esquema y guía de migración.

## Fase 6 — Estabilización y lanzamiento `v1.0.0`

### Objetivo

Declarar estable el contrato público después de validar el editor con proyectos reales.

### Entregables

- Congelación y documentación completa del esquema estable.
- Auditoría de pérdida de datos, seguridad de importación y compatibilidad de proyectos.
- Perfiles de rendimiento para proyectos pequeños, medianos y grandes.
- Manual de usuario, tutorial de principio a fin y guía para desarrolladores de runtimes.
- Política de soporte, reporte de errores y vulnerabilidades.
- Ejemplos de producción y proyectos de referencia descargables.

### Criterios de aceptación

- Cero defectos conocidos que provoquen pérdida de trabajo o corrupción de proyectos.
- Los proyectos creados con la versión estable se abren y exportan de forma determinista.
- Los flujos críticos mantienen cobertura E2E y pasan en los navegadores soportados.
- El rendimiento y los límites máximos están documentados con mediciones reproducibles.

## Métricas de seguimiento

- Tasa de guardados, recuperaciones e importaciones completadas sin error.
- Tiempo de apertura, guardado y exportación para los tres tamaños de proyecto de referencia.
- Pico de memoria durante importación, reproducción e historial de 100 operaciones.
- Porcentaje de flujos críticos cubiertos por pruebas E2E.
- Errores de accesibilidad críticos y serios por pantalla.
- Tamaño del paquete inicial y del runtime independiente.
- Defectos de pérdida de datos abiertos por release.

## Fuera de alcance antes de `v1.0.0`

- Edición colaborativa en tiempo real.
- Backend obligatorio, cuentas de usuario o sincronización en la nube.
- Deformación avanzada por malla, pintura de pesos o animación 3D.
- Marketplace de plantillas o recursos.

Estas capacidades podrán evaluarse después de estabilizar el editor local, el formato y el runtime.
