import {
  pool,
  settings,
  issue,
  adjustment,
  processDocument,
  event,
} from "./ledger.ts";
import { storeConnection, readOrder, orderPage } from "./stores.ts";
import { emailDocument } from "./api.ts";
import { ModuleError } from "../modules/security.ts";
export async function tick(process = processDocument) {
  const installs = await pool.query(
    "SELECT i.workspace_id FROM module_installations i JOIN module_grants g ON g.workspace_id=i.workspace_id AND g.module_id=i.module_id AND g.enabled=true WHERE i.module_id='billing-cl' AND i.enabled=true ORDER BY i.workspace_id",
  );
  for (const { workspace_id: tenant } of installs.rows) {
    const lock = await pool.connect();
    try {
      if (
        !(
          await lock.query("SELECT pg_try_advisory_lock($1,$2) AS acquired", [
            327020,
            tenant,
          ])
        ).rows[0].acquired
      )
        continue;
      const connections = (
        await lock.query(
          "SELECT id,provider,credentials FROM integrations WHERE workspace_id=$1 AND provider IN('woo','shopify','payload')",
          [tenant],
        )
      ).rows;
      if (connections.length !== 1) continue;
      const store = storeConnection(connections[0]),
        c = await settings(tenant);
      const legacy =
        store.provider === "woo" &&
        (
          await lock.query(
            "SELECT id FROM module_installations WHERE workspace_id=$1 AND module_id='woo-dte-chile'",
            [tenant],
          )
        ).rows.length > 0;
      if (legacy) {
        await event(lock, tenant, null, "migration_required");
        continue;
      }
      if (c.automaticIssue || c.automaticRefunds) {
        await lock.query(
          "INSERT INTO billing_sync(workspace_id,store_key,connection_id) VALUES($1,$2,$3) ON CONFLICT(workspace_id,store_key) DO UPDATE SET activated_at=CASE WHEN billing_sync.connection_id<>EXCLUDED.connection_id THEN now() ELSE billing_sync.activated_at END,cursor=CASE WHEN billing_sync.connection_id<>EXCLUDED.connection_id THEN NULL ELSE billing_sync.cursor END,connection_id=EXCLUDED.connection_id",
          [tenant, store.key, store.connectionId],
        );
        const progress = (
          await lock.query(
            "SELECT * FROM billing_sync WHERE workspace_id=$1 AND store_key=$2",
            [tenant, store.key],
          )
        ).rows[0];
        const cursor = progress.cursor;
        const page = await orderPage(store, cursor);
        let error = "";
        for (const id of page.ids) {
          try {
            const order = await readOrder(store, id);
            let original = (
              await lock.query(
                "SELECT * FROM billing_documents WHERE workspace_id=$1 AND store_key=$2 AND order_id=$3 AND parent_id IS NULL AND environment=$4 AND issuer=$5",
                [tenant, store.key, id, c.issuer.environment, c.issuer.rut],
              )
            ).rows[0];
            if (!original && c.automaticIssue) {
              // Never recreate a sale solely to credit a historical refund.
              if (
                order.refunds.length ||
                order.cancelled ||
                !Number.isFinite(Date.parse(order.paidAt)) ||
                Date.parse(order.paidAt) < Date.parse(progress.activated_at)
              )
                continue;
              const receiver = (
                await lock.query(
                  "SELECT type FROM billing_receivers WHERE workspace_id=$1 AND store_key=$2 AND order_id=$3",
                  [tenant, store.key, id],
                )
              ).rows[0];
              original = await issue(
                tenant,
                store,
                order,
                receiver?.type || 39,
                c,
              );
            }
            if (original && c.automaticRefunds)
              for (const refund of order.refunds)
                await adjustment(
                  tenant,
                  store,
                  {
                    documentId: original.id,
                    type: 61,
                    amount: refund.amount,
                    reason: (
                      "Devolución " +
                      store.provider +
                      " #" +
                      refund.id
                    ).slice(0, 90),
                    cancel: refund.amount === Number(original.amount),
                    kind: "return",
                    operationKey: "refund:" + refund.id,
                    lines: refund.lines,
                  },
                  c,
                  refund.id,
                );
          } catch (e) {
            if (
              e instanceof ModuleError &&
              e.message === "El pedido no tiene pago confirmado."
            )
              continue;
            error =
              e instanceof ModuleError
                ? e.message
                : "Pedido pendiente de revisión";
            await event(lock, tenant, null, "source_order_review", {
              provider: store.provider,
              orderId: id,
              error,
            });
          }
        }
        await lock.query(
          "UPDATE billing_sync SET cursor=$3,error=$4,updated_at=now() WHERE workspace_id=$1 AND store_key=$2",
          [tenant, store.key, page.next, error],
        );
      }
      const docs = (
        await lock.query(
          "SELECT id FROM billing_documents WHERE workspace_id=$1 AND state IN('queued','retry','signed','sending','submitted','uncertain','received_unconfirmed') AND next_run<=now() ORDER BY next_run LIMIT 10",
          [tenant],
        )
      ).rows;
      for (const doc of docs) await process(tenant, doc.id, store, c);
      const mail = (
        await lock.query(
          "SELECT id FROM billing_documents WHERE workspace_id=$1 AND state IN('accepted','accepted_with_repair') AND email_state='pending' LIMIT 5",
          [tenant],
        )
      ).rows;
      for (const d of mail)
        try {
          await emailDocument(tenant, d.id, c);
        } catch {}
    } catch (e) {
      await event(lock, tenant, null, "worker_error", {
        message: e instanceof ModuleError ? e.message : "Error interno",
      });
    } finally {
      await lock.query("SELECT pg_advisory_unlock($1,$2)", [327020, tenant]);
      lock.release();
    }
  }
}
