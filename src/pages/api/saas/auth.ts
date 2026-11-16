import type { APIRoute } from "astro";
import {
  COOKIE,
  payload,
  sameOrigin,
  setCookie,
  configured,
} from "@/lib/saas/server";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return ctx.redirect("/acceso?error=origin", 303);
  const form = await ctx.request.formData();
  const action = String(form.get("action"));
  const register = action === "register";
  const destination = register ? "/acceso/registro" : "/acceso";
  if (action === "logout") {
    ctx.cookies.delete(COOKIE, { path: "/" });
    return ctx.redirect("/acceso", 303);
  }
  if (!configured(ctx))
    return ctx.redirect(destination + "?error=unavailable", 303);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length > 128 ||
    password.length < (register ? 12 : 1)
  )
    return ctx.redirect(destination + "?error=validation", 303);
  try {
    if (register) {
      await payload(
        ctx,
        "register-workspace",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            name: String(form.get("name") || "").trim(),
            business: String(form.get("business") || "").trim(),
            code: String(form.get("code") || ""),
          }),
        },
        "",
      );
    }
    const result = await payload(
      ctx,
      "users/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      "",
    );
    setCookie(ctx, result.token);
    return ctx.redirect("/app", 303);
  } catch {
    return ctx.redirect(
      destination + "?error=" + (register ? "registration" : "credentials"),
      303,
    );
  }
};
