import type { Access, Config, PayloadRequest } from "payload";
/** Companion extension for @payloadcms/plugin-ecommerce. Reuse its admin read policy. */
export function chileBillingEvents(canRead: Access) {
  return (config: Config): Config => ({
    ...config,
    collections: [
      ...(config.collections || []),
      {
        slug: "orbital-fiscal-events",
        admin: { hidden: true },
        lockDocuments: false,
        access: {
          create: () => false,
          read: canRead,
          update: () => false,
          delete: () => false,
        },
        fields: [
          { name: "orderId", type: "text", required: true, index: true },
          { name: "eventKey", type: "text", required: true, unique: true },
          {
            name: "kind",
            type: "select",
            required: true,
            options: ["settlement", "refund"],
          },
          { name: "value", type: "json", required: true },
        ],
      },
    ],
  });
}
export type ChileSettlement = {
  testPayment?: boolean;
  total: number;
  paidAt: string;
  receiver: Record<string, string>;
  lines: { name: string; net: number; tax: number; quantity: number }[];
};
function validate(input: ChileSettlement) {
  if (
    !Number.isSafeInteger(input.total) ||
    input.total < 1 ||
    !Number.isFinite(Date.parse(input.paidAt)) ||
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    input.lines.length > 60
  )
    throw new Error("Detalle tributario inválido.");
  for (const l of input.lines)
    if (
      !l.name ||
      l.name.length > 80 ||
      !Number.isFinite(l.net) ||
      !Number.isFinite(l.tax) ||
      l.net < 0 ||
      l.tax < 0 ||
      !Number.isFinite(l.quantity) ||
      l.quantity <= 0 ||
      (l.tax > 0 && Math.abs(l.tax - l.net * 0.19) > 1.01)
    )
      throw new Error("Línea tributaria inválida.");
  if (
    Math.abs(input.lines.reduce((s, l) => s + l.net + l.tax, 0) - input.total) >
    1.01
  )
    throw new Error("El detalle no concilia con el total pagado.");
}
function canonical(v: any): string {
  return JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );
}
async function save(
  req: PayloadRequest,
  orderId: string | number,
  kind: "settlement" | "refund",
  key: string,
  value: any,
) {
  const collection = "orbital-fiscal-events" as any,
    eventKey = String(orderId) + ":" + kind + ":" + key;
  const find = async () =>
    (
      await req.payload.find({
        collection,
        where: { eventKey: { equals: eventKey } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
    ).docs[0] as any;
  const existing = await find();
  if (existing) {
    if (canonical(existing.value) !== canonical(value))
      throw new Error("La operación ya existe con otro contenido.");
    return existing;
  }
  // Unique eventKey handles racing webhooks without overwriting another refund.
  // A unique violation aborts this request; retry the SAME key in a fresh transaction.
  return req.payload.create({
    collection,
    data: { orderId: String(orderId), eventKey, kind, value },
    overrideAccess: true,
    req,
  });
}
/** Server-only: call after official finalizeOrder succeeds. Use the gateway-confirmed checkout breakdown, never browser amounts. */
export async function captureChileSettlement(
  req: PayloadRequest,
  orderId: string | number,
  input: ChileSettlement,
  ordersSlug = "orders",
) {
  validate(input);
  const order: any = await req.payload.findByID({
    collection: ordersSlug as any,
    id: orderId,
    depth: 1,
    overrideAccess: true,
    req,
  });
  if (order.currency !== "CLP" || Number(order.amount) !== input.total)
    throw new Error("Pago CLP no conciliado.");
  const tx =
    order.transactions?.filter(
      (t: any) =>
        typeof t === "object" &&
        t.status === "succeeded" &&
        String(typeof t.order === "object" ? t.order?.id : t.order) ===
          String(orderId),
    ) || [];
  if (
    !tx.length ||
    tx.some((t: any) => t.currency !== "CLP") ||
    tx.reduce((s: number, t: any) => s + Number(t.amount), 0) !== input.total
  )
    throw new Error("Transacción oficial sin pago confirmado.");
  return save(req, orderId, "settlement", "paid", {
    schema: "orbital-cl-v1",
    ...input,
  });
}
/** Server-only: invoke after verifying successful refund with the payment gateway. Use its immutable refund ID. */
export async function captureChileRefund(
  req: PayloadRequest,
  orderId: string | number,
  refund: { id: string; amount: number; lines: ChileSettlement["lines"] },
) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(refund.id) ||
    !Number.isSafeInteger(refund.amount) ||
    refund.amount < 1 ||
    !Array.isArray(refund.lines)
  )
    throw new Error("Reembolso inválido.");
  if (refund.lines.length)
    validate({
      total: refund.amount,
      paidAt: new Date().toISOString(),
      receiver: {},
      lines: refund.lines,
    });
  return save(req, orderId, "refund", refund.id, {
    ...refund,
    status: "succeeded",
  });
}
