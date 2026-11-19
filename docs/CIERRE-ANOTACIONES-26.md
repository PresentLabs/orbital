# Cierre de 26 anotaciones · 19 de noviembre de 2026

1. Estados de Próximas atenciones con fondo principal y texto blanco; Agenda de hoy conserva los colores por estado.
2. Movimiento de la agenda ocupa la mitad izquierda del bloque de análisis.
3. Servicios y profesionales se apilan en la mitad derecha; en móvil se ordenan en una columna.
4. Espacios: icono eliminado del título y alineación de título/píldora con el inicio anterior del icono.
5. Tarjetas de espacios sin borde.
6. Tarjetas de tableros sin borde.
7. Tarjetas de notas sin borde.
8. Tarjetas de archivos sin borde.
9. Encabezado con el mismo fondo que el contenido.
10. Fondo padre del lateral igual al contenido; los tres bloques conservan sus fondos propios.
11. Cabecera blanca en las tablas del detalle del pedido.
12. Menú del perfil de 15rem.
13. Cabecera de Equipo con el mismo pastel que Pedidos.
14. Eliminado el botón de mostrar/ocultar comentarios; comentarios y accesos individuales se conservan.
15. Selector Kanban/Lista/Timeline con fondo secundario.
16. Tareas del timeline se mueven entre días y se redimensionan desde ambos extremos. Manejadores de 60px de alto y 5px de ancho, ajuste por días, fecha mínima de un día, guardado por la misma vía autorizada y cancelación con Escape. Los grupos agregados de proyectos conservan su consulta sin modificar masivamente tareas.
17. Grupo Tareas/Proyectos/Hoy/navegación con fondo secundario y bordes redondeados.
18. Botones no actuales blancos.
19. Botón actual con fondo principal.
20. Avance del tablero a la derecha de Tablero/Resumen/Avance en la misma línea de escritorio; se adapta en móvil.
21. Degradado del lateral a 358deg, #becdff → #e3e8ff → blanco en claro, con las variantes oscuras solicitadas.
22. Avisos de demo/datos de ejemplo blancos y con radio de 20px, igual a las tarjetas.
23. Scrollbar de las citas: pulgar sin borde y mismo ancho de 8px que el carril. Se conservan margen y degradado de contenido pendiente.
24. Configuración de reservas: contenedor transparente, preferencias blancas y horarios/fechas especiales con fondo del bloque de navegación lateral. Formulario y serialización conservados.
25. Contabilidad demo con el mismo encabezado, botón y aviso de activación que un negocio sin Facturación habilitada. Actualizar en demo no llama a la API real.
26. Calendario de Proyecto por horas con Día/Semana/Mes, eventos de duración real, arrastre entre días/horas, manejadores de inicio y término, solapamientos en columnas, eventos de varios días, ajuste por 15 minutos y navegación conservada. Los colores de un evento permanecen estables entre segmentos y vistas. Mantiene los hitos de tableros/ciclos.

## Fechas, compatibilidad y permisos

Los eventos añaden endDate y endTime opcionales al JSON existente. Eventos anteriores sin término mantienen una hora de duración, compatible con el comportamiento anterior. El editor permite revisar y corregir ambas fechas y horas; preserva los metadatos de Google Meet. ICS y el endpoint existente de Google Calendar usan la duración guardada. No se ejecutaron llamadas externas a Google ni se configuraron nuevas credenciales.

El arrastre usa una única transacción al soltar; Escape, cancelación del puntero o pérdida de foco descartan la previsualización. Los perfiles sin edición no reciben manejadores y no pueden cambiar fechas mediante el gesto. No se alteraron permisos de API ni el interior de un Espacio abierto.

## Validación

82 pruebas frontend pasan, incluidas fechas invertidas, meses/años, medianoche, duración mínima, compatibilidad del estado y distribución de solapamientos. TypeScript y compilación pasan. Chrome aislado a 1166px y 390px: verificación de los cambios visuales, sin overflow horizontal ni excepciones.

Con el ratón se verificaron movimiento y ambos extremos del timeline; calendario por horas y por días; ambos extremos del evento; movimiento y extensión en vista mensual; Escape; recarga y conservación de fechas. Un evento temporal de la cuenta sintética design-owner se guardó y redimensionó en la API local, se recargó para comprobar persistencia y se eliminó al terminar. La cuenta sintética lectora no recibe manejadores. La comprobación independiente de geometría, colores y controles del interior de Espacios pasa.

Evidencia: VALIDACION-ANOTACIONES-26.json, capturas orbita-notes26-* y pruebas date-ranges.test.mjs. Versión local: /private/tmp/orbita-preview-notes26d, puerto 4394. Sin cambios de producción.
