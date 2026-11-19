# Cierre de anotaciones recientes de interfaz

> Actualización posterior: la solicitud nueva de Empresa elimina el grupo intermedio Equipo y sustituye la jerarquía anterior. La auditoría vigente, incluidas demo y transiciones, está en [AUDITORIA-HOY-DESDE-1500.md](AUDITORIA-HOY-DESDE-1500.md).

18 de noviembre de 2026. Este registro cubre las tres tandas recientes de comentarios de UI y las dos solicitudes de elipsis del perfil. Se revisaron sobre la plataforma renderizada, con medidas de navegador y capturas, no solo sobre el código.

| Punto | Solicitud resuelta | Estado |
|---|---|---|
| A01 | Inicio sin padding superior en escritorio | Verificado |
| A02 | Aviso de guardado oculto en encabezado | Verificado |
| A03 | Texto e iconos del perfil alineados a la izquierda | Verificado |
| A04 | Buscador de Accesos con superficie uniforme en sus esquinas | Verificado |
| A05 | Clientes preparados para WooCommerce, Shopify y Payload; conexiones reales aplazadas por el usuario | Verificado |
| A06 | Separación idéntica entre buscador, navegación y bloque inferior | Verificado |
| B01 | Texto del área privada alineado exactamente y con line-height 1.4 | Verificado |
| B02 | Acceso SaaS con color principal y texto/icono blancos; contraste legible en oscuro | Verificado |
| B03 | Paneles de edición sin esquinas redondeadas | Verificado |
| B04 | Título de módulo lateral más grande | Verificado |
| B05 | Módulo actual principal y sin outline/halo de foco en botones/campos | Verificado |
| B06 | Equipo, como padre anidado, sin negrita | Verificado |
| B07 | Botones superiores con menos padding vertical y más lateral | Verificado |
| B08 | Categorías agrupadas en jerarquía real de listas | Verificado |
| B09 | Buscador in situ con velo y resultados a la derecha; debajo en móvil | Verificado |
| B10 | Aviso de tienda pastel y sin borde | Verificado |
| B11 | Título del aviso más grande y menor separación | Verificado |
| B12 | Acción del aviso diferenciada del resto de botones secundarios | Verificado |
| B13 | Agenda de hoy con fondo propio y contraste | Verificado |
| B14 | Selector de creación más estrecho (máximo 30rem) | Verificado |
| B15 | Tres estilos de botón configurables: principal, secundario y contorno | Verificado |
| B16 | Apariencia reorganizada con muestras, campos de color y vista previa | Verificado |
| C01 | Próximas atenciones destacada sobre las tarjetas secundarias | Verificado |
| C02 | Detalle de hora con resumen, estado, fecha, importe, extras, datos e historial agrupados | Verificado |
| C03 | Estado de personas en píldora | Verificado |
| C04 | Orden Inicio/Tienda/Empresa/Proyecto/Agendamiento/Contabilidad | Verificado |
| C05 | Leyenda de vista previa del gráfico con tamaño reducido | Verificado |
| C06 | Agregar objetivo sin fondo y con contorno | Verificado |
| C07 | Submenús más compactos, con línea vertical e indentación | Verificado |
| C08 | Cabeceras de tablas con fondo pastel | Verificado |
| C09 | Agenda de hoy y próximas atenciones con 50% cada una y altura igual | Verificado |
| C10 | Rankings con posición, cifras y barras legibles basadas en datos reales | Verificado |
| C11 | Logo SVG entregado con letras convertidas a trazados | Verificado |
| C12 | Movimiento de agenda ocupa todo el ancho | Verificado |
| C13 | Mi cuenta tiene icono | Verificado |
| C14 | Clientes de Agendamiento en tabla con sus acciones existentes | Verificado |
| C15 | Módulos abren la primera página autorizada; rutas jerárquicas y enlaces antiguos compatibles | Verificado |
| C16 | Navegación lateral con mayor padding horizontal | Verificado |
| D01 | Nombre del perfil en una sola línea, con elipsis si no cabe | Verificado |
| D02 | Rol del perfil en una sola línea, con elipsis si no cabe | Verificado |

## Evidencia

- Nombre y rol: altura de una línea, nowrap, overflow hidden y text-overflow ellipsis. Probados también textos largos, sin modificar datos persistidos.
- Área privada: texto y título comienzan en x=50px a 1159px de ancho. Interlineado 1.4. Outline y halo de foco: ninguno.
- Verificación a 1159px y 390px, claro/oscuro, demo y cuentas ficticias autenticadas; sin desbordamiento ni excepciones JavaScript.
- Paleta guardada, búsqueda y resultados, selección y cierre de paneles, rutas nuevas/antiguas y página inicial de cada módulo comprobados. Espacios conserva sus medidas, controles y colores previos.
- 77 pruebas frontend y 86 backend pasan; TypeScript y compilación pasan.
- Capturas orbita-closure-*, orbita-final-* y orbita-refinement-* en las visualizaciones del chat. Detalle reproducible en VALIDACION-CIERRE-ANOTACIONES.json.
- Logo descargable: [orbita-logo.svg](../public/brand/orbita-logo.svg), sin etiquetas text ni dependencia de fuentes.

Las conexiones reales de tiendas fueron aplazadas expresamente por el usuario. Este cierre de anotaciones de interfaz no modifica ni sustituye la matriz histórica de capacidades del ZIP.
