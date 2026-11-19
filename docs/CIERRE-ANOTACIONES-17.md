# Cierre de 17 anotaciones · 18 de noviembre de 2026

1. Eliminada la tarjeta repetida de Facturación propia; la acción de configuración autorizada se conserva sin ese bloque descriptivo.
2. Subtítulo corregido a documentos tributarios.
3. Restituido margen superior de Mi área privada; su separador sigue oculto cuando es la única navegación.
4. Las tres etiquetas del perfil comparten columna e inicio horizontal, con iconos de ancho uniforme.
5. Entrada de vistas de 480ms y retrasos progresivos de 45ms, con movimiento reducido respetado.
6. Acceso SaaS fuera del lateral: icono a la izquierda de Notificaciones, condicionado a SAAS_ADMIN_USER_IDS en servidor.
7. Fondo pastel lavanda en la zona inferior del lateral, con variante oscura.
8. Agenda de hoy con fondo verde oscuro y texto blanco, incluidos título, subtítulo y acciones.
9. Zona horaria retirada del subtítulo de Agenda de hoy; cálculos y conversión mantienen su zona configurada.
10. Botón de agenda en la columna derecha de su cabecera, alineado arriba con el título.
11. Misma estructura de hora/fecha, cliente/servicio/profesional y estado/acción en hoy y próximas citas, sin recortar la segunda fila.
12. Barras de ranking con gradiente basado en el principal del negocio.
13. Prioridades utiliza el mismo ancho de 30rem que Crear nuevo.
14. Contador de selección sin borde; avisos section-note sin borde dentro de las vistas y paneles.
15. Guardar mi selección ocupa el ancho del contenido, al pie con márgenes laterales e inferior. Listado independiente desplazable.
16. Zona horaria retirada del resumen de la agenda; permanece donde es necesaria para configurar o crear horas.
17. Paneles abren en 460ms y cierran en 360ms, sincronizados con el fondo y respetando movimiento reducido.

Validación: 78 pruebas frontend, TypeScript y build pasan. Chrome aislado: comprobaciones de los 17 puntos, escritorio 1159px y móvil 390px, contraste oscuro, ausencia de errores JavaScript y overflow. Prueba de geometría, colores y controles del interior de Espacios pasa. Sin cambios de permisos de API, datos de producción ni integración de tiendas reales.

Evidencia: VALIDACION-ANOTACIONES-17.json y capturas orbita-notes17-* en la carpeta de artefactos de esta sesión. Versión local: /private/tmp/orbita-preview-notes17c, puerto 4394.
