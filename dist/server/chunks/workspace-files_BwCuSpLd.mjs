import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, l as setting, r as currentUser, s as sameOrigin, t as COOKIE } from "./server_Bo7bLI-7.mjs";
import { n as canWrite, t as canView } from "./permissions_BVhMm5T3.mjs";
//#region services/payload/src/workspace-file-policy.ts
var workspaceFileTypes = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
	"image/svg+xml",
	"text/plain",
	"text/markdown",
	"text/csv",
	"application/zip",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
	"video/mp4",
	"video/webm"
];
function validWorkspaceFile(type, size) {
	return workspaceFileTypes.includes(type) && size > 0 && size <= 20971520;
}
//#endregion
//#region src/pages/api/saas/workspace-files.ts
var workspace_files_exports = /* @__PURE__ */ __exportAll({
	DELETE: () => DELETE,
	GET: () => GET,
	PATCH: () => PATCH,
	POST: () => POST
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canView(user, "files")) return json({ error: "No tienes acceso a los archivos del equipo." }, 403);
	try {
		const id = ctx.url.searchParams.get("id");
		if (id) {
			if (!/^\d+$/.test(id)) return json({ error: "Archivo no válido." }, 400);
			const doc = await payload(ctx, "workspace-files/" + id + "?depth=0");
			if (doc.deletedAt) return json({ error: "El archivo está en la papelera." }, 410);
			const base = setting(ctx, "PAYLOAD_URL"), url = new URL(doc.url, base);
			if (url.origin !== new URL(base).origin) throw Error();
			const r = await fetch(url, {
				headers: { Authorization: "JWT " + ctx.cookies.get(COOKIE).value },
				redirect: "error",
				signal: AbortSignal.timeout(3e4)
			});
			if (!r.ok) throw Error();
			return new Response(r.body, { headers: {
				"Content-Type": doc.mimeType || "application/octet-stream",
				"Content-Disposition": (ctx.url.searchParams.has("download") ? "attachment" : "inline") + "; filename=\"" + String(doc.filename || "archivo").replace(/["\r\n\\]/g, "_") + "\"",
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
				"Content-Security-Policy": "default-src 'none'; sandbox"
			} });
		}
		const query = "workspace-files?depth=0&limit=1000&sort=-createdAt&where[deletedAt][exists]=" + (ctx.url.searchParams.get("trash") === "1");
		let result = await payload(ctx, query), page = 1;
		const docs = [...result.docs];
		while (result.hasNextPage) {
			result = await payload(ctx, query + "&page=" + ++page);
			docs.push(...result.docs);
		}
		return json({ docs: [...new Map(docs.map((d) => [d.id, d])).values()].map((d) => ({
			id: String(d.id),
			title: d.title,
			filename: d.filename,
			mime: d.mimeType,
			size: d.filesize,
			createdAt: d.createdAt,
			updatedAt: d.updatedAt,
			deletedAt: d.deletedAt,
			folderId: d.folder ? String(typeof d.folder === "object" ? d.folder.id : d.folder) : void 0
		})) });
	} catch {
		return json({ error: "No pudimos cargar los archivos." }, 503);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canWrite(user, "files")) return json({ error: "No puedes subir archivos." }, 403);
	try {
		const form = await ctx.request.formData(), file = form.get("file");
		if (!(file instanceof File) || !validWorkspaceFile(file.type, file.size)) return json({ error: "Formato no compatible o archivo mayor a 20 MB." }, 400);
		const body = new FormData();
		body.set("file", file);
		body.set("_payload", JSON.stringify({
			title: String(form.get("title") || file.name).trim().slice(0, 160),
			workspace: typeof user.workspace === "object" ? user.workspace.id : user.workspace,
			folder: form.get("folderId") || null
		}));
		if (!(await fetch(setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/workspace-files", {
			method: "POST",
			headers: { Authorization: "JWT " + ctx.cookies.get("orbita_session").value },
			body,
			signal: AbortSignal.timeout(3e4)
		})).ok) throw Error();
		return json({ ok: true }, 201);
	} catch {
		return json({ error: "No pudimos subir el archivo." }, 400);
	}
};
var change = (restore) => async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canWrite(user, "files")) return json({ error: "No puedes modificar archivos." }, 403);
	try {
		const body = await ctx.request.json(), { id } = body;
		const moving = restore && Object.hasOwn(body, "folderId");
		if (moving && body.folderId !== null && body.folderId !== "" && !/^\d+$/.test(String(body.folderId))) return json({ error: "Carpeta no válida." }, 400);
		if (!/^\d+$/.test(String(id))) return json({ error: "Archivo no válido." }, 400);
		await payload(ctx, "workspace-files/" + id, {
			method: "PATCH",
			body: JSON.stringify(moving ? { folder: body.folderId || null } : { deletedAt: restore ? null : (/* @__PURE__ */ new Date()).toISOString() })
		});
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos actualizar el archivo." }, 400);
	}
};
var DELETE = change(false);
var PATCH = change(true);
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/workspace-files@_@ts
var page = () => workspace_files_exports;
//#endregion
export { page };
