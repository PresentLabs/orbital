import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
import { s as storeUrl, t as connection } from "./integrations_P9zpvxGj.mjs";
//#region src/pages/api/saas/orders.ts
var orders_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!isAdmin(user)) return json({ error: "Solo los administradores pueden ver la tienda." }, 403);
	try {
		const c = await connection(ctx, "woo");
		if (!c) return json({
			connected: false,
			docs: [],
			total: 0,
			pages: 0
		});
		const id = ctx.url.searchParams.get("id");
		if (id && !/^\d+$/.test(id)) return json({ error: "Pedido no válido." }, 400);
		const page = Math.max(1, Math.min(1e4, Number(ctx.url.searchParams.get("page")) || 1));
		const response = await fetch(storeUrl(ctx, c.credentials.url) + "/wp-json/wc/v3/orders" + (id ? "/" + id : "?per_page=10&page=" + page + "&orderby=date&order=desc"), {
			headers: { Authorization: "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret) },
			redirect: "error",
			signal: AbortSignal.timeout(15e3)
		});
		if (!response.ok) return json({ error: response.status === 404 ? "No encontramos ese pedido." : "WooCommerce no pudo devolver los pedidos." }, response.status === 404 ? 404 : 502);
		const data = await response.json();
		return json(id ? {
			connected: true,
			doc: data
		} : {
			connected: true,
			docs: data,
			total: Number(response.headers.get("X-WP-Total")),
			pages: Number(response.headers.get("X-WP-TotalPages")),
			page
		});
	} catch {
		return json({ error: "No pudimos cargar los pedidos. Revisa la conexión de WooCommerce." }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/orders@_@ts
var page = () => orders_exports;
//#endregion
export { page };
