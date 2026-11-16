# Orbital · Evolución propuesta y decisiones pendientes

El objetivo de esta propuesta es introducir aplicaciones dentro de Orbital sin interrumpir el uso del espacio de trabajo actual. El orden de desarrollo de las aplicaciones nuevas se decide según el primer problema de negocio que se quiera resolver.

## Secuencia propuesta

1. **Definir el marco de aplicaciones.** Prototipar un selector y la navegación por aplicación. Mantener una sesión de negocio y definir a qué aplicación llega cada rol. Identificar las rutas actuales que pasan a Gestión creativa y conservar el acceso mediante enlaces existentes.
2. **Acordar la propiedad de los datos compartidos.** Para cada entidad que aparezca en más de una aplicación, decidir dónde se crea, dónde se actualiza y cómo se consulta desde otras aplicaciones. Elegir cómo enlazar registros ya existentes de clientes, pedidos y documentos.
3. **Elegir un flujo nuevo de principio a fin.** Ejemplos de alcance inicial: crear un prospecto y seguir una oportunidad en CRM, publicar horarios y confirmar una reserva en Agendamiento, o registrar una compra y actualizar stock en ERP. Elegir uno según las necesidades del primer negocio.
4. **Definir Facturación propia antes de conectar la emisión.** Resolver jurisdicción, documentos, mecanismo de emisión y qué acción inicia el flujo. Diseñar cómo se muestran fallos, reintentos y estados antes de automatizarlo desde ERP, CRM o Agendamiento.

## Reglas propuestas para diseñar los cruces

| Tema | Pregunta que debe responder el diseño |
| --- | --- |
| Clientes | ¿CRM administra el contacto principal? ¿Cómo se deduplican clientes que llegan de tienda, reservas e importaciones? |
| Catálogo | ¿El catálogo del ERP abastece también a Agendamiento y Facturación? ¿Cómo se conserva el precio asociado a una transacción? |
| Horas | ¿Qué aplicación controla disponibilidad y reservas? ¿Cómo se previenen dos reservas para el mismo recurso y horario? |
| Documentos | ¿Qué aplicación es dueña del documento emitido y cuáles muestran una referencia a su estado? |
| Acceso | ¿Qué combina la disponibilidad de una aplicación para un negocio con el permiso de una persona para ver o modificar sus recursos? |
| Automatizaciones | ¿Qué paso confirma la persona y qué paso ejecuta el sistema? ¿Cómo se evita que un reintento cree una segunda reserva, orden o factura? |

## Criterios iniciales de aceptación

- Una persona ve solo las aplicaciones y acciones que puede usar. Abrir un enlace directo respeta los mismos permisos. Una referencia entre aplicaciones también verifica acceso al registro de destino.
- El negocio activo y la aplicación activa se identifican al navegar. Las rutas existentes de Gestión creativa siguen siendo útiles para el equipo y sus marcadores.
- La app diferencia los estados reales de una operación y muestra qué puede hacer el usuario cuando algo falla. Una desconexión temporal no debe presentar datos de demo dentro de la sesión del negocio.
- Cada flujo nuevo tiene una prueba de principio a fin con casos de permisos y datos de dos negocios separados. Si requiere una migración, se define cómo probarla en una copia de datos.

## Decisiones de producto pendientes

1. ¿Qué negocios serán los primeros usuarios y cuál es su flujo más urgente?
2. ¿Qué abarca el ERP inicial: compras, inventario, ventas, servicios u otra operación?
3. ¿Agendamiento será interno, público o ambos? ¿Qué se reserva: una persona, una sala, un equipo o varios recursos juntos? ¿Se necesita pago o solo confirmación?
4. ¿Facturación propia se orienta primero a Chile? ¿Qué documentos debe emitir y mediante qué proveedor o integración? Confirmar con fuentes oficiales y especialistas antes de diseñar la emisión tributaria.
5. ¿Quién activa aplicaciones por negocio? ¿Habrá planes por aplicación, permisos configurables y cuentas con acceso a varios negocios?
6. ¿Cómo se presentan las integraciones actuales de comercio y qué datos se conservan al importar o vincular clientes y pedidos?

Cuando se resuelva una pregunta, anotar aquí la decisión, su fecha y el motivo. Mantener el inventario de funciones existentes separado de las decisiones de producto para que Work pueda identificar el punto de partida de cada solicitud.
