import type { APIRoute } from "astro";
import {
  COOKIE,
  currentUser,
  payload,
  sameOrigin,
  setCookie,
  configured,
  setting,
} from "@/lib/saas/server";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return ctx.redirect("/acceso?error=origin", 303);
  const form = await ctx.request.formData();
  const action = String(form.get("action"));
  const register = action === "register";
  const business = String(form.get("workspace") || "");
  const businessQuery = /^\d+$/.test(business) ? "?negocio=" + business : "";
  const destination = (register ? "/acceso/registro" : "/acceso") + businessQuery;
  const failure = (error: string) => destination + (businessQuery ? "&" : "?") + "error=" + error;
  if (action === "logout") {
    const user = await currentUser(ctx);
    const workspace = typeof user?.workspace === "object" ? user.workspace.id : user?.workspace;
    ctx.cookies.delete(COOKIE, { path: "/" });
    return ctx.redirect("/acceso" + (workspace ? "?negocio=" + workspace : businessQuery), 303);
  }
  if (!configured(ctx))
    return ctx.redirect(failure("unavailable"), 303);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length > 128 ||
    password.length < (register ? 12 : 1)
  )
    return ctx.redirect(failure("validation"), 303);
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
    const workspace = typeof result.user?.workspace === "object"
      ? result.user.workspace.id : result.user?.workspace;
    if (!register && businessQuery && String(workspace) !== business)
      return ctx.redirect(failure("business"), 303);
    setCookie(ctx, result.token);
    const admins = setting(ctx, "SAAS_ADMIN_USER_IDS").split(",").map((id) => id.trim()).filter(Boolean);
    return ctx.redirect(admins.includes(String(result.user?.id)) ? "/administracion" : "/app", 303);
  } catch {
    return ctx.redirect(
      failure(register ? "registration" : "credentials"),
      303,
    );
  }
};
