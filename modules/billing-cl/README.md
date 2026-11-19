# Facturación propia · Chile — Orbital 0.3.0

Módulo nativo habilitado por negocio desde **Administración SaaS → Módulos** (`/administracion`), y configurado por el negocio desde **Tienda → Facturas y boletas**. Utiliza la tienda activa de ese negocio: **Shopify, WooCommerce o el plugin oficial de ecommerce de Payload**. Astro ofrece la interfaz y el proxy autenticado; Payload administra permisos y configuración; PostgreSQL conserva el libro fiscal; un proceso privado PHP genera y firma los documentos y comunica con el SII. No depende de Facto.

Esta entrega está integrada en el código de Orbital. No se desplegó ni se habilitó producción; no se enviaron DTE al SII real. La aceptación oficial está pendiente. Ver [validación y límites](VALIDACION.md).

## Instalar y operar

1. Desplegar este repositorio con sus dependencias bloqueadas. Aplicar las migraciones de Payload, incluida `20261116_150000_billing`, con respaldo previo. `compose.yaml` ejecuta las migraciones antes de iniciar Payload y añade `billing-worker`. El worker reintenta si la base todavía no está lista.
2. Mantener la misma `INTEGRATIONS_SECRET` en Astro, Payload y el worker. Respaldar esta clave y la base: perderla impide descifrar certificados, CAF y documentos. Mantener restringido el acceso a respaldos y variables de despliegue.
3. Conectar una tienda desde la configuración existente de Orbital. Debe existir exactamente una conexión comercial activa por negocio. Woo/Payload requieren HTTPS y su host explícito en `INTEGRATION_ALLOWED_HOSTS`; Shopify usa el dominio `*.myshopify.com`.
4. Para una tienda Payload, instalar [el paquete complementario](../../public/modules/orbital-payload-billing-cl-0.3.0.tgz), aplicar su migración y conectar sus helpers a la confirmación de pago/reembolso del adaptador. [Instrucciones completas](payload-extension/README.md). Esta parte debe ejecutarse en el servidor de **la tienda conectada**, que puede ser distinto del Payload administrativo de Orbital.
5. En Módulos → Instalar, completar emisor y certificado P12/PFX. Comenzar en **Certificación**. Confirmar que ningún otro facturador emite para esos pedidos. Importar CAF reales del mismo ambiente y emisor.
6. Consultar un pedido pagado, guardar su receptor si corresponde y solicitar boleta/factura. O habilitar emisión y/o NC automáticas. El worker procesa la cola; las solicitudes no equivalen a aceptación SII.

El motor requiere PHP CLI con OpenSSL, DOM/XML, mbstring, curl, sodium y bcmath. La imagen Docker incorpora el runtime. En desarrollo, usar `PHP_BINARY` si PHP no está en PATH y ejecutar `npm run billing:worker` dentro de `services/payload`. `BILLING_ENGINE_PATH` apunta al puente PHP; Docker lo configura. El adaptador PostgreSQL de Payload excluye `billing_*` de su schema push: esas tablas se administran exclusivamente con migraciones explícitas.

### Configuración de servidor

- `BILLING_SII_CAF_KEYS`: JSON de claves públicas oficiales por ambiente e IDK: `{"certification":{"IDK":"-----BEGIN PUBLIC KEY-----\n…"},"production":{…}}`. Obtener y comprobar su procedencia oficial antes de importar CAF. No se confían claves aportadas por el navegador.
- `SAAS_PUBLIC_URL`: origen público exacto de Orbital; Compose usa `APP_URL`.
- `RESEND_API_KEY`, `INVITATION_FROM`: transporte de correo existente. En certificación solo se entrega a `BILLING_TEST_EMAIL`; no al cliente real.
- Producción exige simultáneamente autorización del servidor `BILLING_PRODUCTION_AUTHORIZATIONS` (mapa por ID del negocio, con `rut` y `origin`), frase explícita `ACTIVAR PRODUCCION RUT` y evidencia de certificación en la configuración. No incluir esta autorización antes de completar las pruebas oficiales. Su presencia no demuestra certificación por sí misma.

## Conectores y automatización

- **WooCommerce:** REST autenticado, pedidos pagados, líneas/IVA/despacho/descuentos y reembolsos. Usa la API de pedidos, sin consultar tablas internas: no depende del almacenamiento clásico frente a HPOS. Requiere verificar el flujo con la pasarela y configuración HPOS reales.
- **Shopify:** Admin GraphQL `2026-10`, importes históricos, descuentos asignados a líneas, impuestos/despacho y transacciones exitosas de pago/reembolso. Necesita acceso de lectura a pedidos y sus transacciones, incluyendo los permisos de datos de clientes que Shopify exija. La visibilidad de pedidos históricos depende de los permisos concedidos. Solo CLP; pagos marcados de prueba no se emiten en producción.
- **Payload oficial:** pedidos y transacciones confirmadas del plugin, más eventos inmutables de la extensión `@orbital/payload-billing-cl`. No se reconstruye IVA desde el catálogo actual. La extensión no procesa dinero: el servidor de pagos debe llamarla con datos verificados de la pasarela.

El worker recorre páginas de hasta 50 pedidos por ciclo y vuelve a recorrerlas para detectar cambios; no depende de webhooks. El intervalo entre ciclos es 60 segundos, además del tiempo de procesamiento. No hace emisión automática retroactiva de pagos anteriores a la activación de esa conexión. Tampoco crea un original histórico solo para generar una NC. Los pedidos que no se pueden conciliar quedan registrados para revisión; revisar el estado de sincronización y los eventos antes de asumir que todos fueron procesados.

## Conservación y operaciones

Tipos admitidos: 39, 33, 61 y 56; ambientes Certificación y Producción; Chile/CLP, IVA 19% y líneas exentas en documentos mixtos. Emisión manual/automática, importación CAF, reserva transaccional de folios, TED/XMLDSig/XSD, envío/consulta SII, PDF/XML y correo. Las reglas y limitaciones tributarias del [núcleo fiscal](../woo-dte-chile/wordpress/woo-dte-chile/docs/VALIDACION-SII.md) siguen aplicándose.

La identidad incluye negocio, proveedor, origen de tienda, pedido, ambiente y emisor. El mismo ID en dos tiendas es distinto; repetir una operación no duplica documentos. Las NC reservan saldo bajo bloqueo; las acumuladas no pueden exceder el original. Una anulación completa después de una NC parcial se rechaza. Los originales no se borran ni sobrescriben. Las ND tienen referencia y operación propia.

Cambiar de tienda conserva el historial. Una pantalla con una conexión anterior no puede emitir: debe actualizarse. Las operaciones todavía sin firmar de otra tienda se pausan. Un envío incierto conserva folio y XML y no se vuelve a subir automáticamente. Consultar/reconciliar antes de cualquier intervención. Desactivar el módulo pausa sus automatizaciones y conserva lectura de historial/archivos.

La instalación antigua `woo-dte-chile` permanece para compatibilidad. **No se importa automáticamente su historial WordPress.** Si existe su registro en un negocio conectado a Woo, la emisión nativa se bloquea hasta una migración y conciliación deliberada. No eliminar registros como atajo para desbloquear: habría riesgo de doble emisión.

## REST para Astro/headless

`GET /api/orbital-modules` devuelve el catálogo y la tienda activa. `POST` recibe `moduleId: "billing-cl"`, `action` y sus datos. Las mutaciones ligadas a tienda incluyen `expectedStoreKey`, obtenido del catálogo. Acciones: `install`, `disable`, `status`, `orders`, `documents`, `history`, `fiscal`, `issue`, `adjust`, `caf`, `file`, `retry`, `email` (ver contratos en `services/payload/src/billing/api.ts`).

El endpoint Payload exige JWT de administrador del negocio; el ámbito se obtiene de la sesión, nunca del cuerpo. El navegador Astro usa `/api/saas/billing`, cookie de sesión y comprobación de mismo origen. No exponer credenciales de tienda ni JWT administrativos en un frontend público. `history` devuelve los últimos 100 documentos, incluidos los de conexiones anteriores; para un pedido usar `documents`. No hay operación pública de borrado fiscal.

## Referencias de los conectores

Se inspeccionó el paquete oficial `@payloadcms/plugin-ecommerce` 3.92.1 y su [documentación](https://payloadcms.com/docs/ecommerce/overview). Para Shopify se consultaron los esquemas oficiales de [Order](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Order), [LineItem](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/LineItem), [RefundLineItem](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/RefundLineItem) y [OrderTransaction](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/OrderTransaction). Las fuentes SII revisadas en septiembre de 2026 están documentadas en el núcleo fiscal; esta integración no constituye una nueva validación normativa ni certificación.

## Distribución

`public/modules/orbital-billing-cl-0.3.0.zip` es un **paquete de integración para este repositorio Orbital**, con archivos nuevos y un parche de los puntos de integración. No se carga en el instalador WordPress ni en un catálogo de código arbitrario. En este checkout ya están aplicados los cambios: desplegar y habilitar desde Módulos. La tienda Payload conectada instala por separado el `.tgz` complementario.
