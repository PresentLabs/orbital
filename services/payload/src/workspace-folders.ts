import { APIError, type Access, type CollectionConfig } from "payload";
import { canView, canWrite } from "./permissions.ts";
const workspace = (u: any) =>
  typeof u?.workspace === "object" ? u.workspace.id : u?.workspace;
const read: Access = ({ req }) =>
  canView(req.user, "files")
    ? { workspace: { equals: workspace(req.user) } }
    : false;
export const WorkspaceFolders: CollectionConfig = {
  slug: "workspace-folders",
  access: {
    read,
    create: ({ req }) => canWrite(req.user, "files"),
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "workspace",
      type: "relationship",
      relationTo: "workspaces",
      required: true,
      index: true,
      access: { update: () => false },
    },
    { name: "name", type: "text", required: true, maxLength: 80 },
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      admin: { hidden: true },
      access: { read: () => false, update: () => false },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        if (!canWrite(req.user, "files") || !workspace(req.user))
          throw new APIError("No puedes crear carpetas.", 403);
        const name = String(data?.name || "")
          .trim()
          .replace(/\s+/g, " ");
        if (!name || name.length > 80)
          throw new APIError("Escribe un nombre de hasta 80 caracteres.", 400);
        return {
          ...data,
          name,
          workspace: workspace(req.user),
          key: workspace(req.user) + ":" + name.toLocaleLowerCase("es"),
        };
      },
    ],
  },
};
export async function validateFileFolder({ data, req }: any) {
  if (!data || !Object.hasOwn(data, "folder")) return data;
  if (data.folder === null || data.folder === "") {
    data.folder = null;
    return data;
  }
  const id = typeof data.folder === "object" ? data.folder?.id : data.folder;
  if (!/^\d+$/.test(String(id))) throw new APIError("Carpeta no válida.", 400);
  const found = await req.payload.find({
    collection: "workspace-folders",
    where: {
      and: [
        { id: { equals: id } },
        { workspace: { equals: workspace(req.user) } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    req,
  });
  if (!found.docs.length)
    throw new APIError("La carpeta no está disponible en tu equipo.", 403);
  data.folder = found.docs[0].id;
  return data;
}
