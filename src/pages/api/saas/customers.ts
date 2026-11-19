import type { APIRoute } from "astro";
import { currentUser, json } from "@/lib/saas/server";
import { isAdmin } from "@/lib/saas/permissions";
import {readShopify,readPayload,type StoreProvider} from "@/lib/saas/store-read";
import { connection, storeUrl } from "@/lib/saas/integrations";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!isAdmin(user))
    return json(
      { error: "Solo un administrador puede consultar clientes." },
      403,
    );
  try {
    const available=await Promise.all((['woo','shopify','payload'] as StoreProvider[]).map(async provider=>({provider,value:await connection(ctx,provider)})));
    const stores=available.filter(store=>store.value),requested=ctx.url.searchParams.get('provider');
    if(requested&&!['woo','shopify','payload'].includes(requested))return json({error:'Tienda no válida.'},400);
    if(!requested&&stores.length>1)return json({connected:false,chooseStore:true,providers:stores.map(s=>s.provider),docs:[],total:0,pages:0});
    const selected=stores.find(s=>s.provider===requested)||(!requested?stores[0]:undefined);
    if(!selected)return json({connected:false,providers:stores.map(s=>s.provider),docs:[],total:0,pages:0});
    const c=selected.value!,provider=selected.provider;
    if(provider!=='woo'){
      const id=ctx.url.searchParams.get('id')||undefined,page=Number(ctx.url.searchParams.get('page')||1);
      if(id && !(provider==='shopify'?/^\d+$/:/^[a-zA-Z0-9_-]{1,100}$/).test(id))return json({error:'Cliente no válido.'},400);
      if(!Number.isInteger(page)||page<1||page>100)return json({error:'Página fuera de rango.'},400);
      const read=(options:any)=>provider==='shopify'?readShopify(c.credentials,options):readPayload(storeUrl(ctx,c.credentials.url),c.credentials,options);
      const result=await read({kind:'customers',id,page,q:(ctx.url.searchParams.get('q')||'').slice(0,120)});
      if(id){const orders=await read({kind:'orders',customer:id,page});return json({connected:true,provider,providers:stores.map(s=>s.provider),...result,orders:orders.docs,total:orders.total,pages:orders.pages,page});}
      return json({connected:true,provider,providers:stores.map(s=>s.provider),...result});
    }
    const id = ctx.url.searchParams.get("id"),
      page = Math.max(
        1,
        Math.min(10000, Number(ctx.url.searchParams.get("page")) || 1),
      );
    if (id && !/^\d+$/.test(id))
      return json({ error: "Cliente no válido." }, 400);
    const headers = {
        Authorization:
          "Basic " + btoa(c.credentials.key + ":" + c.credentials.secret),
      },
      base = storeUrl(ctx, c.credentials.url) + "/wp-json/wc/v3";
    const response = await fetch(
      base +
        "/customers" +
        (id
          ? "/" + id
          : "?per_page=10&page=" +
            page +
            "&search=" +
            encodeURIComponent(
              (ctx.url.searchParams.get("q") || "").slice(0, 120),
            )),
      { headers, redirect: "error", signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    const safe = (m: any) => ({
      id: String(m.id),
      name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username,
      email: m.email,
      phone: m.billing?.phone || "",
      date: m.date_created,
      billing: m.billing,
    });
    if (!id)
      return json({
        connected: true, provider, providers: stores.map(s=>s.provider),
        docs: data.map(safe),
        total: Number(response.headers.get("X-WP-Total")),
        pages: Number(response.headers.get("X-WP-TotalPages")),
        page,
      });
    const orders = await fetch(
      base + "/orders?customer=" + id + "&per_page=10&page=" + page,
      { headers, redirect: "error", signal: AbortSignal.timeout(15000) },
    );
    if (!orders.ok) throw Error();
    return json({
      connected: true, provider, providers: stores.map(s=>s.provider),
      doc: safe(data),
      orders: await orders.json(),
      total: Number(orders.headers.get("X-WP-Total")),
      pages: Number(orders.headers.get("X-WP-TotalPages")),
      page,
    });
  } catch {
    return json(
      { error: "No pudimos consultar los clientes. Revisa la conexión y los permisos de la tienda." },
      502,
    );
  }
};
