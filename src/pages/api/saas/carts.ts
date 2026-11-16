import { canView } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, json } from "@/lib/saas/server";
import { connection, storeUrl } from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  if (!(await currentUser(ctx))) return json({ error: "Inicia sesión" }, 401);
  if (!canView(await currentUser(ctx), "analytics"))
    return json({ error: "No tienes acceso a esta sección." }, 403);
  try {
    const c = await connection(ctx, "woo");
    if (!c) return json({ connected: false });
    const url = storeUrl(ctx, c.credentials.url);
    const res = await fetch(url + "/wp-json/wc/v3/orbita/abandoned-carts", {
      headers: {
        Authorization:
          "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret),
      },
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return json({ connected: false, requiresPlugin: true });
    return json({ connected: true, ...(await res.json()) });
  } catch {
    return json({ error: "No se pudo consultar carros abandonados" }, 502);
  }
};
