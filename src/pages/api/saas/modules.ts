import type { APIRoute } from 'astro';
import { COOKIE, setting, sameOrigin, json, currentUser } from '../../../lib/saas/server';
import { isAdmin } from '../../../lib/saas/permissions';
export const prerender = false;
const handler: APIRoute = async ctx => {
  if (ctx.request.method !== 'GET' && !sameOrigin(ctx)) return json({error: 'Origen inválido.'}, 403);
  const user = await currentUser(ctx);
  if (!isAdmin(user)) return json({error: 'Solo administradores del negocio.'}, user ? 403 : 401);
  let body: string | undefined;
  if (ctx.request.method === 'POST') {
    if (!ctx.request.headers.get('content-type')?.includes('application/json')) return json({error: 'Se requiere JSON.'}, 415);
    body = await ctx.request.text();
    if (body.length > 10000000) return json({error: 'Solicitud demasiado grande.'}, 413);
    try { JSON.parse(body); } catch { return json({error: 'JSON inválido.'}, 400); }
  }
  try {
    const response = await fetch(setting(ctx, 'PAYLOAD_URL').replace(/\/$/, '') + '/api/orbital-modules', {
      method: ctx.request.method, redirect: 'error',
      headers: {'Content-Type': 'application/json', Authorization: 'JWT ' + ctx.cookies.get(COOKIE)!.value},
      body, signal: AbortSignal.timeout(45000),
    });
    return json(await response.json(), response.status);
  } catch { return json({error: 'No se confirmó la respuesta. Consulta el pedido y conserva la clave de operación para reintentar.'}, 504); }
};
export const GET = handler;
export const POST = handler;
