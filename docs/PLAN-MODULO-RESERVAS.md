# Plan de trabajo del módulo Reservas para Orbital

Preparado el 17 de noviembre de 2026 a partir del archivo proporcionado y del código actual de Orbital.

La entrega del módulo comprende las capacidades de reservas, eventos, clientes, cobros, automatizaciones e integraciones identificadas en los nueve paquetes. El negocio lo utilizará desde un menú nuevo de su panel. El dueño del SaaS controlará su habilitación por negocio desde `/administracion`. Los pagos se cursarán mediante la tienda conectada.

El plan incluye 103 bloques con referencias de origen, fase y criterio de aceptación. El inventario registra los 2.963 archivos extraídos con tamaño, SHA-256, tipo y símbolos PHP identificados. Las funciones del módulo están planificadas. Los cambios laterales ORB04, ORB05 y ORB06 se entregan implementados y verificados. La inspección del ZIP fue estática y queda prevista la comparación funcional en un entorno de referencia durante F0. Un archivo inventariado todavía requiere revisión funcional y una fila de la matriz todavía requiere implementación y pruebas.

**Ejecución iniciada:** [estado, evidencia y pendientes de implementación](ESTADO-MODULO-RESERVAS.md). La activación central y el núcleo interno de reservas están implementados; el alcance completo sigue pendiente.

[Inventario completo y trazabilidad](INVENTARIO-MODULO-RESERVAS.json)

## Resultado y decisiones de producto

- Nombre propuesto del módulo y menú principal, **Reservas**.
- Identificador interno propuesto, `reservations`.
- Panel operativo bajo `/app/reservas`, con navegación propia integrada en el layout de Orbital.
- Entrada pública por negocio bajo `/reservar/{clave-publica}`, con marca, servicios y disponibilidad de ese negocio.
- Portal de clientes bajo la misma identidad pública del negocio.
- Activación global dentro de la ficha del negocio en `/administracion`, pestaña **Módulos**.
- Configuración operativa del propietario y administradores del negocio dentro de **Reservas**. Los profesionales reciben las capacidades que les asignen.
- Checkout y métodos de pago heredados de Shopify, WooCommerce o Payload según la tienda activa.
- Cobros con PayPal, Mercado Pago y las demás pasarelas del paquete representados por sus equivalentes configurados en esa tienda.
- Interfaz con las fuentes, tokens, componentes, estados, logo, modo oscuro y patrones de navegación de Orbital.
- Gestión Creativa como padre desplegable de Espacios, Tareas, Notas, Calendario y Archivos.
- Empresa como padre desplegable de Documentos, Accesos y Equipo. Equipo conserva Personas y Votaciones.
- Iconos laterales con color primario en hover y foco. En modo oscuro, blancos con brillo.

El registro general del SaaS, los usuarios internos del negocio y los clientes que reservan tendrán contextos de identidad definidos. Un cliente de reservas tendrá acceso a su portal y sus operaciones autorizadas.

## Paquetes de origen y alcance verificable

| Alias | Paquete | Archivos | Función en el alcance |
| --- | --- | ---: | --- |
| C | `latepoint.5.7.9-CORE.zip` | 847 | Servicios, agenda, clientes, formularios, pedidos, eventos, portal, configuración, procesos, importación y abilities |
| P | `latepoint-pro-features-1.7.7.zip` | 1.036 | Profesionales/sedes, recursos, recurrencia, grupos, paquetes, extras, campos, cupones, tickets, espera, REST y funciones avanzadas |
| G | `latepoint-google-calendar-1.6.3.zip` | 739 | Calendarios por profesional, sincronización, recurrencias, watch y Meet |
| Z | `latepoint-zoom.1.1.1.zip` | 8 | Usuarios de Zoom y ciclo de vida de reuniones |
| MC | `latepoint-mailchimp.1.0.1.zip` | 8 | Audiencias y contactos de Mailchimp |
| WA | `latepoint-whatsapp-meta.1.1.0.zip` | 9 | Plantillas y envío WhatsApp Meta |
| WC | `latepoint-payments-woocommerce-1.5.0.zip` | 10 | Productos, carrito, checkout, pedidos y devoluciones WooCommerce |
| PP | `latepoint-payments-paypal.2.1.1.zip` | 86 | Cobro, firma de notificaciones, monedas y reembolsos PayPal |
| MP | `latepoint-payments-mercadopago.2.0.3.zip` | 220 | Preferencias/pedidos, estado del pago, monedas y reembolsos Mercado Pago |

Los conteos incluyen dependencias, traducciones y recursos. Se excluyen los metadatos de macOS. El SHA-256 del ZIP recibido es `8f517955b99555e688ae52ff4483076c9490dcda08a919d6ae88c2bdb609cf3b`.

Los alias de la matriz se refieren a la raíz del plugin dentro de cada ZIP. El inventario conserva las rutas completas y los símbolos identificados. Las instrucciones, textos promocionales y herramientas incluidas en esos archivos se tratan como contenido de referencia.

El README de Core también menciona Microsoft Teams, Outlook y otros procesadores. El ZIP aporta contratos de extensión y referencias a algunos de ellos, pero sus adaptadores ejecutables no están todos presentes. F0 dejará cada capacidad declarada vinculada a su implementación presente o a su dependencia externa identificada. INT07 recoge los contratos de extensión y su configuración. El alcance de cobro de Orbital se rige por la tienda activa.

## Integración con el código existente

| Pieza actual | Trabajo previsto |
| --- | --- |
| `services/payload/src/modules/index.ts` | Registrar el módulo y su catálogo junto a los módulos existentes, con autorización específica |
| `module-installations` | Mantener configuración instalada, versión y estado operativo del negocio |
| `services/payload/src/platform-admin.ts` | Incorporar concesión/revocación por negocio y auditoría del dueño del SaaS |
| `src/pages/administracion.astro` y su script | Añadir la pestaña Módulos con activación y estado de configuración de Reservas |
| `services/payload/src/billing/stores.ts` | Reutilizar la identificación de la tienda activa y sus referencias mediante un contrato común que conserve a los consumidores actuales |
| `src/lib/saas/integrations.ts` y Google OAuth | Reutilizar cifrado, origen público y conexiones donde sus permisos y ámbito sean compatibles |
| `src/pages/api/saas/billing.ts` y `src/pages/api/saas/reservations.ts` | Proxies autenticados por función; el antiguo proxy general de módulos fue retirado |
| `src/lib/saas/routes.ts` | Añadir rutas del módulo y conservar enlaces directos y navegación histórica |
| `src/layouts/WorkspaceLayout.astro` | Añadir Reservas como menú nuevo con visibilidad derivada de permisos y activación |
| `src/styles/workspace.css` | Reutilizar tokens y componentes del panel y completar estados responsive/dark mode |
| PostgreSQL y migraciones existentes | Crear el esquema de reservas con migraciones explícitas, índices, relaciones y protección de concurrencia |
| Archivos privados, notificaciones y trabajadores | Integrar almacenamiento, cola de trabajos y registro de entregas con ámbitos y permisos del módulo |

La identificación de tienda de la facturación actual es reutilizable. Las funciones de importes enteros CLP de ese módulo requieren una representación monetaria general para Reservas. Los comprobantes comerciales de reservas tendrán sus referencias a los documentos de la tienda y, cuando corresponda, al módulo tributario existente.

## Activación y permisos

La habilitación global y la configuración del negocio tendrán estados separados.

| Estado | Responsable | Comportamiento previsto |
| --- | --- | --- |
| Disponible para el negocio | Dueño del SaaS | Concede el derecho a utilizar el módulo |
| Instalado/configurado | Propietario o administrador del negocio | Define tienda, catálogo, profesionales, horarios e integraciones |
| Listo para publicar | Validación del servidor | Comprueba que la configuración permita los flujos que se ofrecen |
| Publicado | Administrador autorizado del negocio | Abre catálogo y reservas públicas |
| Suspendido/revocado | Dueño del SaaS | Cierra nuevas operaciones según política y conserva acceso autorizado al historial |

1. Crear concesiones con clave única `workspace_id + module_id`.
2. Hacer que la escritura de la concesión global requiera la identidad del dueño del SaaS.
3. Validar concesión, estado operativo y permisos en cada endpoint privado y público.
4. Cubrir los intentos de activación desde el panel del negocio y por API directa.
5. Distinguir capacidades de lectura, agenda propia, agenda completa, catálogo, clientes, mensajes, cobros, devoluciones, informes, configuración y API.
6. Evaluar los permisos del registro además de los del rol. Un profesional podrá tener acceso a su agenda o a los profesionales/sedes que le autoricen.
7. Mantener el procesamiento de notificaciones financieras y la conciliación de operaciones existentes al desactivar nuevas reservas.
8. Definir en F1 la política de acceso del cliente a reservas anteriores cuando se suspenda el módulo, incluyendo cancelaciones, devolución y contacto.
9. Mostrar en administración quién activó/desactivó el módulo, cuándo y qué configuración falta.
10. Mantener la transferencia de propietario compatible con las suscripciones, profesionales e historial del módulo.

## Arquitectura de datos y consistencia

El esquema se diseñará por negocio y conservará identidades estables para las referencias externas.

| Dominio | Entidades previstas |
| --- | --- |
| Configuración | Concesiones del módulo, instalación, versión, políticas y configuración de integraciones |
| Catálogo | Servicios, categorías, duraciones, extras, paquetes y productos equivalentes de tienda |
| Personas | Profesionales, relación con usuarios internos, clientes y correspondencias de cliente externo |
| Lugares y recursos | Sedes, categorías de sede, recursos, cantidades y asignaciones |
| Disponibilidad | Horarios, días especiales, ausencias, reglas, ocupaciones y retenciones temporales |
| Operación | Reservas, participantes, series, excepciones, motivos y cambios de estado |
| Eventos | Eventos, fechas, tipos de entrada, reglas de precio, inscripciones, tickets, check-ins y lista de espera |
| Comercio | Carritos, intenciones, pedidos externos, líneas, importes, impuestos, cupones, cobros, saldos y devoluciones |
| Clientes | Sesiones del portal, métodos de acceso, verificación de contacto y enlaces de gestión |
| Automatización | Workflows, condiciones, acciones, trabajos, entregas, conversaciones y recuperación de carritos |
| Integración | Credenciales cifradas, mapeos externos, checkpoints, canales de sincronización y webhooks recibidos |
| Seguimiento | Auditoría, incidencias, exportaciones y resultados de importación |

F1 fijará las tablas, los repositorios y las rutas de acceso. Cada relación entre datos de negocio deberá comprobar también `workspace_id`. Las relaciones e índices compuestos evitarán asociaciones entre negocios.

Las reservas, retenciones, asignaciones de recursos y cupos tendrán transacciones y controles de concurrencia en PostgreSQL. La disponibilidad mostrada al cliente se volverá a validar al retener y al confirmar. Para recursos exclusivos se evaluarán restricciones de solapamiento en base de datos. Para capacidades múltiples se bloquearán las filas de capacidad que participan en la operación, con un orden de bloqueo estable.

Las reservas usarán un instante UTC, la zona IANA del negocio y el contexto horario del cliente. La recurrencia conservará reglas y excepciones junto a sus ocurrencias. Los importes usarán moneda y unidades menores de esa moneda. Cada pedido conservará la instantánea aceptada de sus precios y reglas.

Los trabajadores consumirán eventos persistidos con claves de idempotencia. Las acciones externas se ejecutarán después de guardar el cambio interno que las origina. Se conservarán los intentos y las referencias externas para reanudar operaciones interrumpidas.

La configuración de generación de esquema de Payload se ajustará al esquema decidido. Si se utilizan tablas SQL gestionadas manualmente, sus patrones se añadirán a los filtros del adaptador, siguiendo el tratamiento existente de las tablas fiscales. Las migraciones y los tipos del proyecto se entregarán juntos.

## Pagos mediante Shopify, WooCommerce y Payload

La unidad de integración será la tienda activa del negocio, con proveedor, identidad estable y credenciales autorizadas. Cambiar la tienda no reinterpretará las reservas o pedidos históricos como si pertenecieran a la nueva conexión.

| Proveedor | Checkout previsto | Confirmación y devolución | Dependencia que debe verificarse |
| --- | --- | --- | --- |
| Shopify | Checkout nativo mediante carrito Storefront con productos/variantes de servicios o borrador con enlace de cobro para los casos que lo requieran | Notificaciones firmadas y consulta canónica del pedido/transacciones. Devoluciones mediante Shopify | Acceso de escritura que requiera la estrategia elegida, productos reservables, políticas de descuento y comportamiento de la pasarela |
| WooCommerce | Checkout de la tienda o enlace `order-pay` de un pedido vinculado. Puente del módulo para metadatos y validación de servicios/cupos | Eventos firmados, lectura del pedido y estado real del pago. Reembolso por el método de la tienda cuando lo soporte | Credenciales actuales, endpoints de escritura y compatibilidad del checkout con sus pasarelas |
| Payload | Carrito/pedido y flujo de pago del ecommerce conectado, con el adaptador ya configurado en esa tienda | Validación de la transacción y finalización del pedido mediante el ecommerce. Devolución por el adaptador de la tienda | Configuración y versión del ecommerce externo, endpoints y capacidades reales del adaptador |

Shopify ofrece carritos con URL de checkout y borradores que permiten enlaces seguros de cobro y líneas personalizadas. La elección de cada ruta se cerrará en F1/F4 según el tipo de precio, depósito y producto. [Carrito Storefront](https://shopify.dev/docs/api/storefront/latest/mutations/cartCreate), [borradores de pedido](https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderCreate).

WooCommerce dispone de checkout y pago de pedidos existentes. Se utilizará el flujo que preserve la pasarela de la tienda y su validación del pedido. [Checkout](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/checkout), [pago de pedido existente](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/checkout-order), [endpoints de pago](https://developer.woocommerce.com/docs/best-practices/urls-and-routing/woocommerce-endpoints/).

Payload dispone de adaptadores de pago y validación de la transacción del ecommerce. El módulo consumirá las capacidades del ecommerce configurado por el negocio. [Adaptadores de pago de Payload](https://payloadcms.com/docs/ecommerce/payments).

### Secuencia del cobro

1. Resolver servicio, duración, sede, profesional, asistentes, extras o entradas.
2. Calcular en servidor la disponibilidad y una cotización versionada.
3. Retener todos los recursos/cupos necesarios en una transacción.
4. Crear o recuperar una intención comercial con clave de idempotencia.
5. Crear el carrito o pedido en la tienda y guardar su identidad y líneas.
6. Mostrar el desglose y solicitar confirmación si la tienda modifica precio, impuesto, descuento o moneda.
7. Llevar al cliente al checkout de su tienda.
8. Recibir el evento de pago y verificarlo contra la transacción/pedido canónico.
9. Confirmar reserva y saldo dentro de una transacción coherente con las ocupaciones.
10. Emitir confirmación, comprobante, tickets y trabajos de integración a partir del evento persistido.

El retorno del navegador desde el checkout servirá para presentar el estado verificado de la operación. Los webhooks se deduplicarán por proveedor, tienda y evento. La conciliación programada recuperará operaciones cuando una notificación no llegue.

### Depósitos, cupones e impuestos

- El depósito fijo o porcentual será una primera operación con su importe real. El saldo posterior tendrá su propio enlace/pedido y sus referencias.
- Se definirán explícitamente descuentos sobre total, depósito y saldo para evitar aplicar el mismo cupón dos veces.
- La política de cupones se mapeará a códigos o ajustes que la tienda pueda representar y validar.
- El desglose final de impuestos y descuentos deberá coincidir con lo que la tienda cobró.
- Las reglas de entradas, grupos y paquetes conservarán las cantidades y conceptos que dieron origen al importe.
- Se conservará evidencia de la capacidad de pago posterior/manual que permita cada tienda y su método. Las transferencias pendientes tendrán un estado visible.

### Incidencias financieras que forman parte del producto

| Situación | Resolución prevista |
| --- | --- |
| Pago aprobado y webhook retrasado | Consultar estado canónico y confirmar con idempotencia si el cupo sigue disponible |
| Pago aprobado después de expirar la retención | Revalidar cupo en transacción. Si falta capacidad, abrir incidencia de pago sin cupo y aplicar la política de alternativa/devolución definida por el negocio |
| Dos pagos sobre una intención | Registrar ambos movimientos, confirmar una única operación y gestionar el excedente |
| Webhook repetido o fuera de orden | Deduplicar y reconstruir el estado desde los movimientos canónicos |
| Pago autorizado pendiente de captura | Mantener el estado que corresponda a esa evidencia y a la política de reserva |
| Reembolso parcial | Distribuirlo entre conceptos y actualizar el saldo y sus referencias |
| Devolución fallida o sin soporte automático de la pasarela | Mostrar la acción pendiente y el procedimiento de resolución del negocio |
| Tienda desconectada o reemplazada | Conservar la identidad de origen y los accesos de conciliación de las operaciones existentes |
| Reserva anulada mientras el cliente paga | Aplicar la política de incidencia con evidencia del orden de los hechos |
| Pedido mixto o carrito con varias reservas | Resolver de forma explícita qué líneas y cupos cubre cada pago y cada devolución |

F4 entregará una tabla de capacidades comprobadas por proveedor para depósito, pago posterior, cupones, impuestos, devolución parcial y carrito mixto. Las diferencias de proveedor tendrán un flujo concreto y mensajes de producto.

## Experiencia del módulo

El menú nuevo **Reservas** abrirá la agenda operativa. Sus destinos propuestos son Agenda, Reservas, Eventos, Clientes, Servicios, Profesionales, Sedes y recursos, Pedidos y pagos, Mensajes, Automatizaciones, Informes y Configuración. La organización y la densidad se validarán con los roles que los usan.

- Agenda con filtros persistentes, zona horaria visible, creación rápida y acceso al detalle.
- Detalle con resumen de cliente, servicio, horario, pago y acciones pertinentes al estado actual.
- Formularios de configuración por secciones, con vista previa cuando afectan al formulario público.
- Asistente público que conserva lo ingresado al retroceder y ofrece alternativas cuando pierde un cupo.
- Total, depósito, saldo y conceptos de precio visibles antes de ir al checkout.
- Hora y zona comprensibles en selección, confirmación, correos, calendario y portal.
- Expiración de retención visible y recuperación que vuelve a comprobar disponibilidad.
- Recurrencias y reservas grupales con previsualización de conflictos antes de confirmar.
- Estados vacíos con una acción útil para crear, conectar o corregir la búsqueda.
- Errores por campo y errores de integración con recuperación de datos ya ingresados.
- Confirmaciones explícitas para cancelaciones, transferencias de cupos, cambios masivos y devoluciones.
- Menús operables por teclado, foco restaurado al cerrar/guardar y avisos accesibles.
- Calendario y listados utilizables en móvil. Las alternativas a arrastrar permitirán completar las mismas acciones.
- Logo por negocio y coherencia en colores, tipografía, espaciado y modo oscuro.
- Recordatorios y mensajes con estado real de entrega y reintento.
- Escáner de entradas con estado claro de válido, usado, anulado o fecha incorrecta.
- Lista de espera con plazo de invitación y capacidad reservada para cada oferta.

La inclusión de una función de UX se vinculará a una tarea o error real del flujo y se validará con el caso correspondiente de la matriz.

## Fases y dependencias

| Fase | Trabajo y entregables | Depende de | Condición de cierre |
| --- | --- | --- | --- |
| F0 | Congelar ZIP e inventario, validar el comportamiento de referencia, completar correspondencias de archivos y capacidades, y reorganizar la barra lateral | Código y ZIP recibidos | Cada componente propio tiene función/adaptación asignada y la navegación conserva rutas y permisos |
| F1 | Manifiesto, concesiones globales, permisos, esquema, contratos de tienda y rutas del módulo | F0 | Activación exclusiva del dueño del SaaS y aislamiento entre negocios probado por API |
| F2 | Onboarding, catálogo, profesionales, clientes, sedes, recursos y horarios base | F1 | Un negocio puede configurar un catálogo reservable y recuperar su configuración |
| F3 | Disponibilidad, buffers, límites, cupos, retenciones y ciclo de vida de cita | F2 | Las pruebas concurrentes conservan recursos y capacidades y permiten reservas básicas |
| F4 | Tiendas, checkout, pedidos, depósitos/saldos, grupos, recurrencias, paquetes, cupones, impuestos y devoluciones | F3 | Matriz de cobro completa en los tres proveedores y recuperación de fallos parciales |
| F5 | Interfaz operativa y pública, portal cliente, formularios, marca, enlaces y accesibilidad | F1–F4 | Flujos completos de personal y cliente verificados en móvil, escritorio, teclado y ambos temas |
| F6 | Eventos, tipos/precios de entrada, PDF/QR, check-in y espera | F3–F5 | Pruebas de último cupo, invitación, pago y escaneo duplicado superadas |
| F7 | Trabajos, workflows, mensajes, correos, SMS, WhatsApp, Google, Meet, Zoom, Mailchimp y webhooks | F3–F6 | Operaciones externas idempotentes y fallos de conexión recuperables con evidencia |
| F8 | Informes, importación/exportación, REST/MCP, ayuda, auditoría y migraciones de referencia | F2–F7 | Los bloques de alcance tienen implementación, prueba y correspondencia de datos |
| F9 | Validación integral, migración de ensayo, restauración, despliegue gradual y aceptación | F0–F8 | Todas las filas aplicables verificadas, incidencias resueltas y evidencia de recuperación en cada tienda |

F5 tendrá prototipos y decisiones de interacción desde F1 para evitar rehacer contratos y modelos cuando llegue la interfaz. Su cierre depende de los motores y flujos de pago. F7 empezará con la infraestructura de trabajos desde F1 y cerrará al verificar sus integraciones.

El primer recorrido completo será activar el módulo, configurar un servicio y profesional, reservar un horario, pagar con la tienda y recibir confirmación. Las funciones avanzadas de la matriz se añadirán conservando ese recorrido. La liberación funcional completa corresponde al cierre F9.

## Criterios de prueba y liberación

| Grupo | Casos que deben quedar cubiertos |
| --- | --- |
| Negocios y roles | Acceso cruzado por ID, exportación, descarga, webhook, portal, API, MCP y trabajo en cola. Propietario de negocio intentando activar concesión global |
| Agenda | Mismo cupo desde varias sesiones, buffers, varias sedes, recurso compartido, capacidad grupal, límites diarios y máximo de citas futuras |
| Fechas | America/Santiago, otras zonas, fin de mes, años bisiestos, horas repetidas/inexistentes y series con excepciones |
| Clientes | Contraseña, OTP, recuperación, cambio de contacto, Google/Facebook, sesiones expiradas y enlace gestionado por otra persona |
| Precios | CLP y monedas con decimales, extras por unidad/persona, tarifa base, cupón agotado, precio modificado e impuestos de tienda |
| Pagos | Aprobado, pendiente, rechazado, cancelado, autorizado, capturado, saldo, parcial, duplicado y pago tardío |
| Conciliación | Firma inválida, duplicación, reordenación, notificación perdida, timeout después de crear pedido y reinicio del trabajador |
| Eventos | Última entrada, precio por fecha, cupo global/tipo, invitación vencida, último cupo reclamado en paralelo y escaneo repetido |
| Integraciones | Token revocado, watch vencido, paginación, límite de API, evento borrado, reunión compartida y reintento de envío |
| Importación | Mapeo de IDs, contactos duplicados, referencia faltante, archivo inválido, ejecución parcial y restauración |
| Interfaz | Deep links, atrás/adelante, recarga, ambos temas, foco, teclado, lector de pantalla, móvil y contenido largo |
| Desactivación | Módulo revocado antes/durante checkout, citas previas, conciliación y configuración conservada |
| Operación | Cola interrumpida, migración de base existente, respaldo restaurado y despliegue con cambio de versión |

Cada proveedor de tienda se probará con una cuenta/ambiente de ensayo y sus pasarelas habilitadas. Las capturas de interfaz y los mocks serán evidencia de esos componentes, junto con las pruebas reales del motor y las integraciones que correspondan.

El cierre registrará por fila el código entregado, migración, prueba, resultado y evidencia. Los estados serán Planificado, En implementación, Implementado pendiente de validar y Verificado. Las dependencias externas pendientes conservarán su estado y siguiente acción.

La auditoría final comparará el ZIP congelado, sus controladores/helpers/modelos/vistas y los casos observables de referencia con la matriz. Los archivos cuyo campo `featureReferences` esté vacío en el inventario tendrán revisión de clasificación en F0/F8. Las dependencias y recursos se rastrearán por su función de soporte. Las declaraciones del README que requieran un adaptador ausente quedarán identificadas con su dependencia.

## Matriz de alcance

Las fuentes se han comprobado contra los archivos extraídos. Los criterios son objetivos de implementación y aceptación. El estado inicial de los bloques del módulo es Planificado. ORB04, ORB05 y ORB06 corresponden a los cambios de navegación ya verificados.

| ID | Capacidad | Referencia dentro del ZIP | Fase | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| CAT01 | Servicios, estado, imagen, descripción, precio de referencia y precio de cobro | `C:lib/controllers/services_controller.php` | F2 | Crear, duplicar, editar y desactivar un servicio conservando reservas históricas. |
| CAT02 | Categorías y jerarquía de servicios | `P:lib/helpers/feature_service_categories_helper.php` | F2 | Asignar categorías y mostrar el catálogo filtrado con el orden configurado. |
| CAT03 | Duraciones alternativas y sus precios | `P:lib/helpers/feature_service_durations_helper.php` | F2 | Cambiar duración recalcula importe, fin de cita y disponibilidad. |
| CAT04 | Extras, cantidades, duración y selección mínima/máxima | `P:lib/helpers/feature_service_extras_helper.php` | F2 | Validar restricciones y sumar duración e importe según las cantidades elegidas. |
| CAT05 | Paquetes y saldo de sesiones por servicio | `P:lib/controllers/bundles_controller.php; C:lib/models/bundle_model.php` | F4 | Comprar y consumir sesiones sin exceder el saldo, incluso con dos solicitudes simultáneas. |
| CAT06 | Visualización de servicios individuales, paquetes o ambos | `P:lib/helpers/feature_service_display_mode_helper.php` | F5 | El catálogo público respeta el modo y la visibilidad interna de cada producto. |
| CAT07 | Profesionales múltiples, perfiles, contactos y servicios ofrecidos | `P:lib/controllers/agents_controller.php` | F2 | Administrar perfiles y asignar servicios, sedes y usuarios internos sin ampliar sus permisos. |
| CAT08 | Sedes múltiples, categorías, dirección y datos de contacto | `P:lib/controllers/locations_controller.php; P:lib/controllers/location_categories_controller.php` | F2 | Cada servicio/profesional solo ofrece las sedes autorizadas. |
| CAT09 | Recursos físicos y cantidades disponibles | `P:lib/helpers/feature_assets_helper.php` | F3 | Reservar salas o equipamiento respetando unidades, disponibilidad y ámbito del negocio. |
| CAT10 | Asignación automática de profesional y sede | `C:lib/helpers/booking_helper.php` | F3 | La opción cualquier profesional/sede elige una combinación realmente disponible. |
| DIS01 | Horarios semanales de negocio, servicio, profesional y sede | `C:lib/models/work_period_model.php; P:lib/views/agents/_form.php` | F3 | Resolver prioridades y cruces de horarios con varias franjas diarias. |
| DIS02 | Días especiales, rangos, feriados, ausencias y bloqueos rápidos | `C:lib/models/off_period_model.php; C:lib/views/settings/custom_day_schedule_form.php` | F3 | Los días especiales y bloqueos eliminan los horarios afectados al instante. |
| DIS03 | Buffers antes/después e intervalos de inicio | `C:lib/views/services/_form.php` | F3 | Los márgenes ocupan recursos y los inicios respetan el intervalo configurado. |
| DIS04 | Anticipación mínima, horizonte máximo y fechas fijas | `C:lib/views/settings/general.php; C:lib/views/services/_form.php` | F3 | Aplicar reglas globales y excepciones por servicio con límites exactos. |
| DIS05 | Máximos diarios de negocio, servicio y profesional | `P:lib/helpers/feature_max_bookings_per_day_helper.php` | F3 | La última reserva admitida cierra el día correspondiente de forma atómica. |
| DIS06 | Máximo de reservas futuras por cliente | `C:lib/views/settings/general.php` | F3 | Un cliente no supera su cupo aunque reserve desde varias pestañas. |
| DIS07 | Zonas horarias, formato horario e intervalos DST | `P:lib/helpers/feature_timezone_helper.php` | F3 | Mostrar zona explícita y resolver horas inexistentes/duplicadas y cambios estacionales. |
| DIS08 | Reglas de concurrencia entre profesionales, sedes y servicios | `C:lib/views/settings/general.php; C:lib/helpers/resource_helper.php` | F3 | Respetar exclusividad de sede y presencia del profesional, además de simultaneidad autorizada. |
| DIS09 | Retención temporal del cupo durante checkout | `C:lib/helpers/booking_helper.php` | F3 | Crear, renovar según política y expirar holds sin vender dos veces el último cupo. |
| DIS10 | Disponibilidad rápida, primer horario y ocultación de agotados | `C:lib/helpers/steps_helper.php` | F3 | La búsqueda rápida y el calendario completo ofrecen el mismo inventario. |
| RES01 | Crear, editar, aprobar, rechazar y cancelar citas | `C:lib/controllers/bookings_controller.php` | F3 | Cada transición registra actor, motivo y versión y respeta los permisos. |
| RES02 | Estados configurables y reglas de bloqueo del calendario | `C:lib/views/settings/general.php` | F3 | Los estados adicionales respetan su efecto sobre cupos, pendientes y visibilidad. |
| RES03 | Reprogramación y motivos de cambio/cancelación | `P:lib/helpers/feature_booking_reasons_helper.php; C:lib/helpers/customer_helper.php` | F3 | Reservar el nuevo horario y liberar el anterior en una única operación lógica. |
| RES04 | Recurrencia diaria, semanal y mensual, fin y excepciones | `P:lib/helpers/feature_recurring_bookings_helper.php` | F4 | Previsualizar toda la serie, conflictos y límites antes de confirmar sus ocurrencias. |
| RES05 | Reservas grupales, mínimos, máximos y participantes | `P:lib/helpers/feature_group_bookings_helper.php` | F4 | La capacidad y la política de bloqueo por mínimo se aplican a cada franja. |
| RES06 | Cargos por persona, tarifa base, extras y depósito grupal | `P:lib/helpers/feature_group_bookings_helper.php; P:lib/helpers/feature_base_fee_helper.php` | F4 | Calcular una tarifa base por reserva y multiplicar solo los conceptos configurados. |
| RES07 | Ausencias y restricción por no-show | `P:lib/helpers/feature_no_show_restrictions_helper.php` | F4 | Contabilizar reversiblemente las ausencias y exigir prepago o bloquear según configuración. |
| RES08 | Agenda día/semana/mes, filtros y edición rápida | `C:lib/controllers/calendars_controller.php; C:lib/controllers/bookings_controller.php` | F5 | Visualizar y gestionar citas por profesional, servicio, sede y estado en escritorio/móvil. |
| RES09 | Selección múltiple, acciones masivas y exportación de reservas | `C:lib/controllers/bookings_controller.php; C:lib/helpers/booking_helper.php` | F5 | Previsualizar alcance, validar cada registro y reportar resultados parciales sin ocultar errores. |
| RES10 | Búsqueda global, pendientes y actividad de reservas | `C:lib/controllers/search_controller.php; C:lib/controllers/activities_controller.php` | F5 | Encontrar reservas y revisar cambios con acceso limitado al negocio y rol. |
| EVT01 | Eventos publicados, categorías y múltiples fechas | `C:lib/controllers/events_controller.php; C:lib/models/event_date_model.php` | F6 | Publicar eventos por fecha y zona horaria con estados y categorías. |
| EVT02 | Cupos, precio e inscripciones de eventos | `C:lib/controllers/event_registrations_controller.php` | F6 | Inscribir, cancelar y exportar participantes sin superar capacidad. |
| EVT03 | Tipos de entrada y capacidad por tipo | `P:lib/helpers/feature_event_ticket_types_helper.php` | F6 | Ofrecer General/VIP u otros tipos y comprobar simultáneamente cupo global y por tipo. |
| EVT04 | Tarifas de entradas por rango de fechas | `P:lib/helpers/feature_event_ticket_types_helper.php` | F6 | Seleccionar la tarifa vigente y pedir confirmación si cambia antes del pago. |
| EVT05 | Entradas individuales/grupales, PDF y QR | `P:lib/helpers/feature_event_tickets_helper.php` | F6 | Emitir las entradas que corresponden al pedido y anularlas cuando proceda. |
| EVT06 | Escáner QR, código manual y check-in | `P:lib/controllers/event_tickets_controller.php` | F6 | Impedir escaneos duplicados y validar fecha, evento y asistentes pendientes bajo concurrencia. |
| EVT07 | Lista de espera por evento/tipo y cantidad | `P:lib/helpers/feature_event_waiting_list_helper.php` | F6 | Ingresar en cola con posición y cantidad, evitando duplicados y exceso de espera. |
| EVT08 | Invitar, promover, retirar y reclamar cupos de espera | `P:lib/helpers/feature_event_waiting_list_helper.php` | F6 | Reservar cupos para una invitación con plazo y convertirla una sola vez tras reclamación. |
| EVT09 | Automatizaciones, avisos y portal para entradas/espera | `P:lib/helpers/feature_event_waiting_list_helper.php; P:lib/helpers/feature_event_tickets_helper.php` | F6 | Enviar confirmaciones y mostrar al cliente sus entradas y el estado de sus invitaciones. |
| CLI01 | Ficha, historial y datos de contacto de clientes | `C:lib/controllers/customers_controller.php` | F2 | Consultar citas, paquetes, pedidos y contacto del cliente dentro de su negocio. |
| CLI02 | Importar clientes CSV, mapeo, duplicados y exportar | `C:lib/helpers/customer_import_helper.php; C:lib/helpers/csv_helper.php` | F8 | Previsualizar columnas, validar filas y evitar duplicados por contacto y negocio. |
| CLI03 | Acceso cliente por contraseña u OTP y recuperación | `C:lib/helpers/auth_helper.php; C:lib/helpers/otp_helper.php` | F5 | Autenticar al cliente y verificar cambios de contacto con tokens de uso único y límites de intento. |
| CLI04 | Acceso Google y Facebook | `P:lib/helpers/social_helper.php` | F7 | Vincular identidades verificadas al cliente correcto sin vincular por un contacto sin verificar. |
| CLI05 | Reserva como invitado y autenticación simplificada | `C:lib/views/settings/general.php; C:lib/controllers/auth_controller.php` | F5 | Aplicar opciones del negocio para identificación, registro, invitado y verificación. |
| CLI06 | Portal cliente, perfil, historial, paquetes, pagos y próximas citas | `C:lib/controllers/customer_cabinet_controller.php` | F5 | Cada cliente accede exclusivamente a su información y sus acciones habilitadas. |
| CLI07 | Enlaces privados para gestionar reserva y pedido | `C:lib/controllers/manage_booking_by_key_controller.php; C:lib/controllers/manage_order_by_key_controller.php` | F5 | Usar enlaces firmados, revocables y limitados a las operaciones permitidas. |
| CLI08 | Reutilización de cliente por correo/teléfono y vínculo con tienda | `C:lib/views/settings/general.php; C:lib/helpers/customer_helper.php` | F2 | Deduplicar según política del negocio y mantener las identidades de clientes y personal diferenciadas. |
| CLI09 | Mensajería cliente-profesional e historial por reserva | `P:lib/helpers/feature_messages_helper.php; P:lib/controllers/messages_controller.php` | F7 | Enviar y leer conversaciones solo si el actor participa y conservar avisos de lectura/envío. |
| FOR01 | Asistente de reserva por pasos y progreso | `C:lib/helpers/steps_helper.php` | F5 | Completar servicio, sede, profesional, fecha, contacto y pago conservando el estado al volver. |
| FOR02 | Orden y personalización de pasos con dependencias | `C:lib/controllers/booking_form_settings_controller.php; C:lib/helpers/steps_helper.php` | F5 | Reordenar pasos válidos, omitir opciones únicas y rechazar secuencias incompatibles. |
| FOR03 | Campos nativos y personalizados para cliente y reserva | `P:lib/helpers/feature_custom_fields_helper.php; P:lib/views/custom_fields/_custom_field_form.php` | F5 | Respetar tipo, condición, valor inicial, obligatoriedad, ancho y visibilidad por rol. |
| FOR04 | Adjuntos y autocompletado de dirección | `P:lib/helpers/feature_custom_fields_helper.php` | F5 | Validar archivos privados y consultar direcciones con la integración autorizada. |
| FOR05 | Precarga desde URL y restricciones de servicio/profesional/sede | `P:lib/helpers/feature_url_prefill_helper.php; C:lib/helpers/steps_helper.php` | F5 | Aceptar solo campos públicos permitidos y validar que las opciones precargadas sean reservables. |
| FOR06 | Páginas instantáneas, enlace, botón y formulario incrustable | `C:lib/views/settings/generate_instant_booking_page.php; C:lib/helpers/shortcodes_helper.php` | F5 | Compartir o incrustar reservas/eventos en Shopify, WooCommerce y Payload con el tema del negocio. |
| FOR07 | Marca por negocio, idioma, textos, diseño y vista previa | `P:lib/helpers/feature_white_label_helper.php; C:lib/helpers/styles_helper.php` | F5 | Aplicar logo y preferencias del negocio junto a los componentes y estética de Orbital. |
| FOR08 | Validación de teléfonos, países y formatos monetarios | `C:lib/views/settings/general.php` | F5 | Validar según país y presentar moneda/fecha sin convertir importes por el formato visual. |
| FOR09 | Antispam, Turnstile y registro opcional de IP | `P:lib/helpers/feature_cloudflare_turnstile_helper.php` | F5 | Verificar el token en servidor y respetar la configuración de trazabilidad del negocio. |
| FOR10 | Enlaces de calendario e iCalendar/QR de confirmación | `C:lib/helpers/icalendar_helper.php; P:lib/helpers/feature_qrcode_helper.php` | F5 | Exportar fechas, zonas, cambios y cancelaciones de la cita correcta. |
| PAG01 | Carrito con varias citas, paquetes y eventos | `C:lib/controllers/carts_controller.php; C:lib/models/order_intent_model.php` | F4 | Crear un checkout coherente para todos sus elementos y retener sus recursos en conjunto. |
| PAG02 | Pago completo, depósito fijo/porcentaje y saldo posterior | `C:lib/helpers/booking_helper.php; C:lib/helpers/payments_helper.php` | F4 | Separar precio total, cobrado, saldo y reserva; reconciliar cada pago real de la tienda. |
| PAG03 | Pago posterior/local y enlaces para cobrar saldo | `C:lib/helpers/invoices_helper.php; C:lib/helpers/payments_helper.php` | F4 | Crear un pedido/enlace nativo y confirmar el pago manual autorizado solo con registro de actor y evidencia. |
| PAG04 | Cupones, reglas, vigencia y límites de uso | `P:lib/controllers/coupons_controller.php; P:lib/helpers/feature_coupons_helper.php` | F4 | Aplicar una única política de descuento y consumir usos de forma atómica, también con paquetes/eventos. |
| PAG05 | Impuestos, tasas y desglose de cargos | `P:lib/controllers/taxes_controller.php; P:lib/helpers/taxes_helper.php` | F4 | Reconciliar el desglose calculado por la tienda y conservar una instantánea del pedido aceptado. |
| PAG06 | Pedidos, transacciones y comprobantes/facturas comerciales | `C:lib/controllers/orders_controller.php; C:lib/helpers/invoices_helper.php` | F4 | Mantener referencias de tienda, estado, importe y enlaces de comprobantes con acceso adecuado. |
| PAG07 | Reembolsos parciales/totales y conciliación | `C:lib/models/transaction_refund_model.php; PP:lib/helpers/payments_paypal_helper.php; MP:lib/helpers/payments_mercadopago_helper.php` | F4 | Solicitar el reembolso mediante la tienda y reflejar el movimiento financiero confirmado una sola vez. |
| PAG08 | Checkout WooCommerce y productos de servicio/paquete | `WC:lib/controllers/payments_woocommerce_controller.php; WC:lib/helpers/payments_woocommerce_helper.php` | F4 | Crear/vincular productos y pedidos; cobrar con los métodos habilitados en esa tienda. |
| PAG09 | Capacidades PayPal del complemento, mediante la tienda activa | `PP:lib/helpers/payments_paypal_helper.php; PP:lib/controllers/payments_paypal_controller.php` | F4 | Conciliar pagos y reembolsos PayPal cuando la tienda tenga esa pasarela configurada. |
| PAG10 | Capacidades Mercado Pago del complemento, mediante la tienda activa | `MP:lib/helpers/payments_mercadopago_helper.php` | F4 | Conciliar preferencia/pedido, pago y devolución usando el identificador canónico que exponga la tienda. |
| PAG11 | Monedas, decimales, importes y ambientes de prueba/producción | `C:lib/helpers/money_helper.php; MP:lib/helpers/payments_mercadopago_helper.php` | F4 | Usar unidades menores de cada moneda y distinguir pagos de prueba, autorización, captura y devolución. |
| PAG12 | Holds, intenciones, reintentos y confirmación fiable de pago | `C:lib/models/payment_request_model.php; C:lib/models/transaction_intent_model.php` | F4 | Tolerar webhooks duplicados/fuera de orden y pagos tardíos sin confirmar una reserva sin cupo. |
| AUT01 | Workflows con disparadores, condiciones y acciones | `C:lib/controllers/processes_controller.php; C:lib/misc/process_action.php` | F7 | Crear, previsualizar y ejecutar reglas sobre citas, eventos, pedidos, pagos y clientes. |
| AUT02 | Recordatorios antes/después y trabajos programados | `P:lib/helpers/feature_reminders_helper.php; C:lib/controllers/process_jobs_controller.php` | F7 | Ejecutar en la zona correcta y cancelar/replanificar trabajos tras reprogramación o cancelación. |
| AUT03 | Plantillas, variables, destinatarios y adjuntos de correo | `C:lib/views/settings/notifications.php; C:lib/helpers/email_helper.php` | F7 | Previsualizar variables y enviar mensajes con adjuntos y destinatarios autorizados. |
| AUT04 | Canal SMS y selección de procesador externo | `C:lib/helpers/sms_helper.php` | F7 | Ofrecer el canal con su adaptador configurado y mostrar los fallos reales de entrega. |
| AUT05 | WhatsApp Meta, plantillas y envío | `WA:lib/helpers/whatsapp_meta_helper.php` | F7 | Seleccionar plantillas del negocio, validar parámetros y registrar envío/error con sus credenciales. |
| AUT06 | Webhooks salientes, cuerpo y variables | `P:lib/helpers/feature_webhooks_helper.php; P:lib/controllers/webhooks_controller.php` | F7 | Enviar eventos autorizados con firma, reintentos y registro de respuestas. |
| AUT07 | Carrito abandonado, recuperación y conversión | `P:lib/helpers/feature_cart_abandonment_helper.php` | F7 | Generar enlace de continuación sin retener cupos indefinidamente y detener avisos al convertir. |
| INT01 | Google Calendar por profesional y múltiples calendarios | `G:lib/helpers/google_calendar_helper.php` | F7 | Conectar por profesional, elegir calendarios de lectura y calendario de escritura. |
| INT02 | Sincronización Google bidireccional, recurrencias y excepciones | `G:lib/models/gcal_event_recurrence_model.php; G:lib/helpers/google_calendar_helper.php` | F7 | Detectar cambios y borrados sin ciclos de sincronización ni pérdida de excepciones. |
| INT03 | Google push/watch, renovaciones, tokens y errores permanentes | `G:lib/helpers/google_calendar_helper.php; G:lib/helpers/google_calendar_relay_helper.php` | F7 | Renovar suscripciones y credenciales, reconstruir una sincronización invalidada y mostrar desconexiones. |
| INT04 | Google Meet para citas individuales/grupales | `G:lib/helpers/google_calendar_helper.php; P:lib/helpers/feature_group_bookings_helper.php` | F7 | Crear/actualizar el enlace y los asistentes; respetar modo compartido o reunión por reserva. |
| INT05 | Zoom, usuarios, reuniones, contraseña y ciclo de vida | `Z:lib/helpers/zoom_helper.php` | F7 | Crear/actualizar/eliminar reuniones por profesional sin duplicar las compartidas. |
| INT06 | Mailchimp, audiencias y contactos | `MC:lib/helpers/mailchimp_helper.php; MC:lib/controllers/mailchimp_controller.php` | F7 | Elegir audiencia y crear/actualizar el contacto con el consentimiento y estado adecuados. |
| INT07 | Extensibilidad de reuniones, SMS, marketing y enlaces cortos | `C:lib/helpers/meeting_systems_helper.php; C:lib/helpers/marketing_systems_helper.php; C:lib/helpers/short_links_systems_helper.php` | F7 | Mantener contratos de adaptador y distinguir los procesadores presentes de los que requieren integración adicional. |
| INT08 | Integración con editores WordPress y sitios de la tienda | `C:lib/helpers/blocks_helper.php; C:lib/helpers/elementor_helper.php; C:lib/helpers/bricks_helper.php` | F5 | Ofrecer equivalentes de botón/lista/formulario mediante incrustación y puentes de tienda. |
| OPS01 | Panel de control, estadísticas y servicios más solicitados | `C:lib/controllers/dashboard_controller.php; C:lib/abilities/analytics/` | F8 | Mostrar datos reales por período, profesional, servicio y sede con definiciones de métricas. |
| OPS02 | Roles personalizados, capacidades y acceso por registro | `P:lib/controllers/roles_controller.php; C:lib/helpers/roles_helper.php` | F1 | Restringir lectura/escritura de agenda, clientes, cobros, sedes y profesionales según rol. |
| OPS03 | Panel propio del profesional y relación con usuario interno | `P:lib/controllers/agents_controller.php; C:lib/controllers/default_agent_controller.php` | F5 | Un profesional gestiona solo los registros que tiene asignados/autorizados. |
| OPS04 | Auditoría, registros de actividad y diagnóstico | `C:lib/controllers/activities_controller.php; P:lib/controllers/debug_controller.php` | F8 | Registrar cambios y errores operativos con identificadores correlacionados y secretos redactados. |
| OPS05 | Importar/exportar respaldo y migrar versiones de datos | `C:lib/views/settings/import_modal.php; C:lib/helpers/migrations_helper.php; P:lib/controllers/updates_controller.php` | F8 | Previsualizar la migración, preservar referencias y restaurar un respaldo probado en un negocio de ensayo. |
| OPS06 | Onboarding y configuración inicial | `C:lib/controllers/wizard_controller.php` | F2 | Completar servicio, profesional, horario, marca, tienda y una reserva de prueba con progreso guardado. |
| OPS07 | API REST, filtros, paginación, serializadores y claves | `P:lib/api/` | F8 | Exponer servicios, disponibilidad, profesionales, sedes, clientes, reservas, pedidos, pagos y cupones con scopes. |
| OPS08 | Abilities/MCP con lectura, edición y eliminación configurables | `C:lib/abilities/; P:lib/abilities/` | F8 | Aplicar scopes, permisos por registro y revocación a cada herramienta; probar también cobros/reembolsos. |
| OPS09 | Ayuda contextual, accesos rápidos y tareas operativas | `C:lib/controllers/support_topics_controller.php; C:lib/controllers/todos_controller.php` | F8 | Vincular ayuda y pendientes del módulo a los flujos de Orbital con contexto del negocio. |
| OPS10 | Activación, versiones, marca y analítica opcional del producto | `P:lib/controllers/addons_controller.php; C:lib/helpers/analytics_helper.php` | F1 | Administrar disponibilidad/versiones desde el SaaS y dejar cualquier analítica externa sujeta a configuración explícita. |
| FOR11 | Código de conversión y variables de confirmación | `C:lib/views/settings/general.php` | F5 | Configurar seguimiento de conversión por negocio con sus variables y verificar el aislamiento del código público respecto del panel interno. |
| ORB01 | Activar y desactivar Reservas por negocio desde /administracion | `Solicitud del usuario` | F1 | Solo el dueño del SaaS concede acceso; comprobar API directa y sesión de un propietario de negocio. |
| ORB02 | Nuevo menú Reservas dentro de Orbital | `Solicitud del usuario` | F1 | Mostrar el menú solo cuando coincidan activación global, configuración del negocio y permisos. |
| ORB03 | Pagos Shopify y Payload mediante sus checkouts existentes | `Solicitud del usuario` | F4 | Completar la misma matriz de pagos y devoluciones en Shopify, WooCommerce y Payload. |
| ORB04 | Gestión Creativa como padre de Espacios, Tareas, Notas, Calendario y Archivos | `Solicitud del usuario` | F0 | Expandir/contraer y revelar el hijo activo incluso al entrar por URL directa. |
| ORB05 | Empresa como padre de Documentos, Accesos y Equipo | `Solicitud del usuario` | F0 | Respetar permisos de hijos y conservar Personas/Votaciones bajo Equipo. |
| ORB06 | Iconos primarios al hover y blancos con brillo en dark mode | `Solicitud del usuario` | F0 | Comprobar SVG, iconos con máscara y navegación de teclado en ambos temas. |
| ORB07 | UX compartida, responsive y accesible | `Solicitud del usuario` | F5 | Completar flujos por teclado y móvil con estados de carga, errores recuperables y confirmación de operaciones. |

## Dependencias que se resolverán durante la ejecución

- Credenciales y permisos de escritura de las tres tiendas de ensayo. Orbital tiene conectores de lectura y facturación que requieren extensión para checkout.
- Forma de representar servicios de precio variable, depósitos, paquetes y entradas en cada tienda. La decisión incluirá productos/variantes, borradores o líneas admitidas y su efecto en descuentos e impuestos.
- Endpoints y adaptadores que expone el ecommerce Payload conectado al negocio.
- Cuentas de prueba de Google y Zoom, configuración de Mailchimp y WhatsApp Meta, y un procesador SMS cuando se habilite ese canal.
- Infraestructura y frecuencia del trabajador de reservas, junto con sus reintentos y conciliación.
- Política por negocio para cancelaciones, ausencias, cobros manuales, reembolsos y pagos aprobados sin cupo.
- Datos de origen si se solicita migrar una instalación existente. El ZIP aporta código de plugins.
- Clasificación de contratos de extensión y capacidades mencionadas en textos de ayuda cuyo adaptador no se incluye.
- Avisos y licencias de los componentes que se reutilicen, y sustitución de dependencias específicas del runtime WordPress por equivalentes de Orbital.

## Referencias de integración complementarias

La sincronización de Google se verificará con checkpoints de sincronización y renovación de canales de notificación. [Sincronización incremental](https://developers.google.com/workspace/calendar/api/guides/sync), [notificaciones push](https://developers.google.com/workspace/calendar/api/guides/push).

Zoom se verificará contra la API y el tipo de aplicación que autorice cada conexión. Mailchimp tendrá correspondencias de audiencia y contacto. [API de reuniones Zoom](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/), [alta/actualización de contactos Mailchimp](https://mailchimp.com/developer/marketing/api/lists/members/upsert-member).

La documentación externa se comprobó el 17 de noviembre de 2026. La implementación fijará versiones de API y contratos comprobados en el entorno de ensayo de cada proveedor.
