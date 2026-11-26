import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { n as canWrite } from "./permissions_BVhMm5T3.mjs";
import sharp from "sharp";
//#region services/payload/src/image-optimization.ts
async function optimizeWorkspaceImage(file) {
	if (![
		"image/png",
		"image/jpeg",
		"image/webp",
		"image/gif"
	].includes(file.mimetype)) return file;
	if (!file.size || file.size > 20971520) throw Error("La imagen debe pesar hasta 20 MB.");
	const input = sharp(file.data, {
		animated: true,
		limitInputPixels: 64e6,
		failOn: "error"
	}), meta = await input.metadata();
	if (![
		"png",
		"jpeg",
		"webp",
		"gif"
	].includes(meta.format || "")) throw Error("La imagen no es compatible.");
	const frameHeight = meta.pageHeight || meta.height || 0, width = meta.width || 0;
	const resized = Math.max(width, frameHeight) > 1600;
	const data = await input.rotate().resize({
		width: 1600,
		height: 1600,
		fit: "inside",
		withoutEnlargement: true
	}).webp({
		lossless: true,
		effort: 5
	}).toBuffer();
	if (!resized && (!meta.orientation || meta.orientation === 1) && data.length >= file.size) return file;
	return {
		...file,
		data,
		size: data.length,
		name: file.name.replace(/\.[^.]+$/, "") + ".webp",
		mimetype: "image/webp"
	};
}
//#endregion
//#region src/pages/api/saas/optimize-image.ts
var optimize_image_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const localDemo = ctx.url.searchParams.get("demo") === "1" && false;
	const user = localDemo ? null : await currentUser(ctx);
	if (!localDemo && !canWrite(user, "files")) return json({ error: "No puedes subir archivos." }, 403);
	try {
		const file = (await ctx.request.formData()).get("file");
		if (!(file instanceof File) || ![
			"image/png",
			"image/jpeg",
			"image/webp",
			"image/gif"
		].includes(file.type) || file.size > 20971520) return json({ error: "Imagen no compatible o mayor a 20 MB." }, 400);
		const optimized = await optimizeWorkspaceImage({
			data: Buffer.from(await file.arrayBuffer()),
			name: file.name,
			mimetype: file.type,
			size: file.size
		});
		return new Response(new Uint8Array(optimized.data), { headers: {
			"Content-Type": optimized.mimetype,
			"Cache-Control": "no-store"
		} });
	} catch {
		return json({ error: "No pudimos optimizar la imagen." }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/optimize-image@_@ts
var page = () => optimize_image_exports;
//#endregion
export { page };
