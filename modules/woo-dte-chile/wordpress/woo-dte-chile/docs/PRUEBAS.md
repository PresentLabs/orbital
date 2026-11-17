# Evidencia de pruebas locales — 19 de septiembre de 2026

## Entorno ejecutado

- PHP 8.5.1.
- WordPress 7.1.1.
- WooCommerce 11.1.1.
- MariaDB 13.0.2, conexión local por socket, sin escucha de red.
- Instalación temporal aislada. No se modificó una tienda existente.
- Certificados y CAF sintéticos generados durante las pruebas. HTTP SII y transporte de correo interceptados con respuestas controladas; no hubo emisión fiscal ni correo real.

## Resultados

| Comprobación | Resultado |
|---|---|
| Lint de todos los PHP del paquete, incluidas dependencias | 118 / 118 correctos |
| Pruebas unitarias | 33 correctas |
| Pruebas de integración WordPress/WooCommerce/MariaDB | 62 correctas |
| Lectura independiente PDF417 desde PDF renderizado | 2 / 2, bytes idénticos al TED |
| Auditoría Composer | Sin avisos publicados ni dependencias abandonadas para lo instalado |
| Revisión visual del PDF de prueba | Realizada: texto legible, recuadro y timbre sin superposiciones |
| Integridad ZIP | CRC comprobado durante el empaquetado; huella SHA-256 junto a la entrega |

## Casos cubiertos

RUT y dígito verificador; CLP sin fracciones ni negativos; totales mixtos; límite de NC; anulación posterior a NC parcial; ambientes prohibidos; bloqueo inicial de Producción; cifrado/autenticación y alteración de secretos; rechazo de XXE; XSD oficial y verificación criptográfica de XMLDSig/TED para los cuatro tipos; firma de semilla; interpretación conservadora de estados.

Integración: importación y superposición CAF, CAF alterado, pedido sin pago, evento de pago, datos WooCommerce, idempotencia de pedido, intento de segundo tipo, envío/aceptación simulados, PDF, exportación XML exacta, webhook y replay de refund, NC parcial/por saldo, límite acumulado incluidas NC en cola, conservación del original, congelación fiscal, SOAP para NC, factura y ND, anulación código 1, conflicto de clave, timeout y ausencia de reenvío o folio nuevo, REST anónimo/otro cliente/propietario/administrador, protección de archivos de certificación, correo dirigido al administrador y fallo de correo sin degradar aceptación.

Concurrencia real con ocho procesos PHP y la misma base MariaDB:

- Ocho NC diferentes de $3.000 sobre un original de $11.900: tres permitidas; las restantes bloqueadas.
- Ocho solicitudes de la misma operación: un solo registro NC, con el mismo ID para todas.
- Ocho reservas de folio: ocho folios distintos.

Se ejecutó el flujo de pedidos tanto con almacenamiento tradicional como con HPOS. No se declara probada toda la matriz de versiones mínimas, pasarelas, temas, Checkout Blocks o plugins de terceros.

## Reproducir

Unitarias, sin WordPress ni conexión SII:

```sh
php tests/unit.php
```

Integración: solo contra una instalación local de pruebas cuya base se llame `wdt_test` y cuya URL sea `http://wdt.test`. Debe tener WooCommerce y este plugin activos. La prueba **trunca las cuatro tablas propias del plugin** y crea pedidos sintéticos; nunca ejecutarla en una tienda real.

```sh
WDT_TEST_WORDPRESS=/ruta/wordpress \
WDT_TEST_RESET=YES \
WDT_TEST_ARTIFACTS=/ruta/artefactos \
php tests/integration.php
```

La clave de pruebas fija existe únicamente en scripts CLI. La aplicación no incorpora una clave predeterminada ni un modo de simulación. La prueba de integración intercepta el HTTP externo y el correo; la aplicación utiliza solo Certificación y Producción oficiales.

Para verificar el timbre desde los PDF generados, instalar en un entorno de pruebas `pymupdf`, `pillow` y `zxing-cpp`, y ejecutar:

```sh
python tests/verify-pdf.py /ruta/artefactos
```

La prueba compara el contenido binario completo decodificado, no solo la presencia de un código de barras.
