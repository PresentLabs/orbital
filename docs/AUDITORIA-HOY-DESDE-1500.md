# Auditoría de solicitudes de hoy

18 de noviembre de 2026, America/Santiago. A petición del usuario, se revisaron las anotaciones de interfaz para cubrir lo pedido desde las 15:00. Se incluyeron las tandas anteriores registradas en este chat, sin limitar la revisión a las cinco últimas capturas.

## Diferencias encontradas y corregidas

| Solicitud | Resultado comprobado |
|---|---|
| Eliminar el grupo intermedio Equipo; Personas pasa a Equipo y Votaciones queda al mismo nivel | Empresa muestra Documentos, Accesos, Equipo y Votaciones, sin acordeón intermedio. |
| Recuperar Agendamiento | Aparece también en demo, con datos ficticios de lectura. La demo no llama a la API de reservas. Los negocios reales conservan permisos y activación por Administración. |
| Transiciones perceptibles | Entrada suave de 260ms con desplazamiento corto y opacidad. Respeta movimiento reducido. El interior de Espacios conserva la transición y geometría anteriores. |
| Diseño coherente de Contabilidad | Panel de facturación, icono, aviso contextual y pasos de preparación en demo. Conserva formularios, estados, permisos y acciones del negocio conectado. |
| Sin separador superior cuando solo hay área privada | Se detecta si la navegación tiene enlaces visibles y se oculta el separador cuando no hay ninguno. |

## Recorrido acumulado

Se repitieron en la compilación final las comprobaciones de dashboard 50/50 y gráfico completo; rankings; detalle de hora; tabla de clientes; categorías; jerarquías y primera página de los módulos; rutas antiguas/nuevas; aviso pastel; colores y botones; búsqueda in situ; modales; perfil con elipsis; foco sin outline; bordes; alineaciones; temas claro/oscuro; móvil y protección de Espacios. Todas pasan. La eliminación del grupo intermedio Equipo sustituye el pedido previo de conservarlo sin negrita. Las rutas canónicas son /app/empresa/equipo y /app/empresa/votaciones; las antiguas /empresa/equipo/personas y /empresa/equipo/votaciones siguen abriendo la página correcta.

78 pruebas frontend pasan, TypeScript y build pasan. Backend conserva las 86 pruebas verificadas (sin cambios backend en este bloque). Navegador aislado a 1159px y 390px: sin overflow ni excepciones JavaScript; demo sin solicitudes a reservas y API real sigue respondiendo 401 sin sesión. Evidencia: VALIDACION-AUDITORIA-HOY.json, CIERRE-ANOTACIONES-UI.md y capturas orbita-today-*.

## Alcance funcional

Las conexiones y cobros reales fueron aplazados expresamente por el usuario. La matriz histórica de paridad con Archivo.zip sigue incompleta: este cierre verifica las anotaciones de interfaz, no convierte las 103 capacidades en implementadas. Importación/exportación CSV, acciones masivas, paquetes/saldos, portal, recurrencia y demás pendientes conservan su registro en PARIDAD-AGENDAMIENTO.json. No se modificaron datos ni despliegues de producción.
