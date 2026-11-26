import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, l as setting, r as currentUser, s as sameOrigin, t as COOKIE } from "./server_Bo7bLI-7.mjs";
//#region src/pages/api/saas/platform-admin.ts
var platform_admin_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST
});
var forward = async (ctx) => {
	if (ctx.request.method !== "GET" && !sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!setting(ctx, "SAAS_ADMIN_USER_IDS").split(",").map((id) => id.trim()).filter(Boolean).includes(String(user.id))) return json({ error: "Acceso reservado al dueño del SaaS." }, 403);
	try {
		const response = await fetch(setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/platform-admin" + ctx.url.search, {
			method: ctx.request.method,
			headers: {
				Authorization: "JWT " + ctx.cookies.get(COOKIE).value,
				"Content-Type": "application/json"
			},
			...ctx.request.method === "POST" ? { body: await ctx.request.text() } : {},
			signal: AbortSignal.timeout(2e4)
		});
		return json(await response.json(), response.status);
	} catch {
		return json({ error: "No pudimos conectar con la administración. Intenta nuevamente." }, 503);
	}
};
var GET = forward;
var POST = forward;
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/platform-admin@_@ts
var page = () => platform_admin_exports;
//#endregion
export { page };
