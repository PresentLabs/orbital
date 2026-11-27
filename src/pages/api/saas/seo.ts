import { isAdmin } from "@/lib/saas/permissions";
import { canView } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, json, sameOrigin } from "@/lib/saas/server";
import {
  connection,
  saveConnection,
  googleToken,
} from "@/lib/saas/integrations";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
  const user = await currentUser(ctx);
  if (!user || !isAdmin(user))
    return json({ error: "Solo el propietario puede configurar SEO" }, 403);
  try {
    const { property } = await ctx.request.json();
    if (
      typeof property !== "string" ||
      property.length > 250 ||
      !/^(sc-domain:[a-zA-Z0-9.-]+|https:\/\/[^\s]+\/)$/.test(property)
    )
      return json(
        { error: "Usa sc-domain:tudominio.cl o https://tudominio.cl/" },
        400,
      );
    const c = await connection(ctx, "google");
    if (!c) return json({ error: "Conecta primero tu cuenta de Google" }, 400);
    await saveConnection(ctx, "google", { ...c.credentials, property });
    return json({ ok: true });
  } catch {
    return json({ error: "No se pudo guardar la propiedad" }, 503);
  }
};
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión" }, 401);
  if (!canView(user, "analytics"))
    return json({ error: "No tienes acceso a esta sección." }, 403);
  try {
    const c = await connection(ctx, "google");
    if (!c?.credentials.property) return json({ connected: false });
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 27);
    const token = await googleToken(ctx);
    const response = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites/" +
        encodeURIComponent(c.credentials.property) +
        "/searchAnalytics/query",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions: ["date"],
          rowLimit: 100,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    return json({
      connected: true,
      rows: data.rows || [],
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  } catch {
    return json(
      {
        error:
          "No se pudo consultar Search Console. Revisa la propiedad y los permisos de Google.",
      },
      502,
    );
  }
};
