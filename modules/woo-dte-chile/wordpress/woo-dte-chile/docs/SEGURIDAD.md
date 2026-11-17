# Revisión de seguridad — 0.2.0

## Controles implementados y revisados

- Administración y acciones tributarias: `manage_woocommerce`. Configurar emisor, certificado y CAF exige además `manage_options`.
- Formularios administrativos protegidos por nonce y POST, salvo descarga de solo lectura, que también exige nonce y permiso. Las acciones nativas del pedido usan el flujo de administración WooCommerce y vuelven a comprobar permisos.
- REST: comprobación de permiso por ruta; lectura de pedidos limitada al propietario autenticado o gestor. Un invitado no puede descubrir documentos por ID. El acceso a archivos por clientes exige Producción y aceptación.
- Descargas autenticadas, sin archivos permanentes en uploads, sin rutas suministradas por el cliente y con `nosniff` y cache privado. Los adjuntos de correo se crean con permisos 0600 en una carpeta temporal aleatoria 0700 y se eliminan al finalizar.
- Secretos, XML, TED, datos fiscales y detalle de auditoría cifrados con sodium secretbox. Clave externa a la base de datos. Password del P12 no persistido. Tokens solo en memoria; no se registran cabeceras de autenticación ni claves privadas.
- Entrada XML con límite de tamaño, rechazo de DOCTYPE/ENTITY y carga sin red. CAF importado con comprobación criptográfica usando llave SII confiable, no una llave aportada como parte del propio CAF.
- Carga de archivos limitada a uploads PHP genuinos de hasta 2 MB. No pasan a la biblioteca multimedia ni se usan nombres/rutas originales para guardarlos.
- Consultas preparadas; tablas derivadas del prefijo interno; escape HTML de respuestas, datos y errores en el administrador. Los textos del PDF se imprimen como texto, no como HTML.
- Endpoints SII cerrados a URLs oficiales conocidas, TLS verificado, sin redirecciones, tiempos de espera y tamaño de respuesta acotados. No existe endpoint público de emisión ni proxy HTTP arbitrario.
- Exclusión por pedido y por documento, restricciones únicas y transacciones InnoDB para folios/NC. Ningún reintento automático asigna otro folio después de una transmisión incierta.
- Producción requiere RUT habilitado en servidor, origen HTTPS exacto, frase de confirmación y evidencia declarada. El cambio de ambiente no transforma documentos de la cola.
- Los originales y reservas no tienen operaciones de borrado en el plugin. La desinstalación retiene datos fiscales.

## Límites del análisis

Esto es revisión de código y pruebas locales, no auditoría independiente ni prueba de penetración. Un administrador del servidor con acceso al código y a la clave puede descifrar la información. La protección no abarca backups mal gestionados, plugins ajenos, malware del servidor, un alojamiento que publique su directorio temporal ni una segunda instalación que use los mismos CAF.

Los registros cifrados conservan respuestas SII, que pueden contener datos tributarios. Debe limitarse su acceso y aplicarse la política de conservación que corresponda. No se afirma que el registro sea inalterable frente al administrador de base de datos.

La cadena de confianza/revocación del certificado, la autoridad del firmante y el derecho tributario de una devolución requieren verificación adicional. La verificación criptográfica local y un HTTP 200 no sustituyen la aceptación oficial.

La revisión de Composer al preparar la entrega no encontró avisos de seguridad ni paquetes abandonados para la dependencia instalada. Ese resultado corresponde a la fecha de revisión y no garantiza ausencia de vulnerabilidades futuras.
