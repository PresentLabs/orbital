import type { APIRoute } from "astro";
import { sameOrigin, json, setting } from "@/lib/saas/server";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  try {
    if (Number(ctx.request.headers.get("content-length")) > 2000)
      return json({ error: "Solicitud no válida." }, 400);
    const body = await ctx.request.json();
    const response = await fetch(
      setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/accept-invitation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: body.token, password: body.password }),
        signal: AbortSignal.timeout(12000),
      },
    );
    return json(await response.json(), response.status);
  } catch {
    return json(
      { error: "No pudimos guardar tu contraseña. Inténtalo nuevamente." },
      503,
    );
  }
};
