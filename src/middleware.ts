import { defineMiddleware } from "astro:middleware";
import { currentUser } from "@/lib/saas/server";

const hardened = (response: Response) => {
  try {
    if (!response.headers.has("X-Content-Type-Options")) response.headers.set("X-Content-Type-Options", "nosniff");
    if (!response.headers.has("Referrer-Policy")) response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  } catch {} // immutable headers (e.g. proxied responses) are left untouched
  return response;
};
export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  if (path !== "/app" && !path.startsWith("/app/")) return hardened(await next());

  ctx.locals.workspaceUser = await currentUser(ctx);
  const demo = ctx.url.searchParams.get("demo") === "1";
  let response: Response;
  if (!ctx.locals.workspaceUser && !demo) {
    response = ctx.redirect("/acceso", 302);
  } else if (ctx.locals.workspaceUser && demo) {
    const url = new URL(ctx.url);
    url.searchParams.delete("demo");
    response = ctx.redirect(url.pathname + url.search, 302);
  } else {
    response = await next();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return hardened(response);
});
