# Agendamiento de Orbital · Valor agregado para Chile

**Propuesta** · Empezar con un servicio que entregue **la agenda de mañana preparada y la caja de hoy conciliada**. Orbital sigue las citas, detecta abonos pendientes, cruza pagos con pedidos y comprobantes, y le muestra al negocio qué puede cerrar y qué requiere su decisión.

**Primer segmento** · Estudios de belleza, barberías con varias estaciones y centros de bienestar no clínico que cobran abonos, operan con más de un medio de pago o venden productos además de sus servicios. Priorizar entrevistados que hoy revisan transferencias, mensajes, agenda y comprobantes por separado. El costo de ese trabajo es una hipótesis que hay que medir.

Fecha de revisión · 26 de noviembre de 2026. La comparación usa documentación pública de AgendaPro y el repositorio local de Orbital. Para afirmar una ventaja comparativa, validar el recorrido completo con una demo comercial y negocios usuarios de ambas soluciones.

## 1. Qué cubre cada producto

| Función | Orbital hoy | AgendaPro Chile |
| --- | --- | --- |
| Agenda interna | Crear, reagendar y cancelar horas. Configurar disponibilidad por servicio, profesional, sucursal y recursos. Consultar estados e historial. | Ofrece agenda interna, configuración de horarios y registro de modificaciones. [Agenda online](https://agendapro.com/cl/agenda-online) |
| Reserva pública y autogestión | El motor de reservas existe. La página pública, los enlaces de respuesta y el autoservicio del cliente siguen pendientes. | Ofrece página pública y opciones de confirmación, cancelación o reagendamiento según la configuración. [Reservas online](https://agendapro.com/cl/reservas-online) · [Configuración de recordatorios](https://ayuda.agendapro.com/es/articles/5754192-como-funciona-el-envio-de-recordatorio-mediante-whatsapp) |
| Cobro y abono | Puede retener un cupo hasta que venza el plazo de pago. Faltan el checkout de reservas y la conciliación real con la tienda o pasarela. | Ofrece pago al reservar, abonos por servicio y visibilidad de las transacciones y liquidaciones de su solución integrada. [Abonos](https://ayuda.agendapro.com/es/articles/6044766-como-cobrar-un-abono-sena-o-anticipo-al-cliente-cuando-este-reserva-en-linea) · [Recaudación](https://ayuda.agendapro.com/es/articles/6389806-como-puedo-ver-lo-que-he-recaudado-a-traves-de-agendapro) |
| Recordatorios | Pendiente el flujo automatizado de recordatorios de citas con respuesta del cliente. | Ofrece correo, WhatsApp y SMS según la cuenta. [Recordatorios](https://agendapro.com/cl/recordatorios-automaticos) |
| Recuperación de cupos | El motor puede consultar disponibilidad y liberar cupos vencidos. Falta una lista de espera con ofertas y aceptación. | AgendaPro Fitness documenta lista de espera con inscripción automática para clases. El alcance de esa función en citas individuales debe verificarse. [AgendaPro Fitness](https://ayuda.agendapro.com/es/articles/15465873-centro-de-ayuda-agendapro-fitness-faq) |
| Facturación | Puede asociar comprobantes a pedidos y cuenta con un módulo fiscal nativo. El circuito de cita, pago y emisión requiere integración y validación externa. | Documenta emisión de boletas al registrar pagos con el complemento habilitado, y una opción de honorarios por profesional. [Emisión de boletas](https://ayuda.agendapro.com/es/articles/8430250-como-genero-una-boleta-desde-agendapro) · [Boletas de honorarios](https://ayuda.agendapro.com/es/articles/6581351-como-puedo-emitir-boletas-de-honorarios-desde-agendapro) |

Base de Orbital · [Estado de Agendamiento](ESTADO-MODULO-RESERVAS.md), [retenciones y operación](OPERACION-AGENDAMIENTO.md), [validación del módulo fiscal](../modules/billing-cl/VALIDACION.md) y [plan integral de Service-as-a-Software](PLAN-SERVICE-AS-SOFTWARE.md).

## 2. Dónde puede diferenciarse Orbital

### Prioridad 1 · Cierre diario de citas, abonos y comprobantes

**Problema local a validar.** La persona que atiende necesita saber si un abono entró y cómo se relaciona con una cita, un pedido o un documento. En Chile, el Banco Central identifica que las transferencias electrónicas crecen en el uso cotidiano, aunque su adopción como pago a comercios sigue siendo limitada. Vale la pena probar este flujo con negocios que ya cobran por transferencia, tarjeta o ambos medios y medir el trabajo que realmente les ahorra. [Informe de Sistemas de Pago, Banco Central de Chile](https://www.bcentral.cl/areas/politica-financiera/informe-de-sistemas-de-pago)

**Qué haría Orbital**

1. Al crear una cita con abono, generar una referencia de pago y mostrar monto, plazo y saldo restante en CLP. Enviar un enlace para pagar o consultar las instrucciones del negocio, según el medio habilitado.
2. Conciliar inicialmente una tienda o pasarela y un formato de cartola importada por el propio negocio. Cruzar identificador o referencia, monto, cuenta destino y fecha. Las coincidencias ambiguas o parciales quedan para revisión. Una captura de pantalla se guarda como evidencia auxiliar y jamás cambia por sí sola el estado a pagado.
3. Relacionar **cita → pago verificado → pedido si existe → documento fiscal si corresponde**. Mostrar el origen de cada confirmación y distinguir pago del cliente, liquidación del proveedor y saldo pendiente.
4. Entregar al cierre un resumen con **confirmadas para mañana**, **abonos por verificar**, **pagos que no calzan** y **comprobantes pendientes**. Desde Inicio, abrir la cita o transacción exacta y ver por qué está en la lista.

**Por qué vale la pena probarlo.** AgendaPro ya ofrece abonos, seguimiento de sus pagos integrados y emisión de documentos. La hipótesis de diferenciación es cerrar el trabajo que queda repartido entre canales y sistemas que el negocio ya usa, con evidencia y una bandeja compartida. El piloto debe medir ese trabajo residual antes de prometer una ventaja comercial.

**Condición fiscal para Chile.** El tratamiento del voucher de tarjeta depende del modelo de emisión declarado y de las condiciones aplicables al contribuyente. El comprobante de transferencia sirve como respaldo del pago y se trata por separado del documento tributario. En el piloto se propone preparar o vincular documentos. La emisión automática se habilita por negocio tras verificar su modelo con el responsable tributario, probar el circuito correspondiente y definir cómo evitar duplicados. [Guía de Operación IVA del SII](https://www.sii.cl/destacados/operacion_iva/)

### Prioridad 2 · Recuperar horas canceladas con gente que sí puede tomarlas

Al cancelar una hora, Orbital puede buscar personas que se anotaron expresamente para ese servicio y aceptan el horario, sucursal y profesional disponibles. El negocio elige el orden de prioridad. Orbital ofrece el cupo con vencimiento y, si se acepta, comprueba y reserva la disponibilidad en una sola operación. Si expira, pasa a la siguiente persona y muestra al equipo qué ocurrió.

La oportunidad consiste en recuperar **horas individuales que finalmente se atienden**, con pago o abono cuando corresponda, y medir cuánta ocupación se recupera. La existencia de listas de espera en AgendaPro Fitness hace importante verificar el alcance equivalente para citas individuales antes de posicionarlo como diferencia. [Lista de espera de AgendaPro Fitness](https://ayuda.agendapro.com/es/articles/15465873-centro-de-ayuda-agendapro-fitness-faq)

### Prioridad 3 · Pasar de la hora reservada al servicio entregado

Usar los módulos de Orbital para convertir una cita realizada en trabajo posterior. Por ejemplo, en un estudio de asesoría, cerrar la atención puede crear la tarea de preparar el informe, asignar una fecha interna y programar el seguimiento al cliente. En un centro con tienda, puede vincular la compra de un producto a la visita y dejar la gestión del pedido en Tienda.

Empezar con una plantilla por segmento y un disparador comprobable, como **atención realizada**. El negocio ve el responsable, el plazo y la evidencia de entrega. El beneficio se mide por seguimientos realizados a tiempo y menos traspasos manuales, incluyendo el trabajo del equipo que opera Orbital.

### Otras ideas para validar

| Oportunidad | Cuándo vale la pena |
| --- | --- |
| **Cambio de profesional con continuidad** | Si pierden citas ante ausencias. Sugerir alternativas compatibles y pedir confirmación al cliente antes de mover su hora. |
| **Retorno por servicio** | Si hay recurrencia conocida. Ofrecer una próxima hora según el intervalo que defina el negocio y registrar reservas efectivamente concretadas. |
| **Cierre entre sucursales** | Si una persona coordina varias sedes. Consolidar diferencias en una bandeja con responsables por local y trazabilidad por caja. |
| **Migración guiada y primer día de trabajo** | Si el cambio de agenda frena las ventas. Importar catálogo, clientes y futuras citas desde un archivo autorizado, detectar conflictos y validar una muestra antes de activar recordatorios. |

## 3. Qué construir primero

El objetivo es **un piloto en 3–4 semanas**, alineado con el plan integral y condicionado a tener un negocio piloto, acceso al proveedor de correo y una fuente verificable de pagos. Se reutilizan agenda, permisos, pedidos, historial, tareas, documentos y activación por negocio. El piloto combina ejecución asistida con un flujo automatizado acotado. El checkout completo y la emisión fiscal automática tienen sus propios criterios de salida.

| Semana | Entregable | Criterio de salida |
| --- | --- | --- |
| **1 · Diagnóstico y simulación** | Entrevistar a 5–8 negocios del segmento, seleccionar 2–3 pilotos, observar un cierre y tomar una línea base. Usar exportaciones de prueba para comprobar si cita y pago comparten datos suficientes. Diseñar el resumen en Inicio. | Cada piloto identifica quién resuelve excepciones y se puede reconstruir un cierre real con su fuente de datos. |
| **2 · Confirmación y revisión de abonos** | Habilitar confirmación por correo para citas existentes y una bandeja de abonos pendientes. Importar un formato de cartola o usar el registro autorizado del proveedor disponible. Alguien del negocio valida las coincidencias propuestas. | La respuesta actualiza una cita una sola vez. Un pago atrasado, duplicado, por monto distinto o con referencia ambigua aparece con un motivo claro. |
| **3 · Cierre diario asistido** | Relacionar citas, pagos, pedidos y comprobantes existentes. Enviar un resumen al responsable y medir cuánto tarda en resolver diferencias. Simular una cancelación y la oferta del cupo sin enviarla a clientes reales. | El negocio puede revisar el cierre desde Inicio y abrir los registros fuente. Las diferencias tienen responsable y siguiente paso. |
| **4 · Decisión de ampliación** | Afinar las reglas con casos reales. Preparar una prueba de lista de espera y elegir si la siguiente inversión debe ser un conector de pagos, reserva pública o seguimiento posatención. | Al menos dos negocios describen un ahorro concreto y hay evidencia sobre qué ampliación elimina más trabajo. |

### Reglas de aceptación para el piloto

- **Reserva pública mínima.** Cuando se habilite, mostrar servicio, profesional, disponibilidad y condiciones de abono con una experiencia móvil. Definir un solo medio de pago inicial por negocio piloto. Una reserva con cupo pendiente de pago se confirma tras verificar el pago y la vigencia del cupo. Una excepción deja abierta la revisión en Inicio.
- **Canales.** Empezar con correo. Incorporar WhatsApp mediante un proveedor autorizado al validar el costo, la aceptación del cliente y las reglas operativas. Distinguir mensaje enviado, entregado, respondido y acción aplicada.
- **Datos.** Pedir el mínimo necesario. Limitar referencias de pago, cartolas y comprobantes a los roles autorizados. Registrar decisiones por negocio y usuario, con pausa de envíos y ruta manual para corregir errores.
- **Casos límite.** Probar pagos repetidos, parciales y tardíos, caja que no cuadra, un cupo reclamado por dos personas, citas reagendadas durante el seguimiento y estados fiscales inciertos. Guardar el motivo y resolver antes de reintentar una acción con efecto externo.

## 4. Cómo decidir si realmente aporta valor

| Indicador | Medida propuesta |
| --- | --- |
| Tiempo de cierre | Mediana de minutos para cerrar 20 citas o un día de operación comparable. Hipótesis inicial · 30 % menos tiempo frente a la línea base. |
| Abonos resueltos | Abonos elegibles vinculados a evidencia de pago y registrados antes del corte ÷ abonos elegibles. Reportar por separado revisión humana, automatización y casos ambiguos. |
| Horas recuperadas | Horas canceladas que se vuelven a reservar y finalmente se atienden ÷ horas canceladas elegibles. Reportar valor neto realizado y tamaño de muestra. |
| Correcciones e incidentes | Cero pagos acreditados por error, cupos duplicados o documentos fiscales duplicados durante el piloto. Registrar y revisar todas las coincidencias corregidas por el operador. |
| Demanda y margen | Al menos dos pilotos dispuestos a continuar al precio probado. Medir costo de canal, procesamiento y minutos de revisión por caso resuelto. |

**Oferta para validar** · «Te entregamos el cierre diario de citas y abonos, con las diferencias listas para resolver». Probar una cuota mensual con una cantidad de casos incluidos, o un cargo por resultado comprobado cuando exista volumen estable. Contar una conciliación completada o una hora recuperada y atendida. Los mensajes, las alertas y las sugerencias se registran para medir costo y uso.

**Primera decisión** · Si los pilotos pierden más tiempo conciliando, desarrollar el cierre diario. Si el mayor costo son las cancelaciones y ya tienen una lista de espera activa, adelantar la recuperación de cupos. Si hoy pierden reservas por carecer de autoservicio, completar antes el enlace público básico y volver a medir.
