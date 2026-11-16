# Accesos y notificaciones de Órbita

## Entrar a la app

| Uso | Ruta local | Credencial |
| --- | --- | --- |
| Demo | [Abrir la demo](http://127.0.0.1:4345/app/?demo=1) | Sin cuenta. Datos de ese navegador. |
| Cuenta de negocio | [Iniciar sesión](http://127.0.0.1:4345/acceso) | Correo y contraseña del usuario. |
| Crear una organización | [Registro privado](http://127.0.0.1:4345/acceso/registro) | Correo, contraseña nueva y `REGISTRATION_CODE` de Payload. |
| Panel Payload | [Administración local](http://localhost:3001/admin) | Cuenta habilitada con permiso de administrador. |

En producción usa el dominio HTTPS de Órbita. Crea el primer propietario mediante el registro privado del SaaS. El administrador invita a otras personas desde **Equipo**. El enlace de invitación permite que el destinatario defina su propia contraseña. Evita usar el asistente de primer usuario de Payload para crear una organización.

## Acceso a Payload

- `services/payload/.env` contiene `DATABASE_URL`, `PAYLOAD_SECRET`, `REGISTRATION_CODE` y la configuración privada del backend. La raíz de Astro contiene `PAYLOAD_URL` y las variables que usa el frontend en el servidor. Los archivos `.env.example` muestran nombres y valores de ejemplo.
- Astro llama a la API de Payload a través de `PAYLOAD_URL`. La sesión de Órbita viaja en la cookie HttpOnly `orbita_session`. Payload evalúa permisos por rol y organización. Usa la interfaz del SaaS para gestionar miembros y espacios de trabajo.
- Si Payload vive en el VPS y escucha solo en loopback, abre un túnel con `ssh -N -L 3001:127.0.0.1:3001 usuario@vps` y entra al panel desde el enlace de administración local. Mantén `PAYLOAD_SECRET` y las claves de cifrado en un gestor de secretos. La guía no contiene credenciales operativas.

## Cómo se envía un aviso

1. En la campana, elige hasta 20 personas activas de tu organización y escribe un mensaje de hasta 280 caracteres.
2. El formulario envía `POST /api/saas/notifications` con `text`, `recipients` y un `requestId` para identificar el envío. Astro comprueba el origen y la sesión, y reenvía a `POST /api/send-notification` en Payload.
3. Payload verifica que los destinatarios pertenezcan a la organización y registra los avisos. La campana obtiene la bandeja con `GET /api/saas/notifications`. Para marcar un aviso como leído usa `PATCH` a la misma ruta con su `id`. Las menciones de tareas y las invitaciones a votar también pueden crear avisos internos.

## Invitaciones por correo y recordatorios externos

- **Invitaciones del equipo.** Payload puede enviarlas por Resend cuando tiene `RESEND_API_KEY` e `INVITATION_FROM` configurados. `SAAS_PUBLIC_URL` define el dominio del enlace. La invitación también puede compartirse mediante el enlace que muestra Equipo.
- **Recordatorios de tareas por correo.** Configura la integración de correo de la organización con una clave de Resend, un remitente verificado y el destinatario. Es un flujo separado de la campana.
- **Recordatorios por WhatsApp.** Configura la integración con el token de Meta, ID del número, destinatario autorizado y plantilla aprobada. Define `WHATSAPP_GRAPH_VERSION` en Payload. La plantilla utiliza una variable de texto para el título.
- **Programación.** Desde `services/payload`, ejecuta primero `node --env-file=.env --experimental-strip-types reminders.mjs` para revisar las entregas elegibles. Programa ese mismo comando con `--send` en cron o systemd para realizar los envíos reales. Revisa los estados de entrega antes de reintentar.

Para el despliegue y la recuperación de datos, consulta [Desplegar Orbital con Coolify](../README.md).
