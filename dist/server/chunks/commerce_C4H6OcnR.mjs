import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { t as canView } from "./permissions_BVhMm5T3.mjs";
import { t as connection, u as wooSalesBetween } from "./integrations_P9zpvxGj.mjs";
//#region src/lib/saas/money.ts
function percentageChange(current, previous) {
	if (current === null || current === void 0 || current === "" || previous === null || previous === void 0 || previous === "") return null;
	const a = Number(current), b = Number(previous);
	return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? (a - b) / b * 100 : null;
}
function salesPeriods(week, now = /* @__PURE__ */ new Date(), timezone = "America/Santiago") {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(now), part = (key) => Number(parts.find((p) => p.type === key).value);
	const year = part("year"), month = part("month") - 1, day = part("day"), date = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
	return {
		from: date(year, month, week ? day - 6 : 1),
		to: date(year, month, day),
		previousFrom: date(year, week ? month : month - 1, week ? day - 13 : 1),
		previousTo: date(year, week ? month : month - 1, week ? day - 7 : Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()))
	};
}
//#endregion
//#region src/pages/api/saas/commerce.ts
var commerce_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión" }, 401);
	if (!canView(await currentUser(ctx), "analytics")) return json({ error: "No tienes acceso a esta sección." }, 403);
	try {
		const c = await connection(ctx, "woo");
		if (!c) return json({ connected: false });
		const week = ctx.url.searchParams.get("period") === "week";
		const branding = await payload(ctx, "branding");
		const range = salesPeriods(week, /* @__PURE__ */ new Date(), branding.timezone || "America/Santiago");
		const report = await wooSalesBetween(ctx, c.credentials, range.from, range.to);
		let salesChange = null;
		try {
			const previous = await wooSalesBetween(ctx, c.credentials, range.previousFrom, range.previousTo);
			salesChange = percentageChange(report.total_sales, previous.total_sales);
		} catch {}
		return json({
			connected: true,
			report: {
				...report,
				salesChange
			}
		});
	} catch {
		return json({ error: "No se pudo consultar WooCommerce" }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/commerce@_@ts
var page = () => commerce_exports;
//#endregion
export { page };
