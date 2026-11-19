import type { APIRoute } from "astro";
import { COOKIE, currentUser, json, sameOrigin, setting } from "@/lib/saas/server";

const forward: APIRoute = async (ctx) => {
  if (ctx.request.method !== "GET" && !sameOrigin(ctx))
    return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  const admins = setting(ctx, "SAAS_ADMIN_USER_IDS").split(",").map((id) => id.trim()).filter(Boolean);
  if (!admins.includes(String(user.id)))
    return json({ error: "Acceso reservado al dueño del SaaS." }, 403);
  try {
    const response = await fetch(
      setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/platform-admin" + ctx.url.search,
      {
        method: ctx.request.method,
        headers: {
          Authorization: "JWT " + ctx.cookies.get(COOKIE)!.value,
          "Content-Type": "application/json",
        },
        ...(ctx.request.method === "POST" ? { body: await ctx.request.text() } : {}),
        signal: AbortSignal.timeout(20000),
      },
    );
    return json(await response.json(), response.status);
  } catch {
    return json({ error: "No pudimos conectar con la administración. Intenta nuevamente." }, 503);
  }
};
export const GET = forward;
export const POST = forward;
