import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, l as setting, o as publicOrigin, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/google/start.ts
var start_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
	const user = await currentUser(ctx);
	if (!user || !isAdmin(user)) return json({ error: "Inicia sesión como propietario" }, 403);
	const client = setting(ctx, "GOOGLE_CLIENT_ID");
	if (!client || !setting(ctx, "GOOGLE_CLIENT_SECRET")) return json({ error: "Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor" }, 503);
	const state = crypto.randomUUID();
	ctx.cookies.set("orbita_google_state", state + ":" + user.id, {
		httpOnly: true,
		secure: publicOrigin(ctx).startsWith("https://"),
		sameSite: "lax",
		path: "/api/saas/google",
		maxAge: 600
	});
	const params = new URLSearchParams({
		client_id: client,
		redirect_uri: publicOrigin(ctx) + "/api/saas/google/callback",
		response_type: "code",
		scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/webmasters.readonly",
		access_type: "offline",
		prompt: "consent",
		state
	});
	return json({ url: "https://accounts.google.com/o/oauth2/v2/auth?" + params });
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/google/start@_@ts
var page = () => start_exports;
//#endregion
export { page };
