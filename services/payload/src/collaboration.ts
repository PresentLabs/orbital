import { normalizeDeletion } from "./retention.ts";
import { validateEncryptedAccess } from "./encrypted.ts";
import {
  APIError,
  type Access,
  type Where,
  type CollectionConfig,
  type Endpoint,
} from "payload";
import { canView, canWrite, isAdmin } from "./permissions.ts";
const workspace = (user: any) =>
  typeof user?.workspace === "object" ? user.workspace.id : user?.workspace;
const scope =
  (section: "tasks" | "vault", write = false): Access =>
  ({ req }) =>
    (write ? canWrite(req.user, section) : canView(req.user, section))
      ? { workspace: { equals: workspace(req.user) } }
      : false;
const tenant = {
  name: "workspace",
  type: "relationship",
  relationTo: "workspaces",
  required: true,
  index: true,
  access: { update: () => false },
} as const;
export const Comments: CollectionConfig = {
  slug: "comments",
  access: {
    read: ({ req }): boolean | Where =>
      canView(req.user, "tasks")
        ? {
            and: [
              { workspace: { equals: workspace(req.user) } },
              {
                or: [
                  { privateOwner: { exists: false } },
                  { privateOwner: { equals: String(req.user!.id) } },
                ],
              },
            ],
          }
        : false,
    create: ({ req }) => canWrite(req.user, "tasks"),
    update: () => false,
    delete: () => false,
  },
  fields: [
    { ...tenant },
    {
      name: "privateOwner",
      type: "text",
      index: true,
      access: { update: () => false },
    },
    { name: "taskId", type: "text", required: true, index: true },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    { name: "authorName", type: "text", required: true },
    { name: "text", type: "textarea", required: true, maxLength: 5000 },
    {
      name: "mentions",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!canWrite(req.user, "tasks"))
          throw new APIError("No puedes comentar en esta sección.", 403);
        data!.workspace = workspace(req.user);
        data!.author = req.user!.id;
        data!.authorName = req.user!.name;
        data!.text = String(data!.text || "").trim();
        if (!data!.text) throw new APIError("Escribe un comentario.", 400);
        const task = await req.payload.find({
          collection: "documents",
          where: {
            and: [
              { workspace: { equals: workspace(req.user) } },
              { key: { equals: "tasks:" + data!.taskId } },
              { deletedAt: { exists: false } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: false,
          req,
        });
        if (!task.docs.length)
          throw new APIError("Esta tarea ya no está disponible.", 404);
        data!.privateOwner = task.docs[0].privateOwner || null;
        const ids = [
          ...new Set(
            (data!.mentions || []).map((m: any) =>
              String(typeof m === "object" ? m.id : m),
            ),
          ),
        ];
        if (
          data!.privateOwner &&
          ids.some((id) => String(id) !== String(req.user!.id))
        )
          throw new APIError(
            "Las tareas privadas solo son visibles para ti. No puedes mencionar a otras personas.",
            400,
          );
        if (ids.length > 20)
          throw new APIError("Puedes mencionar hasta 20 personas.", 400);
        if (ids.length) {
          const members = await req.payload.find({
            collection: "users",
            where: {
              and: [
                { workspace: { equals: workspace(req.user) } },
                { id: { in: ids } },
                { disabled: { not_equals: true } },
              ],
            },
            limit: 20,
            depth: 0,
            overrideAccess: true,
            req,
          });
          if (
            members.docs.length !== ids.length ||
            members.docs.some((m) => !canView(m, "tasks"))
          )
            throw new APIError(
              "Solo puedes mencionar a personas de tu equipo con acceso a tareas.",
              400,
            );
          data!.mentions = members.docs.map((m) => m.id);
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== "create") return doc;
        for (const mention of doc.mentions || []) {
          const recipient = typeof mention === "object" ? mention.id : mention;
          if (String(recipient) === String(req.user?.id)) continue;
          await req.payload.create({
            collection: "notifications",
            data: {
              workspace: workspace(req.user),
              recipient,
              key: doc.id + ":" + recipient,
              taskId: doc.taskId,
              commentId: String(doc.id),
              text:
                String(req.user?.name || "Alguien") +
                " te mencionó en un comentario.",
              readAt: null,
            },
            overrideAccess: true,
            req,
          });
        }
        return doc;
      },
    ],
  },
};
const ownNotifications: Access = ({ req }): boolean | Where =>
  canView(req.user, "profile")
    ? {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { recipient: { equals: req.user!.id } },
        ],
      }
    : false;
export const Notifications: CollectionConfig = {
  slug: "notifications",
  access: {
    create: () => false,
    read: ownNotifications,
    update: ownNotifications,
    delete: ownNotifications,
  },
  fields: [
    {
      name: "kind",
      type: "select",
      options: ["mention", "message", "poll"],
      defaultValue: "mention",
      access: { update: () => false },
    },
    { name: "pollId", type: "text", access: { update: () => false } },
    { name: "authorId", type: "text", access: { update: () => false } },
    { name: "authorName", type: "text", access: { update: () => false } },
    { ...tenant },
    {
      name: "recipient",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: "key",
      type: "text",
      unique: true,
      required: true,
      access: { update: () => false },
    },
    {
      name: "taskId",
      type: "text",
      access: { update: () => false },
    },
    {
      name: "commentId",
      type: "text",
      access: { update: () => false },
    },
    {
      name: "text",
      type: "text",
      required: true,
      access: { update: () => false },
    },
    { name: "readAt", type: "date" },
  ],
};
export const Vault: CollectionConfig = {
  slug: "vault",
  access: {
    create: ({ req }) => canWrite(req.user, "vault"),
    read: scope("vault"),
    update: scope("vault", true),
    delete: ({ req }) => isAdmin(req.user)
      ? { workspace: { equals: workspace(req.user) }, deletedAt: { exists: true } }
      : false,
  },
  fields: [
    { name: "deletedAt", type: "date", index: true },
    { ...tenant },
    {
      name: "credentials",
      type: "textarea",
      required: true,
      admin: {
        description: "Cifrado AES-GCM. No introducir contraseñas sin cifrar.",
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, req, originalDoc }) => {
        normalizeDeletion(data, originalDoc);
        if (!canWrite(req.user, "vault"))
          throw new APIError("No tienes acceso a esta sección.", 403);
        if (
          !validateEncryptedAccess(
            data?.credentials || originalDoc?.credentials,
            process.env.INTEGRATIONS_SECRET || "",
          )
        )
          throw new APIError(
            "Los accesos deben estar cifrados por la aplicación. Revisa INTEGRATIONS_SECRET.",
            400,
          );
        data!.workspace = workspace(req.user);
        return data;
      },
    ],
  },
};
export const directoryEndpoint: Endpoint = {
  path: "/directory",
  method: "get",
  handler: async (req) => {
    if (!canView(req.user, "tasks"))
      return Response.json(
        { error: "No tienes acceso a tareas." },
        { status: 403 },
      );
    const result = await req.payload.find({
      collection: "users",
      where: {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { disabled: { not_equals: true } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      req,
    });
    return Response.json({
      docs: result.docs
        .filter((m) => canView(m, "tasks"))
        .map((m) => ({ id: String(m.id), name: m.name })),
    });
  },
};

export const meetingDirectoryEndpoint: Endpoint = {
  path: "/meeting-directory",
  method: "get",
  handler: async (req) => {
    if (!canWrite(req.user, "calendar"))
      return Response.json(
        { error: "No puedes organizar reuniones." },
        { status: 403 },
      );
    const result = await req.payload.find({
      collection: "users",
      where: {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { disabled: { not_equals: true } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      req,
    });
    return Response.json({
      docs: result.docs.map((m) => ({
        id: String(m.id),
        name: m.name,
        email: m.email,
      })),
    });
  },
};

export const notificationDirectoryEndpoint: Endpoint = {
  path: "/notification-directory",
  method: "get",
  handler: async (req) => {
    if (!canView(req.user, "profile"))
      return Response.json({ error: "Inicia sesión." }, { status: 403 });
    const result = await req.payload.find({
      collection: "users",
      where: {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { disabled: { not_equals: true } },
          { deletedAt: { exists: false } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      req,
    });
    return Response.json({
      docs: result.docs.map((m) => ({ id: String(m.id), name: m.name })),
    });
  },
};
export const sendNotificationEndpoint: Endpoint = {
  path: "/send-notification",
  method: "post",
  handler: async (req) => {
    if (!canView(req.user, "profile"))
      return Response.json({ error: "Inicia sesión." }, { status: 403 });
    const body = await req.json?.();
    if (
      !body ||
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > 280 ||
      !Array.isArray(body.recipients) ||
      !body.recipients.length ||
      body.recipients.length > 20 ||
      typeof body.requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(body.requestId)
    )
      return Response.json(
        { error: "Escribe un mensaje corto y selecciona a quién notificar." },
        { status: 400 },
      );
    const ids = [...new Set(body.recipients.map(String))];
    const members = await req.payload.find({
      collection: "users",
      where: {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { id: { in: ids } },
          { disabled: { not_equals: true } },
          { deletedAt: { exists: false } },
        ],
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (members.docs.length !== ids.length)
      return Response.json(
        {
          error: "Solo puedes notificar a personas activas de tu organización.",
        },
        { status: 400 },
      );
    const recent = await req.payload.find({
      collection: "notifications",
      where: {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { authorId: { equals: String(req.user!.id) } },
          {
            createdAt: {
              greater_than: new Date(Date.now() - 60000).toISOString(),
            },
          },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (recent.totalDocs >= 20)
      return Response.json(
        { error: "Espera un momento antes de enviar más avisos." },
        { status: 429 },
      );
    for (const member of members.docs) {
      const key =
        workspace(req.user) +
        ":" +
        req.user!.id +
        ":" +
        body.requestId +
        ":" +
        member.id;
      const existing = await req.payload.find({
        collection: "notifications",
        where: { key: { equals: key } },
        limit: 1,
        overrideAccess: true,
        req,
      });
      if (!existing.docs.length)
        await req.payload.create({
          collection: "notifications",
          data: {
            workspace: workspace(req.user),
            recipient: member.id,
            key,
            kind: "message",
            authorId: String(req.user!.id),
            authorName: req.user!.name,
            text: body.text.trim(),
            readAt: null,
          },
          overrideAccess: true,
          req,
        });
    }
    return Response.json({ ok: true, sent: ids.length });
  },
};

export const canvasDirectoryEndpoint: Endpoint = {
  path: "/canvas-directory",
  method: "get",
  handler: async (req) => {
    if (!canView(req.user, "canvas"))
      return Response.json(
        { error: "No tienes acceso a espacios." },
        { status: 403 },
      );
    const ids = [
      ...new Set(
        (new URL(req.url || "http://localhost").searchParams.get("ids") || "")
          .split(",")
          .filter(Boolean),
      ),
    ];
    if (ids.length > 50 || ids.some((id) => !/^[-a-zA-Z0-9_]{1,100}$/.test(id)))
      return Response.json({ error: "Personas no válidas." }, { status: 400 });
    if (!ids.length) return Response.json({ docs: [] });
    const result = await req.payload.find({
      collection: "users",
      where: {
        and: [
          { workspace: { equals: workspace(req.user) } },
          { id: { in: ids } },
          { disabled: { not_equals: true } },
          { deletedAt: { exists: false } },
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
      req,
    });
    return Response.json({
      docs: result.docs
        .filter((m) => canView(m, "canvas"))
        .map((m) => ({
          id: String(m.id),
          avatarData: m.avatarData || undefined,
        })),
    });
  },
};

/** Canvas blocks are discarded immediately; whole spaces retain the 30-day trash flow. */
export const discardCanvasEndpoint: Endpoint = {
  path: '/discard-canvas-document', method: 'post',
  handler: async req => {
    if (!canWrite(req.user, 'canvas')) return Response.json({error:'No puedes editar este espacio.'},{status:403});
    const {key} = await req.json!();
    if (typeof key !== 'string' || !/^(nodes|edges):[a-zA-Z0-9 _-]{1,100}$/.test(key)) return Response.json({error:'Tarjeta no válida.'},{status:400});
    const found = await req.payload.find({collection:'documents',where:{and:[{key:{equals:key}},{workspace:{equals:workspace(req.user)}}]},limit:1,depth:0,overrideAccess:false,req});
    const row = found.docs[0];
    if (!row) return Response.json({error:'No encontramos esa tarjeta.'},{status:404});
    if (row.deletedAt) return Response.json({ok:true}); // A deleted parent owns these records for restoration.
    if (key.startsWith('nodes:')) {
      const edges = await req.payload.find({collection:'documents',where:{and:[{workspace:{equals:workspace(req.user)}},{key:{contains:'edges:'}}]},limit:1000,depth:0,overrideAccess:false,req});
      for (const edge of edges.docs) {
        const value = edge.value as any;
        if (!edge.deletedAt && (value?.from === key.slice(6) || value?.to === key.slice(6)))
          await req.payload.delete({collection:'documents',id:edge.id,overrideAccess:true,req});
      }
    }
    await req.payload.delete({collection:'documents',id:row.id,overrideAccess:true,req});
    return Response.json({ok:true});
  }
};
