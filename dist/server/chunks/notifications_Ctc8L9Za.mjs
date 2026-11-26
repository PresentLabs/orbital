import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { t as canView } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/notifications.ts
var notifications_exports = /* @__PURE__ */ __exportAll({
	DELETE: () => DELETE,
	GET: () => GET,
	PATCH: () => PATCH,
	POST: () => POST
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canView(user, "profile")) return json({ docs: [] });
	try {
		const result = await payload(ctx, "notifications?depth=0&limit=1000&sort=-createdAt");
		return json({ docs: result.docs.map((n) => ({
			id: String(n.id),
			kind: n.kind,
			pollId: n.pollId,
			authorName: n.authorName,
			taskId: n.taskId,
			commentId: n.commentId,
			recipientId: String(n.recipient),
			text: n.text,
			createdAt: n.createdAt,
			readAt: n.readAt
		})) });
	} catch {
		return json({ error: "No pudimos cargar tus avisos." }, 503);
	}
};
var PATCH = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canView(user, "profile")) return json({ error: "No tienes acceso a tareas." }, 403);
	try {
		const { id } = await ctx.request.json();
		if (!/^[a-zA-Z0-9_-]+$/.test(String(id))) return json({ error: "Aviso no válido." }, 400);
		await payload(ctx, "notifications/" + id, {
			method: "PATCH",
			body: JSON.stringify({ readAt: (/* @__PURE__ */ new Date()).toISOString() })
		});
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos marcar el aviso como leído." }, 400);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión." }, 401);
	try {
		return json(await payload(ctx, "send-notification", {
			method: "POST",
			body: JSON.stringify(await ctx.request.json())
		}));
	} catch {
		return json({ error: "No pudimos enviar el aviso. Revisa el mensaje y las personas seleccionadas." }, 400);
	}
};
var DELETE = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión." }, 401);
	const { id } = await ctx.request.json().catch(() => null) || {};
	if (typeof id !== "string" || !/^\d+$/.test(id)) return json({ error: "Aviso no válido." }, 400);
	try {
		await payload(ctx, "notifications/" + id, { method: "DELETE" });
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos eliminar el aviso." }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/notifications@_@ts
var page = () => notifications_exports;
//#endregion
export { page };
