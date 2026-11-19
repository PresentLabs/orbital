# Operación de Agendamiento

## Migraciones

Ejecutar las migraciones de Payload con el procedimiento habitual del despliegue y su entorno antes de usar el catálogo ampliado o los plazos de pago. Este trabajo solo ejecutó migraciones sobre PostgreSQL temporal; no sobre producción.

La migración `20261118_070000_reservations_payment_holds` añade el vencimiento de pago. Las reservas existentes pendientes y sin pago reciben 15 minutos de gracia desde la migración. Las confirmadas, gratuitas o pagadas no se modifican.

## Vencimientos

Desde `services/payload`, con `DATABASE_URL` del mismo backend cargada en el entorno:

```sh
npm run reservations:worker
```

El proceso revisa cada 30 segundos las reservas de negocios con Agendamiento activo. Para una sola ejecución:

```sh
npm run reservations:worker -- --once
```

Configurar el proceso con el gestor de servicios utilizado por el despliegue. No necesita credenciales de tienda ni marca pagos. Finaliza limpiamente con SIGTERM/SIGINT; la ejecución `--once` devuelve error si falla la base. El proceso y las peticiones usan el mismo bloqueo por negocio, por lo que dos ejecuciones no duplican la cancelación ni el historial.

Las consultas y operaciones de Agendamiento también aplican los vencimientos antes de resolver agenda, disponibilidad o cupos. La disponibilidad descarta las retenciones vencidas sin pago. No se requiere tener abierto un navegador para ejecutar el proceso periódico.

El plazo configurado (5–120 minutos, 15 por defecto) se fija al crear una reserva que necesita pago previo. Reagendar o editar extras no lo extiende. Permitir saldo pendiente conserva la lógica de confirmación del negocio. Confirmar una reserva quita la retención; cancelar o vencer conserva el registro histórico.

Las reservas pagadas, parcialmente pagadas o gratuitas no se liberan por esta regla. El evento automático se registra como `payment-hold-expired`, actor de sistema `0`, con motivo y fecha. La interfaz muestra el vencimiento de las pendientes sin pago y exige elegir explícitamente el nuevo estado.

## Dependencia del checkout

Este bloque implementa retenciones y vencimiento, no la intención de checkout ni el cobro. Quedan pendientes la creación de carrito/pedido de la tienda activa, la verificación canónica del pago, notificaciones duplicadas/fuera de orden, pagos tardíos, conciliación, devoluciones y saldo de paquetes. Un retorno del navegador o una acción administrativa nunca debe sustituir esa verificación.

La futura confirmación debe adquirir el mismo bloqueo de negocio, comprobar intención/tienda/importe/moneda/cupo/vencimiento y procesar de forma idempotente los pagos tardíos sin ocupar un horario vendido a otra persona.
