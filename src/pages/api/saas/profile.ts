import { ecommerceRoles } from "../../../../services/payload/src/ecommerce";
import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { formatPhone, validPhone, validAvatar } from "@/lib/saas/formats";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  return user
    ? json({ user, branding: await payload(ctx, "branding") })
    : json({ error: "Inicia sesión." }, 401);
};
export const PATCH: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  try {
    const body = await ctx.request.json();
    if (
      ["firstName", "lastName", "phone", "jobTitle"].some(
        (k) => typeof body[k] !== "string" || body[k].length > 100,
      ) ||
      !body.firstName.trim() ||
      !validPhone(body.phone) ||
      (body.jobTitle &&
        !ecommerceRoles.some((role) => role.value === body.jobTitle))
    )
      return json({ error: "Revisa el nombre y el teléfono." }, 400);
    if (
      body.avatarData !== undefined &&
      body.avatarData !== "" &&
      !validAvatar(body.avatarData)
    )
      return json(
        { error: "Elige una imagen PNG, JPG o WebP de hasta 250 KB." },
        400,
      );
    const data = {
      ...(body.avatarData !== undefined ? { avatarData: body.avatarData } : {}),
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      phone: formatPhone(body.phone),
      jobTitle: body.jobTitle.trim() || null,
      name: (body.firstName.trim() + " " + body.lastName.trim()).trim(),
    };
    const result = await payload(ctx, "users/" + user.id, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return json({ user: result.doc });
  } catch {
    return json({ error: "No pudimos guardar tu perfil." }, 400);
  }
};
