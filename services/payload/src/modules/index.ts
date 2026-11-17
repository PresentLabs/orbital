import {billingEndpoint,billingCatalog} from '../billing/api.ts';
import type { CollectionConfig, Endpoint, PayloadRequest } from 'payload';
import { isAdmin } from '../permissions.ts';
import { moduleById } from './registry.ts';
import { seal, unseal, storeOrigin, ModuleError } from './security.ts';
import { command, wooRequest } from './woo.ts';
const workspace = (user: any) => typeof user?.workspace === 'object' ? user.workspace?.id : user?.workspace;
export const ModuleInstallations: CollectionConfig = {
  slug: 'module-installations', admin: { hidden: true }, lockDocuments: false,
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'workspace', type: 'relationship', relationTo: 'workspaces', required: true, index: true },
    { name: 'moduleId', type: 'text', required: true },
    { name: 'workspaceKey', type: 'text', required: true, unique: true },
    { name: 'version', type: 'text', required: true },
    { name: 'enabled', type: 'checkbox', defaultValue: false },
    { name: 'credentials', type: 'textarea', required: true, access: { read: () => false } },
  ],
};
function reply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
/** Dependency injection is only for tests; endpoint always uses the fixed Woo adapter. */
export async function handleModules(req: PayloadRequest, requestWoo = wooRequest) {
  try {
    if (!req.user) throw new ModuleError('Inicia sesión.', 401);
    if (!isAdmin(req.user) || !workspace(req.user)) throw new ModuleError('Solo administradores del negocio.', 403);
    const tenant = workspace(req.user);
    // Custom route accepts JWT header only; no cross-origin ambient-cookie mutations.
    if (!req.headers.get('authorization')?.startsWith('JWT ')) throw new ModuleError('Se requiere la sesión de Orbital.', 401);
    const db = req.payload;
    const installations = await db.find({ collection: 'module-installations', where: { workspace: { equals: tenant } }, limit: 100, depth: 0, overrideAccess: true, req });
    if (req.method === 'GET') return reply({ modules: [await billingCatalog(req)], legacyInstalled:installations.docs.some((x:any)=>x.moduleId==='woo-dte-chile') });
    /* Legacy WordPress API remains accessible for existing installations. */
    const body = await req.json?.();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ModuleError('Solicitud inválida.');
    if (body.moduleId==='billing-cl') return billingEndpoint(req,body);
    if (JSON.stringify(body).length > 32000) throw new ModuleError('Solicitud demasiado grande.', 413);
    const module = moduleById(body.moduleId);
    if (!module) throw new ModuleError('Módulo no registrado.', 404);
    const row = installations.docs.find((x: any) => x.moduleId === module.id);
    if (body.action === 'disable') {
      if (!row) throw new ModuleError('Módulo no instalado.', 409);
      await db.update({ collection: 'module-installations', id: row.id, data: { enabled: false }, overrideAccess: true, req });
      return reply({ enabled: false });
    }
    const stores = await db.find({ collection: 'integrations', where: { and: [{ workspace: { equals: tenant } }, { provider: { equals: 'woo' } }] }, limit: 1, depth: 0, overrideAccess: true, req });
    if (!stores.docs[0]) throw new ModuleError('Conecta WooCommerce en Configuración → Integraciones.', 409);
    const origin = storeOrigin(unseal(stores.docs[0].credentials).url);
    if (body.action === 'install') {
      if (typeof body.username !== 'string' || !/^[^:\r\n]{1,100}$/.test(body.username) || typeof body.password !== 'string' || !/^[a-zA-Z0-9 ]{20,100}$/.test(body.password)) throw new ModuleError('Usa el usuario y una contraseña de aplicación de WordPress.');
      if (row && unseal(row.credentials).origin !== origin) throw new ModuleError('El módulo está vinculado a otra tienda. Conserva esa conexión para acceder al historial.', 409);
      const connection = { origin, username: body.username.trim(), password: body.password.replace(/ /g, '') };
      const capabilities = await requestWoo(connection, 'capabilities');
      if (capabilities?.module !== module.id || capabilities?.apiVersion !== 1 || !['certification', 'production'].includes(capabilities.environment)) throw new ModuleError('Instala el ZIP compatible de Woo DTE Chile en WordPress.', 409);
      const data = { workspace: tenant, workspaceKey: `${tenant}:${module.id}`, moduleId: module.id, version: module.version, enabled: true, credentials: seal(connection) };
      if (row) await db.update({ collection: 'module-installations', id: row.id, data, overrideAccess: true, req });
      else await db.create({ collection: 'module-installations', data, overrideAccess: true, req });
      return reply({ installed: true, enabled: true, environment: capabilities.environment });
    }
    if (!row?.enabled) throw new ModuleError('Instala o activa el módulo primero.', 409);
    const connection = unseal(row.credentials);
    if (connection.origin !== origin) throw new ModuleError('La tienda conectada cambió. Restaura la conexión original para operar este módulo.', 409);
    const op = command(body);
    return reply(await requestWoo({ origin, username: connection.username, password: connection.password }, op.path, op.method, op.data, op.key));
  } catch (error) {
    if (error instanceof ModuleError) return reply({ error: error.message }, error.status);
    // No raw exceptions in responses/logs: they may contain credentials or upstream data.
    return reply({ error: 'No se pudo completar la operación. Revisa la configuración o actualiza el catálogo antes de reintentar.' }, 503);
  }
}
export const modulesEndpoints: Endpoint[] = [
  { path: '/orbital-modules', method: 'get', handler: req => handleModules(req) },
  { path: '/orbital-modules', method: 'post', handler: req => handleModules(req) },
];
