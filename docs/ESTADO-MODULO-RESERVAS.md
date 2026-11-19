# Estado de implementación de Agendamiento

Actualizado el 18 de noviembre de 2026. La matriz de 103 bloques y el inventario de 2.963 archivos conservan el alcance completo. Esta entrega implementa una primera parte; no equivale a completar F0–F9 ni a reproducir todo LatePoint.

## Registro actualizado de alcance

La revisión completa del ZIP, los 103 bloques individuales y el punto de continuación se conservan en [Paridad de Agendamiento](PARIDAD-AGENDAMIENTO.md), [auditoría de archivos](AUDITORIA-ZIP-AGENDAMIENTO.json) y [continuidad](CONTINUIDAD-AGENDAMIENTO.md). La paridad funcional completa sigue pendiente. Las afirmaciones de esta página deben leerse con las brechas de esa matriz.

Última entrega: Agenda de hoy al inicio, gráficos de curva como Vista general, botones redondeados y tarjetas sin borde, grupo Equipo alineado, eliminación de `.page-eyebrow`, guardado a `1rem`, tablas con estados/acciones de Pedidos y detalle histórico. Incluye límites diarios por profesional, máximo de horas futuras por cliente, motivos e historial de cambios con permisos. El máximo futuro también se comprueba al reagendar y conserva la exclusión de la propia hora.

## Revisión de UX del panel

El módulo se presenta como **Agendamiento**, con Resumen, Agenda, Servicios, Profesionales, Sucursales, Recursos, Clientes y Configuración en el menú lateral. Los submenús usan texto sin íconos decorativos; el grupo activo se expande automáticamente. Cada sección tiene ruta propia bajo `/app/agendamiento`; `/app/reservas` sigue funcionando como enlace anterior.

El Resumen consulta indicadores, evolución diaria, próximas atenciones, agenda del día y distribución por servicio/profesional desde PostgreSQL con el mismo ámbito de negocio/usuario. Ofrece períodos de 7 y 30 días. El monto pagado corresponde a las horas cuya fecha de atención cae en ese período; no se presenta como cobros recibidos en esas fechas. Las consultas incluyen todos los registros autorizados, sin limitarse a una página de la agenda.

`src/styles/workspace-ui.css` establece colores, tipografía, superficies, controles, tablas, formularios y navegación compartidos. Se conservan las geometrías de los espacios y las tarjetas del lienzo. La terminología visible usa sucursal, monto, agendar/reagendar hora, realizada y no asistió.

## Implementado

- Activación y revocación por negocio en `/administracion` → negocio → Módulos, reservadas a las identidades SaaS configuradas en servidor. Concesiones con ámbito, fecha, actor y eventos de auditoría persistentes. CRUD directo de concesiones cerrado.
- Eliminación del menú/pantalla Módulos del negocio y de sus componente, script y proxy anteriores. Facturación conserva su operación en Tienda → Facturas y boletas, con `/api/saas/billing`. El despacho interno de módulos sigue utilizado por facturación y compatibilidad fiscal.
- Nuevo menú Reservas cuando está habilitado, usando el panel y temas de Orbital. Backend con permisos de calendario y configuración reservada a administradores. Los profesionales ven sus citas asignadas y las que crearon.
- Catálogo: servicios, profesionales vinculados a usuarios del negocio, sedes, recursos y clientes; edición, desactivación, duplicación de servicios, búsqueda y reutilización de clientes por correo normalizado.
- Horarios semanales con varias franjas por día para negocio, servicio, profesional y sede; intersección de horarios y excepciones por fecha, incluidos días cerrados.
- Disponibilidad con duración, intervalos, buffers, anticipación/horizonte globales, límites diarios globales y por servicio, capacidad de asistentes y recursos compartidos. Zona horaria explícita y rechazo de horas inexistentes por DST.
- Reservas internas: creación, estados fijos, cancelación y reprogramación atómica, sin cambiar precio ni pago. Versiones de edición, claves de creación idempotentes, auditoría y búsqueda de reservas paginada con filtro de fecha.
- Importes en unidades menores y moneda explícita. Reservas gratuitas confirmadas; las de pago quedan pendientes salvo que el negocio autorice saldo pendiente. No se registra un pago por una acción manual de confirmación.
- Migraciones explícitas para concesiones, reservas y auditoría, sin modificar datos de producción durante las pruebas. Las concesiones fiscales existentes se inicializan desde sus instalaciones para mantener compatibilidad.

## Trazabilidad de alcance

| Bloques | Estado y límite actual |
| --- | --- |
| ORB01 | Implementado y probado por API/UI; activación central también aplicada a facturación |
| ORB02 | Parcial: menú con concesión/permisos; publicación pública y validación de preparación pendientes |
| ORB04–ORB06 | Implementados en la entrega anterior; se conservan |
| CAT01, CAT07–CAT09 | Parcial: catálogo básico; faltan imágenes, categorías de sede, asignaciones ampliadas y políticas avanzadas de recursos |
| DIS01, DIS03 | Implementados en el motor y formularios; falta la comparación funcional con la instalación de referencia de F0 |
| DIS02, DIS04–DIS05 | Parcial: fechas especiales y reglas globales; faltan rangos, bloqueos rápidos y excepciones/límites avanzados por entidad |
| DIS07–DIS08 | Parcial: zonas/DST y concurrencia básica; faltan selección explícita de horas duplicadas y políticas configurables de exclusividad/simultaneidad |
| RES01, RES03, RES05–RES06, RES08, RES10 | Parcial: ciclo interno, reprogramación, cupos, cálculo base y listado; faltan edición ampliada, políticas grupales, calendario visual y actividad navegable |
| CLI01, CLI08 | Parcial: contacto y deduplicación por correo; faltan ficha/historial completo, tienda y políticas de teléfono |
| ORB07 | Parcial: estados de carga/error, formularios y teclado en pestañas; falta validación integral de todos los flujos previstos |
| Resto de los bloques | Pendiente; se mantiene cada criterio del plan original |

## Pendiente antes de ofrecer reservas públicas de pago

Checkout y conciliación real Shopify/WooCommerce/Payload; retenciones con expiración; portal público y autenticación de clientes; pedidos, depósitos, saldos, impuestos, reembolsos; recurrencia, paquetes, cupones y extras; eventos, entradas/QR, espera y check-in; workflows/notificaciones; Google/Meet/Zoom/Mailchimp/WhatsApp; informes, importación/exportación y APIs de extensión. También siguen pendientes el entorno de referencia F0, las pruebas de integración externas y la aceptación integral F9.

El motor actual no crea checkouts ni procesa cobros. Una reserva interna pendiente no tiene todavía una retención temporal: ocupa cupo hasta su cancelación. No publicar este flujo como reserva pública de pago completa.

## Verificación y operación

- Frontend: `npm test` (73 pruebas), `npm run build` y `npm run check:modules` para los scripts modificados.
- Backend: `npm test` (75 pruebas), `npm run check`.
- PostgreSQL real: todas las migraciones desde base vacía; activación SaaS/denegación al propietario, aislamiento, versiones, reintentos, búsqueda, clientes, cancelación/reprogramación y ocho solicitudes concurrentes al último cupo.
- Para repetir la prueba de base: `RESERVATIONS_TEST_DATABASE_URL=postgres://.../orbital_reservations_test npm run test:reservations-db` dentro de `services/payload`. Solo acepta localhost y nombres terminados en `_test`; crea datos ficticios. Aplicar antes las migraciones a esa base de prueba.
- Verificación UI con cuentas ficticias: activar desde administración, ver el menú del negocio, crear servicio y reservar un horario real del motor local. Sin llamadas ni cambios a tiendas reales.
- Despliegue: ejecutar las migraciones mediante el flujo existente de Payload/Compose y configurar el mismo `SAAS_ADMIN_USER_IDS` en Astro/Payload. Activar Reservas por negocio desde administración; después configurar catálogo y horarios en `/app/reservas`.
