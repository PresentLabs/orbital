# Instalación y operación — 0.2.0

Estado: versión para desarrollo/certificación. No validada contra el SII real. Creada desde cero, sin dependencia de Facto.

## Preparar el servidor

- WordPress 6.6+ y WooCommerce 9.0+; PHP 8.1+ con DOM, OpenSSL, mbstring, sodium y mysqli. Estas versiones mínimas son requisitos declarados, no una matriz de versiones ensayadas. Consulte PRUEBAS.md para el entorno realmente probado.
- MySQL/MariaDB con tablas InnoDB y `GET_LOCK` en una conexión estable. No utilizar un proxy que cambie de conexión entre consultas, SQLite, réplicas de lectura para estas tablas ni una conexión multiplexada sin afinidad.
- HTTPS saliente al SII y validación de certificados TLS activa. El plugin no acepta URLs SII arbitrarias ni sigue redirecciones.
- Ejecución de Action Scheduler/WP-Cron cada minuto mediante el cron del alojamiento; el tráfico de visitantes no es un mecanismo fiable de operación continua.
- Una sola instalación emisora por conjunto de CAF. El plugin detecta rangos repetidos dentro de su base de datos, pero no puede coordinar folios con otro software o una copia de la tienda que comparta esos CAF.

Antes de activar la emisión, configure una clave aleatoria y exclusiva de 32 bytes codificada en base64 en `wp-config.php` o mediante un secreto del alojamiento:

```php
define('WDT_SECRET_KEY', getenv('WDT_SECRET_KEY') ?: '');
```

Puede generarla en su servidor con `php -r 'echo base64_encode(random_bytes(32)), PHP_EOL;'`. Guarde un respaldo seguro independiente de la base de datos. No use la clave pública o contraseña del certificado como clave de cifrado. Cambiar o perder esta clave impide descifrar certificados, CAF, XML y registros. Esta versión no incorpora rotación automática de claves.

Suba el ZIP desde WordPress. No requiere Composer en el alojamiento. Activar por sitio; la activación en toda una red multisitio se bloquea.

## Certificación

1. En WooCommerce → Woo DTE Chile, seleccione Certificación y complete RUT del emisor, RUT del firmante autorizado, razón social, giro, actividad, dirección, comuna, unidad SII y resolución del ambiente.
2. Cargue el P12/PFX y su contraseña. Se comprueban vigencia, RSA de al menos 2048 bits y correspondencia clave/certificado. El material se guarda cifrado; la contraseña no se conserva. La autorización del firmante, cadena de confianza y revocación del certificado todavía requieren verificación externa/oficial.
3. Obtenga los CAF en el portal SII correspondiente. Configure en el servidor las llaves públicas **oficiales** del SII que verifican `FRMA`, por ambiente e `IDK`:

```php
define('WDT_SII_CAF_KEYS', [
    'certification' => [
        // IDK real => contenido PEM obtenido de una fuente oficial confiable.
    ],
    'production' => [],
]);
```

No se distribuyen llaves SII supuestas ni se acepta la llave del propio CAF como autoridad de confianza. El operador debe obtener y verificar el origen de estas llaves. Solo se admite CAF con FRMA SHA1withRSA; otros algoritmos se bloquean. El XML del CAF no prueba por sí solo su ambiente: la procedencia oficial y la separación de llaves/rangos deben verificarse al importar.

4. Importe los CAF. Se valida RUT/tipo/rango, firma FRMA, correspondencia de RSASK con RSAPK y superposición. Se aplica un límite conservador de seis meses desde FA a todos los tipos: puede bloquear folios que tengan reglas especiales de mayor vigencia; no extiende vigencias automáticamente.
5. Prepare pedidos de prueba pagados. La emisión manual está en el panel y en las acciones de cada pedido. `date_paid` debe existir y el estado debe ser compatible con el pago. La emisión automática usa `woocommerce_payment_complete`, no la página de éxito del navegador. El gateway debe confirmar el pago en servidor antes de llamar a ese evento.
6. Active la emisión automática solo después de completar datos, certificado y CAF. Active por separado la política de NC automáticas si los reembolsos WooCommerce representan devoluciones. De lo contrario se conservarán en revisión para clasificarlos.

Durante Certificación, el correo tributario va únicamente al correo administrador de WordPress y el PDF lleva una leyenda de prueba. Los clientes no pueden descargar documentos de Certificación por REST.

## Producción

No habilitar hasta completar los requisitos oficiales. Esta versión no aporta una autorización SII ni verifica automáticamente un expediente de certificación.

Se exigen conjuntamente:

- `WDT_ENABLE_PRODUCTION` con el **RUT exacto** del emisor autorizado, configurado en el servidor.
- `WDT_PRODUCTION_ORIGIN` con la URL HTTPS exacta de la tienda, sin barra final. Una copia con otra URL queda bloqueada.
- Ambiente Producción seleccionado por un administrador.
- Frase exacta `ACTIVAR PRODUCCION RUT` y referencia de evidencia de certificación de al menos 20 caracteres.
- CAF y configuración del ambiente de producción.

La evidencia es una declaración del administrador, no una comprobación del SII. Revocar la constante o la confirmación detiene los envíos, incluso los que ya están en cola. Cambiar emisor/ambiente pausa operaciones anteriores; no las convierte al ambiente nuevo.

## Reembolsos, NC y ND

- WooCommerce/gateway devuelve el dinero. La NC no ejecuta un segundo reembolso.
- Un refund se persiste con su ID; espera la aceptación del DTE original, con reintentos limitados. Si no existe DTE original, no crea retroactivamente una venta por sí solo.
- Reembolso total sin NC anteriores: NC 61 con código 1 y líneas originales. Reembolso parcial: NC 61 código 3 y monto del refund.
- Refund con líneas: se conservan montos afectos/exentos y cantidades. Refund solo por monto: se admite automáticamente si el original tiene una sola categoría tributaria. Un documento mixto exige líneas; queda en revisión si falta el desglose.
- Las NC pendientes, bloqueadas o rechazadas también reservan saldo. Ninguna combinación puede superar el total del documento al que se refiere. No se liberan automáticamente esas reservas, ni se reciclan folios, ni se elimina el original.
- “Anular con NC” exige total original y ausencia de NC anteriores. Después de una NC parcial se puede crear otra NC código 3 por el saldo, pero no una nueva anulación por el total.
- El ajuste manual puede indicar `refund_id` para compartir idempotencia con el webhook de ese reembolso. El monto y pedido deben coincidir. Para reintentar un refund bloqueado, use su tarea de reembolso; evite crear una operación independiente sin relacionarla.
- Las ND 56 permiten aumentar el monto de una factura o anular completamente una NC. No se permite una ND directa sobre boleta. Anular una NC mediante ND no libera automáticamente su reserva original; requiere conciliación contable.
- Se distingue devolución de corrección de monto. Una corrección parcial del precio de una boleta se bloquea: requiere anulación y nueva boleta. La reemisión de reemplazo no está automatizada en esta versión y debe resolverse con un procedimiento contable controlado.
- Existe la opción manual `IndNoRebaja` para NC sin derecho a rebaja del débito. El plugin no determina por sí mismo el derecho a rebaja, plazos tributarios, fecha efectiva de devolución o reglas particulares del contribuyente. La política de automatización debe aprobarse para las operaciones de la tienda antes de usar producción.

## Operación y recuperación

Estados principales: `queued`, `signed`, `sending`, `submitted`, `accepted`, `accepted_with_repair`, `rejected`, `uncertain`, `received_unconfirmed`, `blocked`, `review`.

El estado `REC` o la entrega de Track ID no se considera aceptación. Cada sobre contiene un solo documento; para aceptar se exige respuesta procesada y estadísticas coherentes. Las respuestas desconocidas quedan pendientes. Las consultas usan retroceso exponencial, máximo 16 intentos.

Si el envío falla después de iniciarse, se conserva su XML exacto y folio, y se consulta sin volver a enviar. Si falta Track ID y el documento aparece recibido, se informa `received_unconfirmed`, no aceptación. El panel no permite asignar un Track ID arbitrario: un caso incierto sin seguimiento comprobable requiere conciliación oficial fuera del flujo automático. No hay una herramienta automática de recuperación de Track ID perdido.

Un documento rechazado no se regenera ni se reenvía con otro folio por una simple acción de reintento. Debe analizarse la respuesta oficial y realizar una corrección controlada, que esta versión no automatiza. Los errores anteriores a firma pueden reintentarse tras corregir configuración; la fecha de emisión se asigna al reservar el primer folio y se conserva después.

Los correos tienen estados independientes. `sent` significa que el transporte de WordPress aceptó el envío, no entrega al destinatario. Un fallo de correo no cambia la aceptación tributaria. Si el proceso muere durante el correo, el estado `sending` requiere revisión manual antes de reenviar para evitar duplicados.

Respalde base de datos y clave de cifrado por separado. El ZIP no contiene certificados, CAF reales ni credenciales. La desinstalación conserva las tablas fiscales. No existe un botón para borrar documentos o reiniciar folios.
