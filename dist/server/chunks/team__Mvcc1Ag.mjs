import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin, o as sections, r as defaultPermissions } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/team.ts
var team_exports = /* @__PURE__ */ __exportAll({
	DELETE: () => DELETE,
	GET: () => GET,
	PATCH: () => PATCH,
	POST: () => POST
});
var publicMember = (m) => ({
	id: String(m.id),
	name: m.name,
	avatarData: m.avatarData,
	email: m.email,
	role: m.role,
	permissions: m.permissions ?? defaultPermissions,
	disabled: !!m.disabled
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión para continuar." }, 401);
	try {
		if (ctx.url.searchParams.get("directory") === "presence") return json(await payload(ctx, "canvas-directory?ids=" + encodeURIComponent(ctx.url.searchParams.get("ids") || "")));
		if (ctx.url.searchParams.get("directory") === "notifications") return json(await payload(ctx, "notification-directory"));
		if (ctx.url.searchParams.has("directory")) return json(await payload(ctx, "directory"));
		if (!isAdmin(user)) return json({ error: "Solo un administrador puede gestionar el equipo." }, 403);
		const data = await payload(ctx, "users?depth=0&limit=1000&sort=name&where[deletedAt][exists]=false");
		return json({ docs: data.docs.map(publicMember) });
	} catch {
		return json({ error: "No pudimos cargar el equipo." }, 503);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const actor = await currentUser(ctx);
	if (!isAdmin(actor)) return json({ error: "Solo un administrador puede invitar personas." }, 403);
	try {
		return json(await payload(ctx, "invite-member", {
			method: "POST",
			body: JSON.stringify(await ctx.request.json())
		}), 201);
	} catch {
		return json({ error: "No pudimos enviar el enlace. Si el correo ya está registrado, abre Gestionar para enviar uno nuevo." }, 400);
	}
};
var PATCH = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const actor = await currentUser(ctx);
	if (!isAdmin(actor)) return json({ error: "Solo un administrador puede cambiar permisos." }, 403);
	try {
		const body = await ctx.request.json();
		if (!/^[a-zA-Z0-9_-]+$/.test(String(body.id))) return json({ error: "Usuario no válido." }, 400);
		const target = await payload(ctx, "users/" + body.id + "?depth=0");
		if (String(target.id) === String(actor.id) || target.role === "owner") return json({ error: "No puedes cambiar tu propio rol ni el acceso del propietario." }, 403);
		const data = {};
		if (body.restore === true) {
			data.disabled = false;
			data.deletedAt = null;
		} else {
			if (![
				"admin",
				"editor",
				"member",
				"viewer"
			].includes(body.role) || !Array.isArray(body.permissions) || body.permissions.some((p) => !sections.includes(p))) return json({ error: "Revisa los permisos seleccionados." }, 400);
			data.role = body.role;
			data.permissions = body.permissions;
		}
		const result = await payload(ctx, "users/" + target.id, {
			method: "PATCH",
			body: JSON.stringify(data)
		});
		return json({ doc: publicMember(result.doc) });
	} catch {
		return json({ error: "No pudimos actualizar estos permisos." }, 400);
	}
};
var DELETE = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const actor = await currentUser(ctx);
	if (!isAdmin(actor)) return json({ error: "Solo un administrador puede eliminar usuarios." }, 403);
	try {
		const { id } = await ctx.request.json();
		if (!/^[a-zA-Z0-9_-]+$/.test(String(id))) return json({ error: "Usuario no válido." }, 400);
		const target = await payload(ctx, "users/" + id + "?depth=0");
		if (String(target.id) === String(actor.id) || target.role === "owner") return json({ error: "No puedes eliminarte ni quitar al propietario del negocio." }, 403);
		await payload(ctx, "users/" + target.id, {
			method: "PATCH",
			body: JSON.stringify({
				disabled: true,
				deletedAt: (/* @__PURE__ */ new Date()).toISOString()
			})
		});
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos quitar el acceso a esta persona." }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/team@_@ts
var page = () => team_exports;
//#endregion
export { page };
