# Continuidad del sistema de interfaz

Actualizado: 18 de noviembre de 2026. Solicitud más reciente: sistema coherente basado en Monetra y referencias adjuntas, conservando funciones e interior de Espacios. Impeccable aplicado con su fallback tras fallo previo del launcher. El reparto toast/panel lateral fue confirmado por el usuario.

## Entregado en este bloque

- Sistema común de tipografía en rem, superficies, radios, botones, formularios y claro/oscuro. Estado de guardado .85rem y separación del checkbox de confirmación con saldo.
- Header con identidad del negocio y acciones frecuentes. Módulos en el encabezado y navegación contextual lateral, sin iconos en submenús. Mantiene las rutas, permisos y activación desde Administración.
- Servicios, paquetes, extras, categorías, profesionales, sucursales, recursos y clientes con jerarquía y acciones coherentes; tarjetas simétricas, sin grandes placeholders de imagen. Horarios y fechas especiales con agrupación y distribución adaptable.
- Administración: selector de negocios con búsqueda y paginación en popover, detalle con ancho disponible. Solo los IDs SaaS autorizados ven el acceso; propietario/admin de un negocio no equivale a operador SaaS.
- Configuración > Apariencia: cinco colores por tema, vista previa, guardar, restaurar y descartar. Propietario/admin editan; miembros/lectores heredan. Validación de formato, claves y contraste en servidor, aislamiento entre negocios.
- Avisos con icono, título, descripción y cierre, tonos semánticos claros/oscuros. Paneles desde la derecha, velo negro transparente y entrada/salida ease; Escape, foco nativo y movimiento reducido.
- Columnas Kanban/lista renombrables con doble clic, Enter o F2; persistencia sin cambiar claves todo/doing/done.
- Tareas con progreso de checklist real (o estado completado), avatar real/iniciales, comentarios y adjuntos. Timeline semanal de tareas y proyectos con fechas reales, navegación y lista de tareas sin fecha.
- Espacio abierto protegido: nuevos estilos y controles excluidos de canvas-fullscreen. Comparación de geometría, fuente, color y controles con captura anterior pasa.

## Verificado

75 pruebas frontend, 84 backend, TypeScript de ambos y build Astro pasan. Integración PostgreSQL real pasa. Navegador aislado de prueba: escritorio 1440px y móvil 390px, claro/oscuro, directorios, paneles, colores guardados, columnas, lista y timeline, sin overflow ni excepciones JavaScript. Roles owner/admin/member/viewer: herencia y bloqueos API 403 comprobados; SaaS separado; selector probado. Evidencia en VALIDACION-SISTEMA-UI.json y capturas orbital-system-* en las visualizaciones del chat.

No se modificaron bases ni despliegues de producción. La paleta, fecha inicial y nombres de columna usan JSON existente: este bloque no agrega migración. Las migraciones anteriores de Agendamiento siguen sujetas al procedimiento habitual de despliegue.

## Archivos y arquitectura

PRODUCT.md y DESIGN.md fijan contexto y sistema. workspace-system.css y workspace-type-scale.css acotan las reglas nuevas fuera del lienzo; ui-feedback.ts/.css centralizan avisos/paneles; business-palette.ts y backend ui-settings.ts validan/aplican colores. task-presentation.ts deriva señales y rangos sin inventar datos. Los scripts de workspace y platform-admin reutilizan acciones existentes.

## Pendiente de la solicitud histórica

La paridad completa con Archivo.zip NO está terminada. Continúan pendientes checkout conectado a la tienda (Shopify/WooCommerce/Payload), saldo/consumo de paquetes, portal público, recurrencia y otras capacidades detalladas en PARIDAD-AGENDAMIENTO.json. La matriz conserva 103 bloques: 4 implementados, 41 parciales y 58 pendientes; no convertir esta entrega visual en una declaración de paridad funcional.

Siguiente acción: retomar la matriz y el checkout de tienda, empezando por la creación/confirmación del pago y su reconciliación idempotente con las concesiones temporales ya implementadas. No volver a inventariar el ZIP ni rehacer la interfaz entregada.

## Herramientas de continuidad

Copia de trabajo /private/tmp/orbital-impeccable.j8Ofo3. Vista local del usuario en 4394 con PostgreSQL de prueba 55440; revisión aislada en 4395. Compilación estable copiada a /private/tmp/orbital-preview-chrome-v3/dist. Scripts temporales preview-system-browser-test.mjs y preview-system-roles-test.mjs usan Chrome de prueba 9433; no entregarlos ni dependencias, credenciales, perfiles o dist como código del producto. No recargar ni manipular el navegador del usuario.


## Ajuste posterior: diez comentarios del navegador

- Inicio, Tienda, Agendamiento habilitado, Gestión (antes Gestión Creativa) y Empresa están en el encabezado, conservando acceso por permisos. Ya no hay riel de módulos duplicado en el lateral.
- La navegación del módulo ocupa el grupo gris de la izquierda; configuración/cuenta comparte su alineación horizontal. El icono de búsqueda queda arriba y fuera de ese grupo.
- Logo geométricamente centrado en su contenedor y alineado con el lateral. La marca propia del negocio se conserva.
- Avatar de cuenta igualado a los botones vecinos únicamente en la topbar. Controles de tema y montos con fondo blanco en claro y superficie correspondiente en oscuro.
- Topbar sin borde/sombra al inicio; sombra solo después de scroll. El buscador es centrado y oscurece la página, con búsqueda existente, foco y cierre conservados. En móvil se cierra el menú al abrir el formulario para evitar que intercepte su cierre.
- TypeScript y build pasan. Navegador real aislado: 1035x898 como las anotaciones y 390x844, claro/oscuro, módulos, búsqueda/resultado/cierre, geometría, tamaños, fondo de botones y sombra por scroll. Comparación del interior protegido de Espacios vuelve a pasar.
- Evidencia: VALIDACION-NAVEGACION-UI.json y capturas orbital-chrome-*. No se altera la lógica de tienda, proyectos, tareas o reservas. La matriz de paridad histórica conserva los mismos pendientes.

## Ajustes de marca y lateral
Marca visible Órbita y selector DOM orbita-workspace actualizados. Lateral reducido, búsqueda con texto, Proyecto y contador redondo; categorías distinguen principales y subcategorías. TypeScript y build pasan. Pendiente: revisión visual de este bloque y migración compatible de identificadores técnicos persistidos que aún contienen orbital; no reemplazar claves de almacenamiento, contratos API o variables de despliegue sin compatibilidad. Administración SaaS conserva la lista autorizada del propietario del SaaS.

## Navegación estática, perfil y Contabilidad
Títulos laterales de módulos estáticos sin iconos/acordeón, padding de Métricas restaurado. Tema y montos movidos al popover del perfil, con etiquetas dinámicas y sin tooltip; funciones conservadas. Facturación propia movida de Tienda a /app/contabilidad, reutilizando sus permisos y activación backend existentes. Tienda conserva comprobantes de pedidos. No se implementan funciones contables adicionales ni se declara paridad del ZIP. TypeScript/build y navegador aislado 1159px pasan: navegación estática, menú, cambio de tema/montos, ausencia de tooltip y separación de paneles sin overflow. Capturas orbita-profile-preferences y orbita-contabilidad-module.

## Espaciados y cobertura de clientes
Sin padding superior en Vista general desktop; estado de guardado oculto visualmente, conservando sincronización; menú de perfil alineado a izquierda, buscadores con superficie uniforme y separación lateral unificada. Auditoría confirma que /api/saas/customers.ts solo implementa WooCommerce: Shopify/Payload pendientes, indicado en interfaz. No afirmar cobertura de los tres. TypeScript y build pasan.

## Entrega acumulada: buscador, paleta y nuevas anotaciones

- Buscador en su lugar original, con velo oscuro y resultados a la derecha; debajo en móvil. Conserva permisos, resultados, selección y cierre existentes.
- Categorías agrupadas con listas de subcategorías reales; clientes de Agendamiento en tabla con acciones existentes. Cabeceras de tablas pastel.
- Paleta ampliada de cinco a siete campos por tema: acción principal, secundaria y contorno, además de superficies/textos/navegación. Vista previa de botones. Compatibilidad de paletas antiguas y permisos de edición conservados.
- Sidebar con mayor padding lateral, jerarquías y línea de submenú; orden global Inicio/Tienda/Empresa/Proyecto/Agendamiento/Contabilidad. Los módulos abren su primera sección autorizada. Empresa y Proyecto tienen rutas jerárquicas, preservando las anteriores y modo demo.
- Agenda de hoy y Próximas atenciones al 50%, fondos propios con contraste y altura igual; movimiento de agenda a todo el ancho. Rankings con posición, cantidad y barras legibles con valores reales.
- Detalle de la hora con estado, servicio, cliente, fecha/zona horaria, importe, extras, datos y registro de cambios agrupados; conserva controles y transiciones existentes. Paneles cuadrados y selector de creación más estrecho.
- Estado de equipo en píldora, botón de objetivo sin fondo, leyenda pequeña, cuenta con icono y pestaña activa principal. Aviso de tienda con fondo pastel, sin borde y botón diferenciado. Foco sin outline; indicador discreto de teclado conservado mediante sombra. Interior de Espacios no cambia.
- Logo público public/brand/orbita-logo.svg: letras convertidas a trazados, sin etiquetas text ni dependencia de fuentes. Render verificado; copia de entrega en las visualizaciones del chat.

## Avances funcionales preparados durante este bloque

Lectura de clientes y pedidos de su ficha para Shopify y Payload, además de WooCommerce; paginación GraphQL, selección de tienda cuando procede, colección de clientes configurable para Payload, formatos normalizados y enlaces al pedido en la administración de la tienda. Pruebas con respuestas simuladas; NO comprobados con tiendas reales. Rutas internas orbita-* canónicas y orbital-* como alias del mismo handler, para no romper clientes existentes. Variable ORBITA_PUBLIC_ORIGIN preferida con fallback anterior. Marca de invitaciones actualizada.

El usuario indicó explícitamente que integrará las tiendas después: no bloquear el trabajo local por credenciales ni declarar cobros reales verificados. Pedido global/Métricas aún requieren completar adaptadores; no confundir la lectura de pedidos de una ficha de cliente con el módulo completo de tienda.

## Verificación y siguiente punto

77 pruebas frontend y 86 backend pasan; TypeScript de ambos y build Astro pasan. Navegador aislado 1159px/390px, claro/oscuro: paletas guardadas, buscador, jerarquía de categorías, proporciones/alturas, tablas, detalle de hora, orden y primera página de módulos, rutas antiguas/nuevas, píldoras y Espacio protegido. Evidencia adicional VALIDACION-ANOTACIONES-ACUMULADAS.json y capturas orbita-final-* / orbita-refinement-*.

La matriz de 103 capacidades mantiene 4 implementadas, 41 parciales y 58 pendientes. No se declara paridad completa. Importación/exportación CSV de clientes y acciones masivas estaban anunciadas como siguiente bloque, pero TODAVÍA NO ESTÁN IMPLEMENTADAS: retomar desde allí después de esta entrega visual. Luego paquetes/saldos, portal, recurrencia, eventos, automatizaciones y checkout según la matriz. Cobros reales y conexiones externas aplazados por el usuario. No se aplicaron migraciones ni cambios a producción.

Compilación para continuar: /private/tmp/orbita-preview-final-ui3/dist; fuente de trabajo /private/tmp/orbital-impeccable.j8Ofo3. QA 4395, vista del usuario 4394, Chrome aislado 9433. No entregar scripts temporales, perfiles, credenciales ni dist como fuente.

## Cierre de la revisión de las tres tandas recientes
El perfil conserva nombre y rol en una línea con elipsis, tanto en demo como autenticado. Se corrigió el píxel residual del área privada y el halo de foco que seguía pareciendo un outline. La etiqueta de propietario es correcta en cuentas reales, conservando Administrador en la demo. Contraste del acceso SaaS con texto blanco adaptado para oscuro. Selector de proveedor de Clientes oculto cuando no hay varias opciones. Las 40 anotaciones de estas tandas quedan comprobadas punto a punto en CIERRE-ANOTACIONES-UI.md y VALIDACION-CIERRE-ANOTACIONES.json. Compilación estable /private/tmp/orbita-preview-closure4/dist. Mantener los pendientes funcionales históricos separados de este cierre visual.

## Auditoría posterior solicitada desde las 15:00
Empresa ahora tiene Equipo y Votaciones como hermanos: se elimina el grupo intermedio y las rutas canónicas son /app/empresa/equipo y /app/empresa/votaciones, conservando las antiguas como alias. Agendamiento visible en demo con datos ficticios de lectura, sin API real; activación de negocios reales intacta. Transiciones visibles de 260ms fuera de Espacios y movimiento reducido respetado. Contabilidad rediseñada, y separador oculto cuando solo hay área privada. Las tandas previas se comprobaron de nuevo. AUDITORIA-HOY-DESDE-1500.md y VALIDACION-AUDITORIA-HOY.json registran alcance, resultados y diferencias. 78 pruebas frontend, TypeScript/build y navegador pasan; backend sin cambios conserva 86 pruebas. Fuente temporal igual; compilación /private/tmp/orbita-preview-today2/dist. Los pendientes funcionales históricos y las conexiones reales aplazadas no se declaran completados.
