import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
export const GET: APIRoute = async (ctx) => {
  if (!(await currentUser(ctx))) return json({ error: "Inicia sesión." }, 401);
  try {
    return json(await payload(ctx, "team-polls"));
  } catch {
    return json({ error: "No pudimos cargar las votaciones." }, 503);
  }
};
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  if (!(await currentUser(ctx))) return json({ error: "Inicia sesión." }, 401);
  try {
    const body = await ctx.request.json();
    return json(
      await payload(
        ctx,
        body.action === "vote" ? "team-poll-vote" : "team-polls",
        { method: "POST", body: JSON.stringify(body) },
      ),
    );
  } catch {
    return json(
      {
        error: "No pudimos guardar. Revisa los participantes y si ya votaste.",
      },
      400,
    );
  }
};
