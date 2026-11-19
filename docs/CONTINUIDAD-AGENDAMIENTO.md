> Estado vigente del rediseño del 18/11/2026: [CONTINUIDAD-UX-SISTEMA.md](CONTINUIDAD-UX-SISTEMA.md). El registro siguiente conserva bloques históricos; las referencias antiguas a 1rem, ausencia de PRODUCT/DESIGN y apariencia anterior quedan reemplazadas por ese registro. La paridad del ZIP sigue incompleta.

# Continuidad de implementación — Orbital

Actualizado: 18 de noviembre de 2026. Solicitud activa: refinamiento con Impeccable, coherencia con Vista general y paridad completa con Archivo.zip, sin omitir capacidades.

## Regla de continuidad

Antes de detener o compactar el trabajo, actualizar este archivo con archivos modificados, resultados reales, pendientes y siguiente acción concreta. Reanudar desde aquí y desde `PARIDAD-AGENDAMIENTO.json`; no volver a inventariar lo ya comprobado ni declarar completo el alcance que sigue pendiente.

## Comprobado

- ZIP: SHA-256 `8f517955b99555e688ae52ff4483076c9490dcda08a919d6ae88c2bdb609cf3b`; 9 paquetes, 2.963 archivos verificados contra el inventario, sin diferencias. Auditoría repetible en `scripts/audit-booking-parity.py`.
- Matriz: 103 bloques conservados individualmente en `PARIDAD-AGENDAMIENTO.md/.json`, con criterios, referencias, implementación parcial y pendientes.
- La paridad funcional NO está terminada. Checkout, portal, recurrencia, paquetes, extras, eventos, automatizaciones e integraciones siguen pendientes según la matriz.
- Impeccable: se leyó SKILL.md, polish.md, operate.md y craft-floor.md. El launcher falló por motor no instalado/permisos de caché; se siguió el fallback documentado. No hay PRODUCT.md ni DESIGN.md en el repositorio. La referencia de diseño explícita es Vista general.

## Entrega verificada del refinamiento

La revisión preparada en `/private/tmp/orbital-impeccable.j8Ofo3` ya está aplicada al original mediante parches, preservando los cambios anteriores. Mantener esta copia temporal para repetir las pruebas hasta finalizar el alcance.

- Agenda de hoy primero; gráfico con curva/área, inspección de puntos y tabla de datos, reutilizando Vista general.
- Botones redondeados y tarjetas sin contorno; pares con igual altura; contraste de la curva adaptado a oscuro.
- Equipo con `ul/li`, fondo gris, bordes redondeados e hijos alineados. Sin `.page-eyebrow`; estado de guardado `1rem`.
- Estados y acciones de agenda con las clases de Pedidos; detalle también en estados cerrados y lectura; historial autorizado y motivos de cambio/cancelación.
- Límites diarios por profesional y máximo de horas futuras por cliente, protegidos por transacción, también al reagendar una hora pasada.
- Administración SaaS alineada en botones y superficies.

## Evidencia

- Frontend: 73 pruebas; backend: 75 pruebas. TypeScript frontend/backend y build Astro pasan.
- PostgreSQL real: aislamiento, concesión, idempotencia, último cupo concurrente, límites futuros concurrentes y por reprogramación, motivos e historial por permisos.
- Navegador de prueba aislado con perfil propio: escritorio 1440 px y móvil 390 px; light/dark; sin desbordamientos ni excepciones JavaScript; gráfico consultable, períodos 7/30 días, detalle cerrado, cancelación con motivo e historial, alta de profesional con límite diario y coherencia SaaS. CUA no estaba disponible; se usó Chrome headless de prueba.
- Pares de gráficos/listas: 371/371 px; rankings: 206/206 px. Equipo: desfase horizontal 0 px. Topbar 16 px = 1rem; tarjetas 0 px de borde; botones radio 999 px.
- `docs/VALIDACION-UI-AGENDAMIENTO.json` guarda el resultado. Capturas en la carpeta de visualizaciones de esta conversación, prefijo `impeccable-agendamiento-`.
- No se tocaron datos ni despliegues de producción.

## Trabajo activo y siguiente acción

El refinamiento, CAT02 y CAT03 ya fueron aplicados al original y se verificó igualdad con los archivos probados. CAT04 se añade en este bloque. La matriz conserva las 103 capacidades; ninguna se descarta.

1. Continuar F2: imágenes de servicios/extras (CAT01/CAT04); después paquetes/saldos y políticas de visibilidad (CAT05/CAT06).
2. Mantener pendientes públicos/integraciones/checkouts según matriz. Los cobros deben heredar Shopify, WooCommerce o Payload de la tienda.
3. Actualizar matriz y este registro después de cada bloque. No confundir integridad de archivos con paridad funcional.
4. La equivalencia con una instalación ejecutable de referencia sigue pendiente. Total: 4 implementados, 39 parciales y 60 pendientes.

## Herramientas temporales para retomar

- Copia de trabajo: `/private/tmp/orbital-impeccable.j8Ofo3`.
- `preview-impeccable.mjs` sirve datos sintéticos desde PostgreSQL local en 4394; su base de pruebas usa 55440 y nombre terminado en `_test`.
- `preview-browser-test.mjs` verifica el perfil Chrome headless propio del puerto 9433. Usa únicamente cuentas y datos ficticios. No sustituirlo por la sesión del usuario.
- No entregar estos dos archivos temporales ni dependencias, perfiles, `dist`, credenciales, `.env` o artefactos de compilación en el parche fuente.

## Bloque F2 categorías y duraciones validado

- Categorías superiores y orden, validación de ciclos/ámbito, asignación y filtro jerárquico de servicios.
- Duraciones alternativas y precios propios; disponibilidad e importe calculados en servidor. Reintento tras retirar una duración e historial al reagendar conservados.
- Migración `20261118_030000_reservations_catalog.ts`, registrada en el índice. Aplicada solamente a la base temporal: debe ejecutarse con el procedimiento habitual de migración antes de usar categorías en un despliegue.
- 73 pruebas frontend y 77 backend pasan; TypeScript en ambos y build Astro pasan. Integración real PostgreSQL pasa. Navegador: alta de categorías, orden jerárquico, rechazo de ciclo, filtro por categoría superior, alta de servicio con alternativa, cotización y creación de hora de 30 minutos por $9.000, móvil 390 px sin overflow, temas claro/oscuro sin excepciones.
- Evidencia adicional: `VALIDACION-F2-AGENDAMIENTO.json` y capturas `impeccable-categorias-dark`, `impeccable-duraciones-light`, `impeccable-duracion-mobile-dark` en la carpeta de visualizaciones.
- CAT02/CAT03 avanzan a parcial: faltan sus flujos públicos y comparación con referencia ejecutable. La matriz conserva 103 bloques: 4 implementados, 38 parciales, 61 pendientes.
- Siguiente bloque: CAT04, extras con cantidad/precio/duración y mínimo/máximo de tipos distintos por servicio, siguiendo la fuente del ZIP. No confundir cantidad de unidades con cantidad de extras seleccionados.

## Bloque CAT04 extras validado

- Catálogo y submenú de Extras en Agendamiento; configuración solo para propietario/administrador. Asignación a servicios, precio y tiempo por unidad y cantidad máxima.
- Mínimo/máximo de tipos distintos por servicio, siguiendo `feature_service_extras_helper.php` del ZIP. Las unidades se cobran una vez por reserva, independiente de asistentes; el precio del servicio mantiene su regla por persona.
- Disponibilidad y creación resuelven extras del catálogo del negocio en servidor; rechazan extras ajenos, inactivos, duplicados, cantidades fuera de rango y selección insuficiente/excesiva. El total de tiempo ocupa el horario completo y los recursos.
- Instantánea con nombre, precio, tiempo y unidades; la reprogramación conserva datos históricos aunque se cambie/desactive el extra. Los reintentos usan selección normalizada y no duplican.
- Migración `20261118_040000_reservations_extras.ts`, aplicada solo a la base temporal; ejecutar las migraciones pendientes en un despliegue antes de usar el catálogo ampliado.
- 73 pruebas frontend y 78 backend; TypeScript frontend/backend, build e integración PostgreSQL pasan. Navegador verifica alta/asignación, mínimo obligatorio, 2 personas + 2 extras = $22.000 y 60 minutos, invalidación de horarios al cambiar unidades, creación, detalle y reagendamiento. Móvil 390 px, light/dark, sin overflow ni excepciones.
- Evidencia: `VALIDACION-EXTRAS-AGENDAMIENTO.json`; capturas `impeccable-extra-light`, `impeccable-reserva-extras-light` y `impeccable-reserva-extras-mobile-dark`.
- CAT04 parcial: imagen, ajuste de horas pagadas por checkout, portal público y comparación ejecutable pendientes.
- Herramienta temporal adicional `preview-extras-browser-test.mjs`; no entregarla como fuente del producto.

## Ampliación CAT04: edición de extras en una hora existente

- `update-booking-extras` actualiza únicamente horas vigentes sin pago (unpaid/free), con permisos de agenda, aislamiento de negocio, versión y la misma transacción/bloqueo de espacio que la creación.
- Al cambiar extras conserva el subtotal original del servicio, su duración base y sus recursos/márgenes históricos. Resuelve precio/tiempo/cantidad de los nuevos extras desde el catálogo vigente.
- Rechaza la expansión si ocupa otra hora; bloquea cambios directos sobre horas pagadas/parciales/reembolsadas, cuyo ajuste requiere tienda. El motivo y el antes/después se registran en el historial.
- UI: botón Cambiar extras, cotización y comprobación del horario original antes de guardar; detalle y motivo en historial. Los extras retirados del catálogo se identifican antes de quitarse al guardar.
- 79 pruebas backend pasan, TypeScript en ambos proyectos y build Astro pasan. Integración PostgreSQL verifica expansión en conflicto, permisos, protección de pagos, versión obsoleta, actualización de total/término e historial. Navegador verifica la edición y el motivo, además de las pruebas anteriores de extras.
- El script de navegador inicialmente apuntaba a un campo `reason` de facturación oculto; se corrigió para seleccionar el del formulario de Agendamiento. La API y la UI de producción usan el formulario local; el caso pasó al repetirlo.
- Evidencia actualizada en `VALIDACION-EXTRAS-AGENDAMIENTO.json`; captura `impeccable-editar-extras-dark`.

## CAT01: precio de referencia separado del cobro

- Campo opcional de referencia en el formulario de servicio y presentación en catálogo. El precio principal se identifica como precio de cobro.
- Validación de enteros/no negativos en servidor; null significa sin referencia. No interviene en importe por persona, duración alternativa, extras ni reservas históricas.
- 80 pruebas backend y 73 frontend pasan; TypeScript frontend/backend y Astro build pasan. Integración PostgreSQL pasa con referencia $30.000 manteniendo cobro $15.000/$9.000 según duración. Navegador: referencia $15.000 visible en catálogo sin cambiar servicio $9.000 ni cotización con extras.
- En el perfil ficticio estaba activado ocultar montos; la prueba habilitó su visualización usando el control existente. La preferencia del usuario real no se tocó.
- CAT01 permanece parcial por imagen y comparación ejecutable con referencia. No se eliminó ninguna de las 103 capacidades del alcance.

## Punto exacto para reanudar

Todos los bloques anteriores están aplicados al repositorio original y sus diferencias revisadas con `git diff --check`. La copia temporal conserva los scripts y la infraestructura de pruebas. Las migraciones nuevas siguen aplicadas solo a la base temporal, no a un despliegue real.

Próximo trabajo: checkout y retenciones por tienda antes de acreditar/consumir saldos de paquetes (CAT05); luego catálogo/portal públicos y políticas CAT06. Las imágenes y el catálogo de paquetes ya se implementaron y validaron en los bloques que siguen. Para pagos posteriores se debe usar la tienda conectada, sin simular pagos confirmados ni incorporar pasarelas paralelas. Consultar toda la matriz (4 implementados, 39 parciales, 60 pendientes). Continuar con portal público, retenciones, recurrencias, eventos, automatizaciones e integraciones según sus fases, sin omitirlos.

Archivos de pruebas temporales: `preview-f2-browser-test.mjs` y `preview-extras-browser-test.mjs`. Logs de la última comprobación: `/private/tmp/orbital-reference-{front,back,back-types,db,build,browser}.log`. No entregar scripts temporales, perfiles, dependencias, base de prueba ni `dist` dentro del parche de fuente.

## CAT01/CAT04: imágenes de servicios y extras

- Imagen opcional en el formulario: previsualización local, carga/reemplazo, retiro y cancelación de cambios. PNG/JPG/WebP/GIF hasta 4 MB; imagen fija optimizada a WebP, máximo 960×640, sin EXIF. Los SVG de Archivos siguen aceptados por su flujo existente; esta carga de catálogo indica sus formatos explícitamente.
- Imagen y registro se guardan en la misma transacción/versionado; no se crean activos huérfanos al cancelar o fallar el formulario. Las imágenes binarias van en `reservation_catalog_images`, separadas del JSON/listado y con FK compuesta al negocio/registro. No se usan URLs externas ni rutas de archivo enviadas por el cliente.
- GET autorizado por sesión, permiso de agenda y módulo activo; consulta siempre por negocio. Solo administradores pueden subir/quitar/copiar, y la copia valida origen del mismo negocio y tipo. Copiar un servicio crea su propia imagen; retirar la original no afecta la copia.
- Catálogo con imagen contenida sin recorte y título siempre visible, espacio uniforme y alturas iguales; previsualización/controles compatibles con ambos temas y móvil.
- Migración `20261118_050000_reservations_images.ts`, registrada en el índice y ejecutada solamente en PostgreSQL temporal. El despliegue real requiere aplicar las migraciones pendientes.
- Validación: 73 pruebas frontend y 81 backend pasan; TypeScript frontend/backend y build Astro pasan. PostgreSQL prueba lectura ajena, permisos, módulo desactivado, reintentos, copia, retiro, archivo corrupto y versiones obsoletas sin perder imagen anterior. Navegador aislado verifica alta/previsualización, edición sin cambiar imagen, reemplazo, duplicado, cancelar retiro, retirar imagen, alta de extra, desktop/móvil 390 px y light/dark, sin overflow ni excepciones. Capturas revisadas visualmente.
- Evidencia `VALIDACION-IMAGENES-AGENDAMIENTO.json`; capturas `impeccable-catalogo-imagenes-{light,dark}`, `impeccable-catalogo-imagen-editor-{light,mobile-dark}` y `impeccable-catalogo-extra-mobile-{light,dark}` en la carpeta de visualizaciones.
- Archivo temporal de navegador: `preview-images-browser-test.mjs`, no entregar como fuente. Logs `/private/tmp/orbital-images-{front-types,back-types,root-tests,back-tests,migrate,db,build,browser}.log`.
- CAT01/CAT04 siguen parciales por los flujos públicos y comparación funcional ejecutable; no declarar paridad completa. Matriz: 4 implementados, 39 parciales, 60 pendientes (103 conservados).

## CAT05: catálogo de paquetes (compra y saldos todavía pendientes)

- Submenú Paquetes de Agendamiento, visible para propietario/administrador. Alta/edición/duplicado/desactivación, imagen, precio de cobro y referencia, visibilidad interna/pública y orden.
- Servicios incluidos con sesiones, duración ofrecida por cada servicio y personas por sesión; total de sesiones visible. El selector evita repetir servicios y permite agregar/quitar líneas. Los paquetes vacíos no se guardan.
- Validación servidor del tipo/ámbito del servicio, capacidad, duración y versión. No se permite usar un paquete como ID de servicio de una reserva individual. Imágenes se copian de forma independiente como en servicios.
- Referencia revisada: `bundle_model.php` del CORE y `_form.php`/`bundles_controller.php` de Pro; su selector de duración usa las duraciones ofrecidas por servicio, y el número de sesiones es independiente de las personas por sesión.
- Migración `20261118_060000_reservations_packages.ts`, aplicada solo a la base temporal. No se ejecutaron migraciones en producción.
- 73 pruebas frontend y 82 backend; TypeScript en ambos, build Astro e integración PostgreSQL pasan. Navegador: dos servicios con 3+2 sesiones, duración alternativa 30 min, 2 personas por sesión, imagen, precio/visibilidad, copia, quitar servicio/cambiar cantidad, rechazo de vacío. Tarjetas con igual altura, móvil 390 px, light/dark sin overflow ni excepciones. Se revisaron también los campos de sesiones dentro del formulario desplazable móvil.
- Evidencia `VALIDACION-PAQUETES-AGENDAMIENTO.json`; capturas `impeccable-paquetes-{light,dark,mobile-dark}`, `impeccable-paquetes-editor-{light,mobile-dark}` y `impeccable-paquetes-sesiones-mobile-dark`.
- El catálogo configura productos; no vende ni acredita saldo todavía. No hay botón de marcar paquetes pagados ni alta manual de sesiones. La visibilidad es metadata para el futuro catálogo público, no publicación actual.
- CAT05 pasa a parcial; el criterio Comprar/consumir sin exceder saldo concurrente NO está cumplido. Matriz conserva 103: 4 implementados, 40 parciales, 59 pendientes.

## Siguiente paso concreto actualizado

El código anterior está aplicado al original, preservando cambios previos. Mantener la copia `/private/tmp/orbital-impeccable.j8Ofo3` para las pruebas y consultar toda la matriz. Siguiente: preparar retenciones con vencimiento e intención de checkout vinculada a la tienda activa; implementar verificación canónica de pago Shopify/WooCommerce/Payload antes del ledger de sesiones. Solo entonces acreditar paquetes y consumir/reponer sesiones transaccionalmente con pruebas simultáneas e idempotencia. No implementar un atajo administrativo que marque pagos o conceda saldo sin la tienda.

También siguen pendientes, sin retirarlos del alcance: depósitos/rangos de precio, catálogo público y modo servicios/paquetes/ambos, portal/autenticación de clientes, reservas recurrentes, eventos/tickets/QR/espera, automatizaciones, integraciones, API/importación/exportación y comparación con la referencia ejecutable.

Herramienta temporal de este bloque: `preview-packages-browser-test.mjs`, no entregar. Logs `/private/tmp/orbital-packages-{front-types,back-types,root-tests,back-tests,migrate,db,build,browser}.log`. El panel de prueba usa puerto 4394, PostgreSQL 55440 y Chrome de perfil propio 9433; nunca usar sesiones ni datos personales del usuario en estas pruebas.

## Plataforma accesible para revisión del usuario

- El usuario pidió continuar y poder ver la plataforma. Se abrió en Codex y en el navegador del sistema `http://127.0.0.1:4394/app/agendamiento`; `/acceso` responde 200.
- Cuenta ficticia de revisión existente: `owner-reservas@example.test`, contraseña `local-preview-password-1234`. Permite recorrer Orbital y Administración SaaS de pruebas. No es una instancia de producción ni contiene datos reales del usuario.
- Para mantener estable la vista aunque se siga compilando, se sirve desde `/private/tmp/orbital-preview-holds-20261118-v3/dist`, con servidor `/private/tmp/orbital-impeccable.j8Ofo3/preview-platform-live.mjs`. Datos y sesión de la cuenta de revisión se conservaron. Log `/private/tmp/orbital-platform-live.log`.
- Nuevas pruebas de navegador usan otra cuenta y negocio (`browser-holds@example.test`), para no cambiar los datos/preferencias de la cuenta abierta por el usuario. El perfil headless es el propio del puerto 9433, separado de su navegador.

## DIS09: retención de horario con plazo de pago

- Nuevas reservas internas pendientes sin pago tienen vencimiento configurable (5–120 min, 15 por defecto). El vencimiento libera el horario y la cuota futura, cancela sin borrar historial y registra un único evento de sistema.
- Reagendar/editar extras no extiende el plazo. Registros pagados, parciales, gratuitos o confirmados no vencen por esta regla. Reintentar una creación vencida devuelve su registro cancelado, no crea otra reserva.
- Limpieza transaccional con el bloqueo por negocio en lecturas/operaciones y proceso periódico `npm run reservations:worker` (30 s); `--once` probado. La activación del módulo se vuelve a comprobar y se evitan duplicados en ejecuciones simultáneas.
- UI: plazo en tabla/detalle, motivo en historial, actualización al vencer solo en agenda/resumen; se detiene con formularios/borradores abiertos. El cambio de estado exige selección explícita y la confirmación sin pago previo se muestra deshabilitada cuando la política exige pagar en tienda.
- Migración `20261118_070000_reservations_payment_holds`: solo base temporal; gracia de 15 min para pendientes sin pago ya existentes. Operación y despliegue documentados en `OPERACION-AGENDAMIENTO.md`.
- Pruebas: 73 frontend + 83 backend, TypeScript frontend/backend y Astro build pasan. PostgreSQL verifica ocho solicitudes por último cupo tras vencer, evento único, cuota liberada, no extensión, reintentos cancelados, dos barridos simultáneos y protección de pagadas. Navegador verifica campo de configuración, plazo, estados, actualización automática, motivo e integridad de un borrador de Configuración, móvil/light/dark sin overflow ni excepciones.
- Evidencia `VALIDACION-PLAZOS-AGENDAMIENTO.json`, capturas `impeccable-plazo-pago-light` y `impeccable-plazo-pago-mobile-dark`; scripts temporales `preview-holds-browser-test.mjs` y `preview-seed-holds.mjs` no se entregan.
- Matriz conserva 103: 4 implementados, 41 parciales, 58 pendientes. DIS09 parcial; PAG12, checkouts/pago canónico, ledger y consumo de paquetes siguen pendientes. No se cobró, marcó pagado ni concedió saldo manualmente.

## Próxima acción al retomar

Los cambios de este bloque se aplican al original y la vista local actual queda disponible en 4394. Continuar con intención comercial vinculada a la tienda activa y su checkout; leer los adaptadores existentes y verificar sus contratos antes de implementar la confirmación canónica. Añadir pruebas de pago duplicado/fuera de orden/tardío y tienda/importe/moneda incorrectos. Reutilizar el bloqueo y vencimiento existentes; después acreditar y consumir paquetes de forma idempotente. No considerar implementados los pagos por existir la retención.
