# Orbital

<!-- impeccable:product-schema 1 -->

## Platform

Web SaaS para varios negocios. Cada negocio tiene propietarios, administradores, miembros y usuarios de lectura. La administración del SaaS es un ámbito independiente de los roles de cada negocio.

## Trabajo del usuario

Operar el negocio desde Vista general, Tienda, Agendamiento, Gestión y Empresa. Gestionar servicios, clientes, sucursales, profesionales, proyectos y tareas sin perder el contexto del módulo. La terminología solicitada es español de Chile.

## Restricciones confirmadas por el usuario

- Los módulos se activan en /administracion; no ofrecer un catálogo de módulos dentro de Orbital.
- Conservar las funcionalidades existentes salvo necesidad estricta.
- No modificar el interior de un Espacio abierto: su experiencia actual funciona bien.
- Logo y colores pertenecen al negocio; propietario y administrador pueden configurarlos. Los roles inferiores heredan los colores.
- El acceso a Administración SaaS corresponde a los operadores autorizados, no a todos los propietarios.
- Agendamiento debe alcanzar todas las capacidades de Archivo.zip. La matriz de 103 bloques es el registro del alcance; todavía hay trabajo pendiente.
- Los pagos de Agendamiento deben usar el medio de la tienda: Shopify, WooCommerce o Payload.
- Avisos breves con icono, título y cierre como la primera referencia; detalles en panel derecho como la segunda. Confirmado explícitamente por el usuario.

## Stack existente

Astro, TypeScript, Payload y PostgreSQL. Es una implementación existente; no cambiar de framework como efecto del rediseño.

## Evidencia y decisiones abiertas

docs/CONTINUIDAD-UX-SISTEMA.md registra la entrega visual. docs/PARIDAD-AGENDAMIENTO.json conserva lo implementado, parcial y pendiente del ZIP. No se afirma paridad completa ni validación de cobros reales. Posicionamiento comercial y promesas de rendimiento no definidos por esta solicitud.
