import { validateFileFolder } from "./workspace-folders.ts";
import { optimizeWorkspaceImage } from "./image-optimization.ts";
import type { CollectionConfig } from "payload";
import { canView, canWrite } from "./permissions.ts";
import { normalizeDeletion } from "./retention.ts";
import { workspaceFileTypes } from "./workspace-file-policy.ts";
const workspace = (u: any) =>
  typeof u?.workspace === "object" ? u.workspace.id : u?.workspace;
export const WorkspaceFiles: CollectionConfig = {
  slug: "workspace-files",
  upload: {
    staticDir: "uploads-workspace",
    mimeTypes: [...workspaceFileTypes],
    filesRequiredOnCreate: true,
  },
  access: {
    create: ({ req }) => canWrite(req.user, "files"),
    read: ({ req }) =>
      canView(req.user, "files")
        ? { workspace: { equals: workspace(req.user) } }
        : false,
    update: ({ req }) =>
      canWrite(req.user, "files")
        ? { workspace: { equals: workspace(req.user) } }
        : false,
    delete: ({ req }) => canWrite(req.user, "files")
      ? { workspace: { equals: workspace(req.user) }, deletedAt: { exists: true } }
      : false,
  },
  fields: [
    {
      name: "folder",
      type: "relationship",
      relationTo: "workspace-folders",
      index: true,
    },
    {
      name: "workspace",
      type: "relationship",
      relationTo: "workspaces",
      required: true,
      index: true,
      access: { update: () => false },
    },
    { name: "title", type: "text", required: true, maxLength: 160 },
    { name: "deletedAt", type: "date", index: true },
  ],
  hooks: {
    beforeOperation: [
      async ({ args, operation }) => {
        if (
          (operation === "create" || operation === "update") &&
          args.req.file
        ) {
          const file = args.req.file;
          if (file.tempFilePath && !file.data?.length)
            throw Error("No pudimos leer la imagen para optimizarla.");
          args.req.file = await optimizeWorkspaceImage(file);
        }
        return args;
      },
    ],
    beforeValidate: [
      ({ data, req, originalDoc }) => {
        normalizeDeletion(data, originalDoc);
        if (req.user && data) data.workspace = workspace(req.user);
        return data;
      },
      validateFileFolder,
    ],
    beforeChange: [
      ({ data, req }) => {
        if (req.file && req.file.size > 20 * 1024 * 1024)
          throw Error("El archivo supera los 20 MB.");
        return data;
      },
    ],
  },
};
