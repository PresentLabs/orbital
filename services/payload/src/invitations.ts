import { randomBytes } from "node:crypto";
import type { Endpoint } from "payload";
import { isAdmin, sections } from "./permissions.ts";
const tenant = (u: any) =>
  typeof u.workspace === "object" ? u.workspace.id : u.workspace;
const sent = new Map<string, number>();
export function invitationOrigin() {
  const url = new URL(
    process.env.SAAS_PUBLIC_URL ||
      (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:4345" : ""),
  );
  if (
    url.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw Error("Configura SAAS_PUBLIC_URL con HTTPS.");
  return url.origin;
}
export const inviteMemberEndpoint: Endpoint = {
  path: "/invite-member",
  method: "post",
  handler: async (req) => {
    if (!isAdmin(req.user))
      return Response.json(
        { error: "Solo un administrador puede invitar personas." },
        { status: 403 },
      );
    try {
      const body = await req.json!();
      const origin = invitationOrigin();
      let member: any;
      if (body.id) {
        member = await req.payload.findByID({
          collection: "users",
          id: body.id,
          overrideAccess: false,
          req,
          depth: 0,
        });
        if (
          !member ||
          String(tenant(member)) !== String(tenant(req.user)) ||
          member.role === "owner" ||
          member.disabled ||
          String(member.id) === String(req.user!.id)
        )
          return Response.json(
            { error: "No puedes enviar un enlace a esta cuenta." },
            { status: 403 },
          );
      } else {
        if (
          typeof body.name !== "string" ||
          !body.name.trim() ||
          body.name.length > 80 ||
          typeof body.email !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
          !["admin", "editor", "member", "viewer"].includes(body.role) ||
          !Array.isArray(body.permissions) ||
          body.permissions.some((p: string) => !sections.includes(p as any))
        )
          return Response.json(
            { error: "Revisa el nombre, correo y permisos." },
            { status: 400 },
          );
        member = await req.payload.create({
          collection: "users",
          data: {
            name: body.name.trim(),
            email: body.email.trim().toLowerCase(),
            password: randomBytes(48).toString("base64url"),
            role: body.role,
            permissions: body.permissions,
            workspace: tenant(req.user),
          },
          overrideAccess: false,
          req,
        });
      }
      const key = String(member.id),
        last = sent.get(key) || 0;
      if (Date.now() - last < 60000)
        return Response.json(
          { error: "Espera un minuto antes de enviar otro enlace." },
          { status: 429 },
        );
      sent.set(key, Date.now());
      if (sent.size > 10000)
        for (const [k, at] of sent) if (Date.now() - at > 60000) sent.delete(k);
      // Reuse Payload's cryptographically random, expiring reset token and password hashing.
      const token = await req.payload.forgotPassword({
        collection: "users",
        data: { email: member.email },
        disableEmail: true,
        expiration: 3600000,
        overrideAccess: true,
        req,
      });
      if (!token) throw Error();
      const url =
          origin + "/acceso/invitacion?negocio=" + encodeURIComponent(String(tenant(member))) + "#token=" + encodeURIComponent(token),
        expiresAt = new Date(Date.now() + 3600000).toISOString();
      let emailSent = false;
      if (process.env.RESEND_API_KEY && process.env.INVITATION_FROM) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + process.env.RESEND_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.INVITATION_FROM,
              to: [member.email],
              subject: "Te invitaron a trabajar en Órbita",
              text: `Hola, ${member.name}.\n\nTu equipo te invita a Órbita. Crea tu contraseña en este enlace:\n${url}\n\nEl enlace vence en una hora y solo puede usarse una vez. Si no esperabas esta invitación, ignórala.`,
            }),
            signal: AbortSignal.timeout(15000),
          });
          emailSent = response.ok;
        } catch {}
      }
      return Response.json(
        {
          doc: {
            id: String(member.id),
            name: member.name,
            email: member.email,
            role: member.role,
            permissions: member.permissions,
            disabled: !!member.disabled,
          },
          invite: {
            emailSent,
            expiresAt,
            ...(!emailSent ? { url } : {}),
            message: emailSent
              ? "Invitación enviada por correo."
              : "El correo no se envió. Comparte el enlace por un canal privado; vence en una hora.",
          },
        },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        {
          error:
            "No pudimos preparar la invitación. Revisa si el correo ya está registrado y usa Enviar enlace desde Gestionar para una cuenta existente.",
        },
        { status: 400 },
      );
    }
  },
};
export const acceptInvitationEndpoint: Endpoint = {
  path: "/accept-invitation",
  method: "post",
  handler: async (req) => {
    try {
      const body = await req.json!();
      if (
        typeof body.token !== "string" ||
        !/^[a-f0-9]{40}$/.test(body.token) ||
        typeof body.password !== "string" ||
        body.password.trim().length < 12 ||
        body.password.length > 128
      )
        return Response.json(
          {
            error:
              "Usa una contraseña de entre 12 y 128 caracteres y un enlace válido.",
          },
          { status: 400 },
        );
      const member: any = await req.payload.db.findOne({
        collection: "users",
        where: {
          and: [
            { resetPasswordToken: { equals: body.token } },
            {
              resetPasswordExpiration: {
                greater_than: new Date().toISOString(),
              },
            },
          ],
        },
        req,
      });
      if (!member || member.disabled || member.deletedAt)
        return Response.json(
          {
            error:
              "El enlace venció, ya fue utilizado o la cuenta no está disponible.",
          },
          { status: 400 },
        );
      await req.payload.resetPassword({
        collection: "users",
        data: { token: body.token, password: body.password },
        overrideAccess: true,
        req,
      });
      return Response.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        {
          error:
            "El enlace venció o ya fue utilizado. Pide a tu administrador uno nuevo.",
        },
        { status: 400 },
      );
    }
  },
};
