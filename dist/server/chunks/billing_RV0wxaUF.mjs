import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, l as setting, r as currentUser, s as sameOrigin, t as COOKIE } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/billing.ts
var billing_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST,
	prerender: () => false
});
var handler = async (ctx) => {
	if (ctx.request.method !== "GET" && !sameOrigin(ctx)) return json({ error: "Origen inválido." }, 403);
	const user = await currentUser(ctx);
	if (!isAdmin(user)) return json({ error: "Solo administradores del negocio." }, user ? 403 : 401);
	let body;
	if (ctx.request.method === "POST") {
		if (!ctx.request.headers.get("content-type")?.includes("application/json")) return json({ error: "Se requiere JSON." }, 415);
		body = await ctx.request.text();
		if (body.length > 1e7) return json({ error: "Solicitud demasiado grande." }, 413);
		try {
			const data = JSON.parse(body);
			if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "Solicitud no válida." }, 400);
			body = JSON.stringify({
				...data,
				moduleId: "billing-cl"
			});
		} catch {
			return json({ error: "JSON inválido." }, 400);
		}
	}
	try {
		const response = await fetch(setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/orbita-modules", {
			method: ctx.request.method,
			redirect: "error",
			headers: {
				"Content-Type": "application/json",
				Authorization: "JWT " + ctx.cookies.get(COOKIE).value
			},
			body,
			signal: AbortSignal.timeout(45e3)
		});
		return json(await response.json(), response.status);
	} catch {
		return json({ error: "No se confirmó la respuesta. Consulta el pedido y conserva la clave de operación para reintentar." }, 504);
	}
};
var GET = handler;
var POST = handler;
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/billing@_@ts
var page = () => billing_exports;
//#endregion
export { page };
