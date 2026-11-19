import type { CollectionConfig, PayloadRequest } from "payload";

export const availableModules = [
  { id: "billing-cl", name: "Facturación propia · Chile", description: "Documentos tributarios de la tienda conectada.", version: "0.3.0" },
  { id: "reservations", name: "Agendamiento", description: "Servicios, profesionales y horas de atención del negocio.", version: "0.1.0" },
  { id: "woo-dte-chile", name: "Facturación WooCommerce anterior", description: "Acceso a instalaciones fiscales anteriores.", version: "0.2.1", legacy: true },
] as const;

export const ModuleGrants: CollectionConfig = {
  slug: "module-grants",
  admin: { hidden: true },
  lockDocuments: false,
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "workspace", type: "relationship", relationTo: "workspaces", required: true, index: true },
    { name: "moduleId", type: "text", required: true },
    { name: "workspaceKey", type: "text", required: true, unique: true },
    { name: "enabled", type: "checkbox", defaultValue: false },
    { name: "changedBy", type: "text", required: true },
  ],
};

export async function moduleGranted(req: PayloadRequest, moduleId: string, workspace?: number | string) {
  const tenant = workspace ?? (typeof req.user?.workspace === "object" ? req.user.workspace.id : req.user?.workspace);
  if (!tenant) return false;
  const grants = await req.payload.find({
    collection: "module-grants", where: { and: [
      { workspace: { equals: tenant } }, { moduleId: { equals: moduleId } },
      { enabled: { equals: true } },
    ] },
    depth: 0, limit: 1, overrideAccess: true, req,
  });
  return !!grants.docs[0];
}
