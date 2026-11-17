# Revisión técnica y validación pendiente ante el SII

Fecha de revisión documental: 19 de septiembre de 2026. Esta implementación no ha autenticado ni enviado documentos al SII real. Ningún resultado de prueba local constituye certificación o habilitación del contribuyente.

## Fuentes oficiales consultadas

- [Formato DTE versión 2.5, febrero de 2026](https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf): zonas del documento, impuestos, referencias, códigos de corrección e indicador de no rebaja.
- [Formato boleta versión 4.2, 8 de septiembre de 2025](https://www.sii.cl/factura_electronica/factura_mercado/formato_boleta_electronica.pdf): estructura específica de boletas.
- [Página oficial de esquemas XML](https://www.sii.cl/servicios_online/3532-formato_xml-3811.html): se descargaron `schema_dte.zip` y `schema_envio_bol.zip`. Sus XSD se incluyen sin modificar en `schemas/`; sus huellas están en `FUENTES.json`.
- [Instructivo de emisión DTE](https://www.sii.cl/factura_electronica/factura_mercado/instructivo_emision.pdf): CAF, llaves, TED, firmas y reglas PDF417.
- [Instructivo de emisión de boletas](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf) y [API REST oficial](https://www4c.sii.cl/bolcoreinternetui/api/), especificación `openapi.yaml` versión 1.0.5: autenticación, envío y consultas. Se respetan los servidores de envío separados que define la especificación.
- [Autenticación automática](https://www.sii.cl/factura_electronica/factura_mercado/autenticacion.pdf), [envío automático](https://www.sii.cl/factura_electronica/factura_mercado/envio.pdf), [estado del envío](https://www.sii.cl/factura_electronica/factura_mercado/estado_envio.pdf) y [estado DTE](https://www.sii.cl/factura_electronica/factura_mercado/estado_dte.pdf): servicios SOAP tradicionales. La fecha de consulta SOAP usa DDMMAAAA; la REST usa DD-MM-AAAA.
- [Manual de muestras impresas](https://www.sii.cl/factura_electronica/factura_mercado/manual_muestras_impresas.pdf): recuadro del documento, representación y timbre.
- [Anulación/corrección de boleta](https://www.sii.cl/ayudas/boleta_electronica/anular_una_boleta_electronica_estando_inscrito_en_facturacion_electronica.pdf): se bloquea la corrección parcial de precio de boleta mediante el flujo de devoluciones.
- [Vigencia CAF](https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_6968.htm) y [Resolución 58 de 2017](https://www.sii.cl/normativa_legislacion/resoluciones/2017/reso58.pdf): se aplica una política conservadora de caducidad, explicada en la guía.
- [Manual de certificación](https://www.sii.cl/factura_electronica/factura_mercado/manual_certificacion.pdf): pruebas oficiales y proceso del contribuyente.
- [Documentación HPOS de WooCommerce](https://github.com/woocommerce/woocommerce/blob/trunk/docs/features/orders/high-performance-order-storage/recipe-book.md): acceso a pedidos mediante CRUD y declaración de compatibilidad.

Consultar estas fuentes no acredita que se hayan cubierto todas las resoluciones aplicables al giro de una empresa. La implementación limita su alcance a las operaciones descritas abajo y bloquea otras conocidas.

## Lo implementado

El plugin crea operaciones durables independientes de los estados de WooCommerce. Conserva una copia cifrada de emisor, receptor y líneas; reserva folios bajo transacción InnoDB; genera y conserva el mismo XML firmado. La fecha del DTE se asigna cuando se reserva el primer folio.

Usa XML ISO-8859-1, montos CLP enteros y líneas brutas con el indicador correspondiente. Admite IVA 19% y componentes exentos en documentos mixtos; los pedidos completamente exentos y otros impuestos se bloquean porque requieren tratamiento fuera de los tipos soportados. Distribuye el redondeo por restos para reconciliar el detalle con el total WooCommerce; conserva cantidades y precios resultantes de los descuentos ya aplicados.

Se generan 33, 39, 61 y 56, sus referencias, TED firmado con la clave CAF y firmas XMLDSig con certificado RSA. Se valida el sobre contra los XSD oficiales antes de transmitir. Se utiliza SHA-1 únicamente donde lo exige el protocolo SII; la huella interna del archivo usa SHA-256 y el cifrado de almacenamiento usa sodium secretbox.

El PDF incorpora identificación, recuadro tributario, unidad SII, detalle, IVA, referencias y PDF417. El timbre usa bytes ISO-8859-1, compacción binaria, corrección nivel 5, proporción de módulos 3:1 y zona libre. Las pruebas decodifican el PDF mediante una biblioteca independiente y comparan los bytes con el TED. Eso no equivale a aprobar las muestras impresas ante el SII.

Boletas usan REST para semilla/token, envío y estado. Los demás DTE usan SOAP para autenticación/estado y multipart para DTEUpload. La recepción, validación y entrega por correo son estados distintos. Los endpoints son fijos y dependen exclusivamente del ambiente permitido.

## Qué falta validar con credenciales oficiales

1. Inscripción/autorización del emisor y del firmante; obtención de set de pruebas para los cuatro tipos; resolución y datos exactos del contribuyente en cada ambiente.
2. Procedencia de llaves públicas SII, firmas FRMA de CAF reales y asignación correcta del ambiente. Probar agotamiento, vencimiento, errores de CAF y rangos realmente autorizados.
3. Lectura del P12/PFX real, sujeto del certificado, cadena de confianza, revocación y autorización efectiva del firmante. El control local de vigencia y par de claves no resuelve esos puntos.
4. Autenticación SOAP y REST reales, compatibilidad del XML de semilla y de la firma con los validadores oficiales, rutas, TLS y límites de frecuencia del SII.
5. Envíos reales 33/39/56/61; TED, normalización, firma del documento y del sobre, validación semántica de montos y referencias. XSD correcto no garantiza aceptación tributaria.
6. NC por devolución total/parcial y por saldo, originales mixtos, receptores no identificados en boletas, fechas de devolución, operaciones fuera de plazo y `IndNoRebaja`. ND por recargo de factura y anulación de NC. Confirmar con el responsable tributario la elegibilidad de la política automática de refunds.
7. Estados reales: aceptado, reparos, rechazo, token caducado, falta de permisos, envío duplicado, respuesta desconocida, timeout después de recepción y consultas sin Track ID.
8. Muestras impresas y lector oficial, con el CAF real y nombres largos. Validar paginación, copias/requisitos de documentos cedibles cuando correspondan y entrega al cliente.
9. Flujo completo con la pasarela de pago de la tienda; checkout clásico, Blocks y Astro; plugins de impuestos, descuentos, despacho, estados personalizados, correo SMTP y configuración real de Action Scheduler.
10. Requisitos complementarios del proceso de certificación y operación: intercambio entre contribuyentes, recepción/respuestas, registros/reportes y RVD cuando corresponda. No están implementados por este plugin, cuyo alcance documental es 33/39/56/61.

## Limitaciones funcionales concretas

- No automatiza solicitud de CAF en el portal, recuperación de Track ID perdido, corrección y reenvío de documentos rechazados ni reemisión de una boleta de reemplazo después de corregir precio.
- El XML descargado y adjunto es el sobre original enviado al SII, conservado byte por byte. No genera otro sobre dirigido al receptor para el proceso formal de intercambio entre contribuyentes.
- No implementa correcciones exclusivamente de texto (CodRef 2), impuestos específicos, exportaciones, venta exenta completa (DTE 34/41), monedas extranjeras o tipos fuera de 33/39/56/61.
- No decide automáticamente si una NC tiene derecho a rebaja del débito. Las devoluciones de operaciones especiales deben revisarse antes de permitir la automatización.
- No aplica un protocolo de migración desde la versión 0.1.1 mencionada en otra conversación: su código no estaba disponible y se construyó desde cero.
- El envío individual evita confundir aceptación de un lote con aceptación del documento, pero no es una solución optimizada para emisión masiva. Los tokens se solicitan al ejecutar cada operación; se debe probar el ritmo admitido por el SII antes de aumentar el volumen.

Por estas limitaciones y por la falta de ensayos oficiales, no debe presentarse esta entrega como un facturador completo habilitado para producción.
