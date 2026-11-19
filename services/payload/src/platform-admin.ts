import { availableModules } from "./modules/grants.ts";
import { APIError, type Endpoint } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";

export function isPlatformAccount(user: any) {
  return !!user && (process.env.SAAS_ADMIN_USER_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean).includes(String(user.id));
}
export function isPlatformAdmin(user: any) {
  return isPlatformAccount(user) && !user.disabled;
}
const workspaceID = (user: any) =>
  typeof user.workspace === "object" ? user.workspace.id : user.workspace;
const roles = ["admin", "editor", "member", "viewer"];
const billingStatuses = ["trial", "active", "past_due", "canceled"];
const identifier = (value: unknown) => /^\d+$/.test(String(value)) && Number(value) > 0;
const publicUser = (user: any, workspace: any) => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  disabled: !!user.disabled, deletedAt: user.deletedAt,
  createdAt: user.createdAt, updatedAt: user.updatedAt,
  nextPaymentAt: user.role === "owner" ? workspace.nextPaymentAt : undefined,
});
const reply = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export const platformAdminEndpoints: Endpoint[] = [
  {
    path: "/platform-admin",
    method: "get",
    handler: async (req) => {
      if (!isPlatformAdmin(req.user)) return reply({ error: "Acceso reservado al dueño del SaaS." }, 403);
      const url = new URL(req.url!);
      const page = Math.max(1, Math.min(100000, Number(url.searchParams.get("page")) || 1));
      const query = (url.searchParams.get("q") || "").trim().slice(0, 160);
      const workspaces = await req.payload.find({
        collection: "workspaces", depth: 0, limit: 25, page, sort: "-createdAt",
        ...(query ? { where: { name: { contains: query } } } : {}),
        overrideAccess: true, req,
      });
      const selectedID = url.searchParams.get("workspace") || workspaces.docs[0]?.id;
      let selected: any = null;
      if (selectedID && identifier(selectedID)) {
        const found = await req.payload.find({
          collection: "workspaces", where: { id: { equals: Number(selectedID) } },
          limit: 1, depth: 0, overrideAccess: true, req,
        });
        selected = found.docs[0] || null;
      }
      let users: any = { docs: [], totalDocs: 0, page: 1, totalPages: 1 };
      let owners: any[] = [];
      let modules: any[] = [];
      if (selected) {
        const userQuery = (url.searchParams.get("userQ") || "").trim().slice(0, 160);
        const result = await req.payload.find({
          collection: "users",
          where: { and: [
            { workspace: { equals: selected.id } },
            ...(userQuery ? [{ or: [{ name: { contains: userQuery } }, { email: { contains: userQuery } }] }] : []),
          ] },
          page: Math.max(1, Math.min(100000, Number(url.searchParams.get("userPage")) || 1)),
          limit: 50, depth: 0, sort: "name", overrideAccess: true, req,
        });
        users = { docs: result.docs.map((user) => publicUser(user, selected)),
          totalDocs: result.totalDocs, page: result.page, totalPages: result.totalPages };
        const ownerResult = await req.payload.find({
          collection: "users",
          where: { and: [{ workspace: { equals: selected.id } }, { role: { equals: "owner" } }] },
          limit: 100, depth: 0, overrideAccess: true, req,
        });
        owners = ownerResult.docs.map((user) => publicUser(user, selected));
        const [grants, installations] = await Promise.all([
          req.payload.find({ collection: "module-grants", where: { workspace: { equals: selected.id } },
            depth: 0, limit: 100, overrideAccess: true, req }),
          req.payload.find({ collection: "module-installations", where: { workspace: { equals: selected.id } },
            depth: 0, limit: 100, overrideAccess: true, req }),
        ]);
        modules = availableModules.filter((module) => !("legacy" in module) ||
          installations.docs.some((row) => row.moduleId === module.id)).map((module) => {
          const grant = grants.docs.find((row) => row.moduleId === module.id);
          return { ...module, enabled: !!grant?.enabled, changedBy: grant?.changedBy, updatedAt: grant?.updatedAt,
            configured: installations.docs.some((row) => row.moduleId === module.id && row.enabled) };
        });
      }
      const counts = await Promise.all(workspaces.docs.map(async workspace => {
        const result = await req.payload.count({collection:"users",where:{and:[{workspace:{equals:workspace.id}},{deletedAt:{exists:false}}]},overrideAccess:true,req});
        return result.totalDocs;
      }));
      return reply({
        workspaces: { docs: workspaces.docs.map((workspace, index) => ({
          id: workspace.id, name: workspace.name, plan: workspace.plan, createdAt: workspace.createdAt,
          nextPaymentAt: workspace.nextPaymentAt || null, userCount: counts[index], billingStatus: workspace.billingStatus || "trial", active: workspace.billingStatus !== "canceled",
        })), totalDocs: workspaces.totalDocs, page: workspaces.page, totalPages: workspaces.totalPages },
        selected: selected ? {
          id: selected.id, name: selected.name, plan: selected.plan,
          billingStatus: selected.billingStatus || "trial", nextPaymentAt: selected.nextPaymentAt,
          createdAt: selected.createdAt,
        } : null,
        owners, users, modules,
      });
    },
  },
  {
    path: "/platform-admin",
    method: "post",
    handler: async (req) => {
      if (!isPlatformAdmin(req.user)) return reply({ error: "Acceso reservado al dueño del SaaS." }, 403);
      // Native clients must send a Bearer/JWT token. Cookie-only mutations require an origin check.
      const authorization = req.headers.get("authorization") || "";
      const origin = req.headers.get("origin");
      if (!/^(JWT|Bearer)\s+\S+/i.test(authorization) &&
          origin !== process.env.SAAS_PUBLIC_URL?.replace(/\/$/, ""))
        return reply({ error: "Origen no válido." }, 403);
      const body = await req.json?.().catch(() => null);
      if (!body || !identifier(body.workspace) ||
          !["subscription", "user", "delete-user", "restore-user", "transfer-owner", "module"].includes(body.action))
        return reply({ error: "Revisa la operación y el negocio." }, 400);

      const transactionID = await req.payload.db.beginTransaction();
      if (!transactionID) return reply({ error: "No pudimos iniciar la operación. Intenta nuevamente." }, 503);
      req.transactionID = transactionID;
      try {
        // Serialize transfers and user changes within the business.
        const database = req.payload.db as unknown as PostgresAdapter;
        await database.sessions[String(transactionID)].db.execute(
          sql`SELECT id FROM workspaces WHERE id = ${Number(body.workspace)} FOR UPDATE`,
        );
        const workspace = await req.payload.findByID({
          collection: "workspaces", id: Number(body.workspace), depth: 0, overrideAccess: true, req,
        });
        const context = { platformManagement: true };
        if (body.action === "module") {
          const module = availableModules.find((item) => item.id === body.moduleId);
          if (!module || typeof body.enabled !== "boolean")
            throw new APIError("Módulo o estado no válido.", 400);
          const found = await req.payload.find({
            collection: "module-grants",
            where: { workspaceKey: { equals: workspace.id + ":" + module.id } },
            depth: 0, limit: 1, overrideAccess: true, req,
          });
          const data = { workspace: workspace.id, moduleId: module.id,
            workspaceKey: workspace.id + ":" + module.id, enabled: body.enabled,
            changedBy: String(req.user!.id) };
          if (found.docs[0])
            await req.payload.update({ collection: "module-grants", id: found.docs[0].id, data, overrideAccess: true, req });
          else await req.payload.create({ collection: "module-grants", data, overrideAccess: true, req });
          await database.sessions[String(transactionID)].db.execute(sql`
            INSERT INTO module_grant_events(workspace_id,module_id,actor_id,enabled_before,enabled_after)
            VALUES(${workspace.id},${module.id},${Number(req.user!.id)},${!!found.docs[0]?.enabled},${body.enabled})
          `);
        } else if (body.action === "subscription") {
          const date = body.nextPaymentAt;
          if (!["starter", "pro"].includes(body.plan) || !billingStatuses.includes(body.billingStatus) ||
              (date !== null && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)))
            throw new APIError("Revisa el plan, estado y fecha de pago.", 400);
          await req.payload.update({
            collection: "workspaces", id: workspace.id, req, overrideAccess: true, context,
            data: { plan: body.plan, billingStatus: body.billingStatus,
              nextPaymentAt: date ? date + "T12:00:00.000Z" : null },
          });
        } else {
          if (!identifier(body.user)) throw new APIError("Usuario no válido.", 400);
          const user = await req.payload.findByID({
            collection: "users", id: Number(body.user), depth: 0, overrideAccess: true, req,
          });
          if (String(workspaceID(user)) !== String(workspace.id))
            throw new APIError("El usuario pertenece a otro negocio.", 403);
          if (body.action === "transfer-owner") {
            if (user.disabled || user.deletedAt) throw new APIError("El nuevo propietario debe tener acceso activo.", 400);
            if (user.role === "owner") throw new APIError("Esta persona ya es propietaria.", 409);
            const previous = await req.payload.find({
              collection: "users", where: { and: [
                { workspace: { equals: workspace.id } }, { role: { equals: "owner" } },
              ] }, limit: 2, depth: 0, overrideAccess: true, req,
            });
            if (previous.docs.length !== 1 || String(previous.docs[0].id) !== String(body.previousOwner))
              throw new APIError("El propietario cambió. Actualiza la lista antes de continuar.", 409);
            await req.payload.update({ collection: "users", id: previous.docs[0].id,
              data: { role: "admin" }, req, context, overrideAccess: true });
            await req.payload.update({ collection: "users", id: user.id,
              data: { role: "owner" }, req, context, overrideAccess: true });
          } else if (body.action === "user") {
            if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80 ||
                typeof body.email !== "string" || body.email.length > 254 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || typeof body.disabled !== "boolean" ||
                !(user.role === "owner" ? body.role === "owner" : roles.includes(body.role)))
              throw new APIError("Revisa nombre, correo, rol y estado.", 400);
            if (body.disabled && (user.role === "owner" || String(user.id) === String(req.user!.id)))
              throw new APIError("Transfiere la propiedad antes de desactivar al propietario. Tu propia cuenta debe mantenerse activa.", 400);
            if (user.deletedAt) throw new APIError("Restaura el usuario antes de editarlo.", 400);
            await req.payload.update({ collection: "users", id: user.id, req, context, overrideAccess: true,
              data: { name: body.name.trim(), email: body.email.trim().toLowerCase(),
                role: body.role, disabled: body.disabled } });
          } else if (body.action === "delete-user") {
            if (user.role === "owner" || String(user.id) === String(req.user!.id) || isPlatformAccount(user))
              throw new APIError("Transfiere la propiedad antes de eliminar al propietario. Las cuentas del dueño del SaaS se gestionan desde el servidor.", 400);
            await req.payload.update({ collection: "users", id: user.id, req, context, overrideAccess: true,
              data: { disabled: true, deletedAt: user.deletedAt || new Date().toISOString() } });
          } else {
            if (!user.deletedAt) throw new APIError("Esta cuenta ya está disponible.", 409);
            await req.payload.update({ collection: "users", id: user.id, req, context, overrideAccess: true,
              data: { disabled: false, deletedAt: null } });
          }
        }
        await req.payload.db.commitTransaction(transactionID);
        return reply({ ok: true });
      } catch (error) {
        await req.payload.db.rollbackTransaction(transactionID);
        const status = error instanceof APIError ? error.status : 400;
        return reply({ error: error instanceof APIError ? error.message : "No pudimos guardar el cambio. Revisa los datos y que el correo sea único." }, status);
      }
    },
  },
];
