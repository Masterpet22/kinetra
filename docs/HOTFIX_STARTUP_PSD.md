# Parche de arranque e importación PSD

## Síntomas reproducidos

- La aplicación mostraba `Error de inicio`, el botón de exportación de emergencia y paneles sin poblar.
- Algunas capas extraídas de un PSD aparecían en el árbol, pero no en el lienzo.

## Causas

1. La inicialización escribía preferencias de vista directamente en `localStorage`. Un `SecurityError` o una cuota agotada interrumpía el arranque después de enlazar los controles, pero antes del primer `refresh()`. Esto explicaba la interfaz parcialmente funcional de la captura.
2. La importación copiaba el indicador `hidden` de cada capa PSD y de sus grupos padres. El recurso y la capa se creaban correctamente, pero el renderer omite por diseño cualquier capa con `visible: false`.
3. El cargador de imágenes no notificaba errores de decodificación, por lo que un recurso inválido también podía quedar enlistado sin explicación visual.

## Reparación

- Las lecturas, escrituras y eliminaciones de preferencias usan funciones tolerantes a excepciones. IndexedDB continúa siendo el almacenamiento principal del proyecto.
- Toda capa PSD con píxeles no transparentes se incorpora visible. Si el PSD la marcaba como oculta, el estado de la importación informa que fue revelada.
- `Image.onerror` muestra el nombre de la capa cuyo recurso no pudo visualizarse.

## Cobertura

- Pruebas unitarias para almacenamiento web rechazado.
- Prueba E2E que bloquea `Storage.setItem` y exige un arranque completo con las 14 capas de la plantilla.
- Auditoría estática de la visibilidad PSD y del diagnóstico de carga de imágenes.
