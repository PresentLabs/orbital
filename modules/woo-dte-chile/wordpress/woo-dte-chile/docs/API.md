# API para Astro / headless

Base: `/wp-json/woo-dte-chile/v1`. Usar HTTPS.

Las operaciones que modifican documentos requieren un usuario con `manage_woocommerce`. Para Astro, use una contraseña de aplicación de WordPress exclusivamente en el servidor. No envíe credenciales administrativas al navegador. Cookies de WordPress usan la autenticación REST estándar y `X-WP-Nonce`; las contraseñas de aplicación usan HTTP Basic sobre HTTPS.

La consulta de estado permite al administrador o al cliente autenticado dueño del pedido. Los invitados no reciben acceso mediante número de pedido o email: el servidor Astro debe autorizar su sesión de compra antes de actuar como intermediario. No se proporciona CORS abierto ni autenticación JWT propia.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/orders/{id}/documents` | Cadena documental y estados sin secretos ni XML |
| PUT | `/orders/{id}/fiscal` | Tipo y receptor, antes del primer documento |
| POST | `/orders/{id}/issue` | Emisión manual; exige pago confirmado |
| POST | `/documents/{id}/adjust` | NC/ND relacionada |
| POST | `/documents/{id}/retry` | Reintento previo al envío o consulta de un envío incierto |
| POST | `/documents/{id}/email` | Reenvío explícito del correo de un documento aceptado |
| GET | `/documents/{id}/file?format=pdf` | PDF autenticado, en base64 |
| GET | `/documents/{id}/file?format=xml` | Sobre XML firmado exacto, en base64 |

Los archivos se devuelven como `{filename, mime, base64}` para evitar que la serialización REST altere el XML o el binario PDF. La respuesta lleva `Cache-Control: private, no-store`. No hay URLs públicas de certificados, CAF o documentos.

## Datos fiscales y emisión

Guardar antes de confirmar el pago si la emisión automática está activa:

```json
{
  "type": 33,
  "receiver": {
    "rut": "76123456-0",
    "name": "Empresa de ejemplo",
    "giro": "Comercio",
    "address": "Dirección del receptor",
    "commune": "Santiago"
  }
}
```

POST emisión: `{"type":33}` o `{"type":39}`. La idempotencia se deriva del emisor, ambiente y pedido, independientemente del tipo: solicitar un segundo tipo para el mismo pedido produce conflicto. No debe emitirse desde la redirección de éxito del navegador. El backend de pagos confirma el pago en WooCommerce; el plugin recibe su evento.

El frontend clásico incluye tipo, RUT y giro. Checkout Blocks registra campos adicionales y valida los datos antes del procesamiento del pago. La razón social usa la empresa de facturación y la comuna usa la ciudad de facturación; la tienda debe etiquetar/usar correctamente esos campos. La interacción visual completa de Blocks y sus combinaciones con terceros queda pendiente de prueba en la tienda destino.

## Ajuste

Incluya `Idempotency-Key: operacion-unica-12345`, entre 8 y 100 caracteres alfanuméricos, `:`, `_` o `-`.

```json
{
  "type": 61,
  "amount": 1190,
  "reason": "Devolución de un producto",
  "kind": "return",
  "cancel": false,
  "no_vat_reduction": false,
  "refund_id": 0,
  "lines": [
    {"name":"Producto devuelto", "quantity":1, "amount":1190, "exempt":false}
  ]
}
```

Montos brutos en CLP enteros; `exempt` y las opciones deben ser booleanos JSON. Tipo 61 o 56. Para documentos mixtos se necesitan líneas; en los homogéneos se puede omitir `lines`. `kind` es `return` o `amount_correction`; una corrección parcial de precio de boleta se bloquea. `no_vat_reduction` controla `IndNoRebaja` únicamente para NC y debe determinarlo el responsable tributario.

Para anular: tipo 61, `cancel:true` y monto original completo. El servicio usa las líneas originales. Para una ND que anula una NC: tipo 56, `cancel:true` y monto completo de la NC. Con `refund_id`, se valida pedido y monto y se utiliza la identidad del refund, compartida con la cola automática. Repetir una clave con otros datos se rechaza.

`retry` no permite cambiar o agregar un Track ID que no esté vinculado al envío persistido. No use una nueva clave como mecanismo de reintento: reutilice la misma operación y consulte su estado.

Errores controlados devuelven `wdt_error` con HTTP 422 o 409. Los errores internos devuelven 500 sin traza. El panel administrativo contiene el registro cifrado y respuestas SII escapadas.
