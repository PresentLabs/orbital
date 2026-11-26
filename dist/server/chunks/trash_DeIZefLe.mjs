import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { a as sectionForKey, i as isAdmin, n as canWrite, t as canView } from "./permissions_BVhMm5T3.mjs";
import { c as unseal } from "./integrations_P9zpvxGj.mjs";
function expired(deletedAt, now = Date.now()) {
	const time = Date.parse(String(deletedAt || ""));
	return Number.isFinite(time) && now - time >= 2592e6;
}
//#endregion
//#region src/pages/api/saas/trash.ts
var trash_exports = /* @__PURE__ */ __exportAll({
	DELETE: () => DELETE,
	GET: () => GET,
	PATCH: () => PATCH
});
var sectionOf = (collection, row) => collection === "workspace-files" ? "files" : collection === "documents" ? sectionForKey(row.key) : collection === "files" ? "documents" : collection === "vault" ? "vault" : "team";
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	const results = [];
	const jobs = [
		"documents",
		...isAdmin(user) ? ["files", "users"] : [],
		...canView(user, "vault") ? ["vault"] : []
	].map(async (collection) => {
		const query = collection + "?limit=1000&depth=0&where[deletedAt][exists]=true";
		let page = 1;
		let data = await payload(ctx, query);
		const rows = [...data.docs];
		while (data.hasNextPage) {
			data = await payload(ctx, query + "&page=" + ++page);
			rows.push(...data.docs);
		}
		for (const row of rows) {
			if (!row.deletedAt || expired(row.deletedAt) || row.trashGroup) continue;
			let title = row.value?.title || row.value?.name || row.title || row.name || "Elemento";
			if (collection === "vault") try {
				title = (await unseal(ctx, row.credentials)).title || "Acceso";
			} catch {
				title = "Acceso cifrado";
			}
			results.push({
				id: String(row.id),
				collection,
				key: row.key,
				section: sectionOf(collection, row),
				title,
				deletedAt: row.deletedAt,
				privateOwner: row.privateOwner || void 0
			});
		}
	});
	try {
		await Promise.all(jobs);
		return json({ docs: results.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)) });
	} catch {
		return json({ error: "No pudimos abrir la papelera." }, 503);
	}
};
var changeTrash = (permanent) => async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	try {
		const { collection, id } = await ctx.request.json();
		if (![
			"documents",
			"files",
			"vault",
			"users",
			...permanent ? ["workspace-files"] : []
		].includes(collection) || !/^\d+$/.test(String(id))) return json({ error: "Elemento no válido." }, 400);
		const row = await payload(ctx, collection + "/" + id + "?depth=0"), section = sectionOf(collection, row);
		if (!section || !canWrite(user, section) || [
			"users",
			"files",
			"vault"
		].includes(collection) && !isAdmin(user)) return json({ error: "No puedes modificar este elemento." }, 403);
		if (!row.deletedAt || expired(row.deletedAt)) return json({ error: "El plazo de recuperación terminó." }, 410);
		if (collection === "users" && (String(row.id) === String(user.id) || row.role === "owner")) return json({ error: "Esta cuenta está protegida." }, 403);
		if (permanent) {
			if (row.trashGroup) return json({ error: "Elimina el elemento principal del grupo." }, 400);
			if (collection === "documents") {
				const query = "documents?depth=0&limit=100&where[trashGroup][equals]=" + encodeURIComponent(row.key) + "&where[deletedAt][exists]=true";
				let children;
				do {
					children = await payload(ctx, query);
					for (const child of children.docs) await payload(ctx, "documents/" + child.id, { method: "DELETE" });
				} while (children.hasNextPage);
			}
			await payload(ctx, collection + "/" + id, { method: "DELETE" });
			return json({ ok: true });
		}
		await payload(ctx, collection + "/" + id, {
			method: "PATCH",
			body: JSON.stringify({
				deletedAt: null,
				...collection === "users" ? { disabled: false } : {},
				...collection === "documents" ? { value: row.value } : {}
			})
		});
		if (collection === "documents") {
			const children = await payload(ctx, "documents?limit=1000&where[trashGroup][equals]=" + encodeURIComponent(row.key));
			for (const child of children.docs) if (!expired(child.deletedAt)) await payload(ctx, "documents/" + child.id, {
				method: "PATCH",
				body: JSON.stringify({
					deletedAt: null,
					trashGroup: null,
					value: child.value
				})
			});
		}
		return json({ ok: true });
	} catch {
		return json({ error: permanent ? "No pudimos eliminar el elemento." : "No pudimos restaurar el elemento." }, 503);
	}
};
var PATCH = changeTrash(false);
var DELETE = changeTrash(true);
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/trash@_@ts
var page = () => trash_exports;
//#endregion
export { page };
