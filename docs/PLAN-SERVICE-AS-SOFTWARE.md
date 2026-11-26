# Plan de trabajo · Orbital como Service-as-a-Software

**Objetivo** · Que un negocio pueda delegar trabajo en Orbital, entender qué se hizo y resolver desde un solo lugar lo que requiere su criterio. El plan abarca Agendamiento, CRM, Tienda y ERP, Facturación, Gestión creativa y Empresa. Cada área conserva herramientas de operación manual y gana servicios que entregan resultados verificables.

**Decisión propuesta** · Mantener una sola experiencia de negocio. Separar la ejecución por dominio, con permisos y registros propios. Empezar con un recorrido completo entre áreas, medirlo con clientes y ampliar su cobertura en etapas. La tesis toma de Richard Kerby el foco en trabajo ejecutado, resultados medibles y un precio vinculado al valor entregado. [Artículo de Richard Kerby](https://www.linkedin.com/pulse/rise-service-as-a-software-software-works-you-richard-kerby-tzuic/)

## 1. La experiencia que queremos vender

Al entrar, el usuario encuentra tres respuestas: **qué se resolvió, qué viene y qué necesita de mí**. Desde ahí puede abrir un caso, aprobar una acción o ir al área que corresponde. Las áreas existentes siguen disponibles para buscar, corregir y trabajar manualmente con permisos.

| Superficie | Qué podrá hacer el usuario |
| --- | --- |
| **Inicio** | Ver los resultados del día y las decisiones pendientes, ordenadas por urgencia. Abrir el caso exacto desde el resumen, con su próxima acción y el responsable. |
| **Bandeja de decisiones** | Resolver en un solo lugar casos de agenda, clientes, pedidos, proyectos y documentos. Cada tarjeta muestra el motivo, la evidencia y el efecto de aprobar o rechazar. |
| **Historial del caso** | Seguir la cadena completa desde una consulta, una reserva o un pedido hasta su resultado. Ver qué hizo Orbital, qué confirmó el equipo y qué sigue pendiente. Las referencias entre áreas respetan los permisos del usuario. |
| **Activar un servicio** | Elegir un resultado, revisar las reglas sugeridas, ver una simulación con casos recientes y activar con la autorización correspondiente. La habilitación se mantiene por negocio desde Administración. |
| **Operación sin conexión al panel** | Recibir el resumen en el canal acordado y acceder al caso con un enlace directo. Los clientes finales pueden responder desde un enlace acotado a su cita o solicitud. |

**Ejemplo del recorrido inicial.** Un estudio recibe una consulta. El contacto queda vinculado a la reserva y Orbital solicita confirmación. Al responder el cliente, Orbital actualiza la agenda y deja el contexto en su ficha. Cuando el profesional marca la atención como realizada, Orbital crea el seguimiento acordado y, si existe un pedido conciliado, prepara los datos para revisión de facturación. El dueño ve el resultado y solo interviene si hay, por ejemplo, un pago sin correspondencia o una solicitud de cambio de hora.

**La diferencia de producto.** Cada servicio ofrece una promesa con principio, fin y evidencia. Antes de activar una regla, la simulación muestra qué casos habría resuelto, cuáles habría derivado y por qué. Después de activarla, Inicio muestra resultados reales y permite pausar el servicio. Un campo para pedir acciones en lenguaje natural puede incorporarse más adelante si ayuda a encontrar o iniciar flujos ya definidos.

## 2. Mapa de trabajo para todo el proyecto

| Área | Qué se aprovecha hoy | Servicio que debe entregar | Primer alcance y límite |
| --- | --- | --- | --- |
| **Agendamiento** | Catálogo, disponibilidad, reservas internas, historial y retenciones de pago. | **Agenda preparada**. Orbital confirma citas, actualiza la agenda y deriva excepciones antes del corte. Después prueba recuperar horarios cancelados. | Correo y respuesta estructurada. La falta de respuesta conserva la cita. Recuperación de cupos requiere lista de espera autorizada y validación de disponibilidad. |
| **CRM y clientes** | Clientes de tienda y de reservas, contactos y sus referencias de origen. | **Consultas atendidas**. Vincular una consulta con su contacto, asignarla, hacer seguimiento y cerrar con una próxima acción, una reserva o un motivo documentado. | Empezar con un formulario o canal autorizado. Revisar coincidencias ambiguas antes de unir fichas. El CRM inicial cubre seguimiento y trazabilidad. |
| **Tienda y ERP** | Pedidos, clientes, métricas y conexiones con WooCommerce, Shopify o Payload. | **Pedidos conciliados**. Revisar pedidos y pagos, detectar diferencias, reunir comprobantes y entregar un cierre diario. | Partir con un proveedor de tienda y lectura de pedidos y pagos. Extender a alertas de inventario, compras y proveedores cuando el dato sea fiable y el piloto valide demanda. |
| **Facturación y Contabilidad** | Asociación de comprobantes, módulo fiscal nativo y proceso de fondo para facturación. | **Documentos tramitados**. Preparar documentos elegibles, solicitar revisión cuando corresponda y reflejar emisión, entrega o excepción según la evidencia. | Primero preparar y conciliar. Autorizar la emisión por negocio, tipo de documento y estado de pago solo después de validar el circuito fiscal. Un envío incierto se reconcilia antes de reintentar. |
| **Proyecto y Gestión creativa** | Espacios, tableros, tareas, notas, calendario, archivos y colaboración. | **Entregas coordinadas**. Convertir un trabajo aceptado en un proyecto con responsables, fechas y checklist. Pedir actualizaciones, agrupar bloqueos y preparar el cierre. | Empezar con una plantilla de servicio. Los responsables conservan control sobre compromisos, aprobación de entregables y cambios de alcance. |
| **Empresa y administración del negocio** | Equipo, permisos, invitaciones, documentos, accesos, votaciones y Configuración. | **Incorporación y revisiones al día**. Coordinar altas, solicitar documentos faltantes y asignar revisiones o renovaciones internas con evidencia. | Empezar por onboarding y vencimientos. Las concesiones de acceso, el manejo de secretos y las decisiones de equipo requieren la autorización del rol correspondiente. |
| **Administración de Orbital** | Activación de módulos, roles, planes y operación de la plataforma. | **Servicios operables a escala**. Habilitar por negocio, hacer seguimiento de calidad, diagnosticar fallas y revisar consumo, soporte y costo por resultado. | Despliegue gradual, pausa, historial y métricas de operación. Las vistas de soporte aplican el alcance de acceso que corresponda. |

El ERP y el CRM amplios siguen como líneas de evolución. El primer cierre de pedidos y la primera ficha de seguimiento sirven para validar qué piezas justifican inversión adicional. [Visión de aplicaciones](01-vision-y-aplicaciones.md) · [Estado de Agendamiento](ESTADO-MODULO-RESERVAS.md) · [Operación de Agendamiento](OPERACION-AGENDAMIENTO.md) · [Validación de Facturación](../modules/billing-cl/VALIDACION.md)

## 3. Qué separar y qué compartir

**Separar por dominio dentro del stack actual.** Empezar con Astro, Payload, PostgreSQL y los procesos de fondo del repositorio. Definir propietarios claros de los datos y reglas antes de decidir despliegues independientes. Separar procesos en infraestructura cuando haya una necesidad concreta de seguridad, disponibilidad o escala.

| Dato o acción | Responsable |
| --- | --- |
| Contacto, relación comercial y seguimiento | CRM. Vincula los identificadores de tienda y reservas y deriva los conflictos de identidad a revisión. |
| Disponibilidad, reserva y asistencia | Agendamiento. Valida cupo, política y versión de la cita antes de aplicar un cambio. |
| Pedido, pago e inventario | Tienda o ERP según el proveedor elegido. Distingue el dato importado, el dato verificado y la decisión interna. |
| Estado y documento fiscal | Facturación. Publica el estado y su referencia a otros dominios. |
| Entregable, tarea y aceptación | Gestión creativa. Expone el hito acordado para los otros servicios. |
| Identidad, permisos, módulos y configuración | Empresa y Administración de Orbital. Controla quién puede activar, aprobar y auditar acciones. |

**Compartir la ejecución y la experiencia.** Crear una base común de casos, cola persistente, políticas, aprobaciones, notificaciones y registro de resultados. Cada servicio declara su disparador, requisitos, acciones, límites, evidencia y definición de completado. Los dominios aplican las mutaciones mediante sus reglas existentes. La base compartida coordina y registra el proceso.

**Usar IA donde aporte criterio.** Interpretar mensajes libres, resumir un caso y sugerir la próxima acción son usos que se pueden comparar con el trabajo manual. Reglas, permisos, importes, disponibilidad y estados fiscales se comprueban con los registros del dominio. Probar cada uso de IA en simulación con ejemplos reales autorizados y activar solo cuando reduzca tiempo con una tasa de error aceptable.

### Condiciones operativas para todos los servicios

- Alcance por negocio y rol, permisos verificados también al seguir enlaces entre áreas, credenciales separadas por integración y trazabilidad del actor y de la política aplicada.
- Cola duradera con reintentos y deduplicación. Antes de un efecto externo, comprobar versión actual, autorización y resultado conocido. Si la respuesta del proveedor es incierta, reconciliar antes de repetir.
- Modos **simulación**, **con aprobación** y **automático dentro de la política**. Visibilidad de excepciones, pausa por servicio y negocio, y procedimiento de reanudación probado.
- Acciones sensibles como devoluciones, cambios de precio, emisión fiscal y altas de permisos se liberan con una política explícita y revisión del rol responsable.
- Migración gradual con enlaces existentes, pruebas de datos de dos negocios y opción de volver al flujo manual. Antes de ampliar una cohorte, probar recuperación tras caídas, duplicados, estados tardíos y cambios simultáneos.

## 4. Hoja de ruta · piloto en 3–4 semanas

La estimación de **3–4 semanas cubre el primer piloto integral**, con las áreas existentes visibles desde Inicio y los primeros servicios ejecutando trabajo real. Parte de los módulos y pantallas actuales. Supone una persona de desarrollo dedicada, acceso a staging, un proveedor de correo y al menos un negocio piloto disponible durante la primera semana. Confirmar el plazo al verificar esas dependencias.

**Trabajo que se reutiliza.** Agenda y motor de reservas, clientes y pedidos, vistas de Inicio, tareas y tableros, documentos, permisos, habilitación por negocio, auditoría y patrones de procesos de fondo. Reutilizar primero las API y las pantallas de cada área. Agregar una tarjeta de resultados y decisiones en Inicio con enlaces al registro original.

**Trabajo nuevo que determina el plazo.** Conectar los módulos para que reaccionen a un hecho, apliquen una regla autorizada y devuelvan un resultado verificable. Para el piloto esto requiere estado de ejecución, respuestas seguras de clientes, reintentos, derivación de excepciones y pausa. Investigar si el registro y el worker existentes cubren parte de esa necesidad antes de crear infraestructura adicional.

| Semana | Trabajo | Criterio de salida |
| --- | --- | --- |
| **1 · Reutilización y simulación** | Verificar qué está operativo en staging. Inventariar acciones, datos y permisos existentes. Agregar en Inicio un resumen de solo lectura para las áreas habilitadas. Elegir un negocio y simular con datos recientes qué citas y pedidos serían intervenidos. | El equipo puede explicar el estado y la próxima acción de cada caso mostrado. Quedan identificadas las dependencias reales y las acciones que el negocio autoriza. |
| **2 · Primer servicio de punta a punta** | Conectar el envío y la respuesta de confirmación con el motor de reservas. Vincular el resultado al contacto existente y llevar fallas a Inicio. Reutilizar historiales y habilitar pausa por negocio. | Una cita de prueba se confirma una sola vez y deja evidencia. Enlaces vencidos, repetidos o de otro negocio quedan bloqueados. El equipo puede resolver manualmente una excepción desde su registro. |
| **3 · Cruces entre áreas y piloto** | Activar con un negocio. Vincular una atención realizada a una tarea de seguimiento en Proyecto si el flujo lo requiere. Mostrar en Inicio el estado de pedidos y comprobantes de la tienda conectada. Incorporar una revisión documental o de vencimiento de Empresa como caso supervisado. | Se puede recorrer el trabajo desde Inicio hasta el dato de origen en cada área habilitada. Hay una semana real de operación iniciada, con registro de incidentes y tiempo de intervención. |
| **4 · Estabilización y primera ampliación** | Ajustar los puntos de fricción del piloto inicial. Activar el cierre diario de pedidos en modo asistido si la fuente permite verificar pedidos y pagos. Probar un segundo negocio y presentar el primer resumen de resultados y consumo. | El cliente distingue resultados de pendientes y entiende qué le toca hacer. El servicio se puede detener, retomar y auditar. Con datos del piloto se toma la decisión de ampliar o corregir. |

Si el correo, el negocio piloto o el acceso a datos se demoran, avanzar con simulación en staging y confirmar la fecha de activación al resolver el bloqueo. La primera versión puede salir con confirmaciones operativas y el resto de las áreas conectadas en lectura o con supervisión.

### Ampliación por servicio

El despliegue posterior depende de la evidencia de cada área. Las siguientes incorporaciones entran al backlog cuando cumplan su condición de inicio.

| Trabajo posterior | Cuándo incorporarlo |
| --- | --- |
| Recuperar cupos cancelados y ampliar el seguimiento de clientes | Cuando el piloto confirme volumen suficiente y haya una política acordada de lista de espera y prioridad. |
| Ampliar CRM, ERP o conectar otra tienda | Cuando los casos reales muestren qué dato o acción falta y la fuente permita verificarlo. |
| Emitir documentos fiscales dentro del servicio | Cuando se complete la validación fiscal del circuito específico y se aprueben las reglas de emisión, revisión y reconciliación. |
| Coordinar más tipos de entregas, incorporaciones y revisiones internas | Cuando una plantilla inicial muestre ahorro y pueda repetirse con reglas explícitas. |
| Añadir interpretación de mensajes libres o un campo para pedir acciones | Cuando la simulación muestre una mejora medible frente a los formularios y reglas existentes. |

## 5. Medir valor y cobrar por lo que se entrega

Comparar con una línea base por negocio. Reportar volumen junto con porcentajes y separar trabajo automático, trabajo asistido por Orbital y trabajo manual del cliente. Cada resultado se cuenta una vez dentro de su servicio. Un mismo caso puede cruzar áreas, con una regla de cobro explícita para evitar duplicaciones.

| Dimensión | Métrica y objetivo inicial de piloto |
| --- | --- |
| **Facilidad de uso** | Mediana desde conexión validada hasta la primera simulación útil ≤ 15 minutos. Al menos 4 de 5 personas resuelven una excepción sin instrucciones del equipo de producto. |
| **Trabajo resuelto** | En confirmaciones, ≥ 60 % de citas elegibles con respuesta y cambio aplicado antes del corte. En otros servicios, medir pedidos conciliados, consultas atendidas, documentos tramitados y entregas coordinadas según su definición registrada. |
| **Tiempo recuperado** | Meta inicial de ≥ 40 % menos minutos de coordinación por cada 100 casos — medir el tiempo tanto del cliente como del equipo de Orbital. |
| **Fiabilidad** | ≥ 95 % de acciones iniciales dentro de la ventana prometida. Cero efectos duplicados, acciones no autorizadas o cruces de datos entre negocios. Un incidente de este tipo pausa el servicio afectado hasta su revisión. |
| **Sostenibilidad** | Margen de contribución positivo por negocio, incluyendo canal, infraestructura incremental, soporte e intervención. Al menos dos renovaciones al precio probado antes de ampliar la cohorte. |

**Modelo comercial propuesto.** Mantener un precio base por negocio para el entorno compartido. Probar paquetes de servicio con un volumen incluido de resultados y precio pactado por exceso. Empezar con cotización y reporte manual durante el piloto. Por ejemplo, cuenta una cita con respuesta aplicada o un pedido conciliado con evidencia. Registrar por separado mensajes enviados, alertas y casos pendientes.

**Decisión al final de cada ola.** Ampliar cuando haya evidencia de uso, ahorro y margen. Si hay valor pero la intervención consume demasiado tiempo, acotar el servicio o simplificar las excepciones antes de sumar cuentas. Si el resultado es difícil de verificar, rediseñar el alcance y su evidencia antes de venderlo.
