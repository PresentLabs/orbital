import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { t as canView } from "./permissions_BVhMm5T3.mjs";
import { s as storeUrl, t as connection } from "./integrations_P9zpvxGj.mjs";
//#region src/pages/api/saas/search.ts
var search_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	const q = (ctx.url.searchParams.get("q") || "").trim().slice(0, 120);
	if (!q) return json({ results: [] });
	const results = [], warnings = [];
	const jobs = [];
	if (canView(user, "documents")) jobs.push((async () => {
		try {
			const query = new URLSearchParams({
				depth: "0",
				limit: "100",
				sort: "-createdAt",
				"where[deletedAt][exists]": "false",
				"where[or][0][title][contains]": q,
				"where[or][1][filename][contains]": q
			});
			if (/^#?\d+$/.test(q)) query.set("where[or][2][orderId][equals]", q.replace(/^#/, ""));
			const files = await payload(ctx, "files?" + query.toString());
			results.push(...files.docs.map((f) => ({
				id: String(f.id),
				kind: "document",
				title: f.title,
				subtitle: f.filename + (f.orderId ? " · Pedido #" + f.orderId : "")
			})));
		} catch {
			warnings.push("No pudimos buscar en documentos.");
		}
	})());
	if (canView(user, "orders")) jobs.push((async () => {
		try {
			const c = await connection(ctx, "woo");
			if (!c) return;
			const response = await fetch(storeUrl(ctx, c.credentials.url) + "/wp-json/wc/v3/orders?per_page=50&search=" + encodeURIComponent(q.replace(/^#/, "")), {
				headers: { Authorization: "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret) },
				redirect: "error",
				signal: AbortSignal.timeout(12e3)
			});
			if (!response.ok) throw Error();
			const orders = await response.json();
			results.push(...orders.map((o) => ({
				id: String(o.id),
				kind: "order",
				title: "Pedido #" + o.number,
				subtitle: [
					o.billing?.first_name,
					o.billing?.last_name,
					o.status
				].filter(Boolean).join(" · ")
			})));
		} catch {
			warnings.push("No pudimos buscar en la tienda.");
		}
	})());
	await Promise.all(jobs);
	return json({
		results,
		warnings
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/search@_@ts
var page = () => search_exports;
//#endregion
export { page };
