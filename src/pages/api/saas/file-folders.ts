import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { canView, canWrite } from "@/lib/saas/permissions";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canView(user, "files"))
    return json({ error: "No tienes acceso a Archivos." }, 403);
  try {
    const result = await payload(
      ctx,
      "workspace-folders?depth=0&limit=1000&sort=name",
    );
    return json({
      docs: result.docs.map((f: any) => ({
        id: String(f.id),
        name: f.name,
        createdAt: f.createdAt,
      })),
    });
  } catch {
    return json({ error: "No pudimos cargar las carpetas." }, 503);
  }
};
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canWrite(user, "files"))
    return json({ error: "No puedes crear carpetas." }, 403);
  try {
    const { name } = await ctx.request.json();
    if (typeof name !== "string" || !name.trim() || name.trim().length > 80)
      return json({ error: "Escribe un nombre de hasta 80 caracteres." }, 400);
    const doc = await payload(ctx, "workspace-folders", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() }),
    });
    return json(
      { doc: { id: String(doc.id), name: doc.name, createdAt: doc.createdAt } },
      201,
    );
  } catch {
    return json(
      {
        error:
          "No pudimos crearla. Comprueba si ya existe una carpeta con ese nombre.",
      },
      400,
    );
  }
};
