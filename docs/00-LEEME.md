# Orbital · Contexto para ChatGPT Work

Este paquete reúne la situación actual de Orbital y la nueva dirección de producto. Adjunta los cuatro archivos a una misma conversación o proyecto para que Work pueda relacionarlos.

| Archivo | Contenido |
| --- | --- |
| [01-vision-y-aplicaciones.md](01-vision-y-aplicaciones.md) | Decisión de producto, alcance de las aplicaciones y flujos entre ellas. |
| [02-estado-actual.md](02-estado-actual.md) | Funciones existentes, arquitectura, permisos y decisiones de UX que conviene preservar. |
| [03-evolucion-y-decisiones.md](03-evolucion-y-decisiones.md) | Propuesta de evolución, criterios de aceptación y preguntas que el negocio debe resolver. |

## Mensaje para pegar en Work

> Estoy evolucionando Orbital, un SaaS que ya existe, hacia una plataforma con aplicaciones diferenciadas dentro de la misma cuenta de negocio. Lee los cuatro Markdown adjuntos y úsalos como contexto de este proyecto. La decisión de producto es que ERP, CRM, Gestión creativa, Agendamiento de horas y Facturación propia sean aplicaciones diferenciadas. Distingue las funciones existentes de las propuestas pendientes. Cuando te pida avanzar, aterriza el trabajo a la aplicación y al flujo correspondiente. Usa los puntos abiertos para hacer preguntas concretas solo cuando la respuesta cambie una decisión. Si necesitas evaluar código, pídeme el repositorio o los archivos relevantes, porque estos Markdown describen el sistema pero no contienen su código.

## Cómo leer el estado

**Definido** indica una instrucción de producto del propietario. **Actual** describe lo observado en el repositorio revisado. **Propuesta** indica una opción de diseño que se puede ajustar. **Pendiente** indica algo que todavía requiere decisión o comprobación. La referencia del código es el repositorio local de Orbital, revisado en la rama `main` con el commit `d562b9b`. El paquete no acredita qué versión está desplegada.
