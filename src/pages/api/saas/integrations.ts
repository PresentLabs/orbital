import {isStoreProvider, blockedStore, storeConflictMessage} from "../../../../services/payload/src/store-integrations";
import { checkPayloadStore } from "@/lib/saas/payload-store";
import { isAdmin } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import {
  saveConnection,
  shopifyShop,
  shopifyDomain,
  storeUrl,
  wooSales,
  type Provider,
} from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  if (!(await currentUser(ctx))) return json({ connected: [] }, 401);
  try {
    const data = await payload(ctx, "integrations?depth=0&limit=10");
    return json({
      connected: data.docs.map((d: { provider: string }) => d.provider),
    });
  } catch {
    return json({ connected: [] }, 503);
  }
};
async function conflictFor(ctx: Parameters<APIRoute>[0], provider: unknown) {
  if (!isStoreProvider(provider)) return;
  const data = await payload(ctx, "integrations?depth=0&limit=10");
  return blockedStore(provider, data.docs.map((d: {provider:string}) => d.provider));
}
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
  const user = await currentUser(ctx);
  if (!user || !isAdmin(user))
    return json(
      { error: "Solo el propietario puede configurar conexiones" },
      403,
    );
  let provider: Provider | undefined;
  try {
    const body = await ctx.request.json();
    provider = body.provider as Provider;
    const c = body.credentials as Record<string, string>;
    if (
      !["woo", "shopify", "payload", "email", "whatsapp"].includes(provider) ||
      !c ||
      Object.values(c).some((v) => typeof v !== "string" || v.length > 2048)
    )
      return json({ error: "Configuración inválida" }, 400);
    const conflict = await conflictFor(ctx, provider);
    if (conflict) return json({error:storeConflictMessage(conflict)},409);
    if (provider === "payload") {
      c.url = storeUrl(ctx, c.url);
      Object.assign(c, await checkPayloadStore(c.url, c));
    }
    if (provider === "shopify") {
      c.shop = shopifyDomain(c.shop || "");
      if (!c.token || /[\r\n]/.test(c.token))
        return json({ error: "Completa el token de Admin API." }, 400);
      const shop = await shopifyShop(c);
      c.shopName = shop.name;
    }
    if (provider === "woo") {
      c.url = storeUrl(ctx, c.url);
      if (!/^ck_[a-f0-9]+$/.test(c.key) || !/^cs_[a-f0-9]+$/.test(c.secret))
        return json({ error: "Claves de WooCommerce inválidas" }, 400);
      await wooSales(ctx, c);
    }
    if (provider === "email" && (!/^re_/.test(c.token) || !c.from || !c.to))
      return json(
        { error: "Completa el remitente, destinatario y API key de Resend" },
        400,
      );
    if (
      provider === "whatsapp" &&
      (!/^\d+$/.test(c.phoneId) ||
        !/^\d{8,16}$/.test(c.to) ||
        !c.template ||
        !c.token)
    )
      return json({ error: "Revisa la configuración de WhatsApp" }, 400);
    await saveConnection(ctx, provider, c);
    return json({ ok: true });
  } catch (e) {
    try { const conflict = await conflictFor(ctx, provider); if (conflict) return json({error:storeConflictMessage(conflict)},409); } catch {}
    return json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo guardar la conexión",
      },
      400,
    );
  }
};

export const DELETE: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({error:"Origen inválido"},403);
  const user = await currentUser(ctx);
  if (!user || !isAdmin(user)) return json({error:"Solo un administrador puede desconectar la tienda."},403);
  try {
    const {provider} = await ctx.request.json();
    if (!isStoreProvider(provider)) return json({error:"Plataforma no válida."},400);
    const found = await payload(ctx,"integrations?depth=0&limit=1&where[provider][equals]="+provider);
    if (found.docs[0]) await payload(ctx,"integrations/"+found.docs[0].id,{method:"DELETE"});
    return json({ok:true});
  } catch { return json({error:"No pudimos desconectar la tienda. Inténtalo nuevamente."},503); }
};
