import {shopifyDomain} from './integrations.ts';
import {payloadStoreConfig} from './payload-store.ts';
export type StoreProvider='woo'|'shopify'|'payload';
export type StoreReadOptions={kind:'customers'|'orders';id?:string;page:number;q?:string;customer?:string};
const customerFields='id firstName lastName displayName email phone createdAt';
const orderFields='id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } }';
export function normalizeShopCustomer(c:any){return{id:String(c.id).split('/').pop(),name:c.displayName||[c.firstName,c.lastName].filter(Boolean).join(' '),email:c.email||'',phone:c.phone||'',date:c.createdAt};}
export function normalizeShopOrder(o:any){return{id:String(o.id).split('/').pop(),number:o.name,date_created:o.createdAt,status:o.displayFinancialStatus==='REFUNDED'?'refunded':o.displayFinancialStatus==='PAID'?(o.displayFulfillmentStatus==='FULFILLED'?'completed':'processing'):'pending',total:o.totalPriceSet.shopMoney.amount,currency:o.totalPriceSet.shopMoney.currencyCode,provider:'shopify'};}
export async function readShopify(c:Record<string,string>,o:StoreReadOptions,fetcher:typeof fetch=fetch){
 if(o.page<1||o.page>100||!Number.isInteger(o.page))throw Error('Página fuera de rango.');
 for(const id of [o.id,o.customer])if(id&&!/^\d+$/.test(id))throw Error('Identificador no válido.');
 const request=async(query:string,variables:Record<string,unknown>)=>{const r=await fetcher(`https://${shopifyDomain(c.shop)}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':c.token},body:JSON.stringify({query,variables}),redirect:'error',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||d.errors?.length||!d.data)throw Error('Shopify no pudo devolver los datos. Revisa los permisos de clientes y pedidos.');return d.data;};
 if(o.id){const type=o.kind==='customers'?'Customer':'Order',field=o.kind==='customers'?'customer':'order';const d=await request(`query($id:ID!){${field}(id:$id){${type==='Customer'?customerFields:orderFields}}}`,{id:`gid://shopify/${type}/${o.id}`});if(!d[field])throw Error('Registro no encontrado.');return{doc:type==='Customer'?normalizeShopCustomer(d[field]):{...normalizeShopOrder(d[field]),storeUrl:`https://${shopifyDomain(c.shop)}/admin/orders/${o.id}`}};}
 let after:string|null=null,connection:any;
 for(let page=1;page<=o.page;page++){
 const query=o.customer?`query($id:ID!,$after:String){customer(id:$id){orders(first:10,after:$after,reverse:true){nodes{${orderFields}} pageInfo{hasNextPage endCursor}}}}`:`query($after:String,$q:String){${o.kind}(first:10,after:$after,query:$q){nodes{${o.kind==='customers'?customerFields:orderFields}} pageInfo{hasNextPage endCursor}}}`;
 const data=await request(query,{after,q:o.q||null,...(o.customer?{id:`gid://shopify/Customer/${o.customer}`}:{})});connection=o.customer?data.customer?.orders:data[o.kind];if(!connection)throw Error('Registro no encontrado.');if(page<o.page&&!connection.pageInfo.hasNextPage)return{docs:[],page:o.page,pages:page,total:null};after=connection.pageInfo.endCursor;
 }
 return{docs:connection.nodes.map((item:any)=>o.kind==='customers'?normalizeShopCustomer(item):{...normalizeShopOrder(item),storeUrl:`https://${shopifyDomain(c.shop)}/admin/orders/${String(item.id).split('/').pop()}`}),page:o.page,pages:o.page+(connection.pageInfo.hasNextPage?1:0),total:null};
}
export function normalizePayloadCustomer(c:any){return{id:String(c.id),name:c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email,email:c.email||'',phone:c.phone||'',date:c.createdAt};}
export function normalizePayloadOrder(o:any){const currency=String(o.currency||'CLP').toUpperCase();const digits=new Intl.NumberFormat('es-CL',{style:'currency',currency}).resolvedOptions().maximumFractionDigits ?? 2;return{id:String(o.id),number:String(o.orderNumber||o.id),date_created:o.createdAt,status:o.status==='completed'?'completed':o.status==='cancelled'?'cancelled':'processing',total:String(Number(o.amount||0)/10**digits),currency,provider:'payload'};}
export async function readPayload(base:string,c:Record<string,string>,o:StoreReadOptions,fetcher:typeof fetch=fetch){
 const config=payloadStoreConfig(c),collection=o.kind==='customers'?(c.customers||config.authCollection):config.orders;
 if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(collection)||[o.id,o.customer].some(id=>id&&!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))throw Error('Colección o identificador no válido.');
 const params=new URLSearchParams({depth:'0',limit:'10',page:String(o.page)});
 if(o.customer)params.set('where[customer][equals]',o.customer);
 if(o.q){params.set('where[or][0][email][contains]',o.q);params.set('where[or][1][name][contains]',o.q);}
 const r=await fetcher(base+'/api/'+collection+(o.id?'/'+encodeURIComponent(o.id):'?'+params),{headers:{Authorization:config.authCollection+' API-Key '+config.token},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Payload no pudo devolver los datos. Revisa el acceso a la colección.');const d=await r.json(),normalize=o.kind==='customers'?normalizePayloadCustomer:(row:any)=>({...normalizePayloadOrder(row),storeUrl:base+'/admin/collections/'+collection+'/'+encodeURIComponent(row.id)});
 return o.id?{doc:normalize(d)}:{docs:d.docs.map(normalize),page:o.page,total:d.totalDocs,pages:d.totalPages};
}
