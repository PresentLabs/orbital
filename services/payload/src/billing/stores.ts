import { createHash } from "node:crypto";
import { ModuleError, storeOrigin, unseal } from "../modules/security.ts";
import { isStoreProvider, type StoreProvider } from "../store-integrations.ts";
export type Line = {
  name: string;
  amount: number;
  exempt: boolean;
  quantity?: number;
};
export type Order = {
  id: string;
  paid: boolean;
  paidAt: string;
  cancelled: boolean;
  testPayment: boolean;
  currency: string;
  country: string;
  email: string;
  total: number;
  lines: Line[];
  receiver: Record<string, string>;
  refunds: { id: string; amount: number; lines: Line[] }[];
};
export type Store = {
  provider: StoreProvider;
  origin: string;
  key: string;
  connectionId: string;
  credentials: Record<string, string>;
};
export function identity(provider: StoreProvider, origin: string) {
  return createHash("sha256")
    .update(provider + "|" + origin)
    .digest("hex");
}
export function storeConnection(row: any): Store {
  const c = unseal(row.credentials);
  let origin: string;
  if (row.provider === "shopify") {
    const domain = String(c.shop || "")
      .replace(/^https:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
      throw new ModuleError("Dominio Shopify inválido.");
    origin = "https://" + domain;
  } else origin = storeOrigin(c.url);
  if (!isStoreProvider(row.provider))
    throw new ModuleError("Tienda no admitida.");
  return {
    provider: row.provider,
    origin,
    connectionId: String(row.id),
    key: identity(row.provider, origin),
    credentials: c,
  };
}
export async function activeStore(req: any): Promise<Store> {
  const tenant =
    typeof req.user.workspace === "object"
      ? req.user.workspace.id
      : req.user.workspace;
  const found = await req.payload.find({
    collection: "integrations",
    where: {
      and: [
        { workspace: { equals: tenant } },
        { provider: { in: ["woo", "shopify", "payload"] } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (found.docs.length !== 1)
    throw new ModuleError(
      "Conecta una única tienda en Configuración → Integraciones.",
      409,
    );
  return storeConnection(found.docs[0]);
}
export function pesos(v: unknown): number {
  if (!/^(0|[1-9]\d*)(\.0+)?$/.test(String(v)))
    throw new ModuleError("Se requiere un monto entero CLP.");
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n > 999999999999)
    throw new ModuleError("Monto fuera de rango.");
  return n;
}
export function orderId(v: unknown) {
  if (typeof v !== "string" && typeof v !== "number")
    throw new ModuleError("Pedido inválido.");
  const id = String(v);
  if (id === "0" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id))
    throw new ModuleError("Pedido inválido.");
  return id;
}
function lines(
  raw: { name: string; net: number; tax: number; quantity?: number }[],
  total: number,
): Line[] {
  if (!raw.length || raw.length > 60)
    throw new ModuleError("Detalle vacío o con más de 60 líneas.");
  for (const l of raw)
    if (
      !Number.isFinite(l.net) ||
      !Number.isFinite(l.tax) ||
      l.net < 0 ||
      l.tax < 0 ||
      (l.tax > 0 && Math.abs(l.tax - l.net * 0.19) > 1.01)
    )
      throw new ModuleError("Solo IVA 19% y exentos; revisa el detalle.");
  const sum = raw.reduce((s, l) => s + l.net + l.tax, 0);
  if (Math.abs(sum - total) > 1.01)
    throw new ModuleError(
      "El detalle no concilia con el total; requiere revisión.",
    );
  const result = raw.map((l) => ({
    name: String(l.name).slice(0, 80),
    amount: Math.floor(l.net + l.tax),
    exempt: l.tax === 0,
    quantity: l.quantity || 1,
  }));
  const left = total - result.reduce((s, l) => s + l.amount, 0);
  if (left < 0 || left > raw.length)
    throw new ModuleError("Redondeo no conciliable.");
  const sorted = raw
    .map((l, i) => ({ i, remainder: (l.net + l.tax) % 1 }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < left; i++) result[sorted[i].i].amount++;
  return result.filter((l) => l.amount > 0);
}
function verify(order: Order) {
  if (!order.paid)
    throw new ModuleError("El pedido no tiene pago confirmado.", 409);
  if (order.currency !== "CLP" || order.country !== "CL")
    throw new ModuleError("Solo pedidos en CLP y Chile.");
  return order;
}
export function wooOrder(o: any, refunds: any[] = []): Order {
  const detail = (o: any, refund = false) =>
    [
      ...(o.line_items || []),
      ...(o.fee_lines || []),
      ...(o.shipping_lines || []),
    ]
      .map((l) => ({
        name: l.name || l.method_title || "Envío",
        net: Number(l.total) * (refund ? -1 : 1),
        tax: Number(l.total_tax) * (refund ? -1 : 1),
        quantity: Math.abs(Number(l.quantity) || 1),
      }))
      .filter((l) => l.net + l.tax > 0);
  const total = pesos(o.total);
  const b = o.billing || {};
  const meta =
    o.meta_data?.find((x: any) => x.key === "_wdt_receiver")?.value || {};
  return verify({
    id: orderId(o.id),
    paid:
      !!(o.date_paid || o.date_paid_gmt) &&
      ["processing", "completed", "refunded", "cancelled"].includes(o.status),
    paidAt: o.date_paid_gmt ? o.date_paid_gmt + "Z" : o.date_paid,
    cancelled: o.status === "cancelled",
    testPayment: false,
    currency: o.currency,
    country: b.country,
    email: b.email || "",
    total,
    lines: lines(detail(o), total),
    receiver: {
      name:
        b.company ||
        [b.first_name, b.last_name].filter(Boolean).join(" ") ||
        "Consumidor final",
      address: b.address_1 || "",
      commune: b.city || "",
      ...meta,
    },
    refunds: refunds.map((r) => ({
      id: orderId(r.id),
      amount: pesos(r.amount),
      lines: detail(r, true).length
        ? lines(detail(r, true), pesos(r.amount))
        : [],
    })),
  });
}
export function payloadOrder(o: any, events: any[]): Order {
  // Official @payloadcms/plugin-ecommerce orders + expanded transactions.
  // The companion extension freezes Chile's tax breakdown; product prices are never reread to reconstruct old orders.
  const settlements = events.filter(
    (e) => e.kind === "settlement" && e.orderId === String(o.id),
  );
  if (settlements.length !== 1)
    throw new ModuleError(
      "Pedido sin un único evento de pago fiscal. Instala la extensión Chile de ecommerce.",
    );
  const f = {
    ...settlements[0].value,
    refunds: events
      .filter((e) => e.kind === "refund" && e.orderId === String(o.id))
      .map((e) => e.value),
  };
  if (!f || f.schema !== "orbital-cl-v1")
    throw new ModuleError(
      "Falta el detalle tributario congelado. Instala la extensión Chile para el plugin ecommerce de Payload.",
    );
  if (!Array.isArray(f.lines) || !Array.isArray(f.refunds))
    throw new ModuleError("Detalle fiscal Payload inválido.");
  const tx = Array.isArray(o.transactions) ? o.transactions : [];
  if (tx.some((t: any) => !t || typeof t !== "object"))
    throw new ModuleError(
      "La API key necesita acceso a transactions de Payload.",
    );
  const paidTransactions = tx.filter(
    (t: any) =>
      ["succeeded", "refunded"].includes(t.status) &&
      String(typeof t.order === "object" ? t.order?.id : t.order) ===
        String(o.id),
  );
  const total = pesos(o.amount);
  const paid =
    paidTransactions.length > 0 &&
    paidTransactions.every((t: any) => t.currency === "CLP") &&
    paidTransactions.reduce((n: number, t: any) => n + pesos(t.amount), 0) ===
      total;
  const paidAt =
    paidTransactions
      .map((t: any) => t.updatedAt)
      .filter((v: any) => typeof v === "string")
      .sort()
      .at(-1) || "";
  const address =
    paidTransactions[0]?.billingAddress || o.shippingAddress || {};
  const normalize = (ls: any[], amount: number) =>
    lines(
      ls.map((l) => ({
        name: l.name,
        net: Number(l.net),
        tax: Number(l.tax),
        quantity: Number(l.quantity) || 1,
      })),
      amount,
    );
  if (pesos(f.total) !== total)
    throw new ModuleError(
      "El detalle tributario no coincide con el pedido Payload.",
    );
  return verify({
    id: orderId(o.id),
    paid,
    paidAt: f.paidAt || paidAt,
    cancelled: o.status === "cancelled",
    testPayment: f.testPayment === true,
    currency: o.currency,
    country: address.country,
    email:
      o.customerEmail ||
      o.customer?.email ||
      paidTransactions[0]?.customerEmail ||
      paidTransactions[0]?.customer?.email ||
      "",
    total,
    lines: normalize(f.lines, total),
    receiver: f.receiver || {
      name:
        address.company ||
        [address.firstName, address.lastName].filter(Boolean).join(" ") ||
        "Consumidor final",
      address: address.addressLine1 || "",
      commune: address.city || "",
    },
    refunds: f.refunds
      .filter((r: any) => r.status === "succeeded")
      .map((r: any) => ({
        id: orderId(r.id),
        amount: pesos(r.amount),
        lines: r.lines?.length ? normalize(r.lines, pesos(r.amount)) : [],
      })),
  });
}

const money = (m: any) => {
  if (m?.shopMoney?.currencyCode !== "CLP")
    throw new ModuleError("Moneda Shopify distinta de CLP.");
  return Number(m.shopMoney.amount);
};
export function shopifyOrder(o: any): Order {
  if (o.presentmentCurrencyCode !== "CLP")
    throw new ModuleError("Solo pagos Shopify en CLP.");
  if (o.lineItems.pageInfo.hasNextPage || o.shippingLines.pageInfo.hasNextPage)
    throw new ModuleError(
      "Pedido Shopify demasiado extenso; no se emitirá un detalle truncado.",
    );
  const raw = o.lineItems.nodes.map((l: any) => {
    const gross =
        money(l.originalTotalSet) -
        l.discountAllocations.reduce(
          (sum: number, d: any) => sum + money(d.allocatedAmountSet),
          0,
        ),
      tax = l.taxLines.reduce((s: number, t: any) => s + money(t.priceSet), 0);
    return {
      name: l.name,
      net: o.taxesIncluded ? gross - tax : gross,
      tax,
      quantity: l.quantity,
    };
  });
  for (const l of o.shippingLines.nodes) {
    const gross = money(l.discountedPriceSet),
      tax = l.taxLines.reduce((s: number, t: any) => s + money(t.priceSet), 0);
    raw.push({
      name: l.title,
      net: o.taxesIncluded ? gross - tax : gross,
      tax,
      quantity: 1,
    });
  }
  const total = pesos(money(o.totalPriceSet));
  const b = o.billingAddress || o.shippingAddress || {};
  const paid = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
    o.displayFinancialStatus,
  );
  const captures = (o.transactions || []).filter(
    (t: any) => ["SALE", "CAPTURE"].includes(t.kind) && t.status === "SUCCESS",
  );
  if ((o.transactions || []).length >= 250)
    throw new ModuleError("Demasiadas transacciones; revisar pago.");
  return verify({
    id: orderId(o.id.split("/").pop()),
    paid: paid && captures.length > 0,
    paidAt:
      captures
        .map((t: any) => t.processedAt)
        .sort()
        .at(-1) || "",
    cancelled: !!o.cancelledAt,
    testPayment: o.test === true,
    currency: o.currencyCode,
    country: b.countryCodeV2,
    email: o.email || "",
    total,
    lines: lines(raw, total),
    receiver: {
      name: b.company || b.name || "Consumidor final",
      address: b.address1 || "",
      commune: b.city || "",
    },
    refunds: (o.refunds || [])
      .map((r: any) => {
        if (
          r.transactions.pageInfo.hasNextPage ||
          r.refundLineItems.pageInfo.hasNextPage ||
          r.refundShippingLines.pageInfo.hasNextPage
        )
          throw new ModuleError("Reembolso Shopify truncado.");
        const successes = r.transactions.nodes.filter(
          (t: any) => t.kind === "REFUND" && t.status === "SUCCESS",
        );
        const amount = successes.reduce(
          (s: number, t: any) => s + pesos(money(t.amountSet)),
          0,
        );
        if (!amount)
          return { id: orderId(r.id.split("/").pop()), amount: 0, lines: [] };
        const ls = r.refundLineItems.nodes.map((l: any) => ({
          name: l.lineItem.name,
          net: money(l.subtotalSet),
          tax: money(l.totalTaxSet),
          quantity: l.quantity,
        }));
        for (const shipping of r.refundShippingLines.nodes)
          ls.push({
            name: shipping.shippingLine.title,
            net: money(shipping.subtotalAmountSet),
            tax: money(shipping.taxAmountSet),
            quantity: 1,
          });
        return {
          id: orderId(r.id.split("/").pop()),
          amount,
          lines: ls.length ? lines(ls, amount) : [],
        };
      })
      .filter((r: any) => r.amount > 0),
  });
}
export const SHOPIFY_ORDER_FIELDS = `id email currencyCode presentmentCurrencyCode test taxesIncluded cancelledAt displayFinancialStatus transactions(first:250){kind status processedAt} totalPriceSet { shopMoney { amount currencyCode } }
 billingAddress {name company address1 city countryCodeV2} shippingAddress {name company address1 city countryCodeV2}
 lineItems(first:250){pageInfo{hasNextPage} nodes{name quantity originalTotalSet{shopMoney{amount currencyCode}} discountAllocations{allocatedAmountSet{shopMoney{amount currencyCode}}} taxLines{priceSet{shopMoney{amount currencyCode}}}}}
 shippingLines(first:50){pageInfo{hasNextPage} nodes{title discountedPriceSet{shopMoney{amount currencyCode}} taxLines{priceSet{shopMoney{amount currencyCode}}}}}
 refunds {id refundShippingLines(first:50){pageInfo{hasNextPage} nodes{shippingLine{title} subtotalAmountSet{shopMoney{amount currencyCode}} taxAmountSet{shopMoney{amount currencyCode}}}} transactions(first:100){pageInfo{hasNextPage} nodes{kind status amountSet{shopMoney{amount currencyCode}}}} refundLineItems(first:250){pageInfo{hasNextPage} nodes{quantity subtotalSet{shopMoney{amount currencyCode}} totalTaxSet{shopMoney{amount currencyCode}} lineItem{name}}}}`;
async function remote(
  store: Store,
  path: string,
  body?: unknown,
  fetcher = fetch,
) {
  const c = store.credentials;
  const headers: Record<string, string> = {};
  if (store.provider === "woo")
    headers.Authorization =
      "Basic " + Buffer.from(c.key + ":" + c.secret).toString("base64");
  if (store.provider === "shopify") {
    headers["X-Shopify-Access-Token"] = c.token;
    headers["Content-Type"] = "application/json";
  }
  if (store.provider === "payload") {
    const collection = c.authCollection || "users";
    if (!/^[a-zA-Z][\w-]{0,79}$/.test(collection))
      throw new ModuleError("Colección de autenticación inválida.");
    headers.Authorization = collection + " API-Key " + c.token;
  }
  const response = await fetcher(store.origin + path, {
    method: body ? "POST" : "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new ModuleError(
      "La tienda no pudo devolver el pedido. Revisa sus permisos de lectura.",
      502,
    );
  const result = await response.json();
  if (result.errors?.length)
    throw new ModuleError(
      "Shopify rechazó la consulta. Revisa read_orders y acceso a datos de clientes.",
      502,
    );
  return result;
}
export async function readOrder(
  store: Store,
  id: unknown,
  fetcher = fetch,
): Promise<Order> {
  const safe = orderId(id);
  if (store.provider === "woo") {
    const o = await remote(
      store,
      "/wp-json/wc/v3/orders/" + safe,
      undefined,
      fetcher,
    );
    const refunds = [];
    for (let page = 1; ; page++) {
      const batch = await remote(
        store,
        `/wp-json/wc/v3/orders/${safe}/refunds?per_page=100&page=${page}`,
        undefined,
        fetcher,
      );
      if (!Array.isArray(batch)) throw new ModuleError("Reembolsos inválidos.");
      refunds.push(...batch);
      if (batch.length < 100) break;
      if (page === 10) throw new ModuleError("Demasiados reembolsos.");
    }
    return wooOrder(o, refunds);
  }
  if (store.provider === "shopify") {
    if (!/^\d+$/.test(safe))
      throw new ModuleError(
        "Usa el ID numérico de Shopify, no el número visible #1001.",
      );
    const r = await remote(
      store,
      "/admin/api/2026-10/graphql.json",
      {
        query: `query($id:ID!){order(id:$id){${SHOPIFY_ORDER_FIELDS}}}`,
        variables: { id: "gid://shopify/Order/" + safe },
      },
      fetcher,
    );
    if (!r.data?.order) throw new ModuleError("Pedido no encontrado.", 404);
    return shopifyOrder(r.data.order);
  }
  const collection = store.credentials.orders || "orders";
  if (!/^[a-zA-Z][\w-]{0,79}$/.test(collection))
    throw new ModuleError("Colección de pedidos inválida.");
  const order = await remote(
    store,
    "/api/" + collection + "/" + safe + "?depth=2",
    undefined,
    fetcher,
  );
  const events = [];
  for (let page = 1; ; page++) {
    const result = await remote(
      store,
      `/api/orbital-fiscal-events?where[orderId][equals]=${safe}&limit=100&page=${page}&depth=0`,
      undefined,
      fetcher,
    );
    if (!Array.isArray(result.docs))
      throw new ModuleError("La extensión fiscal de Payload no respondió.");
    events.push(...result.docs);
    if (!result.hasNextPage) break;
    if (page >= 10) throw new ModuleError("Demasiados eventos fiscales.");
  }
  return payloadOrder(order, events);
}
export async function orderPage(
  store: Store,
  cursor: string | null,
  fetcher = fetch,
): Promise<{ ids: string[]; next: string | null }> {
  if (store.provider === "shopify") {
    const r = await remote(
      store,
      "/admin/api/2026-10/graphql.json",
      {
        query:
          "query($cursor:String){orders(first:50,after:$cursor,sortKey:UPDATED_AT,reverse:true){nodes{id} pageInfo{hasNextPage endCursor}}}",
        variables: { cursor },
      },
      fetcher,
    );
    return {
      ids: r.data.orders.nodes.map((o: any) => orderId(o.id.split("/").pop())),
      next: r.data.orders.pageInfo.hasNextPage
        ? r.data.orders.pageInfo.endCursor
        : null,
    };
  }
  const page = cursor ? Number(cursor) : 1;
  if (!Number.isSafeInteger(page) || page < 1)
    throw new ModuleError("Página inválida.");
  if (store.provider === "woo") {
    const r = await remote(
      store,
      `/wp-json/wc/v3/orders?per_page=50&page=${page}&orderby=modified&order=desc`,
      undefined,
      fetcher,
    );
    return {
      ids: r.map((o: any) => orderId(o.id)),
      next: r.length === 50 ? String(page + 1) : null,
    };
  }
  const slug = store.credentials.orders || "orders";
  if (!/^[a-zA-Z][\w-]{0,79}$/.test(slug))
    throw new ModuleError("Colección inválida.");
  const r = await remote(
    store,
    `/api/${slug}?limit=50&page=${page}&sort=-updatedAt&depth=0`,
    undefined,
    fetcher,
  );
  return {
    ids: r.docs.map((o: any) => orderId(o.id)),
    next: r.hasNextPage ? String(r.nextPage) : null,
  };
}
