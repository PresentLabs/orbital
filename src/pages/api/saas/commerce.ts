import { salesPeriods, percentageChange } from "@/lib/saas/money";
import { canView } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, json, payload } from "@/lib/saas/server";
import { connection, wooSalesBetween } from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión" }, 401);
  if (!canView(user, "analytics"))
    return json({ error: "No tienes acceso a esta sección." }, 403);
  try {
    const c = await connection(ctx, "woo");
    if (!c) return json({ connected: false });
    const week = ctx.url.searchParams.get("period") === "week";
    const branding = await payload(ctx, "branding");
    const range = salesPeriods(
      week,
      new Date(),
      branding.timezone || "America/Santiago",
    );
    const report = await wooSalesBetween(
      ctx,
      c.credentials,
      range.from,
      range.to,
    );
    let salesChange: number | null = null;
    try {
      const previous = await wooSalesBetween(
        ctx,
        c.credentials,
        range.previousFrom,
        range.previousTo,
      );
      salesChange = percentageChange(report.total_sales, previous.total_sales);
    } catch {}
    return json({ connected: true, report: { ...report, salesChange } });
  } catch {
    return json({ error: "No se pudo consultar WooCommerce" }, 502);
  }
};
