# Sistema visual de Orbital

## Autoridad y ámbito

Rediseño solicitado con las referencias Monetra para encabezado/navegación, tarjetas y tareas, y las referencias confirmadas de toast y panel lateral. Modo Operate: priorizar lectura, acciones y contexto. El interior de Espacios queda expresamente excluido; todos los estilos nuevos del panel se acotan con :not(.canvas-fullscreen).

## Composición

Encabezado horizontal con logo del negocio, módulos globales (Inicio, Tienda, Agendamiento cuando está habilitado, Gestión y Empresa) y controles globales. Barra izquierda con buscador de icono fuera del grupo gris, navegación contextual y configuración/cuenta alineadas debajo. Mantener rutas y permisos existentes. Encabezado sin borde ni sombra en reposo; sombra suave solo tras desplazar la página. Contenido con separación generosa entre secciones, agrupaciones compactas y tarjetas sin contornos ornamentales. Submenús sin iconos. En móvil, navegación cerrada realmente oculta y accesible mediante el control existente.

## Tokens

Siete colores por tema: principal (CTA), secundario, contorno, fondo de página, tarjetas/paneles, texto principal y navegación. Paletas anteriores de cinco colores siguen siendo válidas y se completan con valores predeterminados. Variables --ui-light-* / --ui-dark-* aplicadas por negocio. Derivar colores de lectura y gráficos con contraste suficiente. No reemplazar los colores semánticos de estados por el color comercial. Fuente existente; tamaños en rem. Estado Guardado en tu negocio: .85rem. Radios coherentes: tarjetas 1.25rem, acciones tipo cápsula, campos redondeados; paneles laterales sin esquinas redondeadas y selectores de creación con ancho máximo 30rem.

## Componentes

- Toast con icono semántico, título, descripción y cierre. Tonos suaves por estado; adaptable a claro/oscuro, pausa al enfocar/pasar el cursor.
- Paneles de edición a la derecha, velo negro transparente, entrada .28s ease y salida .22s ease. Excepción solicitada: buscador global en su posición lateral original, con velo y resultados a la derecha; en móvil, resultados debajo. Mantener diálogo nativo, Escape y foco; respetar movimiento reducido.
- Directorios de Agendamiento: títulos visibles, hechos separados, precio destacado, estado y acciones alineadas. Sin grandes imágenes de relleno cuando no hay foto. Categorías en filas jerárquicas.
- Tareas: progreso calculado de checklist real, estado completado, avatar real o iniciales, comentarios y adjuntos existentes. No inventar progreso ni personas.
- Timeline: semana y rangos de fechas reales; tareas sin fechas en lista explícita. Agrupación por tareas/proyectos sin alterar estados internos.
- Administración SaaS: selector de negocios con búsqueda y paginación en popover; detalle ocupa el ancho disponible.

## Interacción y protección

Propietario/administrador editan la paleta; servidor rechaza escritura de roles inferiores. Los títulos de columnas se cambian con doble clic, Enter o F2, conservando las claves de estado. Todas las nuevas interacciones reutilizan persistencia y permisos existentes. Evitar excepciones globales que entren al lienzo de Espacios.

## Verificación

Compilación, TypeScript, pruebas de unidad e integración PostgreSQL, navegador aislado a 1440px/390px, claro/oscuro, permisos por rol y comparación geométrica del Espacio protegido. Registro detallado en docs/CONTINUIDAD-UX-SISTEMA.md.

Orden global: Inicio, Tienda, Empresa, Proyecto, Agendamiento y Contabilidad. Los accesos globales abren la primera página autorizada, sin restaurar la última subpágina. Hijos de Empresa y Proyecto usan rutas jerárquicas; enlaces antiguos siguen funcionando. Agenda de hoy y próximas atenciones comparten la primera fila; movimiento de agenda ocupa el ancho completo. Clientes de Agendamiento se muestran en tabla.

Empresa presenta Documentos, Accesos, Equipo y Votaciones al mismo nivel. Se conserva compatibilidad con las rutas anidadas antiguas. Agendamiento tiene una demo de lectura aislada de las APIs reales; los módulos del negocio conectado conservan sus concesiones. Contabilidad usa el mismo sistema de paneles y una preparación guiada sin datos financieros inventados. Las vistas operativas entran con desplazamiento corto y opacidad durante 260ms, salvo movimiento reducido; Espacios mantiene su experiencia anterior.
