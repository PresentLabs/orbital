import type { APIContext } from "astro";
export const COOKIE = "orbita_session";
export function setting(ctx: APIContext, key: string): string {
  const runtime = (
    ctx.locals as unknown as { runtime?: { env?: Record<string, string> } }
  ).runtime?.env;
  return (
    runtime?.[key] ||
    (globalThis as { process?: { env?: Record<string, string> } }).process
      ?.env?.[key] ||
    (import.meta.env as Record<string, string>)[key] ||
    ""
  );
}
export function configured(ctx: APIContext) {
  return !!setting(ctx, "PAYLOAD_URL");
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
export function sameOrigin(ctx: APIContext) {
  return ctx.request.headers.get("origin") === publicOrigin(ctx);
}
export function publicOrigin(ctx: APIContext) {
  return (setting(ctx, "ORBITA_PUBLIC_ORIGIN").trim() || setting(ctx, "ORBITAL_PUBLIC_ORIGIN").trim()) || ctx.url.origin;
}
export async function payload(
  ctx: APIContext,
  path: string,
  init: RequestInit = {},
  token?: string,
) {
  const base = setting(ctx, "PAYLOAD_URL").replace(/\/$/, "");
  if (!base) throw new Error("Payload unavailable");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const auth = token ?? ctx.cookies.get(COOKIE)?.value;
  if (auth) headers.set("Authorization", "JWT " + auth);
  const response = await fetch(base + "/api/" + path, {
    ...init,
    headers,
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Payload " + response.status);
  return data;
}
export async function currentUser(ctx: APIContext) {
  if (!ctx.cookies.get(COOKIE)?.value) return null;
  try {
    const user = (await payload(ctx, "users/me")).user;
    return user && !user.disabled ? user : null;
  } catch {
    return null;
  }
}
export function setCookie(ctx: APIContext, token: string) {
  ctx.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: publicOrigin(ctx).startsWith("https://"),
    path: "/",
    maxAge: 7200,
  });
}
