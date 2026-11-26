import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, l as setting, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { t as canView } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/realtime.ts
var realtime_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión" }, 401);
	if (!canView(user, "canvas")) return json({ error: "No tienes acceso a espacios." }, 403);
	const secret = setting(ctx, "REALTIME_SECRET"), url = setting(ctx, "PUBLIC_REALTIME_URL");
	if (!secret || !url) return json({ url: null });
	const workspace = typeof user.workspace === "object" ? user.workspace.id : user.workspace;
	const content = btoa(Array.from(new TextEncoder().encode(JSON.stringify({
		user: String(user.id),
		name: user.name,
		workspace: String(workspace),
		exp: Date.now() + 6e4
	})), (c) => String.fromCharCode(c)).join(""));
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
	const sig = Array.from(new Uint8Array(signature)).map((x) => x.toString(16).padStart(2, "0")).join("");
	return json({
		url,
		ticket: content + "." + sig
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/realtime@_@ts
var page = () => realtime_exports;
//#endregion
export { page };
