# Kinetra

Kinetra es un editor web estático para ensamblar y animar personajes 2D construidos con sprites articulados. Incluye calibración de piezas, jerarquía de huesos, animación por fotogramas clave, línea de tiempo, vista fantasma e importación y exportación en JSON.

## Controles de transformación

- Haz clic en una articulación para seleccionarla. Usa el botón `+ / ✓` de la jerarquía o `Mayús` + clic en el lienzo para añadir o retirar puntos de la selección.
- Arrastra el centro o las flechas para mover la selección completa; las flechas restringen el movimiento a un eje.
- Al arrastrar una muñeca o un tobillo, Kinetra resuelve automáticamente el hombro/codo o la cadera/rodilla mediante cinemática inversa.
- Al arrastrar un codo o una rodilla, rota su hueso superior y conserva conectada toda la extremidad.
- El anillo rota y las manijas de esquina escalan; mantén `Mayús` durante el escalado para conservar la proporción.
- `Ctrl+Z` deshace tanto un borrador sin guardar como el último cambio confirmado. `Ctrl+Y` o `Ctrl+Mayús+Z` rehace.

## Paneles

Jerarquía, Inspector y Línea de tiempo pueden ocultarse o reactivarse desde el menú `Paneles`. Arrastra la barra de título de un panel para desacoplarlo y moverlo como ventana; el botón `↙` vuelve a acoplarlo y `×` lo oculta. La disposición se conserva en el navegador.

## Uso

Abre la versión publicada en [GitHub Pages](https://masterpet22.github.io/kinetra/) o sirve el repositorio mediante un servidor HTTP local:

```bash
npm run serve
```

La aplicación no necesita backend ni proceso de compilación.

## Desarrollo

```bash
npm test
```

La rama `main` se prueba y publica automáticamente mediante GitHub Actions.

## Compatibilidad de proyectos

Kinetra conserva el identificador de esquema `cronicas-studio/v1` para poder abrir los proyectos creados antes de su extracción. Cambiar ese identificador rompería la compatibilidad con archivos existentes.

## Estructura

- `index.html`: entrada de la aplicación.
- `styles.css`: interfaz del editor.
- `src/studio/editor.js`: controlador visual y estado de autoría.
- `src/animations/`: rig, interpolación, validación y adaptadores.
- `assets/modular/man_sprites/runtime/`: sprites de demostración.
- `tests/`: pruebas del contrato y de la interfaz.
