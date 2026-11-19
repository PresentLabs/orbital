import { isAdmin } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, publicOrigin, setting } from "@/lib/saas/server";
import { saveConnection, connection } from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  const state = ctx.url.searchParams.get("state");
  const cookie = ctx.cookies.get("orbita_google_state")?.value;
  ctx.cookies.delete("orbita_google_state", { path: "/api/saas/google" });
  if (!user || !isAdmin(user) || !state || cookie !== state + ":" + user.id)
    return ctx.redirect("/app?connection=error#integrations", 303);
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: setting(ctx, "GOOGLE_CLIENT_ID"),
        client_secret: setting(ctx, "GOOGLE_CLIENT_SECRET"),
        code: ctx.url.searchParams.get("code") || "",
        grant_type: "authorization_code",
        redirect_uri: publicOrigin(ctx) + "/api/saas/google/callback",
      }),
      signal: AbortSignal.timeout(12000),
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.refresh_token) throw Error();
    const previous = await connection(ctx, "google");
    await saveConnection(ctx, "google", {
      ...previous?.credentials,
      refresh_token: tokens.refresh_token,
    });
    return ctx.redirect("/app?connection=success#integrations", 303);
  } catch {
    return ctx.redirect("/app?connection=error#integrations", 303);
  }
};
