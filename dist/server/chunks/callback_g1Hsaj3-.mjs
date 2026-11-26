import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { l as setting, o as publicOrigin, r as currentUser } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
import { r as saveConnection, t as connection } from "./integrations_P9zpvxGj.mjs";
//#region src/pages/api/saas/google/callback.ts
var callback_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	const state = ctx.url.searchParams.get("state");
	const cookie = ctx.cookies.get("orbita_google_state")?.value;
	ctx.cookies.delete("orbita_google_state", { path: "/api/saas/google" });
	if (!user || !isAdmin(user) || !state || cookie !== state + ":" + user.id) return ctx.redirect("/app?connection=error#integrations", 303);
	try {
		const response = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: setting(ctx, "GOOGLE_CLIENT_ID"),
				client_secret: setting(ctx, "GOOGLE_CLIENT_SECRET"),
				code: ctx.url.searchParams.get("code") || "",
				grant_type: "authorization_code",
				redirect_uri: publicOrigin(ctx) + "/api/saas/google/callback"
			}),
			signal: AbortSignal.timeout(12e3)
		});
		const tokens = await response.json();
		if (!response.ok || !tokens.refresh_token) throw Error();
		const previous = await connection(ctx, "google");
		await saveConnection(ctx, "google", {
			...previous?.credentials,
			refresh_token: tokens.refresh_token
		});
		return ctx.redirect("/app?connection=success#integrations", 303);
	} catch {
		return ctx.redirect("/app?connection=error#integrations", 303);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/google/callback@_@ts
var page = () => callback_exports;
//#endregion
export { page };
