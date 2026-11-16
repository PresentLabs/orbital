# Orbital

SaaS con Astro, Payload CMS, PostgreSQL y un servicio WebSocket para colaboración.

## Publicar el código en GitHub

1. En GitHub crea un repositorio **privado** y vacío llamado `orbital`.
2. Abre una terminal **dentro de esta carpeta**. Ejecuta lo siguiente y cambia `TU-USUARIO` por tu cuenta de GitHub.

   ```sh
   git init -b main
   git add .
   git status --short
   git commit -m "Publicar Orbital"
   git remote add origin git@github.com:TU-USUARIO/orbital.git
   git push -u origin main
   ```

   El repositorio incluye los archivos de bloqueo, Docker y la migración inicial. Configura tus contraseñas en Coolify. Los archivos `.env` reales, las cargas y los respaldos quedan fuera de Git.

## Instalar en Hostinger KVM 1 con Ubuntu 24.04 y Coolify

1. En hPanel, abre tu VPS KVM 1. En un servidor nuevo puedes elegir la plantilla de Coolify. Si ya tienes Ubuntu 24.04 instalado, conserva el sistema e instala Coolify siguiendo su guía oficial. Abre el panel y crea tu cuenta de administración. [Plantilla Hostinger](https://www.hostinger.com/support/9615197-how-to-use-the-coolify-vps-template-at-hostinger/) · [Instalación en Ubuntu](https://coolify.io/docs/start-with-self-hosted)
2. Crea registros DNS **A** para `app.tudominio.cl` y `realtime.tudominio.cl` apuntando a la IP del VPS. Crea `payload.tudominio.cl` solo si necesitas el panel web de Payload. Asegura que el proxy de Coolify pueda recibir tráfico en los puertos 80 y 443.
3. En Coolify abre tu proyecto y añade una **Application** desde el repositorio de GitHub. Para un repositorio privado puedes usar una GitHub App o una clave de despliegue. Elige la rama `main`, la estrategia **Docker Compose**, directorio base `/` y archivo `/compose.yaml`. [Configuración de Docker Compose en Coolify](https://coolify.io/docs/applications/builds/docker-compose)
4. En **Environment Variables**, configura lo siguiente.

   | Variable | Valor |
   | --- | --- |
   | `APP_URL` | `https://app.tudominio.cl` |
   | `PUBLIC_REALTIME_URL` | `wss://realtime.tudominio.cl` |
   | `POSTGRES_PASSWORD` | Valor hexadecimal generado con `openssl rand -hex 32` |
   | `PAYLOAD_SECRET` | Otro valor generado con el mismo comando |
   | `REALTIME_SECRET` | Otro valor generado con el mismo comando |
   | `INTEGRATIONS_SECRET` | Otro valor generado con el mismo comando |
   | `REGISTRATION_CODE` | Código privado independiente para registrar la cuenta |
   | `PAYLOAD_PUBLIC_URL` | `https://payload.tudominio.cl` si publicas el panel |

5. En **Domains**, asigna `https://app.tudominio.cl:4345` a **astro** y `https://realtime.tudominio.cl:3002` a **realtime**. Para publicar el panel, asigna `https://payload.tudominio.cl:3001` a **payload**. Los puertos son internos y se omiten al abrir las URL públicas. PostgreSQL queda en la red interna del proyecto. [Dominios por servicio en Coolify](https://coolify.io/docs/core/networking/domains)
6. Pulsa **Deploy**. Para una base nueva, Payload aplica la migración incluida antes de arrancar. Si KVM 1 se queda sin memoria al compilar Next.js, construye la imagen de Payload en un runner de CI y configura Coolify para descargarla desde un registro. Revisa **Deployment Logs** para distinguir un fallo de compilación de un fallo al arrancar.
7. Abre el dominio de la app. Comprueba `/app/?demo=1` y `/api/saas/version`, registra tu cuenta en `/acceso/registro`, sube un archivo y prueba colaboración desde dos sesiones. Si habilitaste el panel de Payload, ábrelo en `/admin` de su dominio.

## Datos y actualizaciones

Coolify mantiene la base en `postgres_data` y los archivos en `uploads` y `workspace_uploads`. Respalda los tres fuera del VPS. Si migras una base existente, restaura primero una copia en staging y verifica su esquema y el historial de Payload antes de aplicar la migración inicial. Conserva `PAYLOAD_SECRET`, `INTEGRATIONS_SECRET` y `PRIVATE_CANVAS_SECRET` de origen cuando corresponda.

Activa el despliegue automático de la rama `main` en Coolify cuando termines las pruebas. Cada push a esa rama podrá desplegar una nueva versión manteniendo los volúmenes. Si necesitas correo para invitaciones, agrega `RESEND_API_KEY` e `INVITATION_FROM`. [Accesos y notificaciones](docs/ACCESOS-Y-NOTIFICACIONES.md)

Para trabajar solo con Astro en local, ejecuta `npm ci` y `npm run dev` con Node.js 24.22.1 o superior. Abre `http://127.0.0.1:4345/app/?demo=1`. Para el sistema completo usa el Compose con tus variables de entorno y los dominios configurados en Coolify.
