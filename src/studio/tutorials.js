export const HELP_TOPICS = Object.freeze({
  shortcuts: {
    title: "Atajos de teclado",
    body: `<div class="shortcut-grid"><kbd>V</kbd><span>Seleccionar y mover</span><kbd>H</kbd><span>Desplazar la vista</span><kbd>R</kbd><span>Rotar</span><kbd>S</kbd><span>Escalar</span><kbd>Espacio</kbd><span>Reproducir o detener</span><kbd>Ctrl Z</kbd><span>Deshacer</span><kbd>Ctrl Y</kbd><span>Rehacer</span><kbd>Ctrl C / V</kbd><span>Copiar o pegar claves</span><kbd>Mayús ← / →</kbd><span>Clave anterior o siguiente</span><kbd>Supr</kbd><span>Eliminar claves seleccionadas</span></div>`
  }
});

export const TUTORIALS = Object.freeze({
  animador: {
    label: "Animador",
    mode: "animador",
    steps: [
      {
        target: "#workspace-menu",
        title: "Estás en el Animador",
        copy: "Este selector cambia de espacio sin separar el proyecto. El Animador modifica poses y crea fotogramas clave."
      },
      {
        target: "[data-panel='skeleton'] .tree",
        panel: "skeleton",
        title: "Selecciona articulaciones",
        copy: "Haz clic en una articulación. Con Mayús o el botón de suma puedes mantener varios puntos seleccionados."
      },
      {
        target: ".toolbar .tool-group:first-child",
        title: "Elige una transformación",
        copy: "Mover, rotar y escalar cambian la pose. La herramienta activa también puede elegirse con V, R o S."
      },
      {
        target: "#canvas",
        title: "Manipula el personaje",
        copy: "Arrastra el control del lienzo. Muñecas y tobillos resuelven la cadena completa; codos y rodillas conservan conectada la extremidad."
      },
      {
        target: "#set-key",
        panel: "inspector",
        title: "Guarda el fotograma",
        copy: "La pose queda como borrador hasta pulsar Guardar fotograma."
      },
      {
        target: "[data-panel='timeline']",
        panel: "timeline",
        title: "Construye el movimiento",
        copy: "Cambia el tiempo, crea otra pose y guarda una nueva clave."
      }
    ]
  },
  calibrador: {
    label: "Ensamblaje",
    mode: "calibrador",
    steps: [
      {
        target: "#workspace-menu",
        title: "Estás en Ensamblaje",
        copy: "Aquí ajustas los sprites sobre el esqueleto antes de animarlos."
      },
      {
        target: "#import-layers",
        panel: "layers",
        title: "Importa las piezas",
        copy: "Cada imagen se convierte en un recurso y una capa independiente."
      },
      {
        targets: ["[data-panel='layers']", "[data-panel='inspector']"],
        panel: "layers",
        title: "Organiza capas reales",
        copy: "Selecciona una capa y calibra sus propiedades."
      },
      { target: "#canvas", title: "Coloca el sprite", copy: "Arrastra la pieza directamente sobre el personaje." },
      {
        target: "#add-bone",
        panel: "skeleton",
        title: "Construye tu esqueleto",
        copy: "Añade huesos desde la raíz o como hijos del hueso seleccionado."
      }
    ]
  },
  timeline: {
    label: "Línea de tiempo",
    mode: "animador",
    steps: [
      {
        target: "[data-panel='timeline']",
        panel: "timeline",
        title: "Mapa de la animación",
        copy: "Cada fila corresponde a una articulación."
      },
      { target: "#scrub", title: "Recorre el tiempo", copy: "Arrastra este control para revisar cualquier instante." },
      { target: "#play", title: "Reproduce y detén", copy: "El mismo botón alterna reproducción y detención." },
      {
        target: "#timeline-zoom",
        title: "Ajusta la escala temporal",
        copy: "Amplía el tiempo para separar claves cercanas."
      }
    ]
  },
  paneles: {
    label: "Paneles",
    mode: "animador",
    steps: [
      {
        target: "#window-menu > summary",
        title: "Activa cada módulo",
        copy: "El menú Ventana muestra u oculta cada panel."
      },
      {
        target: "[data-panel='skeleton'] .panel-window-bar",
        panel: "skeleton",
        title: "Mueve una ventana",
        copy: "Arrastra la cabecera para acoplar o desacoplar."
      }
    ]
  },
  exportar: {
    label: "Exportación",
    mode: "exportar",
    steps: [
      {
        target: "#mode-overlay",
        title: "Revisa el proyecto",
        copy: "Esta vista resume el contenido antes de exportar."
      },
      {
        target: "#download-project",
        title: "Exporta el proyecto completo",
        copy: "El paquete incluye rig, capas, recursos y todos los clips."
      }
    ]
  }
});
