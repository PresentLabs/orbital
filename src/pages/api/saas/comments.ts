import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { canView, canWrite } from "@/lib/saas/permissions";
const publicComment = (c: any) => ({
  id: String(c.id),
  taskId: c.taskId,
  authorId: String(typeof c.author === "object" ? c.author.id : c.author),
  authorName: c.authorName,
  text: c.text,
  mentions: (c.mentions || []).map((id: any) =>
    String(typeof id === "object" ? id.id : id),
  ),
  createdAt: c.createdAt,
});
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canView(user, "tasks"))
    return json({ error: "No tienes acceso a tareas." }, 403);
  try {
    let path = "comments?depth=0&limit=1000&sort=createdAt";
    const task = ctx.url.searchParams.get("task");
    if (task) path += "&where[taskId][equals]=" + encodeURIComponent(task);
    const result = await payload(ctx, path);
    return json({ docs: result.docs.map(publicComment) });
  } catch {
    return json({ error: "No pudimos cargar los comentarios." }, 503);
  }
};
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canWrite(user, "tasks"))
    return json({ error: "Tu rol no permite añadir comentarios." }, 403);
  try {
    const { taskId, text, mentions } = await ctx.request.json();
    if (
      typeof taskId !== "string" ||
      !/^[a-zA-Z0-9 _-]{1,100}$/.test(taskId) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 5000 ||
      !Array.isArray(mentions) ||
      mentions.length > 20 ||
      mentions.some(
        (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id),
      )
    )
      return json({ error: "Escribe un comentario válido." }, 400);
    const result = await payload(ctx, "comments", {
      method: "POST",
      body: JSON.stringify({ taskId, text: text.trim(), mentions }),
    });
    return json({ doc: publicComment(result.doc) }, 201);
  } catch {
    return json(
      {
        error:
          "No pudimos publicar el comentario. Revisa que las personas mencionadas tengan acceso a esta tarea.",
      },
      400,
    );
  }
};
