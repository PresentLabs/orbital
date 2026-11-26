import {validEventDates} from "./date-ranges.ts";
import {validBusinessPalette,validColumnNames,type BusinessPalette} from "../../../services/payload/src/ui-settings.ts";
import {isNoteColor,validSpatial,type NoteColor,type SpatialBlock} from './spatial.ts';
import {validDemoPolls} from '../../../services/payload/src/poll-policy.ts';
import {validBoardWork,validTaskWork,type BoardWork,type ResourceLink} from "../../../services/payload/src/work-management.ts";
import {validPlanningPreferences,validSprints,type PersonalDaily, type VisionBoard,type Sprint} from "../../../services/payload/src/planning.ts";
import {validDirectoryPreferences,type DirectorySettings} from "../../../services/payload/src/directory-preferences.ts";
import { validSocialLinks } from "../../../services/payload/src/ecommerce.ts";
import {
  validLogo,
  validAvatar,
} from "../../../services/payload/src/formats.ts";
export type TaskStatus = "todo" | "doing" | "done";
export interface Task {
  startDate?:string;
  assigneeId?:string; blockedAt?:string; blockedReason?:string; descriptionHtml?:string; links?:ResourceLink[]; activity?:{at:string;kind:"completed"|"reopened"}[];
  id: string;
  title: string;
  project: string;
  status: TaskStatus;
  priority: "high" | "normal";
  due: string;
  description: string;
  order?: number;
  boardId?: string;
  privateOwner?: string;
}
export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  text: string;
  mentions: string[];
  createdAt: string;
}
export interface TaskNotification {
  id: string;
  taskId?: string;
  commentId?: string;
  kind?: "mention" | "message" | "poll";
  pollId?: string;
  authorName?: string;
  recipientId: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
}
export interface CanvasNode {
  width?:number; height?:number; spatial?:SpatialBlock;
  borderStyle?: "solid" | "dashed";
  noteColor?: NoteColor;
  attachedTo?: string;
  metric?: "sales" | "orders" | "seo" | "carts";
  cloudAuthor?: string;
  calculation?: boolean;
  diagramShape?: "process" | "decision" | "terminal";
  id: string;
  space: string;
  kind: "note" | "page" | "tasks" | "sales" | "image";
  title: string;
  body: string;
  x: number;
  y: number;
  image?: string;
  pageId?: string;
  bodyHtml?: string;
  checklist?: { id: string; text: string; done: boolean }[];
}
export interface TaskBoard {
  columnNames?:Partial<Record<TaskStatus,string>>;
  work?:BoardWork;
  sprints?: Sprint[];
  privateOwner?: string;
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}
export interface Page {
  markdown?: string;
  wikiTargets?: { title: string; id: string }[];
  authorId?:string; links?:ResourceLink[];
  createdAt?: string;
  privateOwner?: string;
  id: string;
  title: string;
  body: string;
  bodyHtml?: string;
  emoji: string;
  updated: string;
}
export interface CalendarEvent {
  allDay?: boolean;
  endDate?: string;
  endTime?: string;
  meetUrl?: string;
  googleEventId?: string;
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
}
export interface Space {
  folder?: { parentId: string; x: number; y: number; groupId?: string; noteColor?: NoteColor; groupOffset?: { x: number; y: number } };
  createdAt?: string;
  id: string;
  name: string;
  color: string;
  privateOwner?: string;
}
export type PortSide = "top" | "bottom" | "left" | "right";
export interface Edge {
  fromSide?: PortSide;
  toSide?: PortSide;
  id: string;
  from: string;
  to: string;
}
export interface Settings {
  palette?:BusinessPalette;
  name: string;
  email: string;
  currency: string;
  timezone: string;
  rut?: string;
  giro?: string;
  phone?: string;
  socialLinks?: Record<string, string>;
  logoData?: string;
}
export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  disabled?: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  avatarData?: string;
  deletedAt?: string;
}
export interface MonthlyGoal {
  id: string;
  title: string;
  month: string;
  done: boolean;
  createdBy?: string;
}
export interface PersonalFocus {
  completedDay?: { date: string; taskIds: string[] };
  daily?: PersonalDaily;
  visionBoard?: VisionBoard;
  overviewMode?: "goals" | "vision";
  taskDirectoryMode?: "boards" | "scrum";
  favoriteKeys?: string[];
  directories?: DirectorySettings;
  id: string;
  privateOwner: string;
  selections: { taskId: string; addedOn: string }[];
  privateSections?: ("spaces" | "tasks" | "pages")[];
  theme?: "light" | "dark";
  showTaskComments?: boolean;
  showMoney?: boolean;
  taskMode?: "board" | "list" | "timeline";
}
export interface DemoTrash {
  id: string;
  title: string;
  section: string;
  privateOwner?: string;
  deletedAt: string;
  items: { group: string; value: any }[];
}
export interface WorkspaceState {
  trash?: DemoTrash[];
  goals?: MonthlyGoal[];
  focus?: PersonalFocus[];
  version: 1;
  tasks: Task[];
  boards?: TaskBoard[];
  nodes: CanvasNode[];
  pages: Page[];
  events: CalendarEvent[];
  spaces: Space[];
  edges: Edge[];
  settings: Settings;
  demoMembers?: WorkspaceMember[];
  comments?: TaskComment[];
  notifications?: TaskNotification[];
  polls?: {id:string;question:string;options:string[];recipients:string[];authorId:string;createdAt:string;votes:{userId:string;option:number}[]}[];
}
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const uid = () => crypto.randomUUID();
export function initialState(demo = true): WorkspaceState {
  const now = new Date();
  const due = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return dateKey(d);
  };
  return {
    version: 1,
    goals: [],
    focus: [],
    trash: [],
    demoMembers: demo
      ? [
          {
            id: "demo-me",
            name: "Administrador",
            email: "tu@ejemplo.cl",
            role: "owner",
            permissions: [],
          },
          {
            id: "demo-ana",
            name: "Ana Martínez",
            email: "ana@ejemplo.cl",
            role: "member",
            permissions: [
              "overview",
              "canvas",
              "tasks",
              "calendar",
              "analytics",
              "pages",
            ],
          },
          {
            id: "demo-diego",
            name: "Diego Soto",
            email: "diego@ejemplo.cl",
            role: "viewer",
            permissions: ["overview", "tasks", "pages"],
          },
        ]
      : undefined,
    boards: [
      {
        id: "general",
        name: "Trabajo del equipo",
        description: "Organiza los pendientes del negocio.",
        color: "green",
        createdAt: now.toISOString(),
      },
    ],
    comments: [],
    notifications: [],
    settings: {
      name: demo ? "Punto Pixel" : "Mi negocio",
      email: "",
      currency: "CLP",
      timezone: "America/Santiago",
    },
    spaces: [
      { id: "Negocio", name: "Mi negocio", color: "green" },
      ...(demo
        ? [
            {
              id: "Lanzamiento de verano",
              name: "Lanzamiento de verano",
              color: "orange",
            },
          ]
        : []),
    ],
    tasks: demo
      ? [
          {
            id: "t1",
            title: "Preparar campaña de verano",
            project: "Marketing",
            status: "doing",
            priority: "high",
            due: due(0),
            description: "Definir concepto, piezas y calendario de la campaña.",
          },
          {
            id: "t2",
            title: "Revisar pedidos pendientes",
            project: "Tienda online",
            status: "todo",
            priority: "high",
            due: due(0),
            description: "Confirmar stock y coordinar los despachos.",
          },
          {
            id: "t3",
            title: "Actualizar fichas de productos",
            project: "Tienda online",
            status: "doing",
            priority: "normal",
            due: due(0),
            description: "Revisar títulos, descripciones y fotografías.",
          },
          {
            id: "t4",
            title: "Planificar contenido semanal",
            project: "Contenido",
            status: "todo",
            priority: "normal",
            due: due(0),
            description: "Preparar el contenido para redes sociales.",
          },
          {
            id: "t5",
            title: "Revisar propuesta de diseño",
            project: "Diseño",
            status: "done",
            priority: "normal",
            due: due(0),
            description: "Propuesta aprobada.",
          },
          {
            id: "t6",
            title: "Publicar nueva colección",
            project: "Marketing",
            status: "todo",
            priority: "high",
            due: due(4),
            description: "Coordinar lanzamiento de verano.",
          },
        ]
      : [],
    nodes: demo
      ? [
          {
            id: "n1",
            space: "Negocio",
            kind: "page",
            title: "Nuestro próximo gran paso",
            body: "Lanzamiento de verano\n\nUna colección hecha para disfrutar lo simple.\n\nObjetivo: conectar con nuevas personas y crecer juntos.",
            x: 95,
            y: 95,
          },
          {
            id: "n2",
            space: "Negocio",
            kind: "tasks",
            title: "Del plan a la acción",
            body: "",
            x: 475,
            y: 85,
          },
          {
            id: "n3",
            space: "Negocio",
            kind: "note",
            title: "Una idea para después",
            body: "¿Y si cada pedido incluyera una nota escrita a mano?\n\nLos pequeños detalles hacen la diferencia. ✧",
            x: 150,
            y: 355,
          },
          {
            id: "n4",
            space: "Negocio",
            kind: "sales",
            title: "El pulso de la tienda",
            body: "Datos de ejemplo · WooCommerce",
            x: 835,
            y: 220,
          },
        ]
      : [],
    edges: demo
      ? [
          { id: "e1", from: "n1", to: "n2" },
          { id: "e2", from: "n2", to: "n4" },
          { id: "e3", from: "n1", to: "n3" },
        ]
      : [],
    pages: demo
      ? [
          {
            id: "p1",
            title: "La esencia de Punto Pixel",
            emoji: "✳",
            body: "Creamos cosas que conectan.\n\nNuestra misión es transformar buenas ideas en experiencias que importan.\n\nValores\n• Cercanía y claridad\n• Atención a los detalles\n• Crecer en equipo",
            updated: now.toISOString(),
          },
          {
            id: "p2",
            title: "Plan de lanzamiento",
            emoji: "↗",
            body: "Una nueva temporada, nuevas posibilidades.\n\n1. Definir la colección\n2. Preparar fotografías\n3. Crear campaña\n4. Publicar y medir resultados",
            updated: now.toISOString(),
          },
          {
            id: "p3",
            title: "Ideas que nos inspiran",
            emoji: "✧",
            body: "Un lugar para guardar todo lo que puede convertirse en algo grande.\n\nCada idea merece un espacio.",
            updated: now.toISOString(),
          },
        ]
      : [],
    events: demo
      ? [
          {
            id: "ev1",
            title: "Planificación de la semana",
            date: due(1),
            time: "09:30",
            description: "Revisar prioridades y próximos pasos.",
          },
          {
            id: "ev2",
            title: "Lanzamiento de verano",
            date: due(4),
            time: "10:00",
            description: "Publicación de la nueva colección.",
          },
          {
            id: "ev3",
            title: "Revisión de resultados",
            date: due(8),
            time: "16:00",
            description: "Analizar ventas y oportunidades.",
          },
        ]
      : [],
  };
}
export function validateState(value: unknown): value is WorkspaceState {
  try {
    if (!value || typeof value !== "object") return false;
    const v = value as WorkspaceState;
    const text = (s: unknown, max = 30000) =>
      typeof s === "string" && s.length <= max;
    const id = (s: unknown) =>
      typeof s === "string" && /^[a-zA-Z0-9 _-]{1,100}$/.test(s);
    const date = (s: unknown) =>
      typeof s === "string" && (!s || /^\d{4}-\d{2}-\d{2}$/.test(s));
    return (
      v.version === 1 &&
      (v.trash === undefined ||
        (Array.isArray(v.trash) &&
          v.trash.length <= 1000 &&
          v.trash.every(
            (t) =>
              id(t.id) && validTaskWork(t) &&
              text(t.title, 200) &&
              text(t.section, 30) &&
              Number.isFinite(Date.parse(t.deletedAt)) &&
              Array.isArray(t.items) &&
              t.items.length <= 2000 &&
              t.items.every(
                (i) =>
                  [
                    "spaces",
                    "tasks",
                    "pages",
                    "boards",
                    "nodes",
                    "edges",
                    "goals",
                    "demoMembers",
                  ].includes(i.group) &&
                  i.value &&
                  id(i.value.id),
              ),
          ))) &&
      (v.goals === undefined ||
        (Array.isArray(v.goals) &&
          v.goals.length <= 1000 &&
          v.goals.every(
            (g) =>
              id(g.id) &&
              text(g.title, 160) &&
              /^\d{4}-(0[1-9]|1[0-2])$/.test(g.month) &&
              typeof g.done === "boolean",
          ))) &&
      (v.focus === undefined ||
        (Array.isArray(v.focus) &&
          v.focus.length <= 1000 &&
          v.focus.every(
            (f) =>
              id(f.id) &&
              id(f.privateOwner) &&
              (f.privateSections === undefined ||
                (Array.isArray(f.privateSections) &&
                  f.privateSections.length <= 3 &&
                  new Set(f.privateSections).size ===
                    f.privateSections.length &&
                  f.privateSections.every((k) =>
                    ["spaces", "tasks", "pages"].includes(k),
                  ))) &&
              validDirectoryPreferences(f.favoriteKeys, f.directories) &&
              validPlanningPreferences(f) &&
              (f.theme === undefined || ["light", "dark"].includes(f.theme)) &&
              (f.showTaskComments === undefined ||
                typeof f.showTaskComments === "boolean") &&
              (f.showMoney === undefined || typeof f.showMoney === "boolean") &&
              (f.taskMode === undefined ||
                ["board", "list", "timeline"].includes(f.taskMode)) &&
              Array.isArray(f.selections) &&
              f.selections.length <= 1000 &&
              f.selections.every(
                (e) =>
                  id(e.taskId) &&
                  typeof e.addedOn === "string" &&
                  /^\d{4}-\d{2}-\d{2}$/.test(e.addedOn),
              ),
          ))) &&
      ["tasks", "nodes", "pages", "events", "spaces", "edges"].every((k) => {
        const a = (v as unknown as Record<string, unknown>)[k];
        return Array.isArray(a) && a.length <= 1000;
      }) &&
      validBusinessPalette(v.settings?.palette) && text(v.settings?.name, 80) &&
      text(v.settings.email, 254) &&
      ["CLP", "USD", "EUR"].includes(v.settings.currency) &&
      text(v.settings.timezone, 80) &&
      (v.settings.logoData === undefined || validLogo(v.settings.logoData)) &&
      (v.settings.rut === undefined || text(v.settings.rut, 20)) &&
      (v.settings.giro === undefined || text(v.settings.giro, 160)) &&
      (v.settings.phone === undefined || text(v.settings.phone, 30)) &&
      (v.settings.socialLinks === undefined ||
        validSocialLinks(v.settings.socialLinks)) &&
      v.tasks.every(
        (t) =>
          id(t.id) && validTaskWork(t) &&
          (t.privateOwner === undefined || id(t.privateOwner)) &&
          (t.boardId === undefined || id(t.boardId)) &&
          text(t.title, 140) &&
          text(t.project, 60) &&
          text(t.description, 5000) &&
          date(t.due) &&
          ["todo", "doing", "done"].includes(t.status) &&
          ["normal", "high"].includes(t.priority) &&
          (t.order === undefined || Number.isFinite(t.order)),
      ) &&
      v.nodes.every(
        (n) =>
          id(n.id) && validSpatial(n) &&
          (n.metric === undefined || (n.kind === "sales" && ["sales", "orders", "seo", "carts"].includes(n.metric))) &&
          (n.attachedTo === undefined || (n.kind === "note" && id(n.attachedTo) && n.attachedTo !== n.id)) &&
          (n.cloudAuthor === undefined || text(n.cloudAuthor,80)) &&
          (n.diagramShape === undefined || (n.kind === "page" && !n.pageId && !n.spatial && !n.calculation && ["process", "decision", "terminal"].includes(n.diagramShape))) &&
          (n.calculation === undefined || (typeof n.calculation === "boolean" && n.kind === "page" && !n.pageId && !n.spatial)) &&
          (n.noteColor === undefined || (n.kind === "note" && isNoteColor(n.noteColor))) &&
          id(n.space) &&
          (n.borderStyle === undefined ||
            ["solid", "dashed"].includes(n.borderStyle)) &&
          text(n.title, 120) &&
          text(n.body, 30000) &&
          (n.bodyHtml === undefined || text(n.bodyHtml)) &&
          (n.checklist === undefined ||
            (Array.isArray(n.checklist) &&
              n.checklist.length <= 500 &&
              n.checklist.every(
                (i) =>
                  id(i.id) && text(i.text, 2000) && typeof i.done === "boolean",
              ))) &&
          Number.isFinite(n.x) &&
          Number.isFinite(n.y) &&
          ["note", "page", "tasks", "sales", "image"].includes(n.kind) &&
          (!n.image ||
            (n.image.length <= 2100000 &&
              /^data:image\/(png|jpeg|webp|gif);base64,/.test(n.image))),
      ) &&
      v.pages.every(
        (p) =>
          id(p.id) &&
          (p.privateOwner === undefined || id(p.privateOwner)) &&
          text(p.title, 140) &&
          text(p.body, 30000) &&
          (p.bodyHtml === undefined || text(p.bodyHtml)) &&
          (p.markdown === undefined || text(p.markdown, 30000)) &&
          (p.wikiTargets === undefined || (Array.isArray(p.wikiTargets) && p.wikiTargets.length <= 6000 &&
            p.wikiTargets.every(target => target && text(target.title, 140) && id(target.id)))) &&
          text(p.emoji, 30) &&
          text(p.updated, 40) &&
          Number.isFinite(Date.parse(p.updated)),
      ) &&
      v.spaces.every(
        (s) =>
          id(s.id) &&
          (s.privateOwner === undefined || id(s.privateOwner)) &&
          text(s.name, 60) &&
          (s.folder === undefined || (!!s.folder && id(s.folder.parentId) &&
            s.folder.parentId !== s.id && (s.folder.groupId === undefined || id(s.folder.groupId)) && Number.isFinite(s.folder.x) && Number.isFinite(s.folder.y) && (s.folder.noteColor === undefined || isNoteColor(s.folder.noteColor)) &&
            (s.folder.groupOffset === undefined || (s.folder.groupOffset &&
              Number.isFinite(s.folder.groupOffset.x) && Number.isFinite(s.folder.groupOffset.y))))) &&
          ["green", "orange"].includes(s.color),
      ) &&
      v.events.every(
        (e) =>
          id(e.id) &&
          text(e.title, 120) &&
          text(e.description, 5000) &&
          date(e.date) && validEventDates(e),
      ) &&
      (v.boards === undefined ||
        (Array.isArray(v.boards) &&
          v.boards.length <= 1000 &&
          v.boards.every(
            (b) =>
              id(b.id) && validColumnNames(b.columnNames) &&
              (b.privateOwner === undefined || id(b.privateOwner)) &&
              validSprints(b.sprints) && validBoardWork(b.work) &&
              text(b.name, 80) &&
              text(b.description, 2000),
          ))) &&
      v.edges.every(
        (e) =>
          id(e.id) &&
          id(e.from) &&
          id(e.to) &&
          [e.fromSide, e.toSide].every(
            (side) =>
              side === undefined ||
              ["top", "bottom", "left", "right"].includes(side),
          ),
      ) &&
      (v.demoMembers === undefined ||
        (Array.isArray(v.demoMembers) &&
          v.demoMembers.length <= 1000 &&
          v.demoMembers.every(
            (m) =>
              id(m.id) &&
              text(m.name, 80) &&
              text(m.email, 254) &&
              (m.avatarData === undefined ||
                m.avatarData === "" ||
                validAvatar(m.avatarData)) &&
              (m.deletedAt === undefined ||
                Number.isFinite(Date.parse(m.deletedAt))) &&
              ["owner", "admin", "editor", "member", "viewer"].includes(
                m.role,
              ) &&
              Array.isArray(m.permissions) &&
              m.permissions.every((p) => typeof p === "string"),
          ))) &&
      validDemoPolls(v.polls) &&
      (v.comments === undefined ||
        (Array.isArray(v.comments) &&
          v.comments.length <= 5000 &&
          v.comments.every(
            (c) =>
              id(c.id) &&
              id(c.taskId) &&
              id(c.authorId) &&
              text(c.authorName, 80) &&
              text(c.text, 5000) &&
              Array.isArray(c.mentions) &&
              c.mentions.every(id) &&
              Number.isFinite(Date.parse(c.createdAt)),
          ))) &&
      (v.notifications === undefined ||
        (Array.isArray(v.notifications) &&
          v.notifications.length <= 5000 &&
          v.notifications.every(
            (n) =>
              id(n.id) &&
              (n.taskId === undefined || id(n.taskId)) &&
              (n.commentId === undefined || id(n.commentId)) &&
              id(n.recipientId) &&
              text(n.text, 300) &&
              Number.isFinite(Date.parse(n.createdAt)),
          )))
    );
  } catch {
    return false;
  }
}
export function csvCell(value: string): string {
  return '"' + value.replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
}

/** Order is explicit, so it survives entity sync and filtering. Old tasks retain array order. */
export function orderedTasks(tasks: Task[], status?: TaskStatus) {
  return tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => !status || task.status === status)
    .sort(
      (a, b) =>
        (a.task.order ?? a.index) - (b.task.order ?? b.index) ||
        a.index - b.index,
    )
    .map(({ task }) => task);
}
export function moveTask(
  tasks: Task[],
  id: string,
  status: TaskStatus,
  beforeId?: string,
): Task[] {
  const moving = tasks.find((t) => t.id === id);
  if (!moving || beforeId === id) return tasks;
  const groups: TaskStatus[] = ["todo", "doing", "done"];
  const updates = new Map<string, Task>();
  for (const group of groups) {
    const list = orderedTasks(
      tasks.filter(
        (t) => (t.boardId || "general") === (moving.boardId || "general"),
      ),
      group,
    ).filter((t) => t.id !== id);
    if (group === status) {
      const at = beforeId ? list.findIndex((t) => t.id === beforeId) : -1;
      list.splice(at < 0 ? list.length : at, 0, { ...moving, status });
    }
    list.forEach((t, order) => updates.set(t.id, { ...t, order }));
  }
  return tasks.map((t) => updates.get(t.id) || t);
}
