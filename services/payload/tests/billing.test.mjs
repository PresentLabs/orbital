import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  identity,
  storeConnection,
  activeStore,
  readOrder,
  wooOrder,
  shopifyOrder,
  payloadOrder,
  orderId,
} from "../src/billing/stores.ts";
import { seal } from "../src/modules/security.ts";
import { engine } from "../src/billing/bridge.ts";
process.env.INTEGRATIONS_SECRET =
  "orbital-fiscal-synthetic-test-secret-32chars";
process.env.INTEGRATION_ALLOWED_HOSTS = "woo.example.test,payload.example.test";
process.env.PHP_BINARY = process.env.PHP_BINARY || "php";
const money = (n) => ({
    shopMoney: { amount: String(n), currencyCode: "CLP" },
  }),
  connection = (nodes) => ({ nodes, pageInfo: { hasNextPage: false } });
const woo = () => ({
  id: 123,
  status: "completed",
  date_paid_gmt: "2026-11-16T12:00:00",
  currency: "CLP",
  total: "11900",
  billing: { country: "CL", first_name: "Prueba", email: "test@example.test" },
  line_items: [
    { name: "Producto", total: "10000", total_tax: "1900", quantity: 1 },
  ],
});
const shop = () => ({
  id: "gid://shopify/Order/123",
  currencyCode: "CLP",
  presentmentCurrencyCode: "CLP",
  test: false,
  taxesIncluded: true,
  displayFinancialStatus: "PAID",
  cancelledAt: null,
  totalPriceSet: money(11900),
  billingAddress: { name: "Prueba", countryCodeV2: "CL" },
  transactions: [
    { kind: "SALE", status: "SUCCESS", processedAt: "2026-11-16T12:00:00Z" },
  ],
  lineItems: connection([
    {
      name: "Producto",
      quantity: 1,
      originalTotalSet: money(11900),
      discountAllocations: [],
      taxLines: [{ priceSet: money(1900) }],
    },
  ]),
  shippingLines: connection([]),
  refunds: [],
});
const official = () => ({
  id: "order-123",
  amount: 11900,
  currency: "CLP",
  status: "processing",
  customerEmail: "test@example.test",
  transactions: [
    {
      id: "tx1",
      order: "order-123",
      status: "succeeded",
      currency: "CLP",
      amount: 11900,
      updatedAt: "2026-11-16T12:00:00Z",
      billingAddress: { country: "CL" },
    },
  ],
});
const fiscal = () => [
  {
    orderId: "order-123",
    kind: "settlement",
    value: {
      schema: "orbital-cl-v1",
      total: 11900,
      paidAt: "2026-11-16T12:00:00Z",
      receiver: { name: "Prueba" },
      lines: [{ name: "Producto", net: 10000, tax: 1900, quantity: 1 }],
    },
  },
];
test("three stores normalize identical paid purchase without sharing source identity", () => {
  const orders = [
    wooOrder(woo()),
    shopifyOrder(shop()),
    payloadOrder(official(), fiscal()),
  ];
  for (const o of orders) {
    assert.equal(o.total, 11900);
    assert.equal(o.paid, true);
    assert.equal(o.lines[0].amount, 11900);
    assert.equal(o.lines[0].exempt, false);
  }
  assert.notEqual(
    identity("woo", "https://shop.test"),
    identity("payload", "https://shop.test"),
  );
  assert.notEqual(
    identity("shopify", "https://one.myshopify.com"),
    identity("shopify", "https://two.myshopify.com"),
  );
});
test("authorization alone and financial status alone do not prove settled Shopify payment", () => {
  const o = shop();
  o.transactions[0].kind = "AUTHORIZATION";
  assert.throws(() => shopifyOrder(o), /pago/);
  o.transactions[0].kind = "SALE";
  o.transactions[0].status = "PENDING";
  assert.throws(() => shopifyOrder(o), /pago/);
});
test("Woo requires confirmed payment and rejects unsupported currency and mismatched totals", () => {
  for (const change of [
    { date_paid_gmt: null },
    { currency: "USD" },
    { total: "12000" },
  ])
    assert.throws(() => wooOrder({ ...woo(), ...change }));
});
test("Shopify includes cart/code discount allocations rather than incomplete discountedTotalSet", () => {
  const o = shop();
  o.lineItems.nodes[0].originalTotalSet = money(23800);
  o.lineItems.nodes[0].discountAllocations = [
    { allocatedAmountSet: money(11900) },
  ];
  assert.equal(shopifyOrder(o).total, 11900);
});
test("pending refunds ignored, successful refunds retain independent keys and real tax lines", () => {
  const o = shop();
  o.displayFinancialStatus = "PARTIALLY_REFUNDED";
  o.refunds = [
    {
      id: "gid://shopify/Refund/9",
      transactions: connection([
        { kind: "REFUND", status: "PENDING", amountSet: money(1190) },
      ]),
      refundLineItems: connection([
        {
          lineItem: { name: "Producto" },
          quantity: 1,
          subtotalSet: money(1000),
          totalTaxSet: money(190),
        },
      ]),
      refundShippingLines: connection([]),
    },
  ];
  assert.equal(shopifyOrder(o).refunds.length, 0);
  o.refunds[0].transactions.nodes[0].status = "SUCCESS";
  assert.equal(shopifyOrder(o).refunds[0].amount, 1190);
  assert.equal(shopifyOrder(o).refunds[0].id, "9");
  o.refunds[0].transactions.pageInfo.hasNextPage = true;
  assert.throws(() => shopifyOrder(o), /truncado/);
});
test("cancelled refunded orders remain readable for NC but retain cancellation marker", () => {
  const o = shop();
  o.cancelledAt = "2026-11-16T14:00:00Z";
  o.displayFinancialStatus = "REFUNDED";
  assert.equal(shopifyOrder(o).cancelled, true);
});
test("official Payload payment requires matching expanded transactions and immutable fiscal event", () => {
  const o = official();
  assert.equal(
    payloadOrder({ ...o, customerEmail: undefined, customer: { email: "registered@example.test" } }, fiscal()).email,
    "registered@example.test",
  );
  assert.throws(() => payloadOrder(o, []), /evento/);
  assert.throws(
    () => payloadOrder({ ...o, transactions: ["tx1"] }, fiscal()),
    /transactions/,
  );
  assert.throws(
    () =>
      payloadOrder(
        { ...o, transactions: [{ ...o.transactions[0], order: "foreign" }] },
        fiscal(),
      ),
    /pago/,
  );
  assert.throws(
    () =>
      payloadOrder(
        { ...o, transactions: [{ ...o.transactions[0], status: "pending" }] },
        fiscal(),
      ),
    /pago/,
  );
  assert.throws(() => payloadOrder({ ...o, amount: 1 }, fiscal()), /coincide/);
});
test("Payload refund event IDs stay separate and source tax detail cannot guess IVA", () => {
  const events = fiscal();
  events.push({
    orderId: "order-123",
    kind: "refund",
    value: {
      id: "gateway-9",
      status: "succeeded",
      amount: 1190,
      lines: [{ name: "Producto", net: 1000, tax: 190, quantity: 1 }],
    },
  });
  assert.equal(payloadOrder(official(), events).refunds[0].id, "gateway-9");
  events[0].value.lines[0].tax = 1700;
  assert.throws(() => payloadOrder(official(), events), /IVA/);
});
test("active store resolution is tenant-scoped and switches provider using existing integration", async () => {
  for (const provider of ["woo", "shopify", "payload"]) {
    const req = {
      user: { workspace: { id: 7 } },
      payload: {
        find: async (args) => {
          assert.equal(args.where.and[0].workspace.equals, 7);
          assert.deepEqual(args.where.and[1].provider.in, [
            "woo",
            "shopify",
            "payload",
          ]);
          return {
            docs: [
              {
                id: 8,
                provider,
                credentials: seal(
                  provider === "shopify"
                    ? { shop: "demo.myshopify.com", token: "test" }
                    : {
                        url: `https://${provider === "woo" ? "woo" : "payload"}.example.test`,
                      },
                ),
              },
            ],
          };
        },
      },
    };
    assert.equal((await activeStore(req)).provider, provider);
  }
  await assert.rejects(() =>
    activeStore({
      user: { workspace: 7 },
      payload: { find: async () => ({ docs: [] }) },
    }),
  );
});
test("Payload uses official order depth and companion events; Shopify uses Admin GraphQL", async () => {
  const p = storeConnection({
    id: 1,
    provider: "payload",
    credentials: seal({ url: "https://payload.example.test", token: "test" }),
  });
  const paths = [];
  await readOrder(p, "order-123", async (url, init) => {
    paths.push(url);
    assert.equal(init.headers.Authorization, "users API-Key test");
    assert.equal(init.redirect, "error");
    return Response.json(
      url.includes("orbital-fiscal-events")
        ? { docs: fiscal(), hasNextPage: false }
        : official(),
    );
  });
  assert.ok(paths[0].endsWith("/orders/order-123?depth=2"));
  const s = storeConnection({
    id: 2,
    provider: "shopify",
    credentials: seal({ shop: "demo.myshopify.com", token: "token" }),
  });
  await readOrder(s, "123", async (url, init) => {
    assert.equal(
      url,
      "https://demo.myshopify.com/admin/api/2026-10/graphql.json",
    );
    assert.equal(JSON.parse(init.body).variables.id, "gid://shopify/Order/123");
    return Response.json({ data: { order: shop() } });
  });
  for (const id of ["../12", "gid://evil/1", -1])
    assert.throws(() => orderId(id));
});
test("standalone PHP core validates all stores without WordPress and blocks accidental production", async () => {
  const fixture = JSON.parse(
    execFileSync(
      process.env.PHP_BINARY,
      [
        fileURLToPath(
          new URL(
            "../../../modules/billing-cl/tests/fixture.php",
            import.meta.url,
          ),
        ),
      ],
      { maxBuffer: 5000000 },
    ),
  );
  const snapshot = {
    type: 39,
    receiver: { name: "Prueba" },
    lines: [{ name: "Producto", amount: 11900, exempt: false }],
    email: "test@example.test",
  };
  const s = await engine({
    action: "snapshot",
    tenant: 7,
    issuer: fixture.issuer,
    snapshot,
  });
  assert.equal(s.totals.vat, 1900);
  assert.equal(s.receiver.rut, "66666666-6");
  await assert.rejects(
    () =>
      engine({
        action: "validate",
        tenant: 7,
        issuer: { ...fixture.issuer, environment: "production" },
        certificate: fixture.certificate,
        password: fixture.password,
      }),
    /Producción bloqueada/,
  );
  process.env.BILLING_SII_CAF_KEYS = JSON.stringify({
    certification: { 999: fixture.public },
  });
  const caf = await engine({
    action: "caf",
    tenant: 7,
    issuer: fixture.issuer,
    xml: fixture.cafs["39"],
  });
  assert.equal(caf.start, 1);
  const built = await engine({
    action: "build",
    tenant: 7,
    issuer: fixture.issuer,
    snapshot: s,
    certificate: fixture.certificate,
    password: fixture.password,
    caf: fixture.cafs["39"],
    folio: 1,
  });
  assert.ok(
    Buffer.from(built.xml, "base64").toString().includes("EnvioBOLETA"),
  );
  const pdf = await engine({
    action: "pdf",
    tenant: 7,
    issuer: fixture.issuer,
    snapshot: s,
    ted: built.ted,
    document: {
      type: 39,
      folio: 1,
      environment: "certification",
      state: "signed",
    },
  });
  assert.ok(
    Buffer.from(pdf.base64, "base64").subarray(0, 5).toString() === "%PDF-",
  );
});

test("Payload companion uses official payment state, immutable event keys and server-only writes", async () => {
  const { chileBillingEvents, captureChileSettlement, captureChileRefund } =
    await import("../../../modules/billing-cl/payload-ecommerce.ts");
  const canRead = () => false;
  const collection = chileBillingEvents(canRead)({ collections: [] })
    .collections[0];
  assert.equal(collection.access.read, canRead);
  for (const op of ["create", "update", "delete"])
    assert.equal(collection.access[op](), false);
  const events = [];
  const req = {
    payload: {
      findByID: async () => official(),
      find: async (args) => ({
        docs: events.filter((e) => e.eventKey === args.where.eventKey.equals),
      }),
      create: async ({ data }) => {
        if (events.some((e) => e.eventKey === data.eventKey))
          throw new Error("unique eventKey");
        events.push(data);
        return data;
      },
    },
  };
  const input = {
    total: 11900,
    paidAt: "2026-11-16T12:00:00Z",
    receiver: { name: "Prueba" },
    lines: [{ name: "Producto", net: 10000, tax: 1900, quantity: 1 }],
  };
  await captureChileSettlement(req, "order-123", input);
  await captureChileSettlement(req, "order-123", input);
  assert.equal(events.length, 1);
  await assert.rejects(
    () =>
      captureChileSettlement(req, "order-123", {
        ...input,
        receiver: { name: "Different" },
      }),
    /otro contenido/,
  );
  await Promise.all(
    ["one", "two"].map((id) =>
      captureChileRefund(req, "order-123", {
        id,
        amount: 1190,
        lines: [{ name: "Producto", net: 1000, tax: 190, quantity: 1 }],
      }),
    ),
  );
  assert.equal(events.length, 3);
  await captureChileRefund(req, "order-123", {
    id: "one",
    amount: 1190,
    lines: [{ name: "Producto", net: 1000, tax: 190, quantity: 1 }],
  });
  assert.equal(events.length, 3);
  req.payload.findByID = async () => ({
    ...official(),
    transactions: [{ ...official().transactions[0], status: "pending" }],
  });
  await assert.rejects(
    () => captureChileSettlement(req, "order-123", input),
    /sin pago/,
  );
});
