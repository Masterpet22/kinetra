# Recomendaciones para Kinetra

Esta lista reúne mejoras propuestas para hacer que Kinetra sea más claro, preciso y ágil durante el ensamblaje y la animación de personajes.

## Prioridad alta

### 1. Barra de herramientas contextual — Implementada

Indicar claramente qué elemento será transformado por cada herramienta:

- En **Ensamblaje**, las herramientas actúan sobre la capa seleccionada.
- En **Animación**, actúan sobre el hueso o la selección actual.

Los mismos iconos cambian de función según el espacio de trabajo, por lo que una indicación contextual reduciría confusiones.

### 2. Selección precisa de sprites — Implementada

Detectar la forma transformada real de cada capa al seleccionarla, considerando:

- Rotación.
- Escala.
- Reflejo horizontal o vertical.
- Transformaciones heredadas del hueso asociado.

Esto evitaría seleccionar otra pieza por accidente cuando varias capas se superponen.

### 3. Creación continua de huesos

Después de dibujar un hueso, permitir continuar inmediatamente desde su articulación final para construir una cadena completa. La tecla `Escape` finalizaría la operación.

### 4. Transformación múltiple de capas

Permitir mover, rotar, escalar y reflejar conjuntamente todas las capas seleccionadas desde el visor.

## Prioridad media

### 5. Información visible durante las transformaciones — Implementada

Mostrar junto al cursor los valores que cambian durante el arrastre, por ejemplo:

- Escala: `125 %`.
- Rotación: `32°`.
- Posición: `X: 140, Y: 82`.

### 6. Ajuste a cuadrícula y articulaciones — Implementada

Incorporar opciones para:

- Encajar un hueso en una articulación próxima.
- Ajustar posiciones a la cuadrícula.
- Restringir la rotación a intervalos de 15° manteniendo `Mayús`.

Esto facilitaría construir esqueletos simétricos y ordenados.

### 7. Duplicación y reflejo estructural

Permitir duplicar y reflejar cadenas completas de huesos junto con sus capas vinculadas. Por ejemplo, construir un brazo derecho y generar automáticamente su equivalente izquierdo.

### 8. Estado activo de la interpolación

Resaltar qué curva está aplicada al fotograma seleccionado. También podría mostrarse una pequeña animación de ejemplo al pasar el cursor sobre estas opciones:

- Lineal.
- Suave.
- Desaceleración.
- Sobrepaso.

### 9. Edición directa de articulaciones

Permitir arrastrar una articulación en Ensamblaje para cambiar su posición base sin depender exclusivamente de los campos X/Y del Inspector.

### 10. Modo de prueba del esqueleto

Ofrecer un modo temporal para mover las articulaciones sin crear fotogramas clave. Serviría para comprobar conexiones, posiciones de articulaciones y capas vinculadas antes de comenzar a animar.

## Mejoras complementarias

### 11. Indicador global de cambios

Distinguir claramente entre:

- Proyecto guardado en el navegador.
- Cambios pendientes en el fotograma actual.
- Cambios generales del proyecto todavía sin guardar.

### 12. Nombres automáticos inteligentes

Sugerir nombres relacionados con la jerarquía o la anatomía, como `Brazo`, `Antebrazo` y `Mano`, en lugar de utilizar únicamente nombres como `Hueso 14` o `Hueso 15`.

## Orden de implementación recomendado

1. Barra de herramientas contextual.
2. Selección precisa de sprites.
3. Creación continua de huesos.
4. Transformación múltiple de capas.
5. Información visible durante las transformaciones.
6. Ajuste a cuadrícula y articulaciones.
7. Duplicación y reflejo estructural.
8. Estado activo de la interpolación.
9. Edición directa de articulaciones.
10. Modo de prueba del esqueleto.
11. Indicador global de cambios.
12. Nombres automáticos inteligentes.
