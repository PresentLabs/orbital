import { isAdmin } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, setting, json, sameOrigin } from "@/lib/saas/server";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
  const user = await currentUser(ctx);
  if (!user || !isAdmin(user))
    return json({ error: "Inicia sesión como propietario" }, 403);
  const client = setting(ctx, "GOOGLE_CLIENT_ID");
  if (!client || !setting(ctx, "GOOGLE_CLIENT_SECRET"))
    return json(
      {
        error:
          "Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor",
      },
      503,
    );
  const state = crypto.randomUUID();
  ctx.cookies.set("orbita_google_state", state + ":" + user.id, {
    httpOnly: true,
    secure: ctx.url.protocol === "https:",
    sameSite: "lax",
    path: "/api/saas/google",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: client,
    redirect_uri: ctx.url.origin + "/api/saas/google/callback",
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return json({
    url: "https://accounts.google.com/o/oauth2/v2/auth?" + params,
  });
};
