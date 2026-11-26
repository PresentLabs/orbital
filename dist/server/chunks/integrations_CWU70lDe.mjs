import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
import { a as shopifyDomain, l as wooSales, o as shopifyShop, r as saveConnection, s as storeUrl } from "./integrations_P9zpvxGj.mjs";
import { t as checkPayloadStore } from "./payload-store_BEwPtasP.mjs";
//#region services/payload/src/store-integrations.ts
var storeProviders = [
	"woo",
	"shopify",
	"payload"
];
var storeNames = {
	woo: "WooCommerce",
	shopify: "Shopify",
	payload: "Payload CMS"
};
var isStoreProvider = (value) => typeof value === "string" && storeProviders.includes(value);
function blockedStore(provider, connected) {
	return isStoreProvider(provider) ? connected.find((p) => isStoreProvider(p) && p !== provider) : void 0;
}
var storeConflictMessage = (provider) => `Desconecta ${storeNames[provider]} antes de conectar otra plataforma de tienda.`;
//#endregion
//#region src/pages/api/saas/integrations.ts
var integrations_exports = /* @__PURE__ */ __exportAll({
	DELETE: () => DELETE,
	GET: () => GET,
	POST: () => POST
});
var GET = async (ctx) => {
	if (!await currentUser(ctx)) return json({ connected: [] }, 401);
	try {
		const data = await payload(ctx, "integrations?depth=0&limit=10");
		return json({ connected: data.docs.map((d) => d.provider) });
	} catch {
		return json({ connected: [] }, 503);
	}
};
async function conflictFor(ctx, provider) {
	if (!isStoreProvider(provider)) return;
	return blockedStore(provider, (await payload(ctx, "integrations?depth=0&limit=10")).docs.map((d) => d.provider));
}
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
	const user = await currentUser(ctx);
	if (!user || !isAdmin(user)) return json({ error: "Solo el propietario puede configurar conexiones" }, 403);
	let provider;
	try {
		const body = await ctx.request.json();
		provider = body.provider;
		const c = body.credentials;
		if (![
			"woo",
			"shopify",
			"payload",
			"email",
			"whatsapp"
		].includes(provider) || !c || Object.values(c).some((v) => typeof v !== "string" || v.length > 2048)) return json({ error: "Configuración inválida" }, 400);
		const conflict = await conflictFor(ctx, provider);
		if (conflict) return json({ error: storeConflictMessage(conflict) }, 409);
		if (provider === "payload") {
			c.url = storeUrl(ctx, c.url);
			Object.assign(c, await checkPayloadStore(c.url, c));
		}
		if (provider === "shopify") {
			c.shop = shopifyDomain(c.shop || "");
			if (!c.token || /[\r\n]/.test(c.token)) return json({ error: "Completa el token de Admin API." }, 400);
			c.shopName = (await shopifyShop(c)).name;
		}
		if (provider === "woo") {
			c.url = storeUrl(ctx, c.url);
			if (!/^ck_[a-f0-9]+$/.test(c.key) || !/^cs_[a-f0-9]+$/.test(c.secret)) return json({ error: "Claves de WooCommerce inválidas" }, 400);
			await wooSales(ctx, c);
		}
		if (provider === "email" && (!/^re_/.test(c.token) || !c.from || !c.to)) return json({ error: "Completa el remitente, destinatario y API key de Resend" }, 400);
		if (provider === "whatsapp" && (!/^\d+$/.test(c.phoneId) || !/^\d{8,16}$/.test(c.to) || !c.template || !c.token)) return json({ error: "Revisa la configuración de WhatsApp" }, 400);
		await saveConnection(ctx, provider, c);
		return json({ ok: true });
	} catch (e) {
		try {
			const conflict = await conflictFor(ctx, provider);
			if (conflict) return json({ error: storeConflictMessage(conflict) }, 409);
		} catch {}
		return json({ error: e instanceof Error ? e.message : "No se pudo guardar la conexión" }, 400);
	}
};
var DELETE = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
	const user = await currentUser(ctx);
	if (!user || !isAdmin(user)) return json({ error: "Solo un administrador puede desconectar la tienda." }, 403);
	try {
		const { provider } = await ctx.request.json();
		if (!isStoreProvider(provider)) return json({ error: "Plataforma no válida." }, 400);
		const found = await payload(ctx, "integrations?depth=0&limit=1&where[provider][equals]=" + provider);
		if (found.docs[0]) await payload(ctx, "integrations/" + found.docs[0].id, { method: "DELETE" });
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos desconectar la tienda. Inténtalo nuevamente." }, 503);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/integrations@_@ts
var page = () => integrations_exports;
//#endregion
export { page };
