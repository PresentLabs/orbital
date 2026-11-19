import { moduleGranted } from "../modules/grants.ts";
import type { PayloadRequest } from "payload";
import { isAdmin } from "../permissions.ts";
import { ModuleError, seal } from "../modules/security.ts";
import { activeStore, readOrder, orderId, orderPage } from "./stores.ts";
import { engine } from "./bridge.ts";
import {
  pool,
  decode,
  settings,
  transaction,
  event,
  issue,
  adjustment,
  importCaf,
  publicDocument,
  file,
  type Settings,
} from "./ledger.ts";
export const billingManifest = {
  id: "billing-cl",
  name: "Facturación propia · Chile",
  version: "0.3.0",
  description:
    "Documentos tributarios de la tienda conectada: Shopify, WooCommerce o Payload.",
  requires: ["connected-store"],
  documents: [39, 33, 61, 56],
  certification:
    "Requiere validación oficial en Certificación SII. No certificado para producción.",
};
const tenantId = (req: any) =>
  Number(
    typeof req.user?.workspace === "object"
      ? req.user.workspace.id
      : req.user?.workspace,
  );
const json = (data: any, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function billingCatalog(req: PayloadRequest) {
  const tenant = tenantId(req);
  const found = await req.payload.find({
    collection: "module-installations",
    where: {
      and: [
        { workspace: { equals: tenant } },
        { moduleId: { equals: "billing-cl" } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  });
  const row = found.docs[0];
  let store = null;
  try {
    const s = await activeStore(req);
    store = { provider: s.provider, origin: s.origin, key: s.key };
  } catch {}
  return {
    ...billingManifest,
    installed: !!row,
    enabled: !!row?.enabled,
    granted: await moduleGranted(req, "billing-cl"),
    installedVersion: row?.version || null,
    store,
  };
}
export async function billingEndpoint(req: PayloadRequest, body: any) {
  try {
    const tenant = tenantId(req);
    if (
      !isAdmin(req.user) ||
      !tenant ||
      !req.headers.get("authorization")?.startsWith("JWT ")
    )
      throw new ModuleError(
        "Solo administradores autenticados del negocio.",
        403,
      );
    if (JSON.stringify(body).length > 10000000)
      throw new ModuleError("Solicitud demasiado grande.", 413);
    const row = (
      await req.payload.find({
        collection: "module-installations",
        where: {
          and: [
            { workspace: { equals: tenant } },
            { moduleId: { equals: "billing-cl" } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
    ).docs[0];
    if (body.action === "disable")
      throw new ModuleError("La activación de módulos se gestiona en Administración SaaS.", 403);
    if (!["history", "file"].includes(body.action) && !(await moduleGranted(req, "billing-cl")))
      throw new ModuleError("El dueño del SaaS debe activar Facturación para este negocio.", 403);
    if (row && body.action === "history")
      return json(
        (
          await pool.query(
            "SELECT * FROM billing_documents WHERE workspace_id=$1 ORDER BY id DESC LIMIT 100",
            [tenant],
          )
        ).rows.map(publicDocument),
      );
    if (row && body.action === "file") {
      const id = Number(body.documentId);
      if (!Number.isSafeInteger(id) || id < 1)
        throw new ModuleError("Documento inválido.");
      return json(await file(tenant, id, body.format, decode(row.credentials)));
    }
    const store = await activeStore(req);
    if (
      ["install", "issue", "fiscal", "adjust"].includes(body.action) &&
      body.expectedStoreKey !== store.key
    )
      throw new ModuleError(
        "La tienda activa cambió. Actualiza el catálogo antes de continuar.",
        409,
      );
    if (body.action === "install") {
      const previous: Settings | undefined = row
        ? decode(row.credentials)
        : undefined;
      const issuer: Record<string, any> = {};
      for (const key of [
        "environment",
        "rut",
        "sender",
        "name",
        "giro",
        "activity",
        "address",
        "commune",
        "sii_office",
        "resolution_date",
        "resolution_number",
        "production_confirmation",
        "evidence",
      ])
        issuer[key] = String(body.issuer?.[key] || "");
      const certificate =
        typeof body.certificate === "string" && body.certificate
          ? body.certificate
          : previous?.certificate || "";
      const password = body.certificate
        ? String(body.password || "")
        : previous?.password || "";
      if (
        !certificate ||
        certificate.length > 8000000 ||
        !/^[A-Za-z0-9+/=\r\n]+$/.test(certificate)
      )
        throw new ModuleError("Carga un certificado PKCS#12 válido.");
      // Existing Woo emitters cannot be silently switched: their ledger/folios live elsewhere.
      if (store.provider === "woo") {
        const legacy = await req.payload.find({
          collection: "module-installations",
          where: {
            and: [
              { workspace: { equals: tenant } },
              { moduleId: { equals: "woo-dte-chile" } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        });
        if (legacy.docs.length)
          throw new ModuleError(
            "Este negocio tiene una instalación fiscal antigua en WordPress. Migra y concilia su historial/folios antes de habilitar el motor nativo para esa tienda.",
            409,
          );
      }
      if (body.confirmSoleEmitter !== true)
        throw new ModuleError(
          "Confirma que ningún otro sistema emite DTE para estos pedidos.",
        );
      const valid = await engine({
        action: "validate",
        tenant,
        issuer,
        certificate,
        password,
      });
      const data = {
        workspace: tenant,
        workspaceKey: tenant + ":billing-cl",
        moduleId: "billing-cl",
        version: "0.3.0",
        enabled: true,
        credentials: seal({
          issuer: valid.issuer,
          certificate,
          password,
          automaticIssue: body.automaticIssue === true,
          automaticRefunds: body.automaticRefunds === true,
        }),
      };
      if (row)
        await req.payload.update({
          collection: "module-installations",
          id: row.id,
          data,
          overrideAccess: true,
          req,
        });
      else
        await req.payload.create({
          collection: "module-installations",
          data,
          overrideAccess: true,
          req,
        });
      await pool.query(
        "INSERT INTO billing_sync(workspace_id,store_key,connection_id) VALUES($1,$2,$3) ON CONFLICT(workspace_id,store_key) DO UPDATE SET activated_at=CASE WHEN billing_sync.connection_id<>EXCLUDED.connection_id THEN now() ELSE billing_sync.activated_at END,connection_id=EXCLUDED.connection_id",
        [tenant, store.key, store.connectionId],
      );
      await event(pool, tenant, null, "configured", {
        provider: store.provider,
        environment: issuer.environment,
      });
      return json({ installed: true, enabled: true, provider: store.provider });
    }
    if (!row || (body.action !== "status" && !row.enabled))
      throw new ModuleError("Activa Facturación propia primero.", 409);
    const c: Settings = decode(row.credentials);
    if (body.action === "orders")
      return json(
        await orderPage(store, body.cursor ? String(body.cursor) : null),
      );
    if (body.action === "status") {
      const cafs = await pool.query(
        "SELECT type,environment,first_folio,last_folio,next_folio,expires FROM billing_cafs WHERE workspace_id=$1 ORDER BY id",
        [tenant],
      );
      const sync = await pool.query(
        "SELECT error,updated_at FROM billing_sync WHERE workspace_id=$1 AND store_key=$2",
        [tenant, store.key],
      );
      return json({
        provider: store.provider,
        origin: store.origin,
        environment: c.issuer.environment,
        automaticIssue: c.automaticIssue,
        automaticRefunds: c.automaticRefunds,
        issuer: c.issuer,
        cafs: cafs.rows,
        sync: sync.rows[0] || null,
        productionUnlocked: c.issuer.environment === "production",
        siiCertificationVerified: false,
      });
    }
    if (body.action === "caf")
      return json(await importCaf(tenant, String(body.xml || ""), c));
    if (body.action === "documents")
      return json(
        (
          await pool.query(
            "SELECT * FROM billing_documents WHERE workspace_id=$1 AND store_key=$2 AND order_id=$3 ORDER BY id",
            [tenant, store.key, orderId(body.orderId)],
          )
        ).rows.map(publicDocument),
      );
    if (body.action === "history")
      return json(
        (
          await pool.query(
            "SELECT * FROM billing_documents WHERE workspace_id=$1 ORDER BY id DESC LIMIT 100",
            [tenant],
          )
        ).rows.map(publicDocument),
      );
    if (
      store.provider === "woo" &&
      ["issue", "adjust", "fiscal"].includes(body.action)
    ) {
      const legacy = await req.payload.find({
        collection: "module-installations",
        where: {
          and: [
            { workspace: { equals: tenant } },
            { moduleId: { equals: "woo-dte-chile" } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      });
      if (legacy.docs.length)
        throw new ModuleError(
          "Conciliar el historial WordPress antes de emitir con el motor nativo.",
          409,
        );
    }
    if (body.action === "issue")
      return json(
        publicDocument(
          await issue(
            tenant,
            store,
            await readOrder(store, body.orderId),
            Number(body.type),
            c,
          ),
        ),
      );
    if (body.action === "fiscal") {
      const order = await readOrder(store, body.orderId);
      const type = Number(body.type);
      if (![33, 39].includes(type)) throw new ModuleError("Tipo inválido.");
      const snapshot = await engine({
        action: "snapshot",
        tenant,
        issuer: c.issuer,
        snapshot: {
          type,
          receiver: body.receiver,
          lines: order.lines,
          email: order.email,
        },
      });
      await transaction(
        tenant,
        "order:" + store.key + ":" + order.id,
        async (db) => {
          if (
            (
              await db.query(
                "SELECT id FROM billing_documents WHERE workspace_id=$1 AND store_key=$2 AND order_id=$3",
                [tenant, store.key, order.id],
              )
            ).rows.length
          )
            throw new ModuleError(
              "Los datos están congelados desde el primer DTE.",
              409,
            );
          await db.query(
            "INSERT INTO billing_receivers(workspace_id,store_key,order_id,type,receiver) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,store_key,order_id) DO UPDATE SET type=EXCLUDED.type,receiver=EXCLUDED.receiver",
            [tenant, store.key, order.id, type, seal(snapshot.receiver)],
          );
        },
      );
      return json({ saved: true });
    }
    if (body.action === "adjust")
      return json(publicDocument(await adjustment(tenant, store, body, c)));
    const id = Number(body.documentId);
    if (!Number.isSafeInteger(id) || id < 1)
      throw new ModuleError("Documento inválido.");
    const d = (
      await pool.query(
        "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2",
        [tenant, id],
      )
    ).rows[0];
    if (!d) throw new ModuleError("Documento no encontrado.", 404);
    if (body.action === "file")
      return json(await file(tenant, id, body.format, c));
    if (body.action === "retry") {
      if (["accepted", "accepted_with_repair", "rejected"].includes(d.state))
        throw new ModuleError(
          "Documento finalizado; no se vuelve a emitir.",
          409,
        );
      const state = d.xml
        ? d.track_id
          ? "submitted"
          : ["uncertain", "sending", "review", "received_unconfirmed"].includes(
                d.state,
              )
            ? "uncertain"
            : "signed"
        : "queued";
      await pool.query(
        "UPDATE billing_documents SET state=$1,attempts=0,next_run=now() WHERE workspace_id=$2 AND id=$3",
        [state, tenant, id],
      );
      await event(pool, tenant, id, "manual_retry");
      return json({ scheduled: true });
    }
    if (body.action === "email")
      return json(await emailDocument(tenant, id, c));
    throw new ModuleError("Operación no admitida.");
  } catch (e) {
    return json(
      {
        error:
          e instanceof ModuleError
            ? e.message
            : "No se pudo completar la operación fiscal. Revisa la configuración.",
      },
      e instanceof ModuleError ? e.status : 503,
    );
  }
}
export async function emailDocument(tenant: number, id: number, c: Settings) {
  const recipient = await transaction(tenant, "email:" + id, async (db) => {
    const d = (
      await db.query(
        "SELECT * FROM billing_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
        [tenant, id],
      )
    ).rows[0];
    if (!d || !["accepted", "accepted_with_repair"].includes(d.state))
      throw new ModuleError("Solo se envían documentos aceptados.");
    if (d.email_state !== "pending") return null;
    const target =
      d.environment === "production"
        ? decode(d.snapshot).email
        : process.env.BILLING_TEST_EMAIL;
    if (
      !target ||
      !/^\S+@\S+\.\S+$/.test(target) ||
      !process.env.RESEND_API_KEY ||
      !process.env.INVITATION_FROM
    )
      throw new ModuleError(
        "Configura correo de salida y destinatario de certificación.",
      );
    await db.query(
      "UPDATE billing_documents SET email_state='sending' WHERE id=$1",
      [id],
    );
    return target;
  });
  if (!recipient) return { requested: false };
  try {
    const xml = await file(tenant, id, "xml", c),
      pdf = await file(tenant, id, "pdf", c);
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": `billing-${tenant}-${id}`,
      },
      body: JSON.stringify({
        from: process.env.INVITATION_FROM,
        to: [recipient],
        subject: "Documento tributario electrónico",
        text: "Adjuntamos el documento tributario y su representación PDF.",
        attachments: [xml, pdf].map((f) => ({
          filename: f.filename,
          content: f.base64,
        })),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!result.ok) throw new ModuleError("Correo no confirmado.");
    await pool.query(
      "UPDATE billing_documents SET email_state='sent' WHERE workspace_id=$1 AND id=$2",
      [tenant, id],
    );
    await event(pool, tenant, id, "mail_accepted");
    return { requested: true };
  } catch {
    await event(pool, tenant, id, "mail_uncertain");
    throw new ModuleError(
      "Entrega de correo incierta; revisa el proveedor antes de reenviar.",
      503,
    );
  }
}
