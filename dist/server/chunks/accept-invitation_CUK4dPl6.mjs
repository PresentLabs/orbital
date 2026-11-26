import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, l as setting, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
//#region src/pages/api/saas/accept-invitation.ts
var accept_invitation_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	try {
		if (Number(ctx.request.headers.get("content-length")) > 2e3) return json({ error: "Solicitud no válida." }, 400);
		const body = await ctx.request.json();
		const response = await fetch(setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/accept-invitation", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				token: body.token,
				password: body.password
			}),
			signal: AbortSignal.timeout(12e3)
		});
		return json(await response.json(), response.status);
	} catch {
		return json({ error: "No pudimos guardar tu contraseña. Inténtalo nuevamente." }, 503);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/accept-invitation@_@ts
var page = () => accept_invitation_exports;
//#endregion
export { page };
