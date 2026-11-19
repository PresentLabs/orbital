import type { APIRoute } from "astro";
import { COOKIE, currentUser, json, sameOrigin, setting } from "@/lib/saas/server";

const handler: APIRoute = async (ctx) => {
  if (ctx.request.method !== "GET" && !sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  if (!(await currentUser(ctx))) return json({ error: "Inicia sesión." }, 401);
  try {
    const response = await fetch(setting(ctx, "PAYLOAD_URL").replace(/\/$/, "") + "/api/orbita-reservations" + ctx.url.search, {
      method: ctx.request.method,
      headers: { Authorization: "JWT " + ctx.cookies.get(COOKIE)!.value, "Content-Type": "application/json" },
      ...(ctx.request.method === "POST" ? { body: await ctx.request.text() } : {}),
      signal: AbortSignal.timeout(20000), redirect: "error",
    });
    if (ctx.request.method === "GET" && ctx.url.searchParams.get("action") === "image" && response.ok && response.headers.get("Content-Type") === "image/webp")
      return new Response(response.body,{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
    return json(await response.json(), response.status);
  } catch { return json({ error: "No pudimos conectar con Reservas. Intenta nuevamente." }, 503); }
};
export const GET = handler;
export const POST = handler;
