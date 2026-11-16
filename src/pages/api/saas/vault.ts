import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { canView, canWrite, isAdmin } from "@/lib/saas/permissions";
import { seal, unseal } from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canView(user, "vault"))
    return json({ error: "No tienes permiso para ver los accesos." }, 403);
  try {
    const id = ctx.url.searchParams.get("id");
    if (id) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id))
        return json({ error: "Acceso no válido." }, 400);
      const row = await payload(ctx, "vault/" + id + "?depth=0");
      if (row.deletedAt)
        return json({ error: "Este acceso está en la papelera." }, 410);
      return json({
        doc: { id: String(row.id), ...(await unseal(ctx, row.credentials)) },
      });
    }
    const result = await payload(
      ctx,
      "vault?depth=0&limit=1000&where[deletedAt][exists]=false&sort=-updatedAt",
    );
    const docs = await Promise.all(
      result.docs.map(async (row: any) => {
        const v = await unseal(ctx, row.credentials);
        return {
          id: String(row.id),
          title: v.title,
          category: v.category,
          url: v.url,
          username: v.username,
          hasSecret: !!v.password,
          updatedAt: row.updatedAt,
        };
      }),
    );
    return json({ docs });
  } catch {
    return json(
      {
        error:
          "No pudimos abrir los accesos. Revisa la clave de cifrado del servidor.",
      },
      503,
    );
  }
};
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canWrite(user, "vault"))
    return json({ error: "Tu rol solo permite consultar los accesos." }, 403);
  try {
    const body = await ctx.request.json();
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.length > 100 ||
      !["Plataformas", "Redes sociales", "Hosting", "Otros"].includes(
        body.category,
      ) ||
      ["url", "username", "password", "notes"].some(
        (k) => typeof body[k] !== "string" || body[k].length > 10000,
      )
    )
      return json({ error: "Revisa los datos del acceso." }, 400);
    if (body.url && !/^https?:\/\//.test(body.url))
      return json({ error: "Escribe una URL que empiece con https://." }, 400);
    const credentials = await seal(ctx, {
      title: body.title.trim(),
      category: body.category,
      url: body.url,
      username: body.username,
      password: body.password,
      notes: body.notes,
    });
    if (body.id && !/^[a-zA-Z0-9_-]+$/.test(String(body.id)))
      return json({ error: "Acceso no válido." }, 400);
    const result = await payload(
      ctx,
      "vault" + (body.id ? "/" + body.id : ""),
      {
        method: body.id ? "PATCH" : "POST",
        body: JSON.stringify({ credentials }),
      },
    );
    return json({ id: String(result.doc.id) });
  } catch {
    return json({ error: "No pudimos guardar este acceso." }, 400);
  }
};
export const DELETE: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!isAdmin(user))
    return json(
      { error: "Solo un administrador puede eliminar accesos." },
      403,
    );
  try {
    const { id } = await ctx.request.json();
    if (!/^[a-zA-Z0-9_-]+$/.test(String(id)))
      return json({ error: "Acceso no válido." }, 400);
    await payload(ctx, "vault/" + id, {
      method: "PATCH",
      body: JSON.stringify({ deletedAt: new Date().toISOString() }),
    });
    return json({ ok: true });
  } catch {
    return json({ error: "No pudimos eliminar este acceso." }, 400);
  }
};
