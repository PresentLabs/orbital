import { ModuleError, positiveId, operationKey } from './security.ts';
export type Connection = { origin: string; username: string; password: string };
export async function wooRequest(connection: Connection, path: string, method = 'GET', data?: unknown, key?: string, transport = fetch): Promise<any> {
  let response: Response;
  try {
    response = await transport(connection.origin + '/wp-json/woo-dte-chile/v1/' + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { Authorization: 'Basic ' + Buffer.from(connection.username + ':' + connection.password).toString('base64'),
        'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  } catch { throw new ModuleError('No se confirmó la respuesta de WooCommerce. Consulta los documentos y reintenta con la misma clave de operación.', 504); }
  const text = await response.text();
  if (text.length > 24 * 1024 * 1024) throw new ModuleError('Respuesta de tienda demasiado grande.', 502);
  let result: any;
  try { result = JSON.parse(text); } catch { throw new ModuleError('La tienda devolvió una respuesta inválida.', 502); }
  if (!response.ok) {
    // Do not propagate arbitrary upstream pages, stacks, or credentials.
    const detail = result?.code === 'wdt_error' && typeof result.message === 'string' ? result.message.slice(0, 300) : 'Revisa el plugin y los permisos de la contraseña de aplicación en WordPress.';
    throw new ModuleError(detail, [400, 401, 403, 404, 409, 422].includes(response.status) ? response.status : 502);
  }
  return result;
}
export function command(body: Record<string, any>) {
  const action = body.action;
  if (action === 'documents') return { path: `orders/${positiveId(body.orderId)}/documents`, method: 'GET' };
  if (action === 'status') return { path: 'capabilities', method: 'GET' };
  if (action === 'file') {
    if (!['xml', 'pdf'].includes(body.format)) throw new ModuleError('Formato inválido.');
    return { path: `documents/${positiveId(body.documentId)}/file?format=${body.format}`, method: 'GET' };
  }
  if (action === 'issue' || action === 'fiscal') {
    if (![33, 39].includes(body.type)) throw new ModuleError('Selecciona DTE 33 o 39.');
    const data: Record<string, unknown> = { type: body.type };
    if (action === 'fiscal') {
      const receiver: Record<string, string> = {};
      for (const field of ['rut', 'name', 'giro', 'address', 'commune']) {
        if (typeof body.receiver?.[field] !== 'string' || body.receiver[field].length > 100) throw new ModuleError('Receptor inválido.');
        receiver[field] = body.receiver[field].trim();
      }
      data.receiver = receiver;
    }
    return { path: `orders/${positiveId(body.orderId)}/${action}`, method: action === 'fiscal' ? 'PUT' : 'POST', data };
  }
  if (action === 'email') return { path: `documents/${positiveId(body.documentId)}/email`, method: 'POST', data: {} };
  if (action === 'retry') return { path: `documents/${positiveId(body.documentId)}/retry`, method: 'POST', data: {} };
  if (action === 'adjust') {
    const key = operationKey(body.operationKey);
    if (![61, 56].includes(body.type) || !Number.isSafeInteger(body.amount) || body.amount < 1 ||
        typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 90 ||
        typeof body.cancel !== 'boolean' || !['return', 'amount_correction'].includes(body.kind)) throw new ModuleError('Ajuste inválido. Revisa tipo, monto CLP y motivo.');
    const data: Record<string, any> = { type: body.type, amount: body.amount, reason: body.reason.trim(), cancel: body.cancel, kind: body.kind, no_vat_reduction: body.no_vat_reduction === true };
    if (body.lines !== undefined) {
      if (!Array.isArray(body.lines) || body.lines.length > 60 || body.lines.some((x: any) => !x || typeof x.name !== 'string' || x.name.length > 80 || !x.name.trim() || !Number.isSafeInteger(x.amount) || x.amount < 1 || typeof x.exempt !== 'boolean')) throw new ModuleError('Líneas afectas/exentas inválidas.');
      data.lines = body.lines.map((x: any) => ({name: x.name.trim(), amount: x.amount, exempt: x.exempt}));
    }
    return { path: `documents/${positiveId(body.documentId)}/adjust`, method: 'POST', data, key };
  }
  throw new ModuleError('Operación no disponible.');
}
