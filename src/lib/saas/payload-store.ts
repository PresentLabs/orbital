export function payloadStoreConfig(c: Record<string, string>) {
  const slug = /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/;
  const authCollection = c.authCollection || "users",
    products = c.products || "products",
    orders = c.orders || "orders", customers = c.customers || authCollection;
  if (
    ![authCollection, products, orders, customers].every((s) => slug.test(s)) ||
    typeof c.token !== "string" ||
    !c.token.trim() ||
    c.token.length > 2048 ||
    /[\r\n]/.test(c.token)
  )
    throw Error("Revisa la API key y los nombres de las colecciones.");
  return { authCollection, products, orders, customers, token: c.token };
}
export async function checkPayloadStore(
  base: string,
  c: Record<string, string>,
  fetcher: typeof fetch = fetch,
) {
  const settings = payloadStoreConfig(c);
  const headers = {
    Authorization: settings.authCollection + " API-Key " + settings.token,
  };
  const result = await fetcher(
    base + "/api/" + settings.authCollection + "/me",
    { headers, redirect: "error", signal: AbortSignal.timeout(12000) },
  );
  if (!result.ok) throw Error("Payload CMS no pudo autenticar la API key.");
  const identity = await result.json();
  if (!identity.user)
    throw Error("La API key no identifica una cuenta de Payload CMS.");
  for (const collection of new Set([settings.products, settings.orders, settings.customers])) {
    const r = await fetcher(base + "/api/" + collection + "?limit=1&depth=0", {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw Error("No pudimos leer la colección " + collection + ".");
    const data = await r.json();
    if (!Array.isArray(data.docs))
      throw Error(
        "La colección " + collection + " no devolvió un listado válido.",
      );
  }
  return settings;
}
