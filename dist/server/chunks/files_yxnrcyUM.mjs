import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, l as setting, r as currentUser, s as sameOrigin, t as COOKIE } from "./server_Bo7bLI-7.mjs";
import { i as isAdmin } from "./permissions_BVhMm5T3.mjs";
//#region src/pages/api/saas/files.ts
var files_exports = /* @__PURE__ */ __exportAll({
	DELETE: () => DELETE,
	GET: () => GET,
	POST: () => POST
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!isAdmin(user)) return json({ error: "Solo los administradores pueden ver estos documentos." }, 403);
	try {
		const id = ctx.url.searchParams.get("id");
		if (id) {
			if (!/^\d+$/.test(id)) return json({ error: "Documento no válido." }, 400);
			const doc = await payload(ctx, "files/" + id + "?depth=0");
			if (doc.deletedAt) return json({ error: "Este documento está en la papelera." }, 410);
			const base = setting(ctx, "PAYLOAD_URL");
			const url = new URL(doc.url, base);
			if (url.origin !== new URL(base).origin) throw Error();
			const result = await fetch(url, {
				headers: { Authorization: "JWT " + ctx.cookies.get(COOKIE).value },
				redirect: "error",
				signal: AbortSignal.timeout(2e4)
			});
			if (!result.ok) throw Error();
			const filename = String(doc.filename || "documento").replace(/["\r\n\\]/g, "_");
			return new Response(result.body, { headers: {
				"Content-Type": doc.mimeType || "application/octet-stream",
				"Content-Disposition": (ctx.url.searchParams.has("download") ? "attachment" : "inline") + "; filename=\"" + filename + "\"",
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
				"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"
			} });
		}
		const receipt = ctx.url.searchParams.has("receipts");
		const result = await payload(ctx, "files?depth=0&limit=1000&sort=-createdAt&where[deletedAt][exists]=false" + (receipt ? "&where[kind][in]=factura,boleta" : ""));
		return json({ docs: result.docs.map((d) => ({
			id: String(d.id),
			title: d.title,
			filename: d.filename,
			mime: d.mimeType,
			size: d.filesize,
			createdAt: d.createdAt,
			kind: d.kind,
			orderId: d.orderId,
			folio: d.folio
		})) });
	} catch {
		return json({ error: "No pudimos abrir los documentos." }, 503);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!isAdmin(user)) return json({ error: "Solo un administrador puede subir documentos." }, 403);
	try {
		const incoming = await ctx.request.formData(), file = incoming.get("file");
		if (!(file instanceof File) || file.size > 20971520 || ![
			"application/pdf",
			"image/png",
			"image/jpeg",
			"image/webp",
			"text/plain",
			"text/markdown",
			"text/csv"
		].includes(file.type)) return json({ error: "Sube un PDF, imagen o archivo de texto de hasta 20 MB." }, 400);
		const title = String(incoming.get("title") || file.name).trim().slice(0, 160), kind = String(incoming.get("kind") || "documento"), orderId = Number(incoming.get("orderId")) || void 0, folio = String(incoming.get("folio") || "").slice(0, 80);
		if (![
			"documento",
			"factura",
			"boleta"
		].includes(kind) || kind !== "documento" && !orderId) return json({ error: "Asocia la factura o boleta a un pedido." }, 400);
		const body = new FormData();
		body.set("file", file);
		body.set("_payload", JSON.stringify({
			title,
			kind,
			orderId,
			folio,
			workspace: typeof user.workspace === "object" ? user.workspace.id : user.workspace
		}));
		const result = await fetch(setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/files", {
			method: "POST",
			headers: { Authorization: "JWT " + ctx.cookies.get(COOKIE).value },
			body,
			signal: AbortSignal.timeout(3e4)
		});
		if (!result.ok) throw Error();
		return json({
			ok: true,
			doc: (await result.json()).doc
		}, 201);
	} catch {
		return json({ error: "No pudimos subir el documento." }, 400);
	}
};
var DELETE = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!isAdmin(user)) return json({ error: "Solo un administrador puede eliminar documentos." }, 403);
	try {
		const { id } = await ctx.request.json();
		if (!/^\d+$/.test(String(id))) return json({ error: "Documento no válido." }, 400);
		await payload(ctx, "files/" + id, {
			method: "PATCH",
			body: JSON.stringify({ deletedAt: (/* @__PURE__ */ new Date()).toISOString() })
		});
		return json({ ok: true });
	} catch {
		return json({ error: "No pudimos enviar el documento a la papelera." }, 503);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/files@_@ts
var page = () => files_exports;
//#endregion
export { page };
