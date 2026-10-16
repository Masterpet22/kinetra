# Límites de Kinetra v2

Los límites se aplican al importar, validar y exportar un paquete. Evitan que un archivo hostil o accidentalmente enorme bloquee el editor.

| Recurso                         |           Límite |
| ------------------------------- | ---------------: |
| Capas                           |              256 |
| Huesos                          |              128 |
| Clips                           |               64 |
| Fotogramas por clip             |           10.000 |
| Dimensión de imagen             | 8.192 × 8.192 px |
| Recursos de imagen por proyecto |           24 MiB |
| Duración de un clip             |    100–60.000 ms |

MIME admitidos: `image/png`, `image/webp` e `image/jpeg`. Las data URLs deben declarar el mismo MIME que el recurso. Los recortes deben ser positivos y permanecer dentro de las dimensiones declaradas del recurso. Todas las referencias a recursos, huesos, grupos y objetivos de animación se validan antes de abrir o exportar.

Los metadatos se guardan en IndexedDB separados de las imágenes, que se almacenan como `Blob`. El límite de 24 MiB corresponde al contrato del producto y no al límite mucho menor de `localStorage`.
