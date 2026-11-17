=== Woo DTE Chile ===
Contributors: woo-dte-chile
Tags: woocommerce, chile, dte, sii, facturacion
Requires at least: 6.6
Requires PHP: 8.1
Stable tag: 0.2.1
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Plugin independiente para DTE 33, 39, 56 y 61 en WooCommerce. Versión de desarrollo para certificación, no homologada por el SII.

== Description ==
Solo Chile/CLP; Certificación y Producción. CAF/folios transaccionales, certificado cifrado, XML/TED/XMLDSig, validación XSD, servicios SII, acciones manuales, pago confirmado, reembolsos, NC/ND, Action Scheduler, trazabilidad, PDF417, XML, correo y REST.

Certificación es el ambiente inicial. Emisión automática y NC automáticas vienen apagadas hasta configurar el emisor y su política de devoluciones.

La validación local no equivale a aceptación SII. Lea docs/INSTALACION.md, docs/VALIDACION-SII.md y docs/API.md antes de conectar credenciales reales.

== Installation ==
1. Instale y active WooCommerce.
2. Suba woo-dte-chile-0.2.1.zip en Plugins > Añadir plugin > Subir plugin.
3. Configure WDT_SECRET_KEY en el servidor (clave aleatoria de 32 bytes, base64).
4. Configure el emisor en WooCommerce > Woo DTE Chile.
5. Importe certificado P12/PFX y CAF de certificación; configure previamente las llaves públicas oficiales SII por ambiente/IDK.
6. Complete la certificación oficial. La activación de Producción requiere protecciones adicionales descritas en la guía.

Requiere PHP DOM, OpenSSL, mbstring, sodium y mysqli; base de datos MySQL/MariaDB con InnoDB y soporte GET_LOCK, HTTPS saliente y ejecución de tareas programadas. TCPDF está incluido.

== Frequently Asked Questions ==
= ¿Está certificado por el SII? =
No. Las pruebas locales usan certificados y CAF sintéticos y un transporte SII simulado. No se han enviado DTE reales.
= ¿Depende de Facto? =
No. Se revisó su integración WooCommerce como referencia conceptual; no se incorpora su código ni API.
= ¿Borra documentos al anular o desinstalar? =
No. Anular crea una NC relacionada; desinstalar no elimina tablas fiscales ni reservas.
= ¿Devuelve dinero? =
No. El gateway/WooCommerce gestiona el dinero. Este plugin registra la operación tributaria por separado.
= ¿Un timeout vuelve a emitir? =
No. Conserva folio y XML, consulta y deriva a revisión cuando el resultado continúa incierto.

== Changelog ==
= 0.2.1 =
Implementación nueva desde cero. No contiene ni migra una supuesta versión 0.1.1 cuyo código no estuvo disponible.
