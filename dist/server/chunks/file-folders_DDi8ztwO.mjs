import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { n as canWrite, t as canView } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/file-folders.ts
var file_folders_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canView(user, "files")) return json({ error: "No tienes acceso a Archivos." }, 403);
	try {
		const result = await payload(ctx, "workspace-folders?depth=0&limit=1000&sort=name");
		return json({ docs: result.docs.map((f) => ({
			id: String(f.id),
			name: f.name,
			createdAt: f.createdAt
		})) });
	} catch {
		return json({ error: "No pudimos cargar las carpetas." }, 503);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canWrite(user, "files")) return json({ error: "No puedes crear carpetas." }, 403);
	try {
		const { name } = await ctx.request.json();
		if (typeof name !== "string" || !name.trim() || name.trim().length > 80) return json({ error: "Escribe un nombre de hasta 80 caracteres." }, 400);
		const doc = await payload(ctx, "workspace-folders", {
			method: "POST",
			body: JSON.stringify({ name: name.trim() })
		});
		return json({ doc: {
			id: String(doc.id),
			name: doc.name,
			createdAt: doc.createdAt
		} }, 201);
	} catch {
		return json({ error: "No pudimos crearla. Comprueba si ya existe una carpeta con ese nombre." }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/file-folders@_@ts
var page = () => file_folders_exports;
//#endregion
export { page };
