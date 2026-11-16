import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";

export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);

  const body = await ctx.request.json().catch(() => null);
  const { currentPassword, password } = body || {};
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128 ||
      typeof password !== "string" || password.length < 12 || password.length > 128)
    return json({ error: "La nueva contraseña debe tener entre 12 y 128 caracteres." }, 400);

  try {
    const verification = await payload(ctx, "users/login", {
      method: "POST",
      body: JSON.stringify({ email: user.email, password: currentPassword }),
    }, "");
    if (String(verification.user?.id) !== String(user.id)) throw Error();
  } catch {
    return json({ error: "No pudimos verificar tu contraseña actual." }, 403);
  }
  try {
    await payload(ctx, "users/" + user.id, {
      method: "PATCH",
      body: JSON.stringify({ password }),
    });
    return json({ ok: true });
  } catch {
    return json({ error: "No pudimos cambiar tu contraseña." }, 503);
  }
};
