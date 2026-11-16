import { isSealedCanvas, privateCanvasKey, sealCanvas, unsealCanvas } from "./private-canvas.ts";
import {WorkspaceFolders} from './workspace-folders.ts';
import { Polls, PollVotes, pollsEndpoint, createPollEndpoint, votePollEndpoint } from './polls.ts';
import {inviteMemberEndpoint,acceptInvitationEndpoint} from "./invitations.ts";
import {validTaskWork,validLinks,boardTransitionError,sameWorkData} from "./work-management.ts";
import {validPlanningPreferences,validSprints} from "./planning.ts";
import {validDirectoryPreferences} from "./directory-preferences.ts";
import {isStoreProvider, storeProviders, blockedStore, storeConflictMessage} from "./store-integrations.ts";
import { normalizeDeletion } from "./retention.ts";
import { validSocialLinks, ecommerceRoles } from "./ecommerce.ts";
import { WorkspaceFiles } from "./workspace-files.ts";
import { Files } from "./files.ts";
import {
  validRut,
  validLogo,
  validAvatar,
  formatPhone,
  validPhone,
} from "./formats.ts";
import {
  buildConfig,
  type Access,
  type Where,
  type CollectionConfig,
  APIError,
} from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { timingSafeEqual } from "node:crypto";
import {
  canView,
  canWrite,
  isAdmin,
  sections,
  defaultPermissions,
  sectionForKey,
  type Section,
} from "./permissions.ts";
import {
  Comments,
  Notifications,
  Vault,
  directoryEndpoint,
  meetingDirectoryEndpoint,
  canvasDirectoryEndpoint,
  discardCanvasEndpoint,
  notificationDirectoryEndpoint,
  sendNotificationEndpoint,
} from "./collaboration.ts";
const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const workspaceId = (user: any) =>
  typeof user?.workspace === "object" ? user.workspace.id : user?.workspace;
const scoped: Access = ({ req }) =>
  req.user && !req.user.disabled && workspaceId(req.user)
    ? { workspace: { equals: workspaceId(req.user) } }
    : false;
const manageOther = ({ req, doc }: any) =>
  isAdmin(req.user) &&
  String(doc?.id) !== String(req.user.id) &&
  doc?.role !== "owner";
const Users: CollectionConfig = {
  slug: "users",
  auth: { tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000 },
  admin: { useAsTitle: "name" },
  access: {
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }): boolean | Where =>
      !req.user || req.user.disabled
        ? false
        : isAdmin(req.user)
          ? { workspace: { equals: workspaceId(req.user) } }
          : { id: { equals: req.user.id } },
    update: ({ req }): boolean | Where =>
      !req.user || req.user.disabled
        ? false
        : isAdmin(req.user)
          ? {
              and: [
                { workspace: { equals: workspaceId(req.user) } },
                {
                  or: [
                    { id: { equals: req.user.id } },
                    { role: { not_equals: "owner" } },
                  ],
                },
              ],
            }
          : { id: { equals: req.user.id } },
    delete: ({ req }) => isAdmin(req.user)
      ? {
          workspace: { equals: workspaceId(req.user) },
          id: { not_equals: req.user!.id },
          role: { not_equals: "owner" },
          disabled: { equals: true },
          deletedAt: { exists: true },
        }
      : false,
    admin: ({ req }) => isAdmin(req.user),
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "firstName", type: "text", maxLength: 80 },
    { name: "lastName", type: "text", maxLength: 80 },
    {
      name: "phone",
      type: "text",
      validate: (value: any) =>
        validPhone(value || "") || "Revisa el teléfono.",
    },
    {
      name: "avatarData",
      type: "textarea",
      validate: (v: any) => !v || validAvatar(v) || "Avatar no válido.",
    },
    {
      name: "deletedAt",
      type: "date",
      index: true,
      access: { create: () => false, update: manageOther },
    },
    { name: "jobTitle", type: "select", options: [...ecommerceRoles] },
    {
      name: "role",
      type: "select",
      defaultValue: "member",
      options: [
        { label: "Administrador", value: "owner" },
        { label: "Administrador", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Colaborador", value: "member" },
        { label: "Lector", value: "viewer" },
      ],
      access: { create: ({ req }) => isAdmin(req.user), update: manageOther },
    },
    {
      name: "permissions",
      type: "select",
      hasMany: true,
      options: [...sections],
      defaultValue: defaultPermissions,
      access: { create: ({ req }) => isAdmin(req.user), update: manageOther },
    },
    {
      name: "disabled",
      type: "checkbox",
      defaultValue: false,
      access: { create: () => false, update: manageOther },
    },
    {
      name: "workspace",
      type: "relationship",
      relationTo: "workspaces",
      required: true,
      saveToJWT: true,
      access: { update: () => false },
    },
  ],
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if (user.disabled)
          throw new APIError(
            "Tu acceso está desactivado. Habla con quien administra el equipo.",
            403,
          );
        return user;
      },
    ],
    beforeValidate: [
      ({ data, req, operation, originalDoc }) => {
        normalizeDeletion(data, originalDoc);
        if (operation === "create" && req.user) {
          data!.workspace = workspaceId(req.user);
          data!.role = ["admin", "editor", "member", "viewer"].includes(
            data!.role,
          )
            ? data!.role
            : "member";
        }
        if (operation === "update" && req.user) {
          if (data?.role === "owner" && originalDoc?.role !== "owner")
            throw new APIError("No puedes asignar el rol de propietario.", 403);
          if (
            originalDoc?.role === "owner" &&
            String(originalDoc.id) !== String(req.user.id)
          )
            throw new APIError("No puedes modificar al propietario.", 403);
        }
        return data;
      },
    ],
  },
};
const Workspaces: CollectionConfig = {
  slug: "workspaces",
  admin: { useAsTitle: "name" },
  access: {
    create: () => false,
    read: ({ req }) =>
      req.user ? { id: { equals: workspaceId(req.user) } } : false,
    update: ({ req }) =>
      isAdmin(req.user) ? { id: { equals: workspaceId(req.user) } } : false,
    delete: () => false,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "plan",
      type: "select",
      defaultValue: "starter",
      options: ["starter", "pro"],
      access: { update: () => false },
    },
  ],
};
function documentScope(req: any, write: boolean): boolean | Where {
  if (!req.user || req.user.disabled) return false;
  const allowed = Object.entries({
    goals: "overview",
    focus: "profile",
    tasks: "tasks",
    boards: "tasks",
    nodes: "canvas",
    spaces: "canvas",
    edges: "canvas",
    events: "calendar",
    pages: "pages",
  })
    .filter(([, section]) =>
      (write ? canWrite : canView)(req.user, section as Section),
    )
    .map(([prefix]) => ({ key: { contains: prefix + ":" } }));
  if (isAdmin(req.user)) allowed.push({ key: { equals: "settings" } } as any);
  if (!allowed.length) return false;
  return {
    and: [
      { workspace: { equals: workspaceId(req.user) } },
      {
        or: [
          { privateOwner: { exists: false } },
          { privateOwner: { equals: String(req.user.id) } },
        ],
      },
      { or: allowed },
    ],
  };
}
const canvasSecret = () => process.env.PRIVATE_CANVAS_SECRET || process.env.PAYLOAD_SECRET || "";
const canvasScope = (doc: {workspace?: any; key?: string; privateOwner?: string | null}) => ({
  workspace: String(typeof doc.workspace === "object" ? doc.workspace?.id : doc.workspace),
  key: String(doc.key),
  owner: String(doc.privateOwner),
});
const Documents: CollectionConfig = {
  slug: "documents",
  access: {
    create: ({ req, data }) => {
      const section = sectionForKey(data?.key);
      return !!section && canWrite(req.user, section);
    },
    read: ({ req }) => documentScope(req, false),
    update: ({ req }) => documentScope(req, true),
    delete: ({ req }) => {
      const scope = documentScope(req, true);
      return typeof scope === "object" ? { and: [scope, { deletedAt: { exists: true } }] } : false;
    },
  },
  fields: [
    { name: "deletedAt", type: "date", index: true },
    { name: "trashGroup", type: "text", index: true },
    {
      name: "workspace",
      type: "relationship",
      relationTo: "workspaces",
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: "privateOwner",
      type: "text",
      index: true,
      access: { update: () => false },
    },
    { name: "key", type: "text", required: true, index: true },
    {
      name: "workspaceKey",
      type: "text",
      unique: true,
      required: true,
      admin: { hidden: true },
    },
    { name: "value", type: "json", required: true },
  ],
  hooks: {
    beforeChange: [({data, originalDoc}) => {
      const record = {...originalDoc, ...data, privateOwner:data.privateOwner || originalDoc?.privateOwner, workspace:data.workspace ?? originalDoc?.workspace};
      if (record.privateOwner && privateCanvasKey(record.key) && data.value) {
        if (isSealedCanvas(data.value)) throw new APIError("Documento privado inválido.", 400);
        data.value = sealCanvas(data.value, canvasScope(record), canvasSecret());
      }
      return data;
    }],
    afterRead: [({doc, req}) => {
      if (doc.privateOwner && privateCanvasKey(doc.key)) {
        if (String(req.user?.id) !== String(doc.privateOwner)) return {...doc, value:null};
        if (isSealedCanvas(doc.value)) return {...doc, value:unsealCanvas(doc.value,canvasScope(doc),canvasSecret()), canvasEncrypted:true};
        return {...doc, canvasEncrypted:false};
      }
      return doc;
    }],
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        normalizeDeletion(data, originalDoc);
        const previousValue = isSealedCanvas(originalDoc?.value)
          ? unsealCanvas(originalDoc.value, canvasScope(originalDoc), canvasSecret()) : originalDoc?.value;
        if (data && !data.value && previousValue) data.value = previousValue;
        const key = data?.key || originalDoc?.key;
        const section = sectionForKey(key);
        if (
          !section ||
          !canWrite(req.user, section) ||
          !/^(settings|(?:tasks|boards|nodes|spaces|edges|events|pages|goals|focus):[a-zA-Z0-9 _-]{1,100})$/.test(
            key,
          )
        )
          throw new APIError("No puedes modificar esta sección.", 403);
        if (key.startsWith("boards:") && !validSprints(data?.value?.sprints)) throw new APIError("Sprint no válido.",400);
        if(key.startsWith("boards:")) {
          const error=boardTransitionError(previousValue?.work,data?.value?.work);
          if(error)throw new APIError(error,400);
          if(previousValue?.sprints && !sameWorkData(previousValue.sprints,data?.value?.sprints))throw new APIError("Conserva el historial anterior de ciclos.",400);
          const owner=originalDoc?.privateOwner || (data?.value?.privateOwner ? String(req.user!.id):null);
          for(const cycle of data?.value?.work?.cycles||[])if(!data?.deletedAt&&cycle.status!=="closed")for(const taskId of cycle.taskIds){
            const found=await req.payload.find({collection:"documents",where:{and:[{workspace:{equals:workspaceId(req.user)}},{key:{equals:"tasks:"+taskId}},{deletedAt:{exists:false}}]},limit:1,depth:0,overrideAccess:false,req});
            const task=found.docs[0];if(!task || jsonRecord(task.value).boardId!==key.slice(7) || (task.privateOwner||null)!==owner)throw new APIError("Las tareas del ciclo deben pertenecer a este tablero y conservar su privacidad.",403);
          }
        }
        if(key.startsWith("tasks:")) {
          if(!validTaskWork(data?.value||{}))throw new APIError("Revisa el bloqueo, responsable y propiedades de la tarea.",400);
          if(data?.value?.assigneeId){const member=await req.payload.find({collection:"users",where:{and:[{workspace:{equals:workspaceId(req.user)}},{id:{equals:data.value.assigneeId}},{disabled:{not_equals:true}}]},limit:1,depth:0,overrideAccess:true,req});if(!member.docs[0]||!canView(member.docs[0],"tasks")||(data.value.privateOwner&&String(member.docs[0].id)!==String(req.user!.id)))throw new APIError("El responsable debe tener acceso a la tarea.",403);}
        }
        if((key.startsWith("tasks:")||key.startsWith("pages:"))&&data?.value?.links){
          if(!validLinks(data.value.links))throw new APIError("Relación no válida.",400);
          const owner=originalDoc?.privateOwner || (data.value.privateOwner?String(req.user!.id):null);
          for(const link of data.value.links){const target=await req.payload.find({collection:link.kind==="files"?"workspace-files":"documents",where:{and:[{workspace:{equals:workspaceId(req.user)}},...(link.kind==="files"?[{id:{equals:link.id}}]:[{key:{equals:link.kind+":"+link.id}}]),{deletedAt:{exists:false}}]},limit:1,depth:0,overrideAccess:false,req});const doc=target.docs[0];if(!doc){if(previousValue?.links?.some((l:any)=>l.kind===link.kind&&l.id===link.id))continue;throw new APIError("Contenido vinculado no disponible.",403);}
            if((("privateOwner" in doc?doc.privateOwner:null)||null)!==owner)throw new APIError("Vincula recursos con la misma privacidad.",403);
          }
        }
        if (key.startsWith("focus:")) {
          if (
            key !== "focus:" + req.user!.id ||
            !data?.value ||
            !Array.isArray(data.value.selections) ||
            data.value.selections.length > 1000 ||
            data.value.selections.some(
              (e: any) =>
                !e ||
                typeof e.taskId !== "string" ||
                !/^[a-zA-Z0-9 _-]{1,100}$/.test(e.taskId) ||
                typeof e.addedOn !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(e.addedOn),
            )
          )
            throw new APIError("Selección personal no válida.", 400);
          if (
            !validDirectoryPreferences(data.value.favoriteKeys, data.value.directories) ||
            !validPlanningPreferences(data.value) ||
            (data.value.theme !== undefined && !["light", "dark"].includes(data.value.theme)) ||
            (data.value.showTaskComments !== undefined &&
              typeof data.value.showTaskComments !== "boolean") ||
            (data.value.showMoney !== undefined &&
              typeof data.value.showMoney !== "boolean") ||
            (data.value.taskMode !== undefined &&
              !["board", "list"].includes(data.value.taskMode))
          )
            throw new APIError("Preferencias no válidas.", 400);
          if (
            data.value.privateSections !== undefined &&
            (!Array.isArray(data.value.privateSections) ||
              data.value.privateSections.length > 3 ||
              new Set(data.value.privateSections).size !==
                data.value.privateSections.length ||
              data.value.privateSections.some(
                (k: string) => !["spaces", "tasks", "pages"].includes(k),
              ))
          )
            throw new APIError("Secciones privadas no válidas.", 400);
          data.privateOwner = String(req.user!.id);
          data.value.privateOwner = String(req.user!.id);
          data.value.id = String(req.user!.id);
        }
        if (key.startsWith("goals:")) {
          data!.privateOwner = null;
          if (
            !data?.value ||
            typeof data.value.title !== "string" ||
            !data.value.title.trim() ||
            data.value.title.length > 160 ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.value.month) ||
            typeof data.value.done !== "boolean"
          )
            throw new APIError("Revisa el objetivo y su mes.", 400);
          data.value.id = key.slice(6);
          data.value.createdBy =
            previousValue?.createdBy || String(req.user!.id);
        }
        if (key === "settings" && data?.value) {
          if (
            (data.value.phone && !validPhone(data.value.phone)) ||
            (data.value.socialLinks &&
              !validSocialLinks(data.value.socialLinks))
          )
            throw new APIError("Revisa el teléfono y las redes sociales.", 400);
          if (data.value.rut && !validRut(data.value.rut))
            throw new APIError("Revisa el RUT.", 400);
          if (!validLogo(data.value.logoData))
            throw new APIError("Logo no válido.", 400);
        }
        if (key.startsWith("tasks:") && data?.value?.boardId) {
          const board = await req.payload.find({
            collection: "documents",
            where: { key: { equals: "boards:" + data.value.boardId } },
            limit: 1,
            depth: 0,
            overrideAccess: false,
            req,
          });
          if (!board.docs[0] && data.value.boardId!=="general") throw new APIError("Tablero no disponible.",403);
          if (board.docs[0]) {
            const owner = board.docs[0].privateOwner || undefined;
            if (
              board.docs[0].deletedAt ||
              (originalDoc?.key && (originalDoc.privateOwner || undefined) !== owner)
            )
              throw new APIError(
                "El tablero debe tener la misma privacidad que la tarea.",
                403,
              );
            if (!originalDoc?.key) data.value.privateOwner = owner;
            if(owner&&data.value.assigneeId&&String(data.value.assigneeId)!==String(req.user!.id))throw new APIError("Una tarea privada solo puede asignarse a su propietario.",403);
          }
        }
        const workspace = workspaceId(req.user);
        data!.workspace = workspace;
        if (/^(spaces|tasks|pages|boards):/.test(key)) {
          const existing = originalDoc?.privateOwner;
          data!.privateOwner =
            existing ||
            (originalDoc?.key
              ? null
              : data?.value?.privateOwner
                ? String(req.user!.id)
                : null);
          if (data!.value)
            data!.value.privateOwner = data!.privateOwner || undefined;
          if (key.startsWith("spaces:") && data?.value?.folder) {
            const { parentId, x, y } = data.value.folder;
            if (typeof parentId !== "string" || !/^[-\w ]{1,100}$/.test(parentId) ||
                parentId === key.slice(7) || !Number.isFinite(x) || !Number.isFinite(y))
              throw new APIError("Ubicación de carpeta inválida.", 400);
            if (!originalDoc?.key || previousValue?.folder?.parentId !== parentId) {
              const parent = await req.payload.find({collection:"documents",where:{key:{equals:"spaces:"+parentId}},limit:1,depth:0,overrideAccess:false,req});
              if (!parent.docs[0] || parent.docs[0].deletedAt || (parent.docs[0].privateOwner && !data!.privateOwner))
                throw new APIError("El espacio padre no está disponible para esta carpeta.", 403);
            }
          }
        } else if (key.startsWith("nodes:")) {
          const space = await req.payload.find({
            collection: "documents",
            where: { key: { equals: "spaces:" + data?.value?.space } },
            limit: 1,
            depth: 0,
            overrideAccess: false,
            req,
          });
          if (!space.docs[0]) throw new APIError("Espacio no disponible.", 403);
          data!.privateOwner = space.docs[0].privateOwner || null;
          if (data?.value?.borderStyle === "dashed")
            data.value.cloudAuthor = originalDoc?.key ? previousValue?.cloudAuthor : String(req.user?.name || "").slice(0,80);
          else if (data?.value) delete data.value.cloudAuthor;
          if (originalDoc?.key && (originalDoc.privateOwner || null) !== data!.privateOwner)
            throw new APIError("No puedes mover una tarjeta entre espacios con distinta privacidad.", 403);
          if (data?.value?.pageId) {
            const page = await req.payload.find({
              collection: "documents",
              where: { key: { equals: "pages:" + data.value.pageId } },
              limit: 1,
              depth: 0,
              overrideAccess: false,
              req,
            });
            if (
              !page.docs[0] ||
              (page.docs[0].privateOwner || null) !==
                (data!.privateOwner || null)
            )
              throw new APIError(
                "La nota y el espacio deben tener la misma privacidad.",
                403,
              );
          }
        } else if (key.startsWith("edges:")) {
          const from = await req.payload.find({
            collection: "documents",
            where: { key: { equals: "nodes:" + data?.value?.from } },
            limit: 1,
            depth: 0,
            overrideAccess: false,
            req,
          });
          const to = await req.payload.find({
            collection: "documents",
            where: { key: { equals: "nodes:" + data?.value?.to } },
            limit: 1,
            depth: 0,
            overrideAccess: false,
            req,
          });
          if (
            !from.docs[0] ||
            !to.docs[0] ||
            jsonRecord(from.docs[0].value).space !== jsonRecord(to.docs[0].value).space
          )
            throw new APIError("Conexión no válida.", 403);
          data!.privateOwner = from.docs[0].privateOwner || null;
        }
        data!.workspaceKey = workspace + ":" + (data!.key || originalDoc?.key);
        return data;
      },
    ],
  },
};
const Integrations: CollectionConfig = {
  slug: "integrations",
  access: {
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }) =>
      req.user && !req.user.disabled
        ? { workspace: { equals: workspaceId(req.user) } }
        : false,
    update: ({ req }) =>
      isAdmin(req.user)
        ? { workspace: { equals: workspaceId(req.user) } }
        : false,
    delete: ({req}): boolean | Where => isAdmin(req.user) ? {and:[{workspace:{equals:workspaceId(req.user)}},{provider:{in:[...storeProviders]}}]} : false,
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
    {
      name: "provider",
      type: "select",
      required: true,
      options: ["woo", "shopify", "payload", "google", "email", "whatsapp"],
    },
    {
      name: "workspaceProvider",
      type: "text",
      unique: true,
      required: true,
      admin: { hidden: true },
    },
    {
      name: "credentials",
      type: "textarea",
      required: true,
      admin: {
        description:
          "AES-GCM encrypted by the Astro server. Never store plaintext.",
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!req.user) throw new APIError("Authentication required", 401);
        const workspace = workspaceId(req.user), provider = data?.provider || originalDoc?.provider;
        if (originalDoc?.provider && provider !== originalDoc.provider)
          throw new APIError("Desconecta la integración antes de cambiar de plataforma.", 409);
        if (isStoreProvider(provider)) {
          const stores = await req.payload.find({collection:"integrations",where:{and:[{workspace:{equals:workspace}},{provider:{in:[...storeProviders]}}]},limit:3,depth:0,overrideAccess:false,req});
          const conflict = blockedStore(provider, stores.docs.map(d => d.provider));
          if (conflict) throw new APIError(storeConflictMessage(conflict),409);
        }
        data!.workspace = workspace;
        // A single unique key gives all store providers the same slot, including concurrent requests.
        data!.workspaceProvider = workspace + ":" + (isStoreProvider(provider) ? "store" : provider);
        return data;
      },
    ],
  },
};
const Deliveries: CollectionConfig = {
  slug: "deliveries",
  access: {
    create: () => false,
    read: scoped,
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
    },
    { name: "key", type: "text", required: true, unique: true },
    {
      name: "provider",
      type: "select",
      options: ["email", "whatsapp"],
      required: true,
    },
    {
      name: "status",
      type: "select",
      options: ["pending", "sent", "error"],
      required: true,
    },
  ],
};
export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  serverURL: process.env.PAYLOAD_PUBLIC_URL || "http://localhost:3001",
  admin: { user: "users", importMap: { baseDir: process.cwd() } },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    push: process.env.NODE_ENV !== "production",
  }),
  collections: [
    Users,
    Workspaces,
    Documents,
    Integrations,
    Deliveries,
    Comments,
    Notifications,
    Polls, PollVotes,
    Vault,
    Files,
    WorkspaceFiles,
    WorkspaceFolders,
  ],
  typescript: { outputFile: "src/payload-types.ts" },
  endpoints: [
    inviteMemberEndpoint,acceptInvitationEndpoint,
    {
      path: "/branding",
      method: "get",
      handler: async (req) => {
        if (!req.user || req.user.disabled)
          return Response.json({ error: "Inicia sesión." }, { status: 401 });
        const result = await req.payload.find({
          collection: "documents",
          where: {
            and: [
              { workspace: { equals: workspaceId(req.user) } },
              { key: { equals: "settings" } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        });
        const value = jsonRecord(result.docs[0]?.value);
        return Response.json({
          name: value.name,
          logoData: value.logoData,
          currency: value.currency,
          timezone: value.timezone,
        });
      },
    },
    directoryEndpoint,
    meetingDirectoryEndpoint,
    canvasDirectoryEndpoint,
  discardCanvasEndpoint,
    notificationDirectoryEndpoint,
    sendNotificationEndpoint,
    pollsEndpoint, createPollEndpoint, votePollEndpoint,
    {
      path: "/register-workspace",
      method: "post",
      handler: async (req) => {
        const body = await req.json?.();
        const expected = process.env.REGISTRATION_CODE || "";
        const actual = String(body?.code || "");
        const codeOk =
          expected.length >= 16 &&
          Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
          timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
        if (!codeOk)
          return Response.json(
            { error: "Invalid registration" },
            { status: 403 },
          );
        if (
          typeof body.email !== "string" ||
          typeof body.password !== "string" ||
          body.password.length < 12 ||
          body.password.length > 128 ||
          typeof body.name !== "string" ||
          !body.name.trim() ||
          typeof body.business !== "string" ||
          !body.business.trim()
        )
          return Response.json({ error: "Invalid data" }, { status: 400 });
        const transactionID = await req.payload.db.beginTransaction();
        if (!transactionID)
          return Response.json(
            { error: "Database unavailable" },
            { status: 503 },
          );
        req.transactionID = transactionID;
        try {
          const workspace = await req.payload.create({
            collection: "workspaces",
            data: { name: body.business.slice(0, 80) },
            req,
            overrideAccess: true,
          });
          const user = await req.payload.create({
            collection: "users",
            data: {
              email: body.email,
              password: body.password,
              name: body.name.slice(0, 80),
              role: "owner",
              workspace: workspace.id,
            },
            req,
            overrideAccess: true,
          });
          await req.payload.db.commitTransaction(transactionID);
          return Response.json({ id: user.id }, { status: 201 });
        } catch {
          await req.payload.db.rollbackTransaction(transactionID);
          return Response.json(
            { error: "Could not register" },
            { status: 400 },
          );
        }
      },
    },
  ],
});
