import { defineMiddleware } from "astro:middleware";
import { currentUser } from "@/lib/saas/server";

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  if (path !== "/app" && !path.startsWith("/app/")) return next();

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
  return response;
});
