import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
//#region src/pages/api/saas/profile/password.ts
var password_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	const { currentPassword, password } = await ctx.request.json().catch(() => null) || {};
	if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128 || typeof password !== "string" || password.length < 12 || password.length > 128) return json({ error: "La nueva contraseña debe tener entre 12 y 128 caracteres." }, 400);
	try {
		const verification = await payload(ctx, "users/login", {
			method: "POST",
			body: JSON.stringify({
				email: user.email,
				password: currentPassword
			})
		}, "");
		if (String(verification.user?.id) !== String(user.id)) throw Error();
	} catch {
		return json({ error: "No pudimos verificar tu contraseña actual." }, 403);
	}
	try {
		await payload(ctx, "users/" + user.id, {
			method: "PATCH",
			body: JSON.stringify({ password })
		});
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos cambiar tu contraseña." }, 503);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/profile/password@_@ts
var page = () => password_exports;
//#endregion
export { page };
