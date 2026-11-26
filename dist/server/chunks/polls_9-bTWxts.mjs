import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
//#region src/pages/api/saas/polls.ts
var polls_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST
});
var GET = async (ctx) => {
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión." }, 401);
	try {
		return json(await payload(ctx, "team-polls"));
	} catch {
		return json({ error: "No pudimos cargar las votaciones." }, 503);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión." }, 401);
	try {
		const body = await ctx.request.json();
		return json(await payload(ctx, body.action === "vote" ? "team-poll-vote" : "team-polls", {
			method: "POST",
			body: JSON.stringify(body)
		}));
	} catch {
		return json({ error: "No pudimos guardar. Revisa los participantes y si ya votaste." }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/polls@_@ts
var page = () => polls_exports;
//#endregion
export { page };
