import { normalizeDeletion } from "./retention.ts";
import type { CollectionConfig } from "payload";
import { isAdmin } from "./permissions.ts";
const workspace = (user: any) =>
  typeof user?.workspace === "object" ? user.workspace.id : user?.workspace;
export const Files: CollectionConfig = {
  slug: "files",
  upload: {
    staticDir: "uploads",
    mimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "text/markdown",
      "text/csv",
    ],
    filesRequiredOnCreate: true,
  },
  access: {
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }) =>
      isAdmin(req.user)
        ? { workspace: { equals: workspace(req.user) } }
        : false,
    update: ({ req }) =>
      isAdmin(req.user)
        ? { workspace: { equals: workspace(req.user) } }
        : false,
    delete: ({ req }) => isAdmin(req.user)
      ? { workspace: { equals: workspace(req.user) }, deletedAt: { exists: true } }
      : false,
  },
  fields: [
    { name: "deletedAt", type: "date", index: true },
    {
      name: "workspace",
      type: "relationship",
      relationTo: "workspaces",
      required: true,
      index: true,
      access: { update: () => false },
    },
    { name: "title", type: "text", required: true, maxLength: 160 },
    {
      name: "kind",
      type: "select",
      options: ["documento", "factura", "boleta"],
      defaultValue: "documento",
      required: true,
    },
    { name: "orderId", type: "number", min: 1 },
    { name: "folio", type: "text", maxLength: 80 },
  ],
  hooks: {
    beforeValidate: [
      ({ data, req, originalDoc }) => {
        normalizeDeletion(data, originalDoc);
        if (req.user) data!.workspace = workspace(req.user);
        if (data?.kind && data.kind !== "documento" && !data.orderId)
          throw new Error("Asocia el comprobante a un pedido.");
        return data;
      },
    ],
  },
};
