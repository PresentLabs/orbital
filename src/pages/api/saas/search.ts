import type { APIRoute } from "astro";
import { currentUser, json, payload } from "@/lib/saas/server";
import { canView } from "@/lib/saas/permissions";
import { connection, storeUrl } from "@/lib/saas/integrations";
import type { SearchEntry } from "@/lib/saas/search";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  const q = (ctx.url.searchParams.get("q") || "").trim().slice(0, 120);
  if (!q) return json({ results: [] });
  const results: SearchEntry[] = [],
    warnings: string[] = [];
  const jobs = [];
  if (canView(user, "documents"))
    jobs.push(
      (async () => {
        try {
          const query = new URLSearchParams({
            depth: "0",
            limit: "100",
            sort: "-createdAt",
            "where[deletedAt][exists]": "false",
            "where[or][0][title][contains]": q,
            "where[or][1][filename][contains]": q,
          });
          if (/^#?\d+$/.test(q))
            query.set("where[or][2][orderId][equals]", q.replace(/^#/, ""));
          const files = await payload(ctx, "files?" + query.toString());
          results.push(
            ...files.docs.map((f: any) => ({
              id: String(f.id),
              kind: "document" as const,
              title: f.title,
              subtitle:
                f.filename + (f.orderId ? " · Pedido #" + f.orderId : ""),
            })),
          );
        } catch {
          warnings.push("No pudimos buscar en documentos.");
        }
      })(),
    );
  if (canView(user, "orders"))
    jobs.push(
      (async () => {
        try {
          const c = await connection(ctx, "woo");
          if (!c) return;
          const response = await fetch(
            storeUrl(ctx, c.credentials.url) +
              "/wp-json/wc/v3/orders?per_page=50&search=" +
              encodeURIComponent(q.replace(/^#/, "")),
            {
              headers: {
                Authorization:
                  "Basic " +
                  btoa(c.credentials.key + ":" + c.credentials.secret),
              },
              redirect: "error",
              signal: AbortSignal.timeout(12000),
            },
          );
          if (!response.ok) throw Error();
          const orders = await response.json();
          results.push(
            ...orders.map((o: any) => ({
              id: String(o.id),
              kind: "order" as const,
              title: "Pedido #" + o.number,
              subtitle: [o.billing?.first_name, o.billing?.last_name, o.status]
                .filter(Boolean)
                .join(" · "),
            })),
          );
        } catch {
          warnings.push("No pudimos buscar en la tienda.");
        }
      })(),
    );
  await Promise.all(jobs);
  return json({ results, warnings });
};
