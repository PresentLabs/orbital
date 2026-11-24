import { expirePaymentHolds } from "./holds.ts";
import { prepareCatalogImage } from "./images.ts";
import { schedulingDashboard } from "./dashboard.ts";
import { createHash } from "node:crypto";
import type { Endpoint, PayloadRequest } from "payload";
import { canView, canWrite, isAdmin } from "../permissions.ts";
import { moduleGranted } from "../modules/grants.ts";
import { ModuleError } from "../modules/security.ts";
import { reservationPool, reservationTransaction, audit } from "./store.ts";
import {
  catalogKinds, defaultSettings, integer, validateSettings, validateEntry, selectServiceDuration, selectServiceExtras, normalizeExtraSelection, bookingExtrasChange, validateCategoryLink, validatePackageServices,
  validDay, localInstant, slotAvailable, quote, type CatalogEntry,
} from "./domain.ts";

const workspaceID = (req: PayloadRequest) =>
  Number(typeof req.user?.workspace === "object" ? req.user.workspace.id : req.user?.workspace);
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const numericID = (value: unknown) => integer(Number(value), 1, 2147483647, "el identificador");
const publicBooking = (row: any) => ({
  ...row, fingerprint: undefined, request_key: undefined,
  hold_expires_at: row.hold_expires_at ? new Date(row.hold_expires_at).toISOString() : null,
  amount_minor: Number(row.amount_minor), start_at: new Date(row.start_at).toISOString(),
  end_at: new Date(row.end_at).toISOString(),
});
function bookingService(row: any, entries: CatalogEntry[]) {
  const current = entries.find((entry) => entry.id === row.service_id && entry.kind === "service");
  if (!current) throw new ModuleError("Servicio no disponible.", 404);
  return { ...current, value: { ...current.value,
    durationMinutes: (Date.parse(row.end_at) - Date.parse(row.start_at)) / 60000,
    bufferBefore: row.details.bufferBefore, bufferAfter: row.details.bufferAfter,
    resourceIds: row.details.resourceIds,
  } };
}
function canManage(req: PayloadRequest, row: any, entries: CatalogEntry[]) {
  return isAdmin(req.user) || Number(row.created_by) === Number(req.user!.id) || ownProfessional(req, entries, row.professional_id);
}
async function checkCustomerFutureLimit(client: any, settings: ReturnType<typeof validateSettings>, workspace: number, email: string, excludeId = 0) {
  if (!settings.maxFutureBookingsPerCustomer) return;
  const future = await client.query("SELECT count(*)::integer AS count FROM reservation_bookings WHERE workspace_id=$1 AND customer_email=$2 AND id<>$3 AND status IN ('pending','confirmed') AND start_at>=now()", [workspace, email, excludeId]);
  if (future.rows[0].count >= settings.maxFutureBookingsPerCustomer)
    throw new ModuleError("El cliente alcanzó su máximo de horas futuras. Revisa su agenda antes de agregar otra.", 409);
}
async function configuration(client: any, workspace: number) {
  const result = await client.query("SELECT value,version FROM reservation_settings WHERE workspace_id=$1", [workspace]);
  return { ...validateSettings(result.rows[0]?.value || defaultSettings), version: result.rows[0]?.version || 0 };
}
async function catalog(client: any, workspace: number): Promise<CatalogEntry[]> {
  return (await client.query("SELECT c.id,c.kind,c.name,c.active,c.value,c.version,c.created_at,c.updated_at,(i.catalog_id IS NOT NULL) AS \"hasImage\" FROM reservation_catalog c LEFT JOIN reservation_catalog_images i ON i.catalog_id=c.id AND i.workspace_id=c.workspace_id WHERE c.workspace_id=$1 ORDER BY c.kind,c.name,c.id", [workspace])).rows;
}
async function guard(req: PayloadRequest, write = false) {
  if (!req.user || req.user.disabled) throw new ModuleError("Inicia sesión.", 401);
  if (!(write ? canWrite : canView)(req.user, "calendar")) throw new ModuleError("No tienes permiso para gestionar reservas.", 403);
  if (!req.headers.get("authorization")?.startsWith("JWT ")) throw new ModuleError("Se requiere la sesión de Orbital.", 401);
  if (!(await moduleGranted(req, "reservations"))) throw new ModuleError("El dueño del SaaS debe activar Agendamiento para este negocio.", 403);
}
function ownProfessional(req: PayloadRequest, entries: CatalogEntry[], id: number | null) {
  return isAdmin(req.user) || entries.some((entry) => entry.kind === "professional" && entry.id === id &&
    String(entry.value.userId) === String(req.user!.id));
}
async function relatedEntries(client: any, workspace: number, entry: ReturnType<typeof validateEntry>, editingId?: number) {
  const all = await catalog(client, workspace);
  validateCategoryLink(all, entry.kind, entry.value, editingId);
  if (entry.kind === "package") validatePackageServices(all,entry.value,entry.active);
  if (entry.kind === "service" && entry.value.minExtras > entry.value.extraIds.length) throw new ModuleError("Asigna suficientes extras para cumplir el mínimo del servicio.");
  for (const [field, kind] of [["professionalIds", "professional"], ["locationIds", "location"], ["resourceIds", "resource"], ["extraIds", "extra"]])
    for (const id of entry.value[field] || [])
      if (!all.some((row) => row.id === id && row.kind === kind))
        throw new ModuleError("Una asignación pertenece a otro negocio o ya no está disponible.");
}
export async function reservationsGET(req: PayloadRequest) {
  try {
    await guard(req);
    const workspace = workspaceID(req);
    const url = new URL(req.url!);
    if (url.searchParams.get("action") === "image") {
      const image = (await reservationPool.query("SELECT bytes FROM reservation_catalog_images WHERE workspace_id=$1 AND catalog_id=$2", [workspace,numericID(url.searchParams.get("id"))])).rows[0];
      if (!image) throw new ModuleError("Imagen no disponible.",404);
      return new Response(new Uint8Array(image.bytes),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
    }
    await reservationTransaction(workspace,client=>expirePaymentHolds(client,workspace));
    const settings = await configuration(reservationPool, workspace);
    const entries = await catalog(reservationPool, workspace);
    if (url.searchParams.get("action") === "availability") {
      const day = url.searchParams.get("day");
      if (!validDay(day)) throw new ModuleError("Elige una fecha válida.");
      let service = entries.find((row) => row.id === numericID(url.searchParams.get("service")) && row.kind === "service");
      let rescheduling: any;
      let changedExtras: ReturnType<typeof bookingExtrasChange> | undefined;
      if (url.searchParams.has("booking")) {
        const result = await reservationPool.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND id=$2",
          [workspace, numericID(url.searchParams.get("booking"))]);
        rescheduling = result.rows[0];
        if (!rescheduling || !canManage(req, rescheduling, entries)) throw new ModuleError("Reserva no disponible.", 404);
        if (!["pending", "confirmed"].includes(rescheduling.status) || rescheduling.service_id !== service?.id)
          throw new ModuleError("Esta reserva no admite reprogramación.");
        service = bookingService(rescheduling, entries);
        if (url.searchParams.get("editExtras") === "true") {
          if (!["unpaid", "free"].includes(rescheduling.payment_status)) throw new ModuleError("Los extras de una hora pagada requieren un ajuste a través de la tienda.", 409);
          let selected: unknown;
          try { selected = JSON.parse(url.searchParams.get("extras") || "[]"); } catch { throw new ModuleError("Revisa los extras seleccionados."); }
          changedExtras = bookingExtrasChange(rescheduling, service, entries, selected);
          service = changedExtras.service;
        }
      }
      if (!service) throw new ModuleError("Servicio no disponible.", 404);
      if (!rescheduling) service = selectServiceDuration(service, url.searchParams.has("duration") ? Number(url.searchParams.get("duration")) : undefined);
      if (!rescheduling) {
        let extras: unknown;
        try { extras = JSON.parse(url.searchParams.get("extras") || "[]"); } catch { throw new ModuleError("Revisa los extras seleccionados."); }
        service = selectServiceExtras(service, entries, extras);
      }
      const professionalId = url.searchParams.get("professional") ? numericID(url.searchParams.get("professional")) : null;
      const locationId = url.searchParams.get("location") ? numericID(url.searchParams.get("location")) : null;
      if (!rescheduling && !ownProfessional(req, entries, professionalId)) throw new ModuleError("Selecciona un profesional de tu agenda.", 403);
      const quantity = integer(Number(url.searchParams.get("quantity") || 1), 1, 1000, "los asistentes");
      if (rescheduling && (professionalId !== rescheduling.professional_id || locationId !== rescheduling.location_id || quantity !== rescheduling.quantity))
        throw new ModuleError("Conserva el profesional, sucursal y asistentes de la reserva.");
      const bookings = (await reservationPool.query(
        "SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND start_at >= $2::date - interval '3 days' AND start_at < $2::date + interval '3 days'",
        [workspace, day],
      )).rows;
      const slots = [];
      for (let minute = 0; minute < 1440; minute += settings.intervalMinutes) {
        const time = String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
        try {
          const start = localInstant(day, time, settings.timezone);
          if (slotAvailable({ start, service, professionalId, locationId, quantity, catalog: entries, bookings, settings, excludeId: rescheduling?.id }))
            slots.push({ start: start.toISOString(), time });
        } catch (error) { if (!(error instanceof ModuleError)) throw error; }
      }
      return json({ slots, durationMinutes: service.value.durationMinutes, timezone: settings.timezone, amountMinor: changedExtras ? changedExtras.amountMinor : rescheduling ? Number(rescheduling.amount_minor) : quote(service, quantity), currency: settings.currency });
    }
    if (url.searchParams.get("action") === "booking-details") {
      const found = await reservationPool.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND id=$2", [workspace, numericID(url.searchParams.get("id"))]);
      const row = found.rows[0];
      if (!row || !canManage(req, row, entries)) throw new ModuleError("Hora no disponible.", 404);
      const history = await reservationPool.query("SELECT action,actor_id,created_at,data FROM reservation_audit WHERE workspace_id=$1 AND record_id=$2 AND action IN ('create-booking','booking-status','reschedule-booking','update-booking-extras','payment-hold-expired') ORDER BY id DESC LIMIT 100", [workspace, row.id]);
      return json({ booking: publicBooking(row), history: history.rows });
    }
    if (url.searchParams.get("action") === "dashboard") {
      const days = url.searchParams.get("days") === "30" ? 30 : 7;
      return json({ ...await schedulingDashboard(reservationPool, workspace,
        isAdmin(req.user) ? null : Number(req.user!.id), settings.timezone, days),
        timezone: settings.timezone, currency: settings.currency });
    }
    const page = Math.max(1, Math.min(100000, Math.floor(Number(url.searchParams.get("page")) || 1)));
    const values: any[] = [workspace];
    let scope = "workspace_id=$1";
    if (!isAdmin(req.user)) {
      values.push(req.user!.id);
      scope += " AND (created_by=$2::integer OR professional_id IN (SELECT id FROM reservation_catalog WHERE workspace_id=$1 AND kind='professional' AND value->>'userId'=$2::text))";
    }
    const search = (url.searchParams.get("search") || "").trim().slice(0, 160);
    if (search) {
      values.push("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
      scope += ` AND (customer_name ILIKE $${values.length} OR customer_email ILIKE $${values.length} OR details->>'serviceName' ILIKE $${values.length})`;
    }
    const day = url.searchParams.get("day");
    if (day) {
      if (!validDay(day)) throw new ModuleError("Fecha no válida.");
      values.push(settings.timezone, day);
      scope += ` AND (start_at AT TIME ZONE $${values.length - 1})::date=$${values.length}::date`;
    }
    const total = await reservationPool.query("SELECT count(*)::integer AS count FROM reservation_bookings WHERE " + scope, values);
    const rows = await reservationPool.query(
      "SELECT * FROM reservation_bookings WHERE " + scope + ` ORDER BY start_at DESC,id DESC LIMIT 100 OFFSET $${values.length + 1}`,
      [...values, (page - 1) * 100],
    );
    const members: { id: number; name: string; email: string }[] = [];
    if (isAdmin(req.user)) {
      let memberPage = 1;
      let hasNext = true;
      while (hasNext) {
        const result = await req.payload.find({ collection: "users",
          where: { and: [{ workspace: { equals: workspace } }, { disabled: { not_equals: true } }] },
          depth: 0, limit: 1000, page: memberPage++, overrideAccess: true, req });
        members.push(...result.docs.map((user) => ({ id: user.id, name: user.name, email: user.email })));
        hasNext = !!result.hasNextPage;
      }
    }
    return json({
      settings, members, catalog: entries.filter((entry) => isAdmin(req.user) || entry.kind !== "customer"),
      bookings: rows.rows.map(publicBooking), total: total.rows[0].count, page,
      canConfigure: isAdmin(req.user), canWrite: canWrite(req.user, "calendar"),
      actorId: req.user!.id,
    });
  } catch (error) {
    return json({ error: error instanceof ModuleError ? error.message : "No pudimos cargar Agendamiento." },
      error instanceof ModuleError ? error.status : 503);
  }
}
export async function reservationsPOST(req: PayloadRequest) {
  try {
    await guard(req, true);
    const body = await req.json?.();
    if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify({ ...body, image: undefined }).length > 50000)
      throw new ModuleError("Solicitud no válida.");
    if (body.image !== undefined && (body.action !== "save-entry" || !["service","extra","package"].includes(body.kind))) throw new ModuleError("La imagen solo puede asignarse a servicios, extras y paquetes.");
    if (body.copyImageFrom !== undefined && (body.action !== "save-entry" || !["service","extra","package"].includes(body.kind) || body.id || body.image !== undefined)) throw new ModuleError("Copia de imagen no válida.");
    if (["save-entry", "save-settings"].includes(body.action) && !isAdmin(req.user)) throw new ModuleError("Solo los administradores del negocio pueden configurar Agendamiento.", 403);
    const image = body.image === undefined ? undefined : body.image === null ? null : await prepareCatalogImage(body.image);
    const workspace = workspaceID(req);
    const actor = Number(req.user!.id);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > 2000 || (body.reason !== undefined && typeof body.reason !== "string")) throw new ModuleError("Revisa el motivo del cambio.");
    const result = await reservationTransaction(workspace, async (client) => {
      await expirePaymentHolds(client,workspace);
      if (["save-entry", "save-settings"].includes(body.action) && !isAdmin(req.user))
        throw new ModuleError("Solo los administradores del negocio pueden configurar Agendamiento.", 403);
      if (body.action === "save-settings") {
        const settings = validateSettings(body.value);
        const existing = await client.query("SELECT 1 FROM reservation_bookings WHERE workspace_id=$1 LIMIT 1", [workspace]);
        const old = await configuration(client, workspace);
        if (existing.rows.length && old.currency !== settings.currency)
          throw new ModuleError("La moneda debe conservarse mientras existan reservas. Usa la moneda de la tienda.");
        const saved = body.version === 0
          ? await client.query("INSERT INTO reservation_settings(workspace_id,value) VALUES($1,$2) ON CONFLICT(workspace_id) DO NOTHING RETURNING version",
              [workspace, JSON.stringify(settings)])
          : await client.query("UPDATE reservation_settings SET value=$1,version=version+1,updated_at=now() WHERE workspace_id=$2 AND version=$3 RETURNING version",
              [JSON.stringify(settings), workspace, numericID(body.version)]);
        if (!saved.rows[0]) throw new ModuleError("La configuración cambió. Actualiza antes de guardar.", 409);
        await audit(client, workspace, actor, "settings", workspace, settings);
        return { settings: { ...settings, version: saved.rows[0].version } };
      }
      if (body.action === "save-entry") {
        const entry = validateEntry(body.kind, body.name, body.value, body.active);
        await relatedEntries(client, workspace, entry, body.id ? numericID(body.id) : undefined);
        if (entry.kind === "professional" && entry.value.userId) {
          const user = await req.payload.findByID({ collection: "users", id: entry.value.userId, overrideAccess: true, depth: 0, req });
          const tenant = typeof user.workspace === "object" ? user.workspace.id : user.workspace;
          if (Number(tenant) !== workspace || user.disabled) throw new ModuleError("El usuario debe pertenecer al negocio y estar activo.");
        }
        if (entry.kind === "customer") {
          const duplicate = await client.query("SELECT id FROM reservation_catalog WHERE workspace_id=$1 AND kind='customer' AND lower(value->>'email')=$2 AND id<>$3 AND request_key IS DISTINCT FROM $4",
            [workspace, entry.value.email, body.id || 0, body.requestKey || null]);
          if (duplicate.rows[0]) throw new ModuleError("Ya existe un cliente con ese correo.", 409);
        }
        if (entry.kind === "professional" && entry.active && entry.value.userId) {
          const duplicate = await client.query("SELECT id FROM reservation_catalog WHERE workspace_id=$1 AND kind='professional' AND active=true AND value->>'userId'=$2 AND id<>$3 AND request_key IS DISTINCT FROM $4",
            [workspace, String(entry.value.userId), body.id || 0, body.requestKey || null]);
          if (duplicate.rows[0]) throw new ModuleError("Esta persona ya tiene un perfil profesional activo.", 409);
        }
        let saved;
        if (body.id) {
          saved = await client.query(
            "UPDATE reservation_catalog SET name=$1,active=$2,value=$3,version=version+1,updated_at=now() WHERE workspace_id=$4 AND id=$5 AND kind=$6 AND version=$7 RETURNING *",
            [entry.name, entry.active, JSON.stringify(entry.value), workspace, numericID(body.id), entry.kind, numericID(body.version)],
          );
          if (!saved.rows[0]) throw new ModuleError("El registro cambió. Actualiza antes de guardar.", 409);
        } else {
          if (typeof body.requestKey !== "string" || !/^[A-Za-z0-9_-]{10,100}$/.test(body.requestKey))
            throw new ModuleError("Clave de operación no válida.");
          const fingerprint = createHash("sha256").update(JSON.stringify({ ...entry,
            ...(image !== undefined ? { image: image?.hash ?? null } : {}),
            ...(body.copyImageFrom !== undefined ? { copyImageFrom: numericID(body.copyImageFrom) } : {}),
          })).digest("hex");
          const previous = await client.query("SELECT * FROM reservation_catalog WHERE workspace_id=$1 AND request_key=$2", [workspace, body.requestKey]);
          if (previous.rows[0]) {
            if (previous.rows[0].fingerprint !== fingerprint) throw new ModuleError("La clave ya se usó con otros datos.", 409);
            return { entry: previous.rows[0] };
          }
          saved = await client.query(
            "INSERT INTO reservation_catalog(workspace_id,kind,name,active,value,request_key,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [workspace, entry.kind, entry.name, entry.active, JSON.stringify(entry.value), body.requestKey, fingerprint],
          );
        }
        const id = saved.rows[0].id;
        if (image === null) await client.query("DELETE FROM reservation_catalog_images WHERE workspace_id=$1 AND catalog_id=$2",[workspace,id]);
        if (image) await client.query("INSERT INTO reservation_catalog_images(workspace_id,catalog_id,bytes,width,height) VALUES($1,$2,$3,$4,$5) ON CONFLICT(catalog_id) DO UPDATE SET bytes=excluded.bytes,width=excluded.width,height=excluded.height,updated_at=now()",[workspace,id,image.bytes,image.width,image.height]);
        if (body.copyImageFrom !== undefined) {
          const source = await client.query("SELECT id FROM reservation_catalog WHERE workspace_id=$1 AND id=$2 AND kind=$3",[workspace,numericID(body.copyImageFrom),entry.kind]);
          if (!source.rows[0]) throw new ModuleError("Imagen de origen no disponible.",404);
          await client.query("INSERT INTO reservation_catalog_images(workspace_id,catalog_id,bytes,width,height) SELECT workspace_id,$1,bytes,width,height FROM reservation_catalog_images WHERE workspace_id=$2 AND catalog_id=$3",[id,workspace,body.copyImageFrom]);
        }
        await audit(client, workspace, actor, "save-entry", id, { ...entry, ...(image !== undefined ? { image: image ? "updated" : "removed" } : {}), ...(body.copyImageFrom !== undefined ? { copyImageFrom: body.copyImageFrom } : {}) });
        return { entry: saved.rows[0] };
      }
      const entries = await catalog(client, workspace);
      const settings = await configuration(client, workspace);
      if (body.action === "create-booking") {
        if (typeof body.requestKey !== "string" || !/^[A-Za-z0-9_-]{10,100}$/.test(body.requestKey))
          throw new ModuleError("Clave de reserva no válida.");
        const serviceId = numericID(body.serviceId);
        const professionalId = body.professionalId ? numericID(body.professionalId) : null;
        const locationId = body.locationId ? numericID(body.locationId) : null;
        const quantity = integer(body.quantity, 1, 1000, "los asistentes");
        const start = new Date(body.startAt);
        const name = String(body.customerName || "").trim(), email = String(body.customerEmail || "").trim().toLowerCase();
        if (!Number.isFinite(start.getTime()) || !name || name.length > 160 ||
            email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw new ModuleError("Revisa la fecha, el nombre y el correo del cliente.");
        const fingerprint = createHash("sha256").update(JSON.stringify({
          serviceId, professionalId, locationId, quantity, startAt: start.toISOString(), name, email,
          ...(body.durationMinutes !== undefined ? { durationMinutes: integer(body.durationMinutes, 5, 1440, "la duración elegida") } : {}),
          ...(body.extras !== undefined ? { extras: normalizeExtraSelection(body.extras) } : {}),
        })).digest("hex");
        const previous = await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND request_key=$2", [workspace, body.requestKey]);
        if (previous.rows[0]) {
          if (previous.rows[0].fingerprint !== fingerprint) throw new ModuleError("La clave ya se usó con otros datos.", 409);
          if (!canManage(req, previous.rows[0], entries)) throw new ModuleError("Hora no disponible.", 404);
          return { booking: publicBooking(previous.rows[0]) };
        }
        const originalService = entries.find((row) => row.id === serviceId && row.kind === "service" && row.active);
        const service = originalService ? selectServiceExtras(selectServiceDuration(originalService, body.durationMinutes), entries, body.extras) : undefined;
        if (!service) throw new ModuleError("Servicio no disponible.", 404);
        if (!ownProfessional(req, entries, professionalId)) throw new ModuleError("Solo puedes reservar en tu agenda asignada.", 403);
        const bookings = (await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND start_at >= $2::timestamptz - interval '3 days' AND start_at <= $2::timestamptz + interval '3 days'", [workspace, start.toISOString()])).rows;
        if (!slotAvailable({ start, service, professionalId, locationId, quantity, catalog: entries, bookings, settings }))
          throw new ModuleError("Ese horario ya no está disponible. Elige otro.", 409);
        await checkCustomerFutureLimit(client, settings, workspace, email);
        const amount = quote(service, quantity);
        const details = {
          durationMinutes: service.value.durationMinutes, servicePriceMinor: service.value.priceMinor, extras: service.value.selectedExtras,
          serviceName: service.name, professionalName: entries.find((row) => row.id === professionalId)?.name,
          locationName: entries.find((row) => row.id === locationId)?.name, timezone: settings.timezone,
          bufferBefore: service.value.bufferBefore, bufferAfter: service.value.bufferAfter,
          resourceIds: service.value.resourceIds,
        };
        await client.query("INSERT INTO reservation_catalog(workspace_id,kind,name,active,value) VALUES($1,'customer',$2,true,$3) ON CONFLICT DO NOTHING",
          [workspace, name, JSON.stringify({ email })]);
        const created = await client.query(
          "INSERT INTO reservation_bookings(workspace_id,request_key,fingerprint,service_id,professional_id,location_id,customer_name,customer_email,start_at,end_at,quantity,amount_minor,currency,status,payment_status,details,created_by,hold_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CASE WHEN $18::boolean THEN clock_timestamp()+$19::integer*interval '1 minute' ELSE NULL END) RETURNING *",
          [workspace, body.requestKey, fingerprint, serviceId, professionalId, locationId, name, email,
            start.toISOString(), new Date(start.getTime() + service.value.durationMinutes * 60000).toISOString(),
            quantity, amount, settings.currency, amount && !settings.allowPayLater ? "pending" : "confirmed",
            amount ? "unpaid" : "free", JSON.stringify(details), actor, Boolean(amount && !settings.allowPayLater), settings.paymentHoldMinutes],
        );
        await audit(client, workspace, actor, "create-booking", created.rows[0].id, { requestKey: body.requestKey });
        return { booking: publicBooking(created.rows[0]) };
      }
      if (body.action === "update-booking-extras") {
        const row = (await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND id=$2", [workspace, numericID(body.id)])).rows[0];
        if (!row || !canManage(req, row, entries)) throw new ModuleError("Reserva no disponible.", 404);
        if (row.version !== body.version) throw new ModuleError("La reserva cambió. Actualiza antes de continuar.", 409);
        if (!["pending", "confirmed"].includes(row.status)) throw new ModuleError("Los extras solo se pueden cambiar en horas vigentes.");
        if (!["unpaid", "free"].includes(row.payment_status)) throw new ModuleError("Los extras de una hora pagada requieren un ajuste a través de la tienda.", 409);
        const changed = bookingExtrasChange(row, bookingService(row, entries), entries, body.extras);
        const bookings = (await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND start_at >= $2::timestamptz - interval '3 days' AND start_at <= $2::timestamptz + interval '3 days'", [workspace, row.start_at])).rows;
        const start = new Date(row.start_at);
        if (!slotAvailable({ start, service: changed.service, professionalId: row.professional_id, locationId: row.location_id, quantity: row.quantity, catalog: entries, bookings, settings, excludeId: row.id }))
          throw new ModuleError("El horario no admite la nueva duración. Cambia los extras o reagenda la hora primero.", 409);
        const end = new Date(start.getTime()+changed.service.value.durationMinutes*60000).toISOString();
        const status = changed.amountMinor && !settings.allowPayLater ? "pending" : row.status;
        const paymentStatus = changed.amountMinor ? "unpaid" : "free";
        const details = { ...row.details, durationMinutes: changed.service.value.durationMinutes, extras: changed.service.value.selectedExtras };
        const saved = await client.query("UPDATE reservation_bookings SET end_at=$1,amount_minor=$2,status=$3,payment_status=$4,details=$5,hold_expires_at=CASE WHEN $8::boolean THEN coalesce(hold_expires_at,clock_timestamp()+$9::integer*interval '1 minute') ELSE NULL END,version=version+1,updated_at=now() WHERE workspace_id=$6 AND id=$7 RETURNING *", [end,changed.amountMinor,status,paymentStatus,JSON.stringify(details),workspace,row.id,Boolean(changed.amountMinor && !settings.allowPayLater),settings.paymentHoldMinutes]);
        await audit(client,workspace,actor,"update-booking-extras",row.id,{reason,before:{extras:row.details.extras || [],amountMinor:Number(row.amount_minor),endAt:row.end_at,status:row.status},after:{extras:details.extras,amountMinor:changed.amountMinor,endAt:end,status}});
        return { booking: publicBooking(saved.rows[0]) };
      }
      if (body.action === "reschedule-booking") {
        const result = await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND id=$2", [workspace, numericID(body.id)]);
        const row = result.rows[0];
        if (!row || !canManage(req, row, entries)) throw new ModuleError("Reserva no disponible.", 404);
        if (row.version !== body.version) throw new ModuleError("La reserva cambió. Actualiza antes de continuar.", 409);
        if (!["pending", "confirmed"].includes(row.status)) throw new ModuleError("Esta reserva no admite reprogramación.");
        const start = new Date(body.startAt);
        if (!Number.isFinite(start.getTime())) throw new ModuleError("Fecha no válida.");
        const service = bookingService(row, entries);
        const bookings = (await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND start_at >= $2::timestamptz - interval '3 days' AND start_at <= $2::timestamptz + interval '3 days'", [workspace, start.toISOString()])).rows;
        if (!slotAvailable({ start, service, professionalId: row.professional_id, locationId: row.location_id,
          quantity: row.quantity, catalog: entries, bookings, settings, excludeId: row.id }))
          throw new ModuleError("Ese horario ya no está disponible. Elige otro.", 409);
        await checkCustomerFutureLimit(client, settings, workspace, row.customer_email, row.id);
        const end = new Date(start.getTime() + service.value.durationMinutes * 60000);
        const updated = await client.query("UPDATE reservation_bookings SET start_at=$1,end_at=$2,version=version+1,updated_at=now() WHERE workspace_id=$3 AND id=$4 RETURNING *",
          [start.toISOString(), end.toISOString(), workspace, row.id]);
        await audit(client, workspace, actor, "reschedule-booking", row.id, {
          reason, before: { startAt: row.start_at, endAt: row.end_at }, after: { startAt: start.toISOString(), endAt: end.toISOString() },
        });
        return { booking: publicBooking(updated.rows[0]) };
      }
      if (body.action === "booking-status") {
        const result = await client.query("SELECT * FROM reservation_bookings WHERE workspace_id=$1 AND id=$2", [workspace, numericID(body.id)]);
        const row = result.rows[0];
        if (!row || (!isAdmin(req.user) && row.created_by !== actor && !ownProfessional(req, entries, row.professional_id)))
          throw new ModuleError("Reserva no disponible.", 404);
        if (row.version !== body.version) throw new ModuleError("La reserva cambió. Actualiza antes de continuar.", 409);
        const transitions: Record<string, string[]> = {
          pending: ["confirmed", "canceled"], confirmed: ["canceled", "completed", "no_show"],
          canceled: [], completed: [], no_show: ["completed"],
        };
        if (!transitions[row.status]?.includes(body.status)) throw new ModuleError("Cambio de estado no permitido.");
        if (body.status === "confirmed" && row.payment_status === "unpaid" && !settings.allowPayLater)
          throw new ModuleError("La reserva necesita un pago confirmado por la tienda.");
        const updated = await client.query("UPDATE reservation_bookings SET status=$1,hold_expires_at=NULL,version=version+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *", [body.status, workspace, row.id]);
        await audit(client, workspace, actor, "booking-status", row.id, { before: row.status, after: body.status, reason });
        return { booking: publicBooking(updated.rows[0]) };
      }
      throw new ModuleError("Operación no válida.");
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof ModuleError ? error.message : "No pudimos guardar. Actualiza los datos antes de reintentar." },
      error instanceof ModuleError ? error.status : 503);
  }
}
const baseEndpoints: Endpoint[] = [
  { path: "/orbital-reservations", method: "get", handler: reservationsGET },
  { path: "/orbital-reservations", method: "post", handler: reservationsPOST },
  {
    path: "/orbital-module-access", method: "get",
    handler: async (req) => {
      if (!req.user || req.user.disabled) return json({ error: "Inicia sesión." }, 401);
      const result = await req.payload.find({ collection: "module-grants",
        where: { and: [{ workspace: { equals: workspaceID(req) } }, { enabled: { equals: true } }] },
        limit: 100, depth: 0, overrideAccess: true, req });
      return json({ modules: result.docs.map((row) => row.moduleId) });
    },
  },
];
export const reservationEndpoints: Endpoint[] = baseEndpoints.flatMap(endpoint=>endpoint.path?.startsWith('/orbital-')?[{...endpoint,path:endpoint.path.replace('/orbital-','/orbita-')},endpoint]:[endpoint]);
