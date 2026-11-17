# Validación local — 16 de noviembre de 2026

## Resultados de 0.3.0

- Orbital: 71 pruebas aprobadas.
- Payload: 68 pruebas aprobadas, incluidas 12 nativas de facturación y 12 del adaptador anterior. Normalización de tiendas, pagos/transacciones, eventos oficiales Payload, impuestos, límites de crédito, generación PHP/XML/PDF y protecciones de producción.
- PostgreSQL 18.6 real, aislado y local: 9 pruebas aprobadas (suite y 8 casos). Migraciones desde cero, mismo pedido en tres tiendas, idempotencia, NC concurrentes que no exceden el original, CAF verificado/solapado, cambio de origen, firma y reserva de folio, envío incierto sin reenvío, consultas de estado, aislamiento entre negocios, historial sin conexión y protección frente a borrado de negocio. Worker con Shopify simulado y deduplicación de refund.
- PHP: lint de los 121 archivos presentes bajo `modules`, sin errores. Núcleo fiscal: 33 pruebas aprobadas, incluidos XSD oficiales y firmas de los cuatro tipos.
- TypeScript de Payload y de la extensión oficial: sin errores. Astro: comprobación de tipos y build. Payload: build de Next. Los avisos existentes de `document.execCommand` siguen pendientes.
- Chrome local contra Astro compilado y el endpoint nativo real, con persistencia PostgreSQL y APIs de tiendas simuladas: instalación con P12 sintético, emisión en cola para Shopify/Woo/Payload usando el mismo ID de pedido, tres documentos separados, historial conservado y rechazo de Origin ajeno. Sin errores JavaScript. Pantalla revisada en escritorio y móvil; tabla con desplazamiento horizontal en móvil.
- Archivo complementario Payload `.tgz`: estructura y contenido comprobados. ZIP de integración: CRC comprobado; hashes SHA-256 en `SHA256SUMS`.

Los tests emplean certificados y CAF sintéticos. No se migró la base del usuario, no se contactaron tiendas reales y no se enviaron DTE ni correos reales. Los envíos/estados en pruebas de cola son respuestas controladas. La comprobación local no acredita habilitación tributaria.

## Seguridad revisada

Permisos de administrador y negocio derivados de la sesión, JWT explícito en Payload, comprobación de mismo origen en Astro, datos sensibles fuera de respuestas de configuración, archivos/historial filtrados por negocio, cifrado AES-GCM, validación y límites de IDs/montos/cuerpo, HTTPS/hosts permitidos sin redirecciones, SQL parametrizado y bloqueos de operación/folio/saldo. El PHP es CLI privado, recibe secretos por stdin y no publica un endpoint HTTP. Los XML conservan su huella y se rechazan entidades externas. `.dockerignore` excluye entornos, certificados locales y dependencias generadas del contexto.

Este módulo no usa nonces WordPress: Astro utiliza sesión y comprobación de origen, y Payload exige autorización JWT explícita. El adaptador WordPress anterior conserva sus comprobaciones propias. La revisión no es una auditoría independiente. Las alertas de dependencias del [informe anterior](../woo-dte-chile/VALIDACION.md) no se consideran resueltas por esta entrega; requieren evaluación antes de producción.

## Validación externa pendiente

1. Instalar la extensión en la **tienda Payload real** e integrar `captureChileSettlement` y `captureChileRefund` en el adaptador de pago, después de verificar la pasarela. Probar pagos invitados/autenticados, descuentos, despacho, IVA/exención, moneda y concurrencia real. El paquete se verificó contra la estructura del plugin oficial 3.92.1, no contra una tienda remota.
2. Verificar permisos/scopes y pedidos reales de Shopify 2026-10; WooCommerce con HPOS, impuestos/plugins y gateway reales. Revisar el alcance histórico de las credenciales y el comportamiento de paginación ante cambios.
3. Ensayar migración/despliegue y recuperación de respaldos en la versión de PostgreSQL del servidor (Compose configura PostgreSQL 17; pruebas locales realizadas con 18.6). Docker se revisó estáticamente, no se construyó ni desplegó la imagen en esta verificación.
4. Completar las [pruebas oficiales SII](../woo-dte-chile/wordpress/woo-dte-chile/docs/VALIDACION-SII.md): certificado real/firmante/cadena/revocación, CAF y anclas oficiales, autenticación SOAP/REST, envío y aceptación de 33/39/56/61, devoluciones/anulaciones/ND, estados y pérdida de respuestas, muestras PDF417 y entrega por correo. Requiere credenciales y documentos del ambiente de Certificación.
5. Revisar con el responsable tributario las NC automáticas, plazos y rebaja de IVA. No se automatizan CAF del portal, correcciones exclusivamente de texto, documentos completamente exentos ni obligaciones de intercambio/reportes fuera del alcance del núcleo. No se habilitó producción.
6. Conciliar previamente cualquier historial WordPress u otro facturador: no existe migración fiscal automática al motor nativo. Historial nativo entre tiendas sí se conserva.

## Repetir pruebas

Desde la raíz: `npm test` y `npx astro check`. En `services/payload`: `npm test`, `npm run check`, `npm run check:billing-extension`, `npm run build`. Ejecutar el núcleo con `php modules/woo-dte-chile/wordpress/woo-dte-chile/tests/unit.php` desde la raíz.

Para integración PostgreSQL, crear una base vacía dedicada con nombre `orbital_billing_test…`, definir `BILLING_TEST_DATABASE_URL` y ejecutar `npm run test:billing-db`. Ese test crea tablas y datos sintéticos: **nunca usar una base de negocio**. Sin esa variable la suite se omite. El script de navegador fue un arnés local temporal; los casos de lógica y persistencia sí se incluyen en el repositorio.
