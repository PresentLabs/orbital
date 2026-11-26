import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { t as canView } from "./permissions_BVhMm5T3.mjs";
import { s as storeUrl, t as connection } from "./integrations_P9zpvxGj.mjs";
//#region src/pages/api/saas/carts.ts
var carts_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión" }, 401);
	if (!canView(await currentUser(ctx), "analytics")) return json({ error: "No tienes acceso a esta sección." }, 403);
	try {
		const c = await connection(ctx, "woo");
		if (!c) return json({ connected: false });
		const url = storeUrl(ctx, c.credentials.url);
		const res = await fetch(url + "/wp-json/wc/v3/orbita/abandoned-carts", {
			headers: { Authorization: "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret) },
			redirect: "error",
			signal: AbortSignal.timeout(12e3)
		});
		if (!res.ok) return json({
			connected: false,
			requiresPlugin: true
		});
		return json({
			connected: true,
			...await res.json()
		});
	} catch {
		return json({ error: "No se pudo consultar carros abandonados" }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/carts@_@ts
var page = () => carts_exports;
//#endregion
export { page };
