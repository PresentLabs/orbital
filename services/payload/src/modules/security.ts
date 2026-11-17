import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
export class ModuleError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function key(secret = process.env.INTEGRATIONS_SECRET || '') {
  if (secret.length < 32) throw new ModuleError('Configura INTEGRATIONS_SECRET en Payload.', 503);
  return createHash('sha256').update(secret).digest();
}
/** Compatible with Astro integrations.ts: IV + ciphertext + GCM tag. */
export function seal(data: unknown, secret?: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(data), 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
}
export function unseal(value: string, secret?: string): Record<string, string> {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 29) throw new ModuleError('Credenciales ilegibles; vuelve a conectar.', 503);
  const decipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString());
}
export function storeOrigin(value: string, allowed = process.env.INTEGRATION_ALLOWED_HOSTS || '') {
  let url: URL;
  try { url = new URL(value); } catch { throw new ModuleError('URL de tienda inválida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
      !allowed.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(url.hostname.toLowerCase())) {
    throw new ModuleError('Autoriza el dominio HTTPS de la tienda en INTEGRATION_ALLOWED_HOSTS de Payload.', 403);
  }
  return url.origin;
}
export function positiveId(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || !/^\d+$/.test(String(value))) throw new ModuleError('Identificador inválido.');
  return n;
}
export function operationKey(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{8,100}$/.test(value)) throw new ModuleError('Se requiere una clave de operación estable (8–100 caracteres).');
  return value;
}
