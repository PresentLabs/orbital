import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { canView } from "@/lib/saas/permissions";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canView(user, "profile")) return json({ docs: [] });
  try {
    const result = await payload(
      ctx,
      "notifications?depth=0&limit=1000&sort=-createdAt",
    );
    return json({
      docs: result.docs.map((n: any) => ({
        id: String(n.id),
        kind: n.kind,
        pollId: n.pollId,
        authorName: n.authorName,
        taskId: n.taskId,
        commentId: n.commentId,
        recipientId: String(n.recipient),
        text: n.text,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
    });
  } catch {
    return json({ error: "No pudimos cargar tus avisos." }, 503);
  }
};
export const PATCH: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canView(user, "profile"))
    return json({ error: "No tienes acceso a tareas." }, 403);
  try {
    const { id } = await ctx.request.json();
    if (!/^[a-zA-Z0-9_-]+$/.test(String(id)))
      return json({ error: "Aviso no válido." }, 400);
    await payload(ctx, "notifications/" + id, {
      method: "PATCH",
      body: JSON.stringify({ readAt: new Date().toISOString() }),
    });
    return json({ ok: true });
  } catch {
    return json({ error: "No pudimos marcar el aviso como leído." }, 400);
  }
};

export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  if (!(await currentUser(ctx))) return json({ error: "Inicia sesión." }, 401);
  try {
    return json(
      await payload(ctx, "send-notification", {
        method: "POST",
        body: JSON.stringify(await ctx.request.json()),
      }),
    );
  } catch {
    return json(
      {
        error:
          "No pudimos enviar el aviso. Revisa el mensaje y las personas seleccionadas.",
      },
      400,
    );
  }
};

export const DELETE: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  if (!(await currentUser(ctx))) return json({ error: "Inicia sesión." }, 401);
  const { id } = (await ctx.request.json().catch(() => null)) || {};
  if (typeof id !== "string" || !/^\d+$/.test(id))
    return json({ error: "Aviso no válido." }, 400);
  try {
    await payload(ctx, "notifications/" + id, { method: "DELETE" });
    return json({ ok: true });
  } catch {
    return json({ error: "No pudimos eliminar el aviso." }, 400);
  }
};
