# Extensión Chile para el ecommerce oficial de Payload

Esta extensión acompaña **Facturación propia de Orbital**. No reemplaza el plugin oficial, no cobra, no devuelve dinero y no emite DTE por su cuenta. Mantiene el desglose histórico necesario para que Orbital facture pedidos del plugin `@payloadcms/plugin-ecommerce`.

## Instalación en la tienda Payload

```sh
npm install ./orbital-payload-billing-cl-0.3.0.tgz
```

En `payload.config.ts`, agrega la extensión después del plugin oficial usando la misma política de administrador de tu tienda:

```ts
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { chileBillingEvents } from '@orbital/payload-billing-cl'

plugins: [
  ecommercePlugin({
    // Conserva la configuración actual de tu tienda.
    currencies: {
      defaultCurrency: 'CLP',
      supportedCurrencies: [
        { code: 'CLP', decimals: 0, label: 'Peso chileno', symbol: '$' },
      ],
    },
  }),
  chileBillingEvents(access.isAdmin), // Tu función real de autorización.
]
```

Genera/revisa/aplica la migración de la tienda para la nueva colección `orbital-fiscal-events`. Da a la API key que ya usa Orbital acceso de lectura a `orders`, a sus `transactions` y a esta colección. La extensión rechaza escrituras REST, actualizaciones y borrados; los registros se escriben desde el servidor de pagos.

## Pago confirmado

Después de que `finalizeOrder` del adaptador oficial haya confirmado el pago, llama desde el servidor:

```ts
import { captureChileSettlement } from '@orbital/payload-billing-cl'

await captureChileSettlement(req, order.id, {
  total: 11900,
  paidAt: gatewayConfirmedAt,
  receiver: { rut: '66666666-6', name: 'Consumidor final' },
  lines: [{ name: 'Producto', quantity: 1, net: 10000, tax: 1900 }],
})
```

Los valores deben provenir del cálculo autoritativo del checkout/confirmación de la pasarela. **Nunca uses montos o estado de pago enviados directamente por el navegador.** Guarda cantidades, descuentos, despacho e IVA/exención del momento de la venta. No reconstruyas ese detalle desde los precios actuales del catálogo. Usa la fecha original confirmada por la pasarela al reintentar; `testPayment: true` marca pagos de prueba e impide emitirlos en producción.

El helper comprueba el importe CLP y las transacciones oficiales vinculadas al pedido. El evento es único por pedido; reutilizarlo con otros datos falla. Ejecuta el helper dentro de la transacción existente del adaptador, o reintenta su misma operación de forma durable tras confirmar el pago. Si falta este evento, Orbital deja el pedido para revisión y no inventa impuestos.

## Reembolso confirmado

Después de verificar el reembolso exitoso con la pasarela:

```ts
import { captureChileRefund } from '@orbital/payload-billing-cl'

await captureChileRefund(req, order.id, {
  id: gatewayRefundId,
  amount: 1190,
  lines: [{ name: 'Producto', quantity: 1, net: 1000, tax: 190 }],
})
```

Usa el ID inmutable de la pasarela. Los eventos separados evitan perder un reembolso por escrituras concurrentes. Una carrera con el mismo ID puede devolver una violación de unicidad: reintenta **el mismo ID** en una transacción nueva. Orbital controla además la idempotencia fiscal y el saldo máximo acreditable bajo bloqueo de base de datos.

La instalación del paquete y sus dos llamadas deben integrarse en el servidor de **la tienda Payload conectada**. No se modificó una tienda remota ni su pasarela durante el desarrollo.

Verificado contra la estructura del paquete oficial 3.92.1. La aceptación tributaria requiere pruebas oficiales SII.
