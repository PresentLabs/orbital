import type { APIRoute } from "astro";
import { currentUser, json } from "@/lib/saas/server";
import { isAdmin } from "@/lib/saas/permissions";
import { connection, storeUrl } from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!isAdmin(user))
    return json(
      { error: "Solo un administrador puede consultar clientes." },
      403,
    );
  try {
    const c = await connection(ctx, "woo");
    if (!c) return json({ connected: false, docs: [], total: 0, pages: 0 });
    const id = ctx.url.searchParams.get("id"),
      page = Math.max(
        1,
        Math.min(10000, Number(ctx.url.searchParams.get("page")) || 1),
      );
    if (id && !/^\d+$/.test(id))
      return json({ error: "Cliente no válido." }, 400);
    const headers = {
        Authorization:
          "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret),
      },
      base = storeUrl(ctx, c.credentials.url) + "/wp-json/wc/v3";
    const response = await fetch(
      base +
        "/customers" +
        (id
          ? "/" + id
          : "?per_page=10&page=" +
            page +
            "&search=" +
            encodeURIComponent(
              (ctx.url.searchParams.get("q") || "").slice(0, 120),
            )),
      { headers, redirect: "error", signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    const safe = (m: any) => ({
      id: String(m.id),
      name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username,
      email: m.email,
      phone: m.billing?.phone || "",
      date: m.date_created,
      billing: m.billing,
    });
    if (!id)
      return json({
        connected: true,
        docs: data.map(safe),
        total: Number(response.headers.get("X-WP-Total")),
        pages: Number(response.headers.get("X-WP-TotalPages")),
        page,
      });
    const orders = await fetch(
      base + "/orders?customer=" + id + "&per_page=10&page=" + page,
      { headers, redirect: "error", signal: AbortSignal.timeout(15000) },
    );
    if (!orders.ok) throw Error();
    return json({
      connected: true,
      doc: safe(data),
      orders: await orders.json(),
      total: Number(orders.headers.get("X-WP-Total")),
      pages: Number(orders.headers.get("X-WP-TotalPages")),
      page,
    });
  } catch {
    return json(
      { error: "No pudimos consultar los clientes de WooCommerce." },
      502,
    );
  }
};
