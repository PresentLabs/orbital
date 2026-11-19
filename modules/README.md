# Módulos Orbital

Los módulos se activan por negocio exclusivamente desde `/administracion`. Son implementaciones revisadas y distribuidas con Orbital; el catálogo no acepta código ejecutable arbitrario.

- [Reservas 0.1.0: estado y alcance parcial](../docs/ESTADO-MODULO-RESERVAS.md).
- [Facturación propia · Chile 0.3.0](billing-cl/README.md): módulo nativo para la tienda activa, Shopify, WooCommerce o ecommerce oficial de Payload.
- [Verificación y pendientes](billing-cl/VALIDACION.md).
- [Adaptador WordPress anterior 0.2.1](woo-dte-chile/README.md): compatibilidad e historial previo; no se migra automáticamente al motor nativo.

Las instalaciones usan `module-installations`, cifrado y ámbito por negocio. El catálogo nativo y su contrato están en `services/payload/src/billing/api.ts`; el despacho compartido, en `services/payload/src/modules/index.ts`. Astro usa el proxy autenticado `/api/saas/billing`.

Para añadir otro módulo, registrar explícitamente su manifiesto y adaptador, sus permisos y validaciones, interfaz, pruebas de aislamiento y migraciones. No reutilizar credenciales o endpoints fiscales para otro servicio.
