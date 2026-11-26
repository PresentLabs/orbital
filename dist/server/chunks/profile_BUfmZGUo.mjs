import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { i as validPhone, n as validAvatar, t as formatPhone } from "./formats_Dx7iOSDS.mjs";
//#region services/payload/src/ecommerce.ts
var ecommerceRoles = [
	{
		value: "propietario-tienda",
		label: "Propietario de la tienda"
	},
	{
		value: "gerente-ecommerce",
		label: "Gerente de ecommerce"
	},
	{
		value: "gestor-catalogo",
		label: "Gestor de catálogo"
	},
	{
		value: "gestor-pedidos",
		label: "Gestor de pedidos"
	},
	{
		value: "atencion-cliente",
		label: "Atención al cliente"
	},
	{
		value: "marketing",
		label: "Marketing y contenido"
	},
	{
		value: "logistica",
		label: "Logística y despacho"
	},
	{
		value: "finanzas",
		label: "Finanzas y facturación"
	}
];
//#endregion
//#region src/pages/api/saas/profile.ts
var profile_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	PATCH: () => PATCH
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	return user ? json({
		user,
		branding: await payload(ctx, "branding")
	}) : json({ error: "Inicia sesión." }, 401);
};
var PATCH = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	try {
		const body = await ctx.request.json();
		if ([
			"firstName",
			"lastName",
			"phone",
			"jobTitle"
		].some((k) => typeof body[k] !== "string" || body[k].length > 100) || !body.firstName.trim() || !validPhone(body.phone) || body.jobTitle && !ecommerceRoles.some((role) => role.value === body.jobTitle)) return json({ error: "Revisa el nombre y el teléfono." }, 400);
		if (body.avatarData !== void 0 && body.avatarData !== "" && !validAvatar(body.avatarData)) return json({ error: "Elige una imagen PNG, JPG o WebP de hasta 250 KB." }, 400);
		const data = {
			...body.avatarData !== void 0 ? { avatarData: body.avatarData } : {},
			firstName: body.firstName.trim(),
			lastName: body.lastName.trim(),
			phone: formatPhone(body.phone),
			jobTitle: body.jobTitle.trim() || null,
			name: (body.firstName.trim() + " " + body.lastName.trim()).trim()
		};
		const result = await payload(ctx, "users/" + user.id, {
			method: "PATCH",
			body: JSON.stringify(data)
		});
		return json({ user: result.doc });
	} catch {
		return json({ error: "No pudimos guardar tu perfil." }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/profile@_@ts
var page = () => profile_exports;
//#endregion
export { page };
