# Orbital · Estado actual del producto y del código

Referencia revisada: repositorio local de Orbital, rama `main`, commit `d562b9b`. En el historial del proyecto se ha usado `ops.pixelografo.cl` para abrir la app. El estado del entorno desplegado requiere verificación aparte.

## Funciones existentes

| Área | Implementación observada |
| --- | --- |
| Cuenta y negocio | Inicio de sesión por correo, registro privado de una organización y equipo con invitaciones. Perfil, cambio de contraseña y marca con logo. El modelo actual asocia a cada usuario con un negocio. |
| Gestión del trabajo | Vista general, objetivos, Espacios con lienzos, Tareas con tableros Kanban y lista, tareas personales, Notas, Calendario, Archivos, Documentos, Votaciones y área privada. Hay papelera y recuperación según el tipo de elemento. |
| Comercio | Secciones para pedidos, clientes, métricas y comprobantes. Integraciones de tienda con WooCommerce, Shopify y Payload, con un proveedor de tienda por negocio. |
| Comprobantes | La vista actual de facturas y boletas permite subir y asociar comprobantes a pedidos. La emisión propia requiere su alcance y flujo específicos. |
| Calendario | Calendario interno e integración con Google Calendar y Meet. La disponibilidad, las reservas y la eventual página pública pertenecen al alcance nuevo de Agendamiento. |
| Colaboración y avisos | Servicio de tiempo real, comentarios, menciones, notificaciones y votaciones. El centro permite leer o eliminar avisos y reproducir un sonido una vez habilitado por la interacción del usuario. |

## Arquitectura

- **Frontend y API intermedia:** Astro en modo servidor, TypeScript y CSS. Rutas de interfaz en `src/pages/app`, layout compartido en `src/layouts/WorkspaceLayout.astro`, comportamiento de pantalla en `src/scripts/workspace*.ts` y endpoints en `src/pages/api/saas`.
- **Backend:** Payload CMS en `services/payload` con PostgreSQL. La configuración define colecciones y reglas de acceso. La app guarda entidades de trabajo, incluidas tareas y elementos de Espacios, en la colección `documents` con claves de tipo `tasks:<id>` o `nodes:<id>`. La vista comercial de Documentos usa sus propios flujos de archivos.
- **Sesión y acceso:** Astro comprueba la sesión antes de entregar rutas privadas. Usa una cookie HttpOnly y consulta Payload. `services/payload/src/permissions.ts` contiene las reglas compartidas de lectura y escritura. Los roles son propietario, administrador, editor, colaborador y lector. Los recursos de la organización están limitados por negocio. El área privada aplica restricciones de propietario sobre los elementos correspondientes.
- **Infraestructura y pruebas:** Docker Compose define Astro, Payload, PostgreSQL y el servicio WebSocket. El repositorio describe un despliegue mediante Coolify. `npm run build` compila Astro y `npm test` ejecuta la suite principal. Payload tiene sus propios comandos de pruebas y revisión de tipos. La demo local se abre en `/app/?demo=1`.

## Decisiones de UX de la implementación reciente

- Una sesión ausente lleva al acceso sin mostrar primero la app. Con sesión válida, el logo se incluye en la respuesta inicial y el menú autorizado aparece mientras cargan los datos. La demo es explícita y está separada de los datos del negocio.
- En **Equipo**, «Puede ver» marca todas las secciones del administrador. Cambiar de rol carga sus permisos predeterminados y deja desmarcadas y bloqueadas las secciones exclusivas de administración. Se quitaron el acordeón del listado y las leyendas por casilla.
- En **Espacios**, los pies de foto se pueden editar y quedan centrados. En **Tareas**, el nombre del tablero se edita con doble clic, los títulos de tarjetas usan peso 600 y el arrastre conserva la guía de inserción sin contorno en la columna. Las tarjetas de Avance tienen fondo blanco sin borde.
- La papelera ofrece **Vaciar papelera** con confirmación, además de la restauración de elementos. Los mensajes vacíos de Espacios, Tareas, Notas, Accesos y Documentos se centran en todo el ancho del listado.
