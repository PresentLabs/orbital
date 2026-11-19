> Adaptador anterior 0.2.1. Para nuevas instalaciones utiliza [Facturación propia multitienda 0.3.0](../billing-cl/README.md). El historial WordPress existente requiere conciliación antes de cambiar de motor.

# Facturación propia · Chile — módulo Orbital 0.2.1

Integración local implementada el 16 de noviembre de 2026. Astro presenta la aplicación, Payload autoriza y mantiene la conexión cifrada, WooCommerce emite y conserva los documentos. El motor es Woo DTE Chile, independiente de Facto.

## Instalar

1. Despliega este código de Orbital. En Payload ejecuta `npm run migrate` con respaldo previo de la base; Compose ya ejecuta las migraciones al arrancar. La nueva migración agrega `module_installations` sin borrar datos.
2. Usa el mismo `INTEGRATIONS_SECRET` de al menos 32 caracteres en Astro y Payload. No lo cambies sin migrar las credenciales cifradas existentes. Agrega el dominio exacto de la tienda a `INTEGRATION_ALLOWED_HOSTS` de ambos servicios (por ejemplo `tienda.ejemplo.cl`, sin protocolo, separados por coma). Solo HTTPS en el origen raíz; redirecciones bloqueadas. Autoriza únicamente dominios de tiendas bajo tu control.
3. Conecta WooCommerce en Configuración → Integraciones usando las credenciales Woo habituales.
4. La pantalla Módulos del negocio fue retirada. Este adaptador se conserva para instalaciones anteriores y clientes internos autorizados; la concesión se gestiona desde `/administracion`. Descarga el instalador WordPress `public/modules/woo-dte-chile-0.2.1.zip`, instala y activa el plugin en esa tienda.
5. Configura en WordPress emisor, certificado, CAF y ambiente **Certificación**. Lee `wordpress/woo-dte-chile/docs/INSTALACION.md` y el resto de la documentación del motor. Los secretos tributarios permanecen en WordPress.
6. Crea una **contraseña de aplicación de WordPress** para un usuario con `manage_woocommerce`; utiliza el contrato interno autorizado indicado abajo para verificar y guardar la conexión. El panel actual configura el motor fiscal nativo. No sirven las claves `ck_`/`cs_` de Woo para las rutas DTE. La verificación consulta metadatos autenticados del plugin.
7. Consulta el ambiente activo, un pedido y sus documentos antes de emitir. Solo se emiten pedidos con pago confirmado. El receptor se guarda antes del primer DTE.

No se conectó ninguna tienda real ni se cambiaron credenciales del negocio durante el desarrollo. La instalación del módulo en una cuenta requiere los pasos anteriores.

## Operaciones

- Catálogo e instalación por negocio; rotación de credenciales; desactivación exclusiva desde Administración SaaS conservando registros.
- Consulta de documentos por pedido, referencia al original, ambiente, monto y estado.
- Datos tributarios del receptor y emisión manual DTE 33/39.
- NC 61, anulación con NC, ND 56; monto CLP, motivo, tipo de corrección, IndNoRebaja y líneas afectas/exentas opcionales.
- Clave de ajuste persistida durante la sesión del navegador; reintentar utiliza la misma clave. Para otra operación se genera una clave nueva explícitamente. Tras perder una sesión, consultar primero el historial en WordPress; no generar otra clave ante un resultado incierto.
- Consulta/reintento de cola, PDF/XML y envío de correo al cliente registrado en WooCommerce. Los emails se solicitan con un botón explícito; su entrega depende del correo de WordPress.
- Emisión automática tras pago confirmado y NC por reembolsos permanecen en los hooks de WooCommerce. No se instala una segunda cola fiscal en Astro/Payload. Desactivar la conexión Orbital **no detiene** esos hooks; para detenerlos se configura WordPress.

WooCommerce mantiene la idempotencia por pedido/refund/operación, locks, saldo acreditado, aceptación del original, trazabilidad y documentos originales inmutables. Orbital no permite borrar documentos ni cambiar producción. Una NC manual no mueve dinero. Las reglas del motor impiden los ajustes no admitidos y los montos que excedan el saldo original.

## Contrato para Astro y otras aplicaciones Orbital

`GET /api/orbital-modules` en Payload devuelve el catálogo e instalación. La concesión se controla exclusivamente desde `/administracion`. `POST /api/orbital-modules` recibe JSON con `moduleId: "woo-dte-chile"` y `action`:

| Acción | Campos |
| --- | --- |
| install | username, password (contraseña de aplicación) |
| status | — |
| documents | orderId |
| fiscal | orderId, type (33/39), receiver: rut, name, giro, address, commune |
| issue | orderId, type (33/39) |
| adjust | documentId, type (61/56), amount entero CLP, reason, cancel booleano, kind (`return`/`amount_correction`), operationKey estable; opcional no_vat_reduction y lines |
| retry / email | documentId |
| file | documentId, format (`xml`/`pdf`) |

El proxy Astro general anterior fue eliminado; `/api/saas/billing` atiende únicamente el motor nativo `billing-cl`. El adaptador anterior sigue disponible mediante el endpoint interno Payload, que exige concesión SaaS y JWT explícito de un administrador, deriva workspace de la identidad y consulta la tienda de ese workspace. `file` devuelve filename/mime/base64. No se exponen claves, CAF ni certificados al cliente. No hay proxy de URLs o rutas arbitrarias. El módulo queda ligado al origen original; cambiar la tienda bloquea sus operaciones hasta restaurar esa conexión para proteger el historial.

La nueva ruta de WordPress `GET /wp-json/woo-dte-chile/v1/capabilities` requiere `manage_woocommerce`, devuelve versión/ambiente/automatizaciones/bloqueo de producción y no revela secretos. `siiCertificationVerified: false` evita presentar la conectividad como certificación.

## Límites tributarios

Se conserva el motor 0.2.0 y su revisión documental de septiembre de 2026; 0.2.1 agrega metadatos de conexión, sin modificar reglas tributarias ni protocolos SII. No se declara una nueva revisión normativa a noviembre de 2026 ni compatibilidad certificada.

Deben probarse en Certificación SII: autenticación con certificado real, CAF/folios autorizados, XML/TED/firma y sobres de los cuatro tipos, envío y consultas oficiales, aceptación/rechazo/reparos, NC totales/parciales, ND, impuestos mixtos y recuperación de respuestas inciertas. También validar PDF417, correo, HPOS y pagos/reembolsos con la tienda real. Producción conserva los bloqueos del motor y requiere evidencia y autorización explícita en WordPress/servidor.

Persisten las limitaciones documentadas del motor: reemplazo de boleta tras corrección no automatizado, recuperación manual de algunos resultados inciertos, intercambio XML con receptor/RVD no implementados y validación completa de cadena/revocación de certificado pendiente. Consultar la documentación incluida antes de habilitar producción.

## Desarrollo y verificación

- `npm test` en Orbital: pruebas existentes de frontend/dominio.
- `npm test`, `npm run check` y `npm run build` en `services/payload`: incluye pruebas de módulos.
- `npm exec astro check` y `npm run build` en Orbital.
- `php wordpress/woo-dte-chile/tests/unit.php` desde esta carpeta.
- `php -d zend.assertions=1 -d assert.exception=1 test-capabilities.php`.
- `python3 package.py`: recompone el instalador, verifica integridad y actualiza manifiesto/SHA256. Excluye fixtures y pruebas del ZIP desplegable.

Las pruebas locales usan credenciales sintéticas y respuestas simuladas. Ver `VALIDACION.md` para evidencia y limitaciones del entorno.

Referencias de integración: [endpoints Payload](https://payloadcms.com/docs/rest-api/overview), [autenticación Payload](https://payloadcms.com/docs/authentication/overview). La documentación SII de base está incluida en el motor.
