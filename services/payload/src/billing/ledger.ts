import { Pool, type PoolClient } from "pg";
import { createHash } from "node:crypto";
import {
  seal,
  unseal,
  ModuleError,
  operationKey,
} from "../modules/security.ts";
import { engine } from "./bridge.ts";
import {
  readOrder,
  storeConnection,
  type Store,
  type Order,
  pesos,
} from "./stores.ts";
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
export const decode = (value: string): any => unseal(value);
export type Settings = {
  issuer: Record<string, any>;
  certificate: string;
  password: string;
  automaticIssue: boolean;
  automaticRefunds: boolean;
};
export const digest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
            )
          : v,
      ) ?? "null",
    )
    .digest("hex");
export const publicDocument = (d: any) =>
  Object.fromEntries(
    [
      "id",
      "order_id",
      "provider",
      "store_key",
      "refund_id",
      "parent_id",
      "environment",
      "type",
      "folio",
      "amount",
      "state",
      "track_id",
      "last_code",
      "email_state",
      "created_at",
      "updated_at",
    ].map((k) => [k, d[k]]),
  );
export async function transaction<T>(
  tenant: number,
  key: string,
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      tenant + ":" + key,
    ]);
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function settings(tenant: number): Promise<Settings> {
  const r = await pool.query(
    "SELECT credentials FROM module_installations WHERE workspace_id=$1 AND module_id='billing-cl' AND enabled=true",
    [tenant],
  );
  if (!r.rows[0])
    throw new ModuleError("Activa Facturación propia primero.", 409);
  return decode(r.rows[0].credentials);
}
export async function event(
  db: any,
  tenant: number,
  id: number | null,
  code: string,
  detail: any = {},
) {
  await db.query(
    "INSERT INTO billing_events(workspace_id,document_id,code,detail) VALUES($1,$2,$3,$4)",
    [tenant, id, code, seal(detail)],
  );
}
async function insert(
  db: PoolClient,
  tenant: number,
  store: Store,
  order: string,
  key: string,
  snapshot: any,
  parent: number | null = null,
  refund = "",
) {
  const rows = await db.query(
    "SELECT * FROM billing_documents WHERE workspace_id=$1 AND op_key=$2",
    [tenant, key],
  );
  if (rows.rows[0]) {
    const old = decode(rows.rows[0].snapshot);
    for (const k of [
      "type",
      "lines",
      "receiver",
      "reference",
      "no_vat_reduction",
      "reason_kind",
    ])
      if (digest(old[k]) !== digest(snapshot[k]))
        throw new ModuleError(
          "La clave corresponde a una operación distinta.",
          409,
        );
    return rows.rows[0];
  }
  const d = await db.query(
    "INSERT INTO billing_documents(workspace_id,store_key,provider,order_id,refund_id,parent_id,op_key,environment,issuer,type,amount,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    [
      tenant,
      store.key,
      store.provider,
      order,
      refund,
      parent,
      key,
      snapshot.issuer.environment,
      snapshot.issuer.rut,
      snapshot.type,
      snapshot.totals.total,
      seal(snapshot),
    ],
  );
  await event(db, tenant, d.rows[0].id, "created", {
    provider: store.provider,
    order,
    refund,
    parent,
  });
  return d.rows[0];
}
async function assertActive(db: PoolClient, tenant: number, store: Store) {
  const rows = (
    await db.query(
      "SELECT id,provider,credentials FROM integrations WHERE workspace_id=$1 AND provider IN('woo','shopify','payload') FOR SHARE",
      [tenant],
    )
  ).rows;
  if (
    rows.length !== 1 ||
    storeConnection(rows[0]).key !== store.key ||
    String(rows[0].id) !== store.connectionId
  )
    throw new ModuleError("La tienda activa cambió durante la operación.", 409);
}
export async function issue(
  tenant: number,
  store: Store,
  order: Order,
  type: number,
  c: Settings,
) {
  if (c.issuer.environment === "production" && order.testPayment)
    throw new ModuleError("Un pago de prueba no se emite en producción.");
  if (![33, 39].includes(type) || !order.paid || order.cancelled)
    throw new ModuleError("Tipo inválido o pedido sin pago.", 409);
  return transaction(
    tenant,
    "order:" + store.key + ":" + order.id,
    async (db) => {
      await assertActive(db, tenant, store);
      const key = digest([
        c.issuer.environment,
        c.issuer.rut,
        store.key,
        "order",
        order.id,
      ]);
      const old = (
        await db.query(
          "SELECT * FROM billing_documents WHERE workspace_id=$1 AND op_key=$2",
          [tenant, key],
        )
      ).rows[0];
      if (old) {
        if (old.type !== type)
          throw new ModuleError("El pedido ya tiene otro tipo de DTE.", 409);
        return old;
      }
      const fiscal = (
        await db.query(
          "SELECT * FROM billing_receivers WHERE workspace_id=$1 AND store_key=$2 AND order_id=$3",
          [tenant, store.key, order.id],
        )
      ).rows[0];
      if (fiscal && fiscal.type !== type)
        throw new ModuleError(
          "El tipo no coincide con los datos tributarios guardados.",
          409,
        );
      const snapshot = await engine({
        action: "snapshot",
        tenant,
        issuer: c.issuer,
        snapshot: {
          type,
          receiver: fiscal ? decode(fiscal.receiver) : order.receiver,
          lines: order.lines,
          email: order.email,
          source: {
            provider: store.provider,
            storeKey: store.key,
            orderId: order.id,
          },
        },
      });
      if (snapshot.totals.total !== order.total)
        throw new ModuleError("El total no concilia con la tienda.");
      return insert(db, tenant, store, order.id, key, snapshot);
    },
  );
}
export async function adjustment(
  tenant: number,
  store: Store,
  input: any,
  c: Settings,
  refund = "",
) {
  const id = Number(input.documentId);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ModuleError("Documento inválido.");
  const original = (
    await pool.query(
      "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2",
      [tenant, id],
    )
  ).rows[0];
  if (!original || original.store_key !== store.key)
    throw new ModuleError("Documento de otra tienda o negocio.", 404);
  const type = Number(input.type),
    amount = pesos(input.amount),
    cancel = input.cancel === true,
    key = operationKey(input.operationKey);
  if (
    typeof input.cancel !== "boolean" ||
    ![56, 61].includes(type) ||
    !amount ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 90 ||
    !["return", "amount_correction"].includes(input.kind)
  )
    throw new ModuleError("Ajuste inválido.");
  return transaction(
    tenant,
    "order:" + store.key + ":" + original.order_id,
    async (db) => {
      await assertActive(db, tenant, store);
      const d = (
        await db.query(
          "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
          [tenant, id],
        )
      ).rows[0];
      if (d.issuer !== c.issuer.rut || d.environment !== c.issuer.environment)
        throw new ModuleError("Cambia al emisor y ambiente del original.", 409);
      const s = decode(d.snapshot);
      let lines = input.lines;
      if (cancel) lines = s.lines;
      if (!lines?.length) {
        if (s.totals.exempt && s.totals.net)
          throw new ModuleError("Indica líneas afectas y exentas del ajuste.");
        lines = [{ name: input.reason, amount, exempt: !s.totals.net }];
      }
      const snapshot = {
        ...s,
        type,
        lines,
        no_vat_reduction: input.no_vat_reduction === true,
        reason_kind: input.kind,
        reference: {
          type: d.type,
          folio: Number(d.folio),
          date: s.date,
          code: cancel ? 1 : 3,
          reason: input.reason,
        },
      };
      const validated = await engine({
        action: "snapshot",
        tenant,
        issuer: c.issuer,
        snapshot,
      });
      if (validated.totals.total !== amount)
        throw new ModuleError("Detalle del ajuste no concilia.");
      const operation = digest([
        d.environment,
        d.issuer,
        store.key,
        "adjust",
        d.order_id,
        key,
      ]);
      const previous = (
        await db.query(
          "SELECT id FROM billing_documents WHERE workspace_id=$1 AND op_key=$2",
          [tenant, operation],
        )
      ).rows[0];
      if (previous)
        return insert(
          db,
          tenant,
          store,
          d.order_id,
          operation,
          validated,
          id,
          refund,
        );
      if (!["accepted", "accepted_with_repair"].includes(d.state))
        throw new ModuleError("El original debe estar aceptado por SII.", 409);
      if (type === 61) {
        if (![33, 39, 56].includes(d.type))
          throw new ModuleError("NC requiere factura, boleta o ND.");
        if (d.type === 39 && !cancel && input.kind === "amount_correction")
          throw new ModuleError(
            "Corrección de boleta: anula y emite una nueva.",
          );
        const credited = Number(
          (
            await db.query(
              "SELECT COALESCE(SUM(amount),0) AS total FROM billing_documents WHERE workspace_id=$1 AND parent_id=$2 AND type=61",
              [tenant, id],
            )
          ).rows[0].total,
        );
        if (
          amount > Number(d.amount) - credited ||
          (cancel && (credited !== 0 || amount !== Number(d.amount)))
        )
          throw new ModuleError(
            "La NC supera el saldo o no permite anulación completa.",
            409,
          );
      } else {
        if (![33, 61].includes(d.type) || input.no_vat_reduction)
          throw new ModuleError("ND requiere factura o anulación de NC.");
        if (d.type === 61) {
          if (
            !cancel ||
            amount !== Number(d.amount) ||
            (
              await db.query(
                "SELECT id FROM billing_documents WHERE workspace_id=$1 AND parent_id=$2 AND type=56",
                [tenant, id],
              )
            ).rows.length
          )
            throw new ModuleError("Anulación de NC inválida o ya registrada.");
        } else if (cancel)
          throw new ModuleError(
            "Una ND de factura corrige montos; no anula la factura.",
          );
      }
      return insert(
        db,
        tenant,
        store,
        d.order_id,
        operation,
        validated,
        id,
        refund,
      );
    },
  );
}
export async function importCaf(tenant: number, xml: string, c: Settings) {
  const caf = await engine({ action: "caf", tenant, issuer: c.issuer, xml });
  return transaction(0, "caf:" + c.issuer.rut, async (db) => {
    if (
      (
        await db.query(
          "SELECT id FROM billing_cafs WHERE issuer=$1 AND environment=$2 AND type=$3 AND first_folio<=$4 AND last_folio>=$5",
          [c.issuer.rut, c.issuer.environment, caf.type, caf.end, caf.start],
        )
      ).rows.length
    )
      throw new ModuleError(
        "El rango CAF ya está registrado o se superpone.",
        409,
      );
    await db.query(
      "INSERT INTO billing_cafs(workspace_id,issuer,environment,type,first_folio,last_folio,next_folio,expires,secret) VALUES($1,$2,$3,$4,$5,$6,$5,$7,$8)",
      [
        tenant,
        c.issuer.rut,
        c.issuer.environment,
        caf.type,
        caf.start,
        caf.end,
        caf.expires,
        seal({ xml }),
      ],
    );
    await event(db, tenant, null, "caf_imported", {
      type: caf.type,
      first: caf.start,
      last: caf.end,
    });
    return { imported: true, type: caf.type };
  });
}
export async function processDocument(
  tenant: number,
  id: number,
  store: Store,
  c: Settings,
  runEngine = engine,
) {
  const lock = await pool.connect();
  try {
    if (
      !(
        await lock.query("SELECT pg_try_advisory_lock($1,$2) AS acquired", [
          327019,
          id,
        ])
      ).rows[0].acquired
    )
      return;
    let d = (
      await lock.query(
        "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2",
        [tenant, id],
      )
    ).rows[0];
    if (
      !d ||
      ![
        "queued",
        "retry",
        "signed",
        "sending",
        "submitted",
        "uncertain",
        "received_unconfirmed",
      ].includes(d.state) ||
      Date.parse(d.next_run) > Date.now()
    )
      return;
    try {
      if (d.issuer !== c.issuer.rut || d.environment !== c.issuer.environment)
        throw new ModuleError("Emisor/ambiente cambió; cola pausada.", 409);
      await runEngine({ action: "validate", tenant, issuer: c.issuer });
      await lock.query(
        "UPDATE billing_documents SET attempts=attempts+1 WHERE id=$1",
        [id],
      );
      let snapshot = decode(d.snapshot);
      if (!d.xml) {
        if (d.store_key !== store.key)
          throw new ModuleError(
            "La tienda del documento ya no está conectada.",
            409,
          );
        if (!d.parent_id) {
          const order = await readOrder(store, d.order_id);
          if (
            (c.issuer.environment === "production" && order.testPayment) ||
            order.cancelled ||
            order.total !== Number(d.amount) ||
            digest(order.lines) !== digest(snapshot.lines)
          )
            throw new ModuleError(
              "El pedido cambió antes de emitir; requiere revisión.",
              409,
            );
        }
        d = await transaction(
          tenant,
          "folio:" + d.issuer + ":" + d.type,
          async (db) => {
            await assertActive(db, tenant, store);
            let row = (
              await db.query(
                "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
                [tenant, id],
              )
            ).rows[0];
            if (!row.folio) {
              const caf = (
                await db.query(
                  "SELECT * FROM billing_cafs WHERE workspace_id=$1 AND issuer=$2 AND environment=$3 AND type=$4 AND next_folio<=last_folio AND expires>=CURRENT_DATE ORDER BY expires,id LIMIT 1 FOR UPDATE",
                  [tenant, d.issuer, d.environment, d.type],
                )
              ).rows[0];
              if (!caf) throw new ModuleError("No hay CAF vigente disponible.");
              await db.query(
                "UPDATE billing_cafs SET next_folio=next_folio+1 WHERE id=$1",
                [caf.id],
              );
              row = (
                await db.query(
                  "UPDATE billing_documents SET folio=$1,caf_id=$2 WHERE id=$3 RETURNING *",
                  [caf.next_folio, caf.id, id],
                )
              ).rows[0];
              await event(db, tenant, id, "folio_reserved", {
                folio: row.folio,
              });
            }
            return row;
          },
        );
        const caf = (
          await lock.query(
            "SELECT secret FROM billing_cafs WHERE workspace_id=$1 AND id=$2",
            [tenant, d.caf_id],
          )
        ).rows[0];
        const built = await runEngine({
          action: "build",
          tenant,
          issuer: c.issuer,
          certificate: c.certificate,
          password: c.password,
          snapshot,
          folio: Number(d.folio),
          caf: decode(caf.secret).xml,
        });
        snapshot.date = built.date;
        const hash = createHash("sha256")
          .update(Buffer.from(built.xml, "base64"))
          .digest("hex");
        d = (
          await lock.query(
            "UPDATE billing_documents SET xml=$1,ted=$2,xml_hash=$3,snapshot=$4,state='signed',updated_at=now() WHERE id=$5 RETURNING *",
            [
              seal({ base64: built.xml }),
              seal({ base64: built.ted }),
              hash,
              seal(snapshot),
              id,
            ],
          )
        ).rows[0];
      }
      const base = {
        tenant,
        issuer: c.issuer,
        certificate: c.certificate,
        password: c.password,
        document: d,
        snapshot,
      };
      if (
        ["sending", "submitted", "uncertain", "received_unconfirmed"].includes(
          d.state,
        )
      ) {
        const status = await runEngine({ ...base, action: "status" });
        const terminal = [
          "accepted",
          "accepted_with_repair",
          "rejected",
        ].includes(status.state);
        const state = !terminal && d.attempts >= 16 ? "review" : status.state;
        await lock.query(
          "UPDATE billing_documents SET state=$1,last_code=$2,next_run=now()+interval '10 minutes',updated_at=now() WHERE id=$3",
          [state, status.code, id],
        );
        await event(lock, tenant, id, "sii_status", status);
      } else {
        const xml = decode(d.xml).base64;
        if (
          createHash("sha256")
            .update(Buffer.from(xml, "base64"))
            .digest("hex") !== d.xml_hash
        )
          throw new ModuleError("Huella XML inválida.");
        await lock.query(
          "UPDATE billing_documents SET state='sending',next_run=now()+interval '10 minutes' WHERE id=$1",
          [id],
        );
        d.state = "sending";
        const sent = await runEngine({ ...base, action: "send", xml });
        await lock.query(
          "UPDATE billing_documents SET state='submitted',track_id=$1,attempts=0,next_run=now()+interval '10 minutes',updated_at=now() WHERE id=$2",
          [sent.track, id],
        );
        await event(lock, tenant, id, "sii_upload", sent);
      }
    } catch (e) {
      const current = (
        await lock.query("SELECT * FROM billing_documents WHERE id=$1", [id])
      ).rows[0];
      const ambiguous = [
        "sending",
        "submitted",
        "uncertain",
        "received_unconfirmed",
      ].includes(current.state);
      const state = ambiguous
        ? current.attempts >= 16
          ? "review"
          : current.track_id
            ? "submitted"
            : "uncertain"
        : e instanceof ModuleError && e.status === 503 && current.attempts < 16
          ? "retry"
          : "blocked";
      await lock.query(
        "UPDATE billing_documents SET state=$1,last_code=$2,next_run=now()+interval '10 minutes',updated_at=now() WHERE id=$3",
        [state, "ACTION_REQUIRED", id],
      );
      await event(lock, tenant, id, "error", {
        message:
          e instanceof ModuleError ? e.message : "Error interno del motor",
      });
    }
  } finally {
    await lock.query("SELECT pg_advisory_unlock($1,$2)", [327019, id]);
    lock.release();
  }
}
export async function file(
  tenant: number,
  id: number,
  format: string,
  c: Settings,
) {
  const d = (
    await pool.query(
      "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2",
      [tenant, id],
    )
  ).rows[0];
  if (!d || !d.xml) throw new ModuleError("Documento no generado.", 404);
  const xml = decode(d.xml).base64;
  if (
    createHash("sha256").update(Buffer.from(xml, "base64")).digest("hex") !==
    d.xml_hash
  )
    throw new ModuleError("Huella XML inválida.");
  if (!["pdf", "xml"].includes(format))
    throw new ModuleError("Formato inválido.");
  const base64 =
    format === "xml"
      ? xml
      : (
          await engine({
            action: "pdf",
            tenant,
            issuer: decode(d.snapshot).issuer,
            document: d,
            snapshot: decode(d.snapshot),
            ted: decode(d.ted).base64,
          })
        ).base64;
  return {
    filename: `DTE-${d.type}-${d.folio}.${format}`,
    mime: format === "xml" ? "application/xml" : "application/pdf",
    base64,
  };
}
