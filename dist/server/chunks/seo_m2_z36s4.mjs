import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin, t as canView } from "./permissions_BVhMm5T3.mjs";
import { n as googleToken, r as saveConnection, t as connection } from "./integrations_P9zpvxGj.mjs";
//#region src/pages/api/saas/seo.ts
var seo_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST
});
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
	const user = await currentUser(ctx);
	if (!user || !isAdmin(user)) return json({ error: "Solo el propietario puede configurar SEO" }, 403);
	try {
		const { property } = await ctx.request.json();
		if (typeof property !== "string" || property.length > 250 || !/^(sc-domain:[a-zA-Z0-9.-]+|https:\/\/[^\s]+\/)$/.test(property)) return json({ error: "Usa sc-domain:tudominio.cl o https://tudominio.cl/" }, 400);
		const c = await connection(ctx, "google");
		if (!c) return json({ error: "Conecta primero tu cuenta de Google" }, 400);
		await saveConnection(ctx, "google", {
			...c.credentials,
			property
		});
		return json({ ok: true });
	} catch {
		return json({ error: "No se pudo guardar la propiedad" }, 503);
	}
};
var GET = async (ctx) => {
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión" }, 401);
	if (!canView(await currentUser(ctx), "analytics")) return json({ error: "No tienes acceso a esta sección." }, 403);
	try {
		const c = await connection(ctx, "google");
		if (!c?.credentials.property) return json({ connected: false });
		const end = /* @__PURE__ */ new Date();
		end.setUTCDate(end.getUTCDate() - 3);
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - 27);
		const token = await googleToken(ctx);
		const response = await fetch("https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(c.credentials.property) + "/searchAnalytics/query", {
			method: "POST",
			headers: {
				Authorization: "Bearer " + token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				startDate: start.toISOString().slice(0, 10),
				endDate: end.toISOString().slice(0, 10),
				dimensions: ["date"],
				rowLimit: 100
			}),
			signal: AbortSignal.timeout(15e3)
		});
		if (!response.ok) throw Error();
		const data = await response.json();
		return json({
			connected: true,
			rows: data.rows || [],
			start: start.toISOString().slice(0, 10),
			end: end.toISOString().slice(0, 10)
		});
	} catch {
		return json({ error: "No se pudo consultar Search Console. Revisa la propiedad y los permisos de Google." }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/seo@_@ts
var page = () => seo_exports;
//#endregion
export { page };
