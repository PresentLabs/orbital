import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const url = process.env.BILLING_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith("/orbital_billing_test"))
  throw new Error("Only isolated orbital_billing_test databases are allowed.");
process.env.DATABASE_URL = url;
process.env.INTEGRATIONS_SECRET = "isolated-billing-database-test-secret-32";
process.env.PHP_BINARY = process.env.PHP_BINARY || "php";
process.env.INTEGRATION_ALLOWED_HOSTS = "woo.example.test,payload.example.test";
test(
  "native ledger: real PostgreSQL migrations, three stores, concurrent NC, history and scoped API",
  { skip: !url },
  async (t) => {
    const {
      pool,
      issue,
      adjustment,
      importCaf,
      processDocument,
      file,
      decode,
    } = await import("../src/billing/ledger.ts");
    const { billingEndpoint } = await import("../src/billing/api.ts");
    const { seal } = await import("../src/modules/security.ts");
    const { storeConnection } = await import("../src/billing/stores.ts");
    try {
      for (const filename of [
        "20261113_185307_initial.ts",
        "20261116_120000_modules.ts",
        "20261116_150000_billing.ts",
      ]) {
        const source = readFileSync(
          new URL("../src/migrations/" + filename, import.meta.url),
          "utf8",
        );
        await pool.query(source.match(/sql`([\s\S]*?)`/)[1]);
      }
      await pool.query(
        "INSERT INTO workspaces(id,name) VALUES(1,'Test A'),(2,'Test B')",
      );
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
      const config = {
        issuer: fixture.issuer,
        certificate: fixture.certificate,
        password: fixture.password,
        automaticIssue: false,
        automaticRefunds: false,
      };
      process.env.BILLING_SII_CAF_KEYS = JSON.stringify({
        certification: { 999: fixture.public },
      });
      const stores = ["woo", "shopify", "payload"].map((provider, i) =>
        storeConnection({
          id: i + 1,
          provider,
          credentials: seal(
            provider === "shopify"
              ? { shop: "demo.myshopify.com", token: "test" }
              : {
                  url: `https://${provider === "woo" ? "woo" : "payload"}.example.test`,
                  key: "ck_test",
                  secret: "cs_test",
                  token: "test",
                },
          ),
        }),
      );
      const order = {
        id: "123",
        paid: true,
        paidAt: new Date().toISOString(),
        cancelled: false,
        testPayment: false,
        currency: "CLP",
        country: "CL",
        email: "test@example.test",
        total: 11900,
        lines: [
          { name: "Producto", quantity: 1, amount: 11900, exempt: false },
        ],
        receiver: { name: "Consumidor final" },
        refunds: [],
      };
      const originals = [];
      async function activate(store) {
        await pool.query("DELETE FROM integrations WHERE workspace_id=1");
        await pool.query(
          "INSERT INTO integrations(id,workspace_id,provider,workspace_provider,credentials) VALUES($1,1,$2,$3,$4)",
          [
            Number(store.connectionId),
            store.provider,
            "1:store",
            seal(store.credentials),
          ],
        );
      }

      await t.test(
        "same order ID in each store creates distinct documents; repeat is idempotent",
        async () => {
          for (const store of stores) {
            await activate(store);
            const d = await issue(1, store, order, 39, config);
            originals.push(d);
            assert.equal((await issue(1, store, order, 39, config)).id, d.id);
          }
          assert.equal(new Set(originals.map((d) => d.id)).size, 3);
          assert.equal(
            (await pool.query("SELECT COUNT(*) FROM billing_documents")).rows[0]
              .count,
            "3",
          );
          assert.ok(
            !JSON.stringify(
              (await pool.query("SELECT snapshot FROM billing_documents")).rows,
            ).includes("Consumidor final"),
          );
        },
      );
      await t.test(
        "refund concurrency and same-key retries cannot exceed original",
        async () => {
          await activate(stores[0]);
          const d = originals[0];
          await pool.query(
            "UPDATE billing_documents SET state='accepted',folio=101 WHERE id=$1",
            [d.id],
          );
          const input = {
            documentId: d.id,
            type: 61,
            amount: 3000,
            reason: "Devolución",
            cancel: false,
            kind: "return",
            operationKey: "same-key-0001",
          };
          const repeated = await Promise.all(
            Array.from({ length: 5 }, () =>
              adjustment(1, stores[0], input, config),
            ),
          );
          assert.equal(new Set(repeated.map((x) => x.id)).size, 1);
          await assert.rejects(
            () => adjustment(1, stores[0], { ...input, amount: 4000 }, config),
            /distinta/,
          );
          const raced = await Promise.allSettled(
            Array.from({ length: 8 }, (_, i) =>
              adjustment(
                1,
                stores[0],
                { ...input, operationKey: "race-key-" + i },
                config,
              ),
            ),
          );
          assert.equal(raced.filter((r) => r.status === "fulfilled").length, 2);
          const credited = Number(
            (
              await pool.query(
                "SELECT SUM(amount) AS total FROM billing_documents WHERE parent_id=$1",
                [d.id],
              )
            ).rows[0].total,
          );
          assert.equal(credited, 9000);
          await assert.rejects(
            () =>
              adjustment(
                1,
                stores[0],
                {
                  ...input,
                  operationKey: "full-cancel-01",
                  cancel: true,
                  amount: 11900,
                },
                config,
              ),
            /saldo/,
          );
          await assert.rejects(
            () => adjustment(2, stores[0], input, config),
            /otra/,
          );
          await assert.rejects(
            () => adjustment(1, stores[1], input, config),
            /otra/,
          );
        },
      );
      await t.test(
        "folio imports verify trusted signature and reject overlapping ranges across workspaces",
        async () => {
          await importCaf(1, fixture.cafs["39"], config);
          await assert.rejects(
            () => importCaf(1, fixture.cafs["39"], config),
            /superpone/,
          );
          await assert.rejects(
            () => importCaf(2, fixture.cafs["39"], config),
            /superpone/,
          );
          const wrong = fixture.cafs["61"].replace(
            '<FRMA algoritmo="SHA1withRSA">',
            '<FRMA algoritmo="BAD">',
          );
          await assert.rejects(() => importCaf(1, wrong, config), /Firma/);
        },
      );
      await t.test(
        "source mismatch pauses unsigned document instead of issuing it for active store",
        async () => {
          await processDocument(1, originals[1].id, stores[2], config);
          assert.equal(
            (
              await pool.query(
                "SELECT state FROM billing_documents WHERE id=$1",
                [originals[1].id],
              )
            ).rows[0].state,
            "blocked",
          );
        },
      );
      await t.test(
        "signed queue reserves one folio and never resends ambiguous upload",
        async () => {
          const { engine } = await import("../src/billing/bridge.ts");
          const { ModuleError } = await import("../src/modules/security.ts");
          const order2 = { ...order, id: "456" };
          const d = await issue(1, stores[0], order2, 39, config);
          let sends = 0,
            polls = 0;
          const originalFetch = globalThis.fetch;
          globalThis.fetch = async (url) =>
            Response.json(
              String(url).includes("/refunds")
                ? []
                : {
                    id: 456,
                    status: "completed",
                    date_paid_gmt: "2026-11-16T12:00:00",
                    currency: "CLP",
                    total: "11900",
                    billing: { country: "CL", first_name: "Prueba" },
                    line_items: [
                      {
                        name: "Producto",
                        quantity: 1,
                        total: "10000",
                        total_tax: "1900",
                      },
                    ],
                  },
            );
          const driver = async (input) => {
            if (input.action === "send") {
              sends++;
              throw new ModuleError("Upload result lost", 503);
            }
            if (input.action === "status") {
              polls++;
              return { state: "accepted", code: "EPR", raw: "synthetic" };
            }
            return engine(input);
          };
          try {
            await processDocument(1, d.id, stores[0], config, driver);
            const uncertain = (
              await pool.query("SELECT * FROM billing_documents WHERE id=$1", [
                d.id,
              ])
            ).rows[0];
            assert.equal(uncertain.state, "uncertain");
            assert.ok(uncertain.xml);
            assert.ok(uncertain.folio);
            await pool.query(
              "UPDATE billing_documents SET next_run=now()-interval '1 minute' WHERE id=$1",
              [d.id],
            );
            await processDocument(1, d.id, stores[0], config, driver);
            const final = (
              await pool.query("SELECT * FROM billing_documents WHERE id=$1", [
                d.id,
              ])
            ).rows[0];
            assert.equal(final.state, "accepted");
            assert.equal(final.xml_hash, uncertain.xml_hash);
            assert.equal(final.folio, uncertain.folio);
            assert.equal(sends, 1);
            assert.equal(polls, 1);
            assert.ok((await file(1, d.id, "xml", config)).base64.length > 100);
          } finally {
            globalThis.fetch = originalFetch;
          }
        },
      );
      // Fake Payload local API wrapping actual SQL with workspace filtering, no real authentication/network.
      await pool.query(
        "INSERT INTO module_installations(workspace_id,module_id,workspace_key,version,enabled,credentials) VALUES(1,'billing-cl','1:billing-cl','0.3.0',true,$1)",
        [seal(config)],
      );
      const req = {
        method: "POST",
        headers: new Headers({ Authorization: "JWT test" }),
        user: { id: 1, role: "admin", workspace: 1 },
        payload: {
          find: async (args) => {
            const tenant = args.where.and[0].workspace.equals;
            if (args.collection === "module-installations") {
              const module = args.where.and[1].moduleId.equals;
              return {
                docs: (
                  await pool.query(
                    "SELECT id,credentials,enabled FROM module_installations WHERE workspace_id=$1 AND module_id=$2",
                    [tenant, module],
                  )
                ).rows,
              };
            }
            return { docs: [] };
          },
        },
      };
      await t.test(
        "history remains available without connected store; foreign tenants cannot read",
        async () => {
          const history = await billingEndpoint(req, { action: "history" });
          assert.equal(history.status, 200);
          assert.equal(
            (await history.json()).filter((d) => !d.parent_id).length,
            4,
          );
          const foreign = await billingEndpoint(
            { ...req, user: { id: 2, role: "admin", workspace: 2 } },
            { action: "file", documentId: originals[0].id, format: "xml" },
          );
          assert.notEqual(foreign.status, 200);
          const denied = await billingEndpoint(
            { ...req, user: { id: 3, role: "member", workspace: 1 } },
            { action: "history" },
          );
          assert.equal(denied.status, 403);
        },
      );
      await t.test(
        "source data remains immutable and documents cannot be removed by workspace deletion",
        async () => {
          await assert.rejects(
            () => pool.query("DELETE FROM workspaces WHERE id=1"),
            (error) => ["23503", "23502"].includes(error.code),
          );
          assert.equal(
            decode(
              (
                await pool.query(
                  "SELECT snapshot FROM billing_documents WHERE id=$1",
                  [originals[0].id],
                )
              ).rows[0].snapshot,
            ).totals.total,
            11900,
          );
        },
      );
      await t.test(
        "worker follows active Shopify, avoids historical backfill, and deduplicates refund events",
        async () => {
          const { tick } = await import("../src/billing/worker.ts");
          const money = (n) => ({
              shopMoney: { amount: String(n), currencyCode: "CLP" },
            }),
            conn = (nodes) => ({ nodes, pageInfo: { hasNextPage: false } });
          const shop = {
            id: "gid://shopify/Order/987",
            currencyCode: "CLP",
            presentmentCurrencyCode: "CLP",
            test: false,
            taxesIncluded: true,
            displayFinancialStatus: "PAID",
            cancelledAt: null,
            totalPriceSet: money(11900),
            billingAddress: { name: "Prueba", countryCodeV2: "CL" },
            transactions: [
              {
                kind: "SALE",
                status: "SUCCESS",
                processedAt: "2020-01-01T00:00:00Z",
              },
            ],
            lineItems: conn([
              {
                name: "Producto",
                quantity: 1,
                originalTotalSet: money(11900),
                discountAllocations: [],
                taxLines: [{ priceSet: money(1900) }],
              },
            ]),
            shippingLines: conn([]),
            refunds: [],
          };
          await activate(stores[1]);
          await pool.query(
            "UPDATE module_installations SET credentials=$1 WHERE workspace_id=1 AND module_id='billing-cl'",
            [seal({ ...config, automaticIssue: true, automaticRefunds: true })],
          );
          const originalFetch = globalThis.fetch;
          globalThis.fetch = async (url, options) => {
            assert.ok(String(url).startsWith("https://demo.myshopify.com/"));
            const query = JSON.parse(options.body).query;
            return Response.json({
              data: query.includes("orders(first")
                ? { orders: conn([{ id: shop.id }]) }
                : { order: shop },
            });
          };
          try {
            await tick(async () => {});
            assert.equal(
              (
                await pool.query(
                  "SELECT id FROM billing_documents WHERE order_id='987'",
                )
              ).rows.length,
              0,
            );
            shop.transactions[0].processedAt = new Date(
              Date.now() + 1000,
            ).toISOString();
            await tick(async () => {});
            await tick(async () => {});
            const original = (
              await pool.query(
                "SELECT * FROM billing_documents WHERE order_id='987' AND parent_id IS NULL",
              )
            ).rows;
            assert.equal(original.length, 1);
            await pool.query(
              "UPDATE billing_documents SET state='accepted',folio=202,email_state='sent' WHERE id=$1",
              [original[0].id],
            );
            shop.displayFinancialStatus = "PARTIALLY_REFUNDED";
            shop.refunds = [
              {
                id: "gid://shopify/Refund/900",
                transactions: conn([
                  { kind: "REFUND", status: "SUCCESS", amountSet: money(1190) },
                ]),
                refundLineItems: conn([
                  {
                    lineItem: { name: "Producto" },
                    quantity: 1,
                    subtotalSet: money(1000),
                    totalTaxSet: money(190),
                  },
                ]),
                refundShippingLines: conn([]),
              },
            ];
            await tick(async () => {});
            await tick(async () => {});
            const notes = (
              await pool.query(
                "SELECT * FROM billing_documents WHERE parent_id=$1",
                [original[0].id],
              )
            ).rows;
            assert.equal(notes.length, 1);
            assert.equal(notes[0].type, 61);
            assert.equal(notes[0].refund_id, "900");
            assert.equal(Number(notes[0].amount), 1190);
          } finally {
            globalThis.fetch = originalFetch;
          }
        },
      );
    } finally {
      await pool.end();
    }
  },
);
