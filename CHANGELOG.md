# Changelog

Todos los cambios relevantes de Kinetra se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added

- Previsualizaciones ensambladas a partir de las piezas reales de cada plantilla.

### Changed

- Las plantillas masculina y femenina usan 14 recursos PNG independientes en lugar de vistas previas o atlas compartidos.
- El rig femenino se recalibró sobre las articulaciones visibles de sus nuevas piezas y su pose oficial ahora inicia con rotación editable de cero grados.

### Removed

- Plantilla de perro y sus recursos, debido a que no ofrecía un flujo funcional.

## [0.11.0] - 2026-10-16

Primera versión pública etiquetada de Kinetra. Consolida el editor independiente y elimina el formato heredado `kinetra/v1`.

### Added

- Editor web estático para ensamblar y animar personajes 2D mediante sprites articulados.
- Proyectos `kinetra/v2` autocontenidos con rig, capas, recursos y clips de animación.
- Plantillas de humano masculino, humano femenino, perro y proyecto vacío.
- Importación múltiple de PNG, WebP y JPEG como capas editables.
- Importación de PSD por capas, con recorte de píxeles transparentes y límite de recursos de 24 MB.
- Creación y edición de esqueletos jerárquicos personalizados.
- Cinemática inversa para cadenas de tres huesos y controles de transformación para mover, rotar y escalar.
- Edición de poses y fotogramas clave con interpolaciones Linear, Sine, Quad, Cubic y Back.
- Línea de tiempo con reproducción, zoom temporal, eventos de sprite, copiar y pegar claves.
- Historial de deshacer y rehacer para cambios confirmados y borradores.
- Selección múltiple de huesos, pistas y capas.
- Grupos de capas con visibilidad, bloqueo, renombrado, contracción y desagrupado.
- Espacio de trabajo modular con paneles acoplables, flotantes y redimensionables.
- Temas Noche, Grafito y Aurora.
- Recorridos guiados y referencia de atajos de teclado.
- Runtime sin dependencias del DOM para resolver matrices por capa en Canvas 2D, PixiJS o Phaser.
- Pruebas automatizadas del formato, plantillas, runtime, gizmos, IK e interfaz.
- Publicación automática en GitHub Pages después de superar las pruebas.

### Changed

- Unificación de calibración, sprites y animación dentro de un único Studio.
- Sustitución de las vistas heredadas por espacios de trabajo Animador y Ensamblaje.
- Mejora de los flujos de duplicados, renombrado, copia, pegado y eliminación múltiple.
- Ajuste del encuadre de la vista previa a los límites transformados de todos los sprites visibles.

### Fixed

- Corrección de controles de transformación no interactivos.
- Prevención de desplazamientos acumulados al transformar cadenas jerárquicas completas.
- Contención de paneles flotantes dentro del espacio de trabajo.
- Correcciones de tamaño, desplazamiento y disponibilidad de controles en la línea de tiempo.
- Auditoría de acciones para los botones estáticos y dinámicos del Studio.

### Removed

- Compatibilidad y código residual del formato `kinetra/v1`.

[Unreleased]: https://github.com/Masterpet22/kinetra/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/Masterpet22/kinetra/releases/tag/v0.11.0
