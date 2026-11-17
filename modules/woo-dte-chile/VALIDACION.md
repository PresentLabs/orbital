# Verificación local — 16 de noviembre de 2026

## Resultado

- Astro: build correcto; `astro check` sin errores (3 avisos de APIs obsoletas existentes).
- Payload: tipos generados, TypeScript sin errores y build de Next correcto.
- Orbital: 71 pruebas existentes aprobadas.
- Payload: 56 pruebas aprobadas (44 existentes + 12 del módulo).
- Woo DTE Chile: lint de los 118 archivos PHP de fuente y 33 pruebas aprobadas (reglas, XSD oficiales, firmas XML/TED, estados y protección de producción).
- Metadatos WordPress: 9 aserciones de permisos, versión, ausencia de secretos, no-cache y producción bloqueada.
- Migración inicial + migración del módulo ejecutadas en PostgreSQL embebido PGlite. Comprobadas unicidad por negocio/módulo, valor inicial desactivado y protección referencial contra borrar la cuenta con conexión. No se migró ninguna base del usuario. No sustituye un ensayo de migración con respaldo del PostgreSQL de despliegue.
- Navegador Chrome: Astro compilado → endpoint Payload real del módulo con persistencia y Woo simulados. Instalación, consulta de ambiente/documentos, NC, reintento con la misma clave sin duplicado y rechazo de origen externo. Sin errores JavaScript; revisión de pantalla escritorio/móvil.
- ZIP: CRC íntegro, directorio raíz correcto y SHA256 en `SHA256SUMS`; excluye pruebas y fixtures del instalador. No incluye certificados/CAF/contraseñas del usuario.

El núcleo tributario de 0.2.0 no se alteró; 0.2.1 agrega el endpoint de metadatos. No se repitió en esta integración la batería completa previa sobre WordPress/MariaDB/HPOS, ni se enviaron documentos o correos reales. Las comprobaciones de conexión no acreditan aceptación del SII.

## Seguridad del módulo

Solo propietario/administrador habilitado; ámbito derivado de la sesión; colección sin CRUD público; no se devuelven credenciales; AES-GCM compatible con las conexiones existentes; autenticación JWT explícita en Payload y mismo origen para escrituras Astro; destino HTTPS en lista de hosts y redirecciones bloqueadas; comandos/IDs/tipos/montos validados; clave de ajuste estable; errores sin stacks o secretos. Ningún endpoint cambia producción ni borra DTE. Los ajustes, folios y reembolsos siguen usando locks e idempotencia del motor Woo.

## Dependencias existentes

Se fijó DOMPurify 3.4.18 mediante override en Payload porque Monaco fijaba 3.4.15. El nuevo audit ya no reporta vulnerabilidades críticas. No se aplicaron actualizaciones mayores automáticas a Orbital.

- Payload, `npm audit --omit=dev`: info: 0, low: 6, moderate: 5, high: 1, critical: 0.
  Dependencias con alertas altas/críticas pendientes: sharp.
- Astro, `npm audit --omit=dev`: info: 0, low: 0, moderate: 10, high: 5, critical: 0.
  Dependencias con alertas altas/críticas pendientes: @huggingface/transformers, astro, sharp, undici, zod.

Estas alertas pertenecen al árbol de dependencias existente; deben evaluarse antes de desplegar en producción. No se presenta este resultado como una auditoría de seguridad independiente ni como autorización para producción tributaria.
