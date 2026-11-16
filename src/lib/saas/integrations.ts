import type { APIContext } from "astro";
import { payload, setting } from "./server.ts";
export type Provider = "woo" | "shopify" | "payload" | "google" | "email" | "whatsapp";
export async function encryptionKey(ctx: APIContext) {
  const secret = setting(ctx, "INTEGRATIONS_SECRET");
  if (secret.length < 32) throw new Error("Configura INTEGRATIONS_SECRET");
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(ctx: APIContext, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(ctx),
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return btoa(
    Array.from(new Uint8Array([...iv, ...new Uint8Array(bytes)]), (n) =>
      String.fromCharCode(n),
    ).join(""),
  );
}
export async function unseal(
  ctx: APIContext,
  value: string,
): Promise<Record<string, string>> {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12) },
    await encryptionKey(ctx),
    bytes.slice(12),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
export async function connection(ctx: APIContext, provider: Provider) {
  const result = await payload(
    ctx,
    "integrations?depth=0&limit=1&where[provider][equals]=" + provider,
  );
  const row = result.docs[0];
  return row ? { row, credentials: await unseal(ctx, row.credentials) } : null;
}
export async function saveConnection(
  ctx: APIContext,
  provider: Provider,
  credentials: Record<string, string>,
) {
  const existing = await payload(
    ctx,
    "integrations?depth=0&limit=1&where[provider][equals]=" + provider,
  );
  const body = JSON.stringify({
    provider,
    credentials: await seal(ctx, credentials),
  });
  return payload(
    ctx,
    "integrations" + (existing.docs[0] ? "/" + existing.docs[0].id : ""),
    { method: existing.docs[0] ? "PATCH" : "POST", body },
  );
}
export function storeUrl(ctx: APIContext, input: string) {
  const url = new URL(input);
  const allowed = setting(ctx, "INTEGRATION_ALLOWED_HOSTS")
    .split(",")
    .map((x) => x.trim().toLowerCase());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !allowed.includes(url.hostname.toLowerCase())
  )
    throw new Error(
      "El dominio debe estar autorizado en INTEGRATION_ALLOWED_HOSTS",
    );
  return url.origin;
}
export async function wooSales(
  ctx: APIContext,
  credentials: Record<string, string>,
  period = "month",
) {
  const url = storeUrl(ctx, credentials.url);
  const result = await fetch(
    url + "/wp-json/wc/v3/reports/sales?period=" + encodeURIComponent(period),
    {
      headers: {
        Authorization:
          "Basic " + btoa(credentials.key + ":" + credentials.secret),
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!result.ok)
    throw new Error(
      "WooCommerce no respondió. Revisa las claves y permisos de lectura.",
    );
  return (await result.json())[0];
}
export async function googleToken(ctx: APIContext) {
  const existing = await connection(ctx, "google");
  if (!existing) throw new Error("Conecta Google Calendar");
  const credentials = existing.credentials;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: setting(ctx, "GOOGLE_CLIENT_ID"),
      client_secret: setting(ctx, "GOOGLE_CLIENT_SECRET"),
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(12000),
  });
  const token = await res.json();
  if (!res.ok) throw new Error("Vuelve a conectar tu cuenta de Google");
  return token.access_token as string;
}

export function shopifyDomain(input: string) {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value))
    throw Error("Usa el dominio de tu tienda: tu-tienda.myshopify.com");
  return value;
}
export async function shopifyShop(credentials: Record<string, string>) {
  const shop = shopifyDomain(credentials.shop);
  const response = await fetch(
    `https://${shop}/admin/api/2026-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": credentials.token,
      },
      body: JSON.stringify({
        query:
          "query OrbitaShop { shop { name myshopifyDomain currencyCode ianaTimezone } }",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (!response.ok || data.errors?.length || !data.data?.shop)
    throw Error(
      "Shopify no pudo validar la conexión. Revisa el token de Admin API y la tienda.",
    );
  return data.data.shop;
}

export async function wooSalesBetween(ctx:APIContext,credentials:Record<string,string>,from:string,to:string){
 const result=await fetch(storeUrl(ctx,credentials.url)+'/wp-json/wc/v3/reports/sales?date_min='+from+'&date_max='+to,{headers:{Authorization:'Basic '+btoa(credentials.key+':'+credentials.secret)},redirect:'error',signal:AbortSignal.timeout(15000)});if(!result.ok)throw Error('No pudimos consultar la comparación de ventas.');return (await result.json())[0];
}
