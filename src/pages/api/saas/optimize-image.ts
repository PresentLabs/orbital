import type { APIRoute } from "astro";
import { optimizeWorkspaceImage } from "../../../../services/payload/src/image-optimization.ts";
import { currentUser, sameOrigin, json } from "@/lib/saas/server";
import { canWrite } from "@/lib/saas/permissions";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const demo = ctx.url.searchParams.get("demo") === "1";
  // The demo transform stores nothing and is limited to loopback development; it grants no data access.
  const localDemo =
    demo &&
    import.meta.env.DEV &&
    ["127.0.0.1", "localhost"].includes(ctx.url.hostname);
  const user = localDemo ? null : await currentUser(ctx);
  if (!localDemo && !canWrite(user, "files"))
    return json({ error: "No puedes subir archivos." }, 403);
  try {
    const form = await ctx.request.formData(),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      file.size > 20 * 1024 * 1024
    )
      return json({ error: "Imagen no compatible o mayor a 20 MB." }, 400);
    const optimized = await optimizeWorkspaceImage({
      data: Buffer.from(await file.arrayBuffer()),
      name: file.name,
      mimetype: file.type,
      size: file.size,
    });
    return new Response(new Uint8Array(optimized.data), {
      headers: {
        "Content-Type": optimized.mimetype,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json({ error: "No pudimos optimizar la imagen." }, 400);
  }
};
