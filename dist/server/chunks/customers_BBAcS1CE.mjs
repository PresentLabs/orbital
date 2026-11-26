import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
import { a as shopifyDomain, s as storeUrl, t as connection } from "./integrations_P9zpvxGj.mjs";
import { n as payloadStoreConfig } from "./payload-store_BEwPtasP.mjs";
//#region src/lib/saas/store-read.ts
var customerFields = "id firstName lastName displayName email phone createdAt";
var orderFields = "id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } }";
function normalizeShopCustomer(c) {
	return {
		id: String(c.id).split("/").pop(),
		name: c.displayName || [c.firstName, c.lastName].filter(Boolean).join(" "),
		email: c.email || "",
		phone: c.phone || "",
		date: c.createdAt
	};
}
function normalizeShopOrder(o) {
	return {
		id: String(o.id).split("/").pop(),
		number: o.name,
		date_created: o.createdAt,
		status: o.displayFinancialStatus === "REFUNDED" ? "refunded" : o.displayFinancialStatus === "PAID" ? o.displayFulfillmentStatus === "FULFILLED" ? "completed" : "processing" : "pending",
		total: o.totalPriceSet.shopMoney.amount,
		currency: o.totalPriceSet.shopMoney.currencyCode,
		provider: "shopify"
	};
}
async function readShopify(c, o, fetcher = fetch) {
	if (o.page < 1 || o.page > 100 || !Number.isInteger(o.page)) throw Error("Página fuera de rango.");
	for (const id of [o.id, o.customer]) if (id && !/^\d+$/.test(id)) throw Error("Identificador no válido.");
	const request = async (query, variables) => {
		const r = await fetcher(`https://${shopifyDomain(c.shop)}/admin/api/2026-10/graphql.json`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": c.token
			},
			body: JSON.stringify({
				query,
				variables
			}),
			redirect: "error",
			signal: AbortSignal.timeout(15e3)
		});
		const d = await r.json();
		if (!r.ok || d.errors?.length || !d.data) throw Error("Shopify no pudo devolver los datos. Revisa los permisos de clientes y pedidos.");
		return d.data;
	};
	if (o.id) {
		const type = o.kind === "customers" ? "Customer" : "Order", field = o.kind === "customers" ? "customer" : "order";
		const d = await request(`query($id:ID!){${field}(id:$id){${type === "Customer" ? customerFields : orderFields}}}`, { id: `gid://shopify/${type}/${o.id}` });
		if (!d[field]) throw Error("Registro no encontrado.");
		return { doc: type === "Customer" ? normalizeShopCustomer(d[field]) : {
			...normalizeShopOrder(d[field]),
			storeUrl: `https://${shopifyDomain(c.shop)}/admin/orders/${o.id}`
		} };
	}
	let after = null, connection;
	for (let page = 1; page <= o.page; page++) {
		const data = await request(o.customer ? `query($id:ID!,$after:String){customer(id:$id){orders(first:10,after:$after,reverse:true){nodes{${orderFields}} pageInfo{hasNextPage endCursor}}}}` : `query($after:String,$q:String){${o.kind}(first:10,after:$after,query:$q){nodes{${o.kind === "customers" ? customerFields : orderFields}} pageInfo{hasNextPage endCursor}}}`, {
			after,
			q: o.q || null,
			...o.customer ? { id: `gid://shopify/Customer/${o.customer}` } : {}
		});
		connection = o.customer ? data.customer?.orders : data[o.kind];
		if (!connection) throw Error("Registro no encontrado.");
		if (page < o.page && !connection.pageInfo.hasNextPage) return {
			docs: [],
			page: o.page,
			pages: page,
			total: null
		};
		after = connection.pageInfo.endCursor;
	}
	return {
		docs: connection.nodes.map((item) => o.kind === "customers" ? normalizeShopCustomer(item) : {
			...normalizeShopOrder(item),
			storeUrl: `https://${shopifyDomain(c.shop)}/admin/orders/${String(item.id).split("/").pop()}`
		}),
		page: o.page,
		pages: o.page + (connection.pageInfo.hasNextPage ? 1 : 0),
		total: null
	};
}
function normalizePayloadCustomer(c) {
	return {
		id: String(c.id),
		name: c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
		email: c.email || "",
		phone: c.phone || "",
		date: c.createdAt
	};
}
function normalizePayloadOrder(o) {
	const currency = String(o.currency || "CLP").toUpperCase();
	const digits = new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency
	}).resolvedOptions().maximumFractionDigits ?? 2;
	return {
		id: String(o.id),
		number: String(o.orderNumber || o.id),
		date_created: o.createdAt,
		status: o.status === "completed" ? "completed" : o.status === "cancelled" ? "cancelled" : "processing",
		total: String(Number(o.amount || 0) / 10 ** digits),
		currency,
		provider: "payload"
	};
}
async function readPayload(base, c, o, fetcher = fetch) {
	const config = payloadStoreConfig(c), collection = o.kind === "customers" ? c.customers || config.authCollection : config.orders;
	if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(collection) || [o.id, o.customer].some((id) => id && !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) throw Error("Colección o identificador no válido.");
	const params = new URLSearchParams({
		depth: "0",
		limit: "10",
		page: String(o.page)
	});
	if (o.customer) params.set("where[customer][equals]", o.customer);
	if (o.q) {
		params.set("where[or][0][email][contains]", o.q);
		params.set("where[or][1][name][contains]", o.q);
	}
	const r = await fetcher(base + "/api/" + collection + (o.id ? "/" + encodeURIComponent(o.id) : "?" + params), {
		headers: { Authorization: config.authCollection + " API-Key " + config.token },
		redirect: "error",
		signal: AbortSignal.timeout(15e3)
	});
	if (!r.ok) throw Error("Payload no pudo devolver los datos. Revisa el acceso a la colección.");
	const d = await r.json(), normalize = o.kind === "customers" ? normalizePayloadCustomer : (row) => ({
		...normalizePayloadOrder(row),
		storeUrl: base + "/admin/collections/" + collection + "/" + encodeURIComponent(row.id)
	});
	return o.id ? { doc: normalize(d) } : {
		docs: d.docs.map(normalize),
		page: o.page,
		total: d.totalDocs,
		pages: d.totalPages
	};
}
//#endregion
//#region src/pages/api/saas/customers.ts
var customers_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!isAdmin(user)) return json({ error: "Solo un administrador puede consultar clientes." }, 403);
	try {
		const stores = (await Promise.all([
			"woo",
			"shopify",
			"payload"
		].map(async (provider) => ({
			provider,
			value: await connection(ctx, provider)
		})))).filter((store) => store.value), requested = ctx.url.searchParams.get("provider");
		if (requested && ![
			"woo",
			"shopify",
			"payload"
		].includes(requested)) return json({ error: "Tienda no válida." }, 400);
		if (!requested && stores.length > 1) return json({
			connected: false,
			chooseStore: true,
			providers: stores.map((s) => s.provider),
			docs: [],
			total: 0,
			pages: 0
		});
		const selected = stores.find((s) => s.provider === requested) || (!requested ? stores[0] : void 0);
		if (!selected) return json({
			connected: false,
			providers: stores.map((s) => s.provider),
			docs: [],
			total: 0,
			pages: 0
		});
		const c = selected.value, provider = selected.provider;
		if (provider !== "woo") {
			const id = ctx.url.searchParams.get("id") || void 0, page = Number(ctx.url.searchParams.get("page") || 1);
			if (id && !(provider === "shopify" ? /^\d+$/ : /^[a-zA-Z0-9_-]{1,100}$/).test(id)) return json({ error: "Cliente no válido." }, 400);
			if (!Number.isInteger(page) || page < 1 || page > 100) return json({ error: "Página fuera de rango." }, 400);
			const read = (options) => provider === "shopify" ? readShopify(c.credentials, options) : readPayload(storeUrl(ctx, c.credentials.url), c.credentials, options);
			const result = await read({
				kind: "customers",
				id,
				page,
				q: (ctx.url.searchParams.get("q") || "").slice(0, 120)
			});
			if (id) {
				const orders = await read({
					kind: "orders",
					customer: id,
					page
				});
				return json({
					connected: true,
					provider,
					providers: stores.map((s) => s.provider),
					...result,
					orders: orders.docs,
					total: orders.total,
					pages: orders.pages,
					page
				});
			}
			return json({
				connected: true,
				provider,
				providers: stores.map((s) => s.provider),
				...result
			});
		}
		const id = ctx.url.searchParams.get("id"), page = Math.max(1, Math.min(1e4, Number(ctx.url.searchParams.get("page")) || 1));
		if (id && !/^\d+$/.test(id)) return json({ error: "Cliente no válido." }, 400);
		const headers = { Authorization: "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret) }, base = storeUrl(ctx, c.credentials.url) + "/wp-json/wc/v3";
		const response = await fetch(base + "/customers" + (id ? "/" + id : "?per_page=10&page=" + page + "&search=" + encodeURIComponent((ctx.url.searchParams.get("q") || "").slice(0, 120))), {
			headers,
			redirect: "error",
			signal: AbortSignal.timeout(15e3)
		});
		if (!response.ok) throw Error();
		const data = await response.json();
		const safe = (m) => ({
			id: String(m.id),
			name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username,
			email: m.email,
			phone: m.billing?.phone || "",
			date: m.date_created,
			billing: m.billing
		});
		if (!id) return json({
			connected: true,
			provider,
			providers: stores.map((s) => s.provider),
			docs: data.map(safe),
			total: Number(response.headers.get("X-WP-Total")),
			pages: Number(response.headers.get("X-WP-TotalPages")),
			page
		});
		const orders = await fetch(base + "/orders?customer=" + id + "&per_page=10&page=" + page, {
			headers,
			redirect: "error",
			signal: AbortSignal.timeout(15e3)
		});
		if (!orders.ok) throw Error();
		return json({
			connected: true,
			provider,
			providers: stores.map((s) => s.provider),
			doc: safe(data),
			orders: await orders.json(),
			total: Number(orders.headers.get("X-WP-Total")),
			pages: Number(orders.headers.get("X-WP-TotalPages")),
			page
		});
	} catch {
		return json({ error: "No pudimos consultar los clientes. Revisa la conexión y los permisos de la tienda." }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/customers@_@ts
var page = () => customers_exports;
//#endregion
export { page };
