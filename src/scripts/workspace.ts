import {installModules} from "./workspace-modules";
import { readWorkspaceCache, writeWorkspaceCache } from "@/lib/saas/workspace-cache";
import { noteColors, noteTextColor, visibleNoteColor } from "@/lib/saas/spatial";
import demoCanvasImage from "@/assets/orbita-demo/diseno.png?inline";
import { bounds as canvasBounds } from "@/lib/saas/canvas-organization";
import { installCanvasMedia } from "./workspace-canvas-media";
import { canvasHoverRepulsion, canvasNeighborOffset, canvasProfile } from "./workspace-canvas-organization";
import {installSpatial} from './workspace-spatial';
import {chartSamples,installChartInspection} from './workspace-chart-inspect';
import {smoothLine} from '@/lib/saas/chart-path';
import {installChartMotion,enterWorkspaceView} from './workspace-chart-motion';
import {installWork,workModeField} from "./workspace-work";
import {reconcileWork,retainWorkOnUndo,workModes,modeOf,type WorkMode} from "@/lib/saas/work-management";
import {isSelectionDelete} from "@/lib/saas/selection-keyboard";
import {installPlanning} from "./workspace-planning";
import { clipboardImageFiles, prepareCanvasScreenshot } from "@/lib/saas/canvas-image";
import {installDirectories} from "./workspace-directories";
import {demoMode, demoPath} from "@/lib/saas/routes";
import {isStoreProvider, blockedStore, storeNames, storeConflictMessage} from "../../services/payload/src/store-integrations";
import { spaceCard, boardCard, noteCard } from "@/lib/saas/cards";
import type { Space, TaskBoard, Page } from "@/lib/saas/model";
import { installPresence } from "./workspace-presence";
import { uiIcon } from "@/lib/saas/icons";
import { installInline } from "./workspace-inline";
import { installPreferences } from "./workspace-preferences";
import { installTrash } from "./workspace-trash";
import { roleLabel } from "../../services/payload/src/roles";
import { validAvatar } from "@/lib/saas/formats";
import { installSearch } from "./workspace-search";
import type { SearchEntry } from "@/lib/saas/search";
import { installHome } from "./workspace-home";
import {
  routeNames,
  slugify,
  settingRoutes,
  entitySlug,
  findEntity,
} from "@/lib/saas/routes";
import {
  initialState,
  orderedTasks,
  moveTask,
  type WorkspaceMember,
  validateState,
  dateKey,
  uid,
  csvCell,
  type WorkspaceState,
  type Task,
  type CanvasNode,
} from "@/lib/saas/model";
import {
  canView,
  isAdmin,
  canWrite,
  sectionForKey,
  type Section,
} from "@/lib/saas/permissions";
import { installWorkspaceFiles } from "./workspace-files";
import { installBusiness } from "./workspace-business";
import {
  overlaps,
  freePosition,
  connector,
  type Rect,
  type PortSide,
} from "@/lib/saas/canvas-layout";
import { sanitizeRichText, installRichToolbar } from "@/lib/saas/rich-text";
import { installWorkspaceFeatures } from "./workspace-features";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const $$ = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s));
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const initialUser = JSON.parse(document.body.dataset.workspaceUser || "null");
const initialBranding = document.body.dataset.branding ? {
  ...JSON.parse(document.body.dataset.branding),
  name: initialUser.workspace.name,
  logoData: document.querySelector<HTMLImageElement>(".brand .business-logo")?.getAttribute("src") || "",
} : null;
const cloud = !!initialUser;
let state = initialState(!cloud);
if (cloud) {
  state.settings.name = initialUser.workspace.name;
  if (initialBranding) Object.assign(state.settings, initialBranding);
}
const storageKey = cloud ? "orbita:" + String(initialUser.id) + ":v1" : "orbita:demo:v1";
let cloudDirty = false;
let localSavePending = false;
let changeVersion = 0;
let moduleView: ReturnType<typeof installModules> | undefined;
let activeView = "overview";
let activeSpace = "Negocio";
let privateKind: "spaces" | "tasks" | "pages" = "spaces";
let detailId = "";
let routing = false;
function viewSection(view: string): Section {
  return (
    view === "private"
      ? { spaces: "canvas", tasks: "tasks", pages: "pages" }[privateKind]
      : (
          {
            modules: "settings",
            polls: "profile",
            search: "profile",
            trash: "profile",
            "private-index": "profile",
            customer: "customers",
            event: "calendar",
            task: "tasks",
            page: "pages",
            document: "documents",
            order: "orders",
          } as Record<string, string>
        )[view] || view
  ) as Section;
}
function writeRoute(path: string) {
  path = demoPath(path);
  if (location.pathname + location.search !== path || location.hash)
    window.history[routing ? "replaceState" : "pushState"](null, "", path);
}
function isMine(owner?: string) {
  return !owner || owner === String(actor().id);
}
function sharedTasks() {
  return state.tasks.filter((t) => !t.privateOwner);
}

let activeBoard = "general";
let boardOpen = false;
let personalTasksOpen=false,returnToPersonalTasks=false;
let advanced: ReturnType<typeof installBusiness>;
let workspaceFiles: ReturnType<typeof installWorkspaceFiles>;
let spatial:ReturnType<typeof installSpatial>|undefined;
let planning: ReturnType<typeof installPlanning>;
let work:ReturnType<typeof installWork>;
let home: ReturnType<typeof installHome>;
let searchFeature: ReturnType<typeof installSearch>;
let directories: ReturnType<typeof installDirectories>;
let preferences: ReturnType<typeof installPreferences>;
let trash: ReturnType<typeof installTrash>;
let inline: ReturnType<typeof installInline>;
let presence: ReturnType<typeof installPresence>;
let layoutBusy = false;
let pendingImagePosition: { x: number; y: number } | undefined;
let canvasOpen = false;
let canvasDetailId = "";
let canvasDetailMotion: Animation | undefined;
const demoActorId = "demo-me";
const initialActor: WorkspaceMember = initialUser ?? state.demoMembers![0];
let taskMode = "board";
let mobileTaskMode: "board" | "list" | undefined;
let chartKind = "sales";
let analyticsKind = "sales";
let connectedProviders: string[] = [];
let storeConnectionVersion = 0;
let connectionsRequest = 0;
let commerceReport: any = null;
let seoReport: any = null;
let cartsReport: any = null;
let calendarDate = new Date();
let tool = "select";
let connectFrom = "";
let camera = { x: 0, y: 0, z: 1 };
let undoStack: string[] = [], redoStack: string[] = [];
let toastTimer: ReturnType<typeof setTimeout>;
let socket: WebSocket | undefined;
let user: (WorkspaceMember & { workspace: unknown }) | undefined = initialUser || undefined;
let cloudRows = new Map<string, string>();
let syncTimer: ReturnType<typeof setTimeout>;
let syncQueue: Promise<void> = Promise.resolve();
let syncing = false;
let dragDirty = false;
let remotePending = false;
const dialog = $<HTMLDialogElement>("#editor-dialog");
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("orbita-demo")
    : null;
function actor(): WorkspaceMember {
  return cloud && user
    ? user
    : state.demoMembers?.find((m) => m.id === demoActorId && !m.disabled) ||
        initialActor;
}
const features = installWorkspaceFeatures({
  state: () => state,
  cloud: () => cloud,
  actor,
  api,
  mutate,
  render,
  modal,
  close,
  notify,
  openTask: taskComments,
  flush: async () => {
    await syncQueue;
    if (cloudDirty) await syncCloud();
  },
  invalidate: () => {
    if (socket?.readyState === 1)
      socket.send(JSON.stringify({ type: "invalidate" }));
  },
  switchDemo: (id) => {
    // The current identity is fixed. Profiles never switch accounts.
    void id;
  },
});
dialog.addEventListener("close", () => {
  if (!dialog.open) {
    $("#dialog-content").replaceChildren();
    dialog.classList.remove("task-dialog");
  }
});
function notify(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4000);
}
let deviceWrites = Promise.resolve();
function persistWorkspace(name = storageKey, serialized = JSON.stringify(state)) {
  const write = deviceWrites.then(() => writeWorkspaceCache(name, serialized));
  deviceWrites = write.catch(() => {});
  return write;
}
async function loadLocal() {
  try {
    const saved = JSON.parse(await readWorkspaceCache(storageKey, "null"));
    if (validateState(saved)) {
      state = saved;
      state.boards ??= initialState(false).boards;
      state.comments ??= [];
      state.notifications ??= [];
      if (!cloud) {
        state.demoMembers ??= initialState().demoMembers;
        const me = state.demoMembers?.find((m) => m.id === "demo-me");
        if (me?.name === "Tú") {
          me.name = "Administrador";
          for (const c of state.comments || [])
            if (c.authorId === "demo-me" && c.authorName === "Tú")
              c.authorName = "Administrador";
          for (const n of state.notifications || [])
            n.text = n.text.replace(
              /^Tú te mencionó/,
              "El administrador te mencionó",
            );
        }
      } else pruneState();
    }
  } catch {
    notify(
      "No se pudo leer el respaldo local. Puedes exportar tus datos desde Configuración.",
    );
  }
}
function history() {
  redoStack = [];
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 25) undoStack.shift();
}
function save() {

  changeVersion++;
  if (cloud) {
    cloudDirty = true;
    try {
      localStorage.setItem(storageKey + ":dirty", "1");
    } catch {}
  }
  const version = changeVersion, key = storageKey, isCloud = cloud;
  $("#save-state").innerHTML = `<span></span>${cloud ? "Guardando en tu negocio…" : "Guardando en este dispositivo…"}`;
  localSavePending = true;
  void persistWorkspace().then(() => {
    if (changeVersion === version) localSavePending = false;
    if (!isCloud) channel?.postMessage({type:"state-saved", key});
    if (!isCloud && changeVersion === version)
      $("#save-state").innerHTML = "<span></span>Guardado en este dispositivo";
  }).catch(() => {
    if (changeVersion === version) {
      $("#save-state").innerHTML = "<span></span>Sin copia en este dispositivo";
      notify("No pudimos guardar una copia cifrada en este dispositivo.");
    }
  });
  if (cloud) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncQueue = syncQueue
        .then(syncCloud)
        .catch(() =>
          notify(
            "No se pudo sincronizar. Tus cambios siguen en este dispositivo.",
          ),
        );
    }, 450);
  }
  renderCommon();
}
function mutate(fn: () => void) {
  history();
  const before = structuredClone(state);
  fn();
  normalizeCanvasRelationships();
  if(canWrite(actor(),"tasks"))reconcileWork(state,before);
  if (!cloud) trash?.capture(before);
  save();
  render();
}
function modal(html: string) {
  dialog.classList.remove("task-dialog");
  $("#dialog-content").innerHTML = html;
  const form = dialog.querySelector<HTMLFormElement>("form");
  if (form && /^Nueva votación$/.test(dialog.querySelector("h2")?.textContent ?? "")) {
    const first = form.firstElementChild as HTMLElement;
    const nextFields = [...form.children].slice(1) as HTMLElement[];
    const progress = document.createElement("p");
    progress.setAttribute("role", "status");
    const next = document.createElement("button");
    const back = document.createElement("button");
    next.type = back.type = "button";
    next.className = "button primary";
    back.className = "button secondary";
    next.textContent = "Continuar";
    back.textContent = "Volver";
    form.before(progress);
    form.append(next, back);
    const showStep = (details: boolean, focus = true) => {
      progress.textContent = details ? "Paso 2 de 2 · Detalles" : "Paso 1 de 2 · Nombre o pregunta";
      first.hidden = next.hidden = details;
      back.hidden = !details;
      for (const field of nextFields) {
        if (details) field.removeAttribute("inert");
        else field.setAttribute("inert", "");
        field.classList.toggle("creation-step-hidden", !details);
      }
      if (focus) (details ? form.querySelector<HTMLElement>(':scope > :not([hidden]) select, :scope > :not([hidden]) textarea, :scope > :not([hidden]) input') : first.querySelector("input"))?.focus();
    };
    const advance = () => {
      if (first.querySelector("input")?.reportValidity()) showStep(true);
    };
    next.onclick = advance;
    back.onclick = () => showStep(false);
    first.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); advance(); }
    });
    showStep(false, false);
  }
  applyAccess();
  if (!dialog.open) dialog.showModal();
  setTimeout(
    () =>
      dialog
        .querySelector<HTMLInputElement>("input:not([type=hidden]),textarea")
        ?.focus(),
    30,
  );
}
function close() {
  dialog.close();
}
function syncSidebarFocus() {
  const sidebar = $("#sidebar");
  sidebar.inert =
    window.matchMedia("(max-width: 1024px)").matches &&
    !sidebar.classList.contains("open");
  const toggle = document.querySelector('[data-action="menu"]');
  toggle?.setAttribute(
    "aria-expanded",
    String(sidebar.classList.contains("open")),
  );
}
window
  .matchMedia("(max-width: 1024px)")
  .addEventListener("change", syncSidebarFocus);
function show(view: string, keepSpace = false) {
  if (view === "integrations") {
    view = "settings";
    advanced?.tab("integrations");
  }
  if (view === "tasks" && !keepSpace) {boardOpen = false;personalTasksOpen=false;}
  if (view !== "blocked" && !canView(actor(), viewSection(view))) {
    view =
      Object.keys({
        overview: 1,
        canvas: 1,
        tasks: 1,
        calendar: 1,
        files: 1,
        analytics: 1,
        pages: 1,
        vault: 1,
        team: 1,
        settings: 1,
        profile: 1,
        documents: 1,
        orders: 1,
        invoices: 1,
      }).find((k) => canView(actor(), k as Section)) || "blocked";
  }
  if (view !== "canvas" || !keepSpace) { closeCanvasDetail(false); canvasOpen = false; }
  if (!document.querySelector(`[data-panel="${view}"]`)) return;
  activeView = view;
  if(view === "team" || view === "polls"){$("#team-submenu").hidden=false;document.querySelector("[data-action=toggle-team]")?.setAttribute("aria-expanded","true");}
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== view));
  $$("[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view),
  );
  $("#breadcrumb").textContent = (
    {
      modules: "Módulos",
      overview: "Vista general",
      search: "Resultados de búsqueda",
      event: "Detalle del evento",
      canvas: "Espacios",
      tasks: "Tareas",
      private: "Mi área privada",
      task: "Detalle de la tarea",
      page: "Detalle de la nota",
      calendar: "Calendario",
      files: "Archivos",
      analytics: "Métricas",
      pages: "Notas",
      integrations: "Integraciones",
      settings: "Configuración",
      vault: "Accesos",
      team: "Equipo",
      polls: "Votaciones",
      blocked: "Sin acceso",
      profile: "Mi perfil",
      documents: "Documentos",
      document: "Ver documento",
      orders: "Pedidos",
      invoices: "Facturas y boletas",
      order: "Detalle del pedido",
      customers: "Clientes",
      customer: "Detalle del cliente",
      trash: "Papelera",
      "private-index": "Mi área privada",
    } as Record<string, string>
  )[view];
  $("#sidebar").classList.remove("open");
  syncSidebarFocus();
  document.title = $("#breadcrumb").textContent + " · Orbital";
  let path = "/app/" + (routeNames[view] || "vista-general");
  if (view === "canvas" && canvasOpen) {
    const space = state.spaces.find((s) => s.id === activeSpace)!;
    path =
      "/app/" +
      (space.privateOwner ? "mi-area-privada/espacios/" : "espacios/") +
      entitySlug(
        space,
        state.spaces.filter(
          (s) => (s.privateOwner || "") === (space.privateOwner || ""),
        ),
      );
  } else if (view === "tasks" && boardOpen) {
    const board = state.boards?.find((b) => b.id === activeBoard);
    if (board)
      path =
        "/app/" +
        (board.privateOwner ? "mi-area-privada/tareas/" : "tareas/") +
        "tableros/" +
        entitySlug(
          board,
          state.boards!.filter(
            (b) => (b.privateOwner || "") === (board.privateOwner || ""),
          ),
        );
  } else if (view === "private")
    path +=
      "/" +
      { spaces: "espacios", tasks: "tareas", pages: "notas" }[privateKind];
  else if (view === "task" || view === "page") {
    const items = view === "task" ? state.tasks : state.pages,
      item = items.find((i) => i.id === detailId);
    if (item)
      path =
        "/app/" +
        (item.privateOwner
          ? "mi-area-privada/" + (view === "task" ? "tareas/" : "notas/")
          : routeNames[view] + "/") +
        entitySlug(
          item,
          items.filter(
            (i) => (i.privateOwner || "") === (item.privateOwner || ""),
          ),
        );
  } else if (view === "settings")
    path += "/" + settingRoutes[advanced?.currentTab() || "company"];
  else if (view === "order" || view === "customer")
    path = location.pathname + location.search;
  else if (view === "document")
    path =
      "/app/documentos/ver/" +
      (sessionStorage.getItem("orbita:selected-document") || "");
  if (view === "search")
    path =
      "/app/buscar?q=" + encodeURIComponent(searchFeature?.currentTerm() || "");
  if (view === "event") {
    const event = state.events.find((e) => e.id === detailId);
    if (event)
      path = "/app/calendario/eventos/" + entitySlug(event, state.events);
  }
  if(view==="tasks"&&personalTasksOpen&&!boardOpen)path="/app/tareas?alcance=personal";
  if(view==="task"&&returnToPersonalTasks)path+="?origen=mis-tareas";
  writeRoute(path);
  render();
  if (view !== "canvas") canvasMedia.pause();
  enterWorkspaceView(document.querySelector<HTMLElement>(`[data-panel="${view}"]`));
}
function openSpace(id: string) {
  if (
    !canView(actor(), "canvas") ||
    !state.spaces.some((s) => s.id === id && isMine(s.privateOwner))
  )
    return;
  const folderCard = [...document.querySelectorAll<HTMLElement>("[data-canvas-folder]")]
    .find(card => card.dataset.canvasFolder === id);
  const origin = folderCard?.getBoundingClientRect();
  const shell = folderCard?.cloneNode(true) as HTMLElement | undefined;
  const neighbors = origin && !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Array.from(document.querySelectorAll<HTMLElement>("#canvas-nodes > :is([data-node],[data-canvas-folder])")).flatMap(card => {
      if (card === folderCard) return [];
      const rect = card.getBoundingClientRect();
      const offset = canvasNeighborOffset(origin, rect, 96);
      if (!offset) return [];
      const preview = (card.querySelector(".canvas-node-face") || card.querySelector(".canvas-folder-front"))?.cloneNode(true) as HTMLElement | undefined;
      if (!preview) return [];
      preview.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
      preview.querySelectorAll("video,audio,iframe").forEach(el => el.remove());
      return [{ rect, offset, preview }];
    }) : [];
  closeCanvasDetail(false);
  activeSpace = id;
  canvasOpen = true;
  camera = { x: 0, y: 0, z: 1 };
  show("canvas", true);
  requestAnimationFrame(() => {
    if (activeSpace !== id || !canvasOpen) return;
    actions.fit();
    if (!origin || !shell || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = $("#canvas-frame");
    const bounds = canvas.getBoundingClientRect();
    for (const {rect, offset, preview} of neighbors) {
      const ghost = document.createElement("div");
      ghost.className = "canvas-folder-neighbor";
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      Object.assign(ghost.style, { left: `${rect.left - bounds.left}px`, top: `${rect.top - bounds.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      ghost.append(preview);
      canvas.append(ghost);
      const fade = ghost.animate([{opacity:.17,translate:"0 0"},{opacity:0,translate:`${offset.x}px ${offset.y}px`}],
        {duration:470,easing:"cubic-bezier(.22,.75,.25,1)"});
      void fade.finished.then(() => ghost.remove(), () => ghost.remove());
    }
    const mouthX = origin.left + origin.width / 2;
    const mouthY = origin.top + origin.height * .38;
    shell.className = "canvas-private-folder canvas-folder-opening";
    shell.inert = true;
    shell.setAttribute("aria-hidden", "true");
    shell.querySelectorAll(".canvas-folder-preview,.canvas-folder-caption,.canvas-note-palette").forEach(el => el.remove());
    Object.assign(shell.style, { left: `${origin.left - bounds.left}px`, top: `${origin.top - bounds.top}px`,
      width: `${origin.width}px`, height: `${origin.height}px` });
    const rear = shell.cloneNode(false) as HTMLElement;
    rear.classList.add("canvas-folder-opening-back");
    canvas.append(rear, shell);
    const cards = [...canvas.querySelectorAll<HTMLElement>("#canvas-nodes > :is([data-node],[data-canvas-folder])")];
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const scale = Math.min(.5, origin.width * .58 / rect.width);
      const x = (mouthX - rect.left - rect.width / 2) / camera.z;
      const y = (mouthY - rect.top - rect.height / 2) / camera.z;
      card.animate([{ translate: `${x}px ${y}px`, scale, opacity: 0 },
        { opacity: 1, offset: .26 }, { translate: "none", scale: 1, opacity: 1 }], {
        duration: 470, delay: Math.min(index, 8) * 22,
        easing: "cubic-bezier(.22,.75,.25,1)", fill: "backwards",
      });
    });
    for (const cover of [rear, shell]) {
      const fade = cover.animate([{ opacity: 1 }, { opacity: 1, offset: .42 }, { opacity: 0 }],
        { duration: 535, fill: "forwards", easing: "ease" });
      void fade.finished.then(() => cover.remove(), () => cover.remove());
    }
  });
}
function routeHash() {
  routing = true;
  try {
    const parts = location.pathname
      .replace(/^\/app\/?/, "")
      .split("/")
      .filter(Boolean)
      .map((p) => slugify(decodeURIComponent(p)));
    if(parts[0]==="tareas"&&parts.length===1&&new URLSearchParams(location.search).get("alcance")==="personal"){openPersonalTasks();return;}
    if(parts[0]==="tienda"&&parts[1]==="analitica")parts[1]="metricas";
    if (parts[0] === "paginas") parts[0] = "notas";
    if (parts[0] === "mi-area-privada" && parts[1] === "paginas")
      parts[1] = "notas";
    if (
      parts[0] === "tienda" &&
      parts[1] === "pedidos" &&
      /^\d+$/.test(parts[2] || "")
    ) {
      advanced?.setOrder(
        parts[2],
        ["facturas-y-boletas", "invoices"].includes(
          new URLSearchParams(location.search).get("origen") ||
            new URLSearchParams(location.search).get("from") ||
            "",
        )
          ? "invoices"
          : "orders",
        Number(
          new URLSearchParams(location.search).get("pagina") ||
            new URLSearchParams(location.search).get("page"),
        ) || 1,
      );
      show("order");
      return;
    }
    if (
      parts[0] === "tienda" &&
      parts[1] === "clientes" &&
      parts[2] === "ver" &&
      parts[3]
    ) {
      advanced.openCustomer(parts[3]);
      return;
    }
    if (parts[0] === "buscar") {
      searchFeature?.setQuery(
        new URLSearchParams(location.search).get("q") || "",
      );
      show("search");
      return;
    }
    if (parts[0] === "calendario" && parts[1] === "eventos" && parts[2]) {
      const event = findEntity(parts[2], state.events);
      if (event) {
        openEventDetail(event.id);
        return;
      }
    }
    if (parts[0] === "configuracion") {
      advanced?.tab(
        Object.entries(settingRoutes).find(
          ([, slug]) => slug === parts[1],
        )?.[0] || "company",
      );
      show("settings");
      return;
    }
    if (parts[0] === "documentos" && parts[1] === "ver" && parts[2]) {
      advanced?.openFile(
        parts[2],
        new URLSearchParams(location.search).get("origen") ===
          "facturas-y-boletas"
          ? "invoices"
          : "documents",
      );
      return;
    }
    if (
      parts[0] === "mi-area-privada" &&
      parts[1] === "tareas" &&
      parts[2] === "tableros" &&
      parts[3]
    ) {
      const board = findEntity(
        parts[3],
        (state.boards || []).filter(
          (b) => b.privateOwner === String(actor().id),
        ),
      );
      if (board) {
        openBoard(board.id);
        return;
      }
    }
    if (parts[0] === "mi-area-privada") {
      if (!parts[1]) {
        show("private-index");
        return;
      }
      privateKind =
        parts[1] === "tareas"
          ? "tasks"
          : parts[1] === "notas"
            ? "pages"
            : "spaces";
      if (parts[2]) {
        if (privateKind === "spaces") {
          const item = findEntity(
            parts[2],
            state.spaces.filter((i) => i.privateOwner === String(actor().id)),
          );
          if (item) {
            openSpace(item.id);
            return;
          }
        } else {
          const items = privateKind === "tasks" ? state.tasks : state.pages,
            item = findEntity(
              parts[2],
              items.filter((i) => i.privateOwner === String(actor().id)),
            );
          if (item) {
            openDetail(privateKind === "tasks" ? "task" : "page", item.id);
            return;
          }
        }
      }
      show("private");
      return;
    }
    if (parts[0] === "espacios" && parts[1]) {
      const item = findEntity(
        parts[1],
        state.spaces.filter((i) => !i.privateOwner),
      );
      if (item) {
        openSpace(item.id);
        return;
      }
    }
    if (parts[0] === "tareas" && parts[1] === "tableros" && parts[2]) {
      const item = findEntity(parts[2], state.boards || []);
      if (item) {
        openBoard(item.id);
        return;
      }
    }
    if (
      (parts[0] === "tareas" || parts[0] === "notas") &&
      parts[1] === "detalle" &&
      parts[2]
    ) {
      const items = parts[0] === "tareas" ? state.tasks : state.pages,
        item = findEntity(
          parts[2],
          items.filter((i) => !i.privateOwner),
        );
      if (item) {
        openDetail(parts[0] === "tareas" ? "task" : "page", item.id);
        return;
      }
    }
    if (location.hash && !parts.length) {
      const [legacy, id] = location.hash
        .slice(1)
        .split("/")
        .map((p) => decodeURIComponent(p));
      if (legacy === "canvas" && id) {
        openSpace(id);
        return;
      }
      if (legacy === "tasks" && id) {
        openBoard(id);
        return;
      }
      show(legacy || "overview");
      return;
    }
    show(
      Object.entries(routeNames).find(
        ([, name]) => name === parts.join("/"),
      )?.[0] || "overview",
    );
  } catch {
    show("overview");
  } finally {
    routing = false;
  }
}
window.addEventListener("popstate", () => {
  close();
  routeHash();
});
window.addEventListener("hashchange", routeHash);
function pruneState() {
  if (!cloud) return;
  for (const group of [
    "spaces",
    "goals",
    "focus",
    "boards",
    "pages",
    "tasks",
    "nodes",
    "edges",
    "events",
  ] as const) {
    const section = sectionForKey(group + ":x")!;
    if (!canView(actor(), section)) state[group] = [] as any;
  }
  if (!canView(actor(), "tasks")) {
    state.comments = [];
    state.notifications = (state.notifications || []).filter(n=>n.kind === "poll" || n.kind === "message");
  }
}
function applyAccess() {
  const me = actor();
  $$("[data-view]").forEach(
    (b) => (b.hidden = !canView(me, viewSection(b.dataset.view || "overview"))),
  );
  $("#spaces-list").hidden = true;
  $("#store-navigation").hidden = !canView(me, "analytics");
  const teamNavigation = $(".team-navigation");
  teamNavigation.hidden = !canView(me, "team") && !canView(me, "profile");
  $$("[data-store-summary]").forEach(
    (el) => (el.hidden = !canView(me, "analytics")),
  );
  $(".overview-grid").classList.toggle(
    "without-store",
    !canView(me, "analytics"),
  );
  $(".metric-grid").classList.toggle(
    "without-store",
    !canView(me, "analytics"),
  );
  $$("[data-private-kind]").forEach(
    (el) =>
      (el.hidden = !canView(
        me,
        (
          { spaces: "canvas", tasks: "tasks", pages: "pages" } as Record<
            string,
            Section
          >
        )[el.dataset.privateKind!],
      )),
  );
  const actionSections: Record<string, Section> = {
    "delete-space": "canvas",
    "delete-board": "tasks",
    "new-task": "tasks",
    "new-note": "canvas",
    "new-sales": "canvas",
    "new-space": "canvas",
    "new-private-space": "canvas",
    "new-board": "tasks",
    image: "canvas",
    "new-page": "pages",
    "new-event": "calendar",
    "new-access": "vault",
    "new-member": "team",
    import: "settings",
  };
  $$("[data-action]").forEach((b) => {
    const section = actionSections[b.dataset.action!];
    if (section) b.hidden = !canWrite(me, section);
  });
  $("#profile-name").textContent =
    "Hola, " + (me.firstName || me.name.split(" ")[0]);
  $("#profile-role").textContent =
    roleLabel(me.role) + (cloud ? "" : " · demo");
  const avatar = $("#profile-avatar");
  const initials = me.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  avatar.innerHTML = validAvatar(me.avatarData)
    ? `<img src="${esc(me.avatarData)}" alt=""/>`
    : esc(initials);
  const account = document.querySelector('[aria-label="Mi cuenta"]');
  if (account) account.innerHTML = avatar.innerHTML;
  const create = document.querySelector<HTMLElement>('[data-action="create"]');
  if (create)
    create.hidden = !["tasks", "calendar", "canvas", "pages"].some((section) =>
      canWrite(me, section as Section),
    );
  features.renderBell();
}
function privateSections() {
  const selected = new Set(preferences?.get()?.privateSections || []);
  if (state.spaces.some((i) => i.privateOwner === String(actor().id)))
    selected.add("spaces");
  if (
    state.tasks.some((i) => i.privateOwner === String(actor().id)) ||
    state.boards?.some((i) => i.privateOwner === String(actor().id))
  )
    selected.add("tasks");
  if (state.pages.some((i) => i.privateOwner === String(actor().id)))
    selected.add("pages");
  return (["spaces", "tasks", "pages"] as const).filter((k) => selected.has(k));
}
function renderCommon() {
  applyAccess();
  $(".breadcrumbs>span:first-of-type").textContent = state.settings.name;
  $("#task-count").textContent = String(
    sharedTasks().filter((t) => t.status !== "done").length,
  );
  $("#spaces-count").textContent = String(
    state.spaces.filter((s) => !s.privateOwner).length,
  );
  $("#spaces-list").replaceChildren();
  $("#private-navigation").innerHTML =
    privateSections()
      .filter((k) =>
        canView(
          actor(),
          ({ spaces: "canvas", tasks: "tasks", pages: "pages" } as const)[k],
        ),
      )
      .map(
        (k) =>
          `<button class="nav-item private-direct" data-private-kind="${k}"><span class="sidebar-section-icon sidebar-section-${{spaces:"espacios",tasks:"tareas",pages:"notas"}[k]}" aria-hidden="true"></span><span>${{ spaces: "Espacios", tasks: "Tareas", pages: "Notas" }[k]}</span></button>`,
      )
      .join("") ||
    '<p class="private-area-empty">Agrega tu primer espacio, tablero o nota.</p>';
  const form = $<HTMLFormElement>("#settings-form");
  for (const [key, value] of Object.entries(state.settings)) {
    const el = form.elements.namedItem(key) as HTMLInputElement;
    if (el && document.activeElement !== el) el.value = value;
  }
}
function relativeDue(value: string) {
  if (!value) return "Sin fecha";
  const today = dateKey(new Date());
  if (value === today) return "Hoy";
  const d = new Date(value + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
function renderToday() {
  home?.renderToday();
  const completed = sharedTasks().filter((t) => t.status === "done").length;
  $("#metric-tasks").innerHTML =
    `${completed} <small>/ ${sharedTasks().length} tareas</small>`;
  const percentage = sharedTasks().length
    ? Math.round((completed / sharedTasks().length) * 100)
    : 0;
  $("#metric-progress").textContent =
    `${percentage}% de tus tareas completadas`;
  $(".mini-progress>span").style.width = percentage + "%";
  const upcoming = sharedTasks()
    .filter((t) => t.status !== "done" && t.due)
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  $(".deadline-value").innerHTML = upcoming
    ? `${esc(new Date(upcoming.due + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" }))}<span class="days-pill">${upcoming.due < dateKey(new Date()) ? "Pendiente" : upcoming.due === dateKey(new Date()) ? "Hoy" : "Próximamente"}</span>`
    : "Sin pendientes";
  $(".deadline-value + .metric-bottom span:last-child").textContent =
    upcoming?.title || "Todo al día";
}
let chartGradientSequence=0;
function chart(kind = "sales", week = false) {
  const areaId=`metric-area-${++chartGradientSequence}`;
  const values =
    kind === "seo"
      ? [32, 35, 31, 41, 40, 48, 43, 55, 58, 56, 69, 73]
      : kind === "carts"
        ? [65, 52, 57, 40, 50, 30, 35, 27, 39, 22, 25, 15]
        : week
          ? [20, 36, 31, 50, 44, 65, 80]
          : [17, 23, 20, 31, 27, 30, 24, 36, 33, 57, 48, 73];
  const points = values.map((v, i) => [
    46 + i * (536 / (values.length - 1)),
    132 - v * 1.35,
  ]);
  const path = smoothLine(points);
  const previous = smoothLine(values.map((v,i)=>[46+i*(536/(values.length-1)),145-v*.8]));
  const labels = week
    ? ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    : ["01", "05", "10", "15", "20", "25", "30"];
  const max =
    kind === "seo"
      ? ["100", "75", "50", "25"]
      : kind === "carts"
        ? ["40", "30", "20", "10"]
        : ["$150k", "$100k", "$50k", "$0"];
  return `<svg class="sales-chart" viewBox="0 0 610 175" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Gráfico de ${kind === "sales" ? "ventas" : kind === "seo" ? "visibilidad SEO" : "carros abandonados"}, datos de ejemplo"><defs><linearGradient id="${areaId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart-color)" stop-opacity=".32"/><stop offset="1" stop-color="var(--chart-color)" stop-opacity="0"/></linearGradient></defs>${max.map((v, i) => `<text x="0" y="${28 + i * 36}">${v}</text><path class="grid-line" d="M44 ${25 + i * 36}H590"/>`).join("")}<path d="${path} L582 143 L46 143Z" fill="url(#${areaId})"/><path d="${previous}" stroke="var(--chart-comparison)" stroke-dasharray="4 4" stroke-width="1.5" fill="none"/><path d="${path}" stroke="var(--chart-color)" stroke-width="2" fill="none" stroke-linejoin="round"/>${labels.map((v, i) => `<text x="${43 + (i * 536) / (labels.length - 1)}" y="166">${v}</text>`).join("")}${chartSamples(points,values.map((_,i)=>week?labels[i]:`Día ${Math.round(1+i*29/(values.length-1))}`),values.map(v=>`Índice de ejemplo: ${v}`))}</svg>`;
}
function realSalesChart() {
  if (!commerceReport) return chart();
  const totals = Object.entries(commerceReport.totals || {}) as [
    string,
    { sales: string },
  ][];
  const max = Math.max(1, ...totals.map(([, v]) => Number(v.sales)));
  const points = totals.map(
    ([, v], i) =>
      [45 + (i * 540) / Math.max(1, totals.length - 1),140 - (Number(v.sales) / max) * 110],
  );
  return `<svg class="sales-chart" viewBox="0 0 610 175" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Ventas reales de WooCommerce"><path d="M45 140H590" stroke="var(--line)" fill="none"/>${points.length ? `<path d="${smoothLine(points)}" stroke="var(--chart-color)" stroke-width="2" fill="none"/>` : ""}${totals
    .filter((_, i) => i % Math.max(1, Math.floor(totals.length / 6)) === 0)
    .map(
      ([d], i) => `<text x="${45 + i * 85}" y="165">${esc(d.slice(5))}</text>`,
    )
    .join("")}${chartSamples(points,totals.map(([d])=>d),totals.map(([,v])=>new Intl.NumberFormat("es-CL",{style:"currency",currency:commerceReport.currency||"CLP"}).format(Number(v.sales))),true)}</svg>`;
}
function renderOverview() {
  renderToday();
  home?.renderCards();
  const week = $<HTMLSelectElement>("#sales-period").value === "week";
  $(".metric-card:first-child .metric-top>span").textContent = week
    ? "Ventas de los últimos 7 días"
    : "Ventas del mes";
  $("#overview-chart").innerHTML = chart(chartKind, week);
  $("#chart-total").textContent =
    chartKind === "seo"
      ? "78 / 100"
      : chartKind === "carts"
        ? "12 carros"
        : week
          ? "$784.500"
          : "$2.845.900";
  $("#chart-delta").textContent =
    chartKind === "seo"
      ? "↗ 8 puntos este mes"
      : chartKind === "carts"
        ? "↓ 14,2% este mes"
        : "↗ 18,6% este mes";
  $("#chart-legend-name").textContent = week ? "Esta semana" : "Este mes";
  if (commerceReport) {
    const money = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: state.settings.currency,
      maximumFractionDigits: 0,
    });
    if (chartKind === "sales") {
      $("#chart-total").textContent = money.format(
        Number(commerceReport.total_sales),
      );
      $("#chart-delta").textContent = "Datos de WooCommerce";
      $("#overview-chart").innerHTML = realSalesChart();
    }
    $(".metric-card:first-child .metric-value").textContent = money.format(
      Number(commerceReport.total_sales),
    );
    $(".metric-card:nth-child(2) .metric-value").innerHTML =
      esc(commerceReport.total_orders) + " <small>pedidos</small>";
    $$(".demo-tag").forEach(
      (x) => (x.textContent = "Ventas reales · SEO demo"),
    );
    $$(".metric-card .positive").forEach(
      (x) => (x.textContent = "Datos reales"),
    );
    $(".chart-legend small").textContent =
      chartKind === "sales"
        ? "Ventas reales · WooCommerce"
        : "Vista previa · Datos de ejemplo";
    $$(".metric-card .sparkline").forEach(
      (x) => (x.style.visibility = "hidden"),
    );
    $(".chart-legend>span:nth-child(2)").hidden = chartKind === "sales";
    $(".integration-notice p").textContent =
      "WooCommerce conectado. Las otras métricas se activan con sus respectivas integraciones.";
    $(".integration-notice strong").textContent = "Tu tienda está conectada.";
  }
  if (
    (chartKind === "seo" && seoReport) ||
    (chartKind === "carts" && cartsReport)
  ) {
    const report = liveMetric(chartKind)!;
    $("#chart-total").textContent = report.stats[0][1];
    $("#chart-delta").textContent = "Datos reales · " + report.source;
    $("#overview-chart").innerHTML = seriesChart(report.values, report.labels);
    $(".chart-legend>span:nth-child(2)").hidden = true;
    $(".chart-legend small").textContent = report.note;
  }
  $("#workspace-cards").innerHTML =
    state.spaces
      .filter((s) => !s.privateOwner)
      .map(
        (s, i) =>
          `<button class="workspace-card" data-space="${esc(s.id)}"><div class="space-preview ${i % 2 ? "warm" : ""}"><div class="preview-mini"><i></i><i></i><i></i></div><div class="preview-connector"></div><div class="preview-mini"><i></i><i></i><i></i></div></div><div class="space-card-info"><span class="space-dot ${s.color === "orange" ? "orange" : "green"}"></span><div><strong>${esc(s.name)}</strong><small>${state.nodes.filter((n) => n.space === s.id).length} bloques · Un espacio para conectar</small></div><span>↗</span></div></button>`,
      )
      .join("") +
    '<button class="new-space-card" data-action="new-space"><span>+</span>Crear un espacio</button>';
}
function renderTasks() {
  const heading = document.querySelector<HTMLElement>("#task-board-editor h1");
  const board = state.boards?.find(b => b.id === activeBoard);
  if (heading && !heading.querySelector("input")) {
    const writable = !!board && canWrite(actor(), "tasks");
    heading.textContent = board?.name || "Trabajo del equipo";
    heading.classList.toggle("board-name-editable", writable);
    heading.tabIndex = writable ? 0 : -1;
    heading.title = writable ? "Doble clic o Enter para cambiar el nombre" : "";
    const beginRename = () => {
      if (!board || !canWrite(actor(), "tasks") || heading.querySelector("input")) return;
      const input = document.createElement("input");
      input.type = "text";
      input.value = board.name;
      input.maxLength = 80;
      input.className = "board-name-input";
      input.setAttribute("aria-label", "Nombre del tablero");
      let cancelled = false;
      input.addEventListener("keydown", event => {
        if (!["Enter", "Escape"].includes(event.key) || event.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        cancelled = event.key === "Escape";
        input.blur();
      });
      input.addEventListener("blur", () => {
        const name = input.value.trim();
        heading.textContent = board.name;
        if (!cancelled && name && name !== board.name && state.boards?.includes(board) && canWrite(actor(), "tasks")) {
          mutate(() => { board.name = name; });
          if (activeView === "tasks" && boardOpen && activeBoard === board.id) {
            const peers = (state.boards || []).filter(b => (b.privateOwner || "") === (board.privateOwner || ""));
            const prefix = board.privateOwner ? "/app/mi-area-privada/tareas/" : "/app/tareas/";
            window.history.replaceState(null, "", demoPath(prefix + "tableros/" + entitySlug(board, peers)));
          }
        }
      }, { once: true });
      heading.replaceChildren(input);
      input.focus();
      input.select();
    };
    heading.ondblclick = writable ? beginRename : null;
    heading.onkeydown = event => {
      if (writable && event.target === heading && (event.key === "Enter" || event.key === "F2")) {
        event.preventDefault();
        beginRename();
      }
    };
  }
  const term = $<HTMLInputElement>("#task-search").value.toLowerCase(),
    filter = $<HTMLSelectElement>("#task-filter").value;
  const writable = canWrite(actor(), "tasks");
  taskMode = window.matchMedia("(max-width: 680px)").matches ? mobileTaskMode || "list" : preferences?.get()?.taskMode || "board";
  $$("[data-task-mode]").forEach((x) => {
    const active = x.dataset.taskMode === taskMode;
    x.classList.toggle("active", active);
    x.setAttribute("aria-pressed", String(active));
  });
  const showComments = preferences?.get()?.showTaskComments !== false;
  const commentToggle = document.querySelector<HTMLElement>(
    '[data-action="toggle-task-comments"]',
  )!;
  commentToggle.textContent = showComments
    ? "Ocultar comentarios"
    : "Mostrar comentarios";
  commentToggle.setAttribute("aria-pressed", String(showComments));

  const selectedBoard=state.boards?.find(b=>b.id===activeBoard),limit=selectedBoard?.work?.limit;
  const allBoardTasks=state.tasks.filter(t=>(t.boardId||"general")===activeBoard&&(t.privateOwner||"")===(selectedBoard?.privateOwner||""));
  const doingCount=allBoardTasks.filter(t=>t.status==='doing').length;
  $("#kanban-board").classList.toggle("list-mode", taskMode === "list");
  $("#kanban-board").innerHTML = (["todo", "doing", "done"] as const)
    .map((status, i) => {
      const tasks = orderedTasks(allBoardTasks,status).filter(t=>(!work||work.filterTask(t))&&t.title.toLowerCase().includes(term)&&(filter==='all'||t.priority===filter));
      return `<section class="kanban-column" data-drop-status="${status}" aria-label="${["Por hacer", "En progreso", "Completado"][i]}"><h2><span class="space-dot ${i === 1 ? "orange" : "green"}"></span>${["Por hacer", "En progreso", "Completado"][i]}<span>${status==="doing"&&limit?`${doingCount} de ${limit}${tasks.length!==doingCount?" · "+tasks.length+" visibles":""}`:tasks.length}</span></h2><span class="task-drop-indicator" aria-hidden="true"></span>${status==="doing"&&limit&&doingCount>limit?'<p class="work-limit-warning" role="status">Hay más tareas en curso de las acordadas. Revisa si puedes terminar alguna antes de empezar otra.</p>':""}<div class="task-drop-list">${tasks
        .map((t) => {
          const count = (state.comments || []).filter(
            (c) => c.taskId === t.id,
          ).length;
          const taskActions = `
            <details class="selection-menu task-card-menu">
              <summary aria-label="Acciones de ${esc(t.title)}">⋯</summary>
              <div class="selection-menu-panel">
                ${writable ? `<button class="button secondary" data-edit-task="${t.id}">${uiIcon("pencil", 15)} Editar</button>` : ""}
                <button class="button secondary" data-task-comments="${t.id}">${uiIcon("comment", 15)} Comentarios <span data-comment-count="${t.id}">${count}</span></button>
                ${writable ? `<button class="button secondary" data-delete-task="${t.id}">${uiIcon("trash", 15)} Eliminar</button>` : ""}
              </div>
            </details>`;
          return `<article class="kanban-task" draggable="false" data-drag-task="${t.id}">${inline.taskContent(t, taskActions)}${t.blockedAt&&t.status!=="done"?`<p class="task-blocked" title="${esc(t.blockedReason)}">${uiIcon("lock",13)} Bloqueada desde ${new Date(t.blockedAt).toLocaleDateString("es-CL")}${t.blockedReason?" · "+esc(t.blockedReason):""}</p>`:""}<div class="task-footer"><span class="priority-label"><i class="priority-dot ${t.priority}"></i>${t.priority === "high" ? "Alta prioridad" : "Normal"}</span>${t.due?`<span>◷ ${esc(relativeDue(t.due))}</span>`:""}${t.assigneeId?`<span>${esc(features.directory().find(m=>String(m.id)===t.assigneeId)?.name||"Responsable")}</span>`:""}</div>${showComments ? `<section class="card-comments" data-card-comments="${t.id}">${features.commentPreview(t.id)}</section>` : ""}</article>`;
        })
        .join(
          "",
        )}</div>${writable ? `<button class="add-task-inline" data-new-status="${status}">+ Agregar tarea</button>` : ""}</section>`;
    })
    .join("");
}
function taskComments(id: string) {
  const task = state.tasks.find((t) => t.id === id && isMine(t.privateOwner));
  if (!task || !canView(actor(), "tasks")) return;
  modal(
    `<h2>Comentarios</h2><p>${esc(task.title)}</p><section id="task-comments" class="task-comments"></section>`,
  );
  dialog.classList.add("task-dialog");
  features.attachComments(id);
}
function removeTask(id: string) {
  if (!canWrite(actor(), "tasks")) return;
  const task = state.tasks.find((t) => t.id === id && isMine(t.privateOwner));
  if (!task) return;
  mutate(() => (state.tasks = state.tasks.filter((t) => t.id !== id)));
  notify("Tarea enviada a la papelera.");
}
function removeNode(id: string) {
  removeCanvasNodes([id]);
}
function removeCanvasNodes(ids: Iterable<string>) {
  if (!canWrite(actor(), "canvas")) return false;
  const requested = new Set(ids);
  const deleted = new Set(state.nodes.filter(node => node.space === activeSpace && requested.has(node.id)).map(node => node.id));
  if (!deleted.size) return false;
  mutate(() => {
    state.nodes = state.nodes.filter(node => !deleted.has(node.id));
    for (const node of state.nodes) {
      if (node.space === activeSpace && node.spatial?.members)
        node.spatial.members = node.spatial.members.filter(id => !deleted.has(id));
    }
    state.edges = state.edges.filter(edge => !deleted.has(edge.from) && !deleted.has(edge.to));
  });
  notify(deleted.size === 1 ? "Elemento eliminado." : deleted.size + " elementos eliminados.");
  return true;
}
async function taskEditor(id?: string, status = "todo", privateArea = false) {
  await features.loadDirectory();
  if (!canView(actor(), "tasks")) return;
  if (!id && !canWrite(actor(), "tasks")) return;
  const t = state.tasks.find((t) => t.id === id);
  modal(
    `<h2>${t ? "Detalles de la tarea" : "Nueva tarea"}</h2><p>Añade lo que necesitas hacer y cuándo debe estar listo.</p><form id="task-form"><label>Tarea<input name="title" required maxlength="140" value="${esc(t?.title || "")}" placeholder="Por ejemplo, preparar la nueva colección"/></label><div class="task-project-row"><label ${t?.privateOwner || privateArea ? "hidden" : ""}>Tablero<select name="boardId">${(
      state.boards || []
    )
      .filter((board) => !board.privateOwner)
      .map(
        (board) =>
          `<option value="${esc(board.id)}" ${board.id === (t?.boardId || activeBoard) ? "selected" : ""}>${esc(board.name)}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Proyecto<input name="project" maxlength="60" value="${esc(t?.project || "Mi negocio")}"/></label></div><div class="task-scheduling-row"><label>Fecha de vencimiento<input type="date" name="due" value="${esc(t?.due || "")}"/></label><label>Estado<select name="status">${[
      ["todo", "Por hacer"],
      ["doing", "En progreso"],
      ["done", "Completado"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${(t?.status || status) === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Prioridad<select name="priority"><option value="normal" ${t?.priority !== "high" ? "selected" : ""}>Normal</option><option value="high" ${t?.priority === "high" ? "selected" : ""}>Alta</option></select></label></div><label>Descripción<div id="task-description-editor" class="work-rich-editor" contenteditable="true" role="textbox" aria-label="Descripción" data-rich-editor="true">${sanitizeRichText(t?.descriptionHtml||esc(t?.description||""))}</div></label><label>Responsable (opcional)<select name="assigneeId"><option value="">Sin asignar</option>${features.directory().filter(m=>!(t?.privateOwner||privateArea)||String(m.id)===String(actor().id)).map(m=>`<option value="${m.id}" ${String(m.id)===t?.assigneeId?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><details class="work-section task-blocking"><summary>Bloqueo y contexto adicional</summary><label class="work-check"><input type="checkbox" name="blocked" ${t?.blockedAt?'checked':''}/><span>Esta tarea está bloqueada</span></label><label>Motivo (opcional)<textarea name="blockedReason" maxlength="1000">${esc(t?.blockedReason||'')}</textarea></label><p>El bloqueo no cambia la columna.${t?.blockedAt?' Registrado desde '+new Date(t.blockedAt).toLocaleString('es-CL'):''}</p></details><div class="dialog-actions">${t ? '<button type="button" class="danger-button" id="delete-task">Eliminar</button>' : ""}<button class="button primary">Guardar tarea</button></div></form>`,
  );
  dialog.classList.add("task-dialog");

  if (!canWrite(actor(), "tasks")) {
    $$("#task-form input,#task-form textarea,#task-form select").forEach(
      (el) => ((el as HTMLInputElement).disabled = true),
    );
    $$("#task-form button").forEach((b) => (b.hidden = true));
  }
  $("#task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!canWrite(actor(), "tasks")) return;
    const f = new FormData(e.target as HTMLFormElement);
    const savedTaskId = t?.id || uid();
    mutate(() => {
      const value = {
        ...t,
        privateOwner:
          t?.privateOwner || (privateArea ? String(actor().id) : undefined),
        boardId:
          t?.privateOwner || privateArea
            ? t?.boardId || "private-" + actor().id
            : String(f.get("boardId") || activeBoard || "general"),
        id: savedTaskId,
        title: String(f.get("title")).trim(),
        project: String(f.get("project")),
        due: String(f.get("due")),
        priority: String(f.get("priority")) as Task["priority"],
        status: String(f.get("status")) as Task["status"],
        description: $("#task-description-editor").innerText.slice(0,5000),
        descriptionHtml:sanitizeRichText($("#task-description-editor").innerHTML),
        assigneeId:String(f.get("assigneeId")||""),
        blockedAt:f.get("blocked")?(t?.blockedAt||new Date().toISOString()):undefined,
        blockedReason:String(f.get("blockedReason")||""),
      };
      if (t) state.tasks = state.tasks.map((x) => (x.id === t.id ? value : x));
      else state.tasks.push(value);
      if (!t || t.status !== value.status)
        state.tasks = moveTask(state.tasks, value.id, value.status, !t ? orderedTasks(state.tasks.filter(i => i.id !== value.id && (i.boardId || "general") === (value.boardId || "general")), value.status)[0]?.id : undefined);
    });
    close();
    if (privateArea && !t) openDetail("task", savedTaskId);
    else if (activeView === "task") show("task");
    notify("Tarea guardada.");
  });
  if (t)
    $("#delete-task").onclick = () => {
      if (!canWrite(actor(), "tasks")) return;
      mutate(() => (state.tasks = state.tasks.filter((x) => x.id !== t.id)));
      close();
      notify("Tarea eliminada. Puedes deshacer con ⌘ Z.");
    };
}
const canvasMetrics = {
  sales: "Ventas de la tienda",
  orders: "Pedidos",
  seo: "Visibilidad SEO",
  carts: "Carros abandonados",
} as const;
type CanvasMetric = keyof typeof canvasMetrics;

function canvasSalesContent(metric: CanvasMetric = "sales") {
  if (!canView(actor(), "analytics"))
    return "<p>Este bloque de ventas solo está disponible para administradores.</p>";
  if (metric !== "sales") {
    const live = liveMetric(metric);
    const stats = live?.stats ?? (metric === "orders" && commerceReport
      ? [["Pedidos", Number(commerceReport.total_orders).toLocaleString("es-CL")]]
      : []);
    if (stats.length) {
      const source = live?.source || "WooCommerce";
      return `<span class="node-pill">${esc(source)}</span>${stats.map(([label, value]) =>
        `<div class="node-metric">${esc(value)} <small>${esc(label)}</small></div>`,
      ).join("")}${live?.values.length ? `<div class="node-sales-chart">${seriesChart(live.values, live.labels)}</div>` : ""}`;
    }
    if (cloud) return '<p>Todavía no hay datos para esta métrica.</p><button class="subtle-button" data-view="settings">Revisar integraciones ↗</button>';
    const examples = { orders: "128 pedidos", seo: "78 / 100", carts: "12 carros" };
    return `<span class="node-pill">Datos de ejemplo</span><div class="node-metric">${examples[metric]}</div>${metric !== "orders" ? `<div class="node-sales-chart">${chart(metric)}</div>` : ""}`;
  }
  if (commerceReport) {
    const money = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: state.settings.currency,
      maximumFractionDigits: 0,
    });
    return `<span class="node-pill">WooCommerce · ${$<HTMLSelectElement>("#sales-period").value === "week" ? "Últimos 7 días" : "Este mes"}</span><div class="node-metric">${esc(money.format(Number(commerceReport.total_sales)))}</div><div class="node-sales-chart">${realSalesChart()}</div><button class="subtle-button" data-view="analytics">Ver detalle de ventas ↗</button>`;
  }
  if (cloud)
    return '<p>Conecta WooCommerce para ver las ventas de tu tienda aquí.</p><button class="subtle-button" data-view="settings">Configurar tienda ↗</button>';
  return `<span class="node-pill">Datos de ejemplo</span><div class="node-metric">$2.845.900</div><div class="node-sales-chart">${chart()}</div><button class="subtle-button" data-view="analytics">Ver ventas ↗</button>`;
}
function canvasCardClasses(n: CanvasNode) {
  return [
    "canvas-node",
    n.kind === "sales" && "canvas-sales-card",
    n.kind === "page" && isCanvasTextCard(n) && n.borderStyle !== "dashed" && "canvas-letter",
    n.spatial?.type === "media" && n.spatial.fileId && "canvas-file-card",
    n.spatial && (["stack", "group"].includes(n.spatial.type) ? "spatial-stack" : "spatial-" + n.spatial.type),
    n.width && "spatial-resized",
    n.borderStyle === "dashed" && "dashed-card",
    n.kind === "note" && "note",
    n.kind === "image" && "image-card",
  ].filter(Boolean).join(" ");
}
function canvasCardFace(n: CanvasNode, writable: boolean, preview = false) {
  const page = n.pageId
    ? state.pages.find((p) => p.id === n.pageId)
    : undefined;
  const title = page?.title || (n.pageId ? "Nota conectada" : n.title),
    body =
      page?.body ?? (n.pageId ? "No tienes acceso a esta nota." : n.body);
  const edit = !preview && writable && (!n.pageId || canWrite(actor(), "pages"));
  const textCard=isCanvasTextCard(n);
  const photo=n.kind==="image";
  const integratedTitle=n.borderStyle!=="dashed";
  const container = n.spatial?.type === "stack" || n.spatial?.type === "group";
  const titleMarkup = `<span ${preview ? "" : `data-inline-title="${esc(n.id)}"`} ${edit && !textCard ? 'data-title-editable="true" title="Doble clic para editar"' : ""} aria-label="Título de la tarjeta">${esc(title)}</span>`;
  return `${n.borderStyle === "dashed" ? '<span class="idea-cloud-bubbles" aria-hidden="true"></span><span class="idea-cloud-icon" aria-hidden="true">' + uiIcon("ideaCloud", 18) + '</span>' : ""} ${!photo && !textCard && !container && n.spatial?.type !== "sketch" && n.spatial?.type !== "media" && n.spatial?.type !== "web" ? `<header ${preview ? "" : `data-drag-node="${esc(n.id)}"`}>${titleMarkup}</header>` : ""}${n.pageId && !textCard ? `<button class="linked-page-label" ${preview ? "" : `data-canvas-note="${esc(n.pageId)}"`}>Abrir nota vinculada →</button>` : ""}${
        n.spatial ? (spatial?.render(n,edit,preview)||"") : n.kind === "image"
          ? `<div class="node-photo">${!preview && n.image?.startsWith("data:image/gif")?canvasMedia.gifMarkup(n.id,n.image,title,esc):`<img src="${esc(n.image)}" alt="${esc(title)}" draggable="false" loading="lazy"/>`}</div><div class="node-photo-caption" ${preview ? "" : `data-inline-body="${esc(n.id)}"`} ${edit ? 'contenteditable="plaintext-only" role="textbox" tabindex="0"' : ""} aria-label="Texto de la foto" data-placeholder="Escribe algo sobre esta foto…">${esc(n.body)}</div>`
          : `<div class="node-body ${textCard?"canvas-card-content":""}" ${textCard && edit ? `data-card-editable="${esc(n.id)}" title="Doble clic para ver en detalle"` : ""}>${
              textCard && integratedTitle ? `<strong class="canvas-card-title">${titleMarkup}</strong>` : ""
            }${
              n.kind === "tasks" ? inline.renderList(n, preview)
                : n.kind === "sales" ? canvasSalesContent(n.metric)
                : `<div class="canvas-card-copy" data-placeholder="Escribe aquí…">${page?.bodyHtml || n.bodyHtml ? sanitizeRichText(page?.bodyHtml || n.bodyHtml || "") : esc(body)}</div>`
            }${textCard && n.pageId && page ? `<button class="linked-page-label" ${preview ? "" : `data-canvas-note="${esc(n.pageId)}"`}>Abrir nota vinculada →</button>` : ""}</div>`
      }`;
}
function canvasCardPreview(n: CanvasNode) {
  if (n.spatial?.type === "stack" || n.spatial?.type === "group")
    return `<span class="canvas-preview-placeholder">${uiIcon("groupCards", 24)}${esc(n.title)}</span>`;
  const note = n.kind === "note";
  const file = n.spatial?.type === "media" && !!n.spatial.fileId;
  const letter = n.kind === "page" && isCanvasTextCard(n) && n.borderStyle !== "dashed";
  const box = nodeRect(n);
  const width = file ? 240 : n.width || (note ? 170 : letter ? 240 : n.spatial?.type === "web" ? 320 : n.spatial?.type === "media" ? 355 : box.width);
  const height = note ? n.height || 170 : file || letter ? Math.max(310, n.height || 0) : box.height;
  const color = note ? `--note-color:${noteColors[visibleNoteColor(n.noteColor)]};--note-ink:${noteTextColor(n.noteColor)};` : "";
  return `<div class="${canvasCardClasses(n)} canvas-preview-node" data-motion-profile="${canvasProfile(n)}" data-preview-width="${width}" data-preview-height="${height}" style="width:${width}px;height:${height}px;${color}" inert><div class="canvas-node-face">${canvasCardFace(n, false, true)}</div></div>`;
}
function renderCanvas(groupTransition = false) {
  document.body.classList.toggle(
    "canvas-fullscreen",
    activeView === "canvas" && canvasOpen,
  );
  $("#spaces-home").hidden = canvasOpen;
  $("#space-editor").hidden = !canvasOpen;
  if (!canvasOpen) {
    closeCanvasToolsMenu();
    canvasMedia.pause();
    directories.render("spaces", state.spaces.filter(i=>!i.privateOwner), "spaces", "spaces-grid", "spaces-directory-toolbar", "spaces-pagination", "space-directory", (i,f)=>spaceCard(state,i,f));
    return;
  }
  const space = state.spaces.find((s) => s.id === activeSpace);
  if (!groupTransition) canvasMedia.pause();
  const title = $("#canvas-title");
  if (title.querySelector("input")?.dataset.folderId !== space?.id || !space?.folder) {
    title.textContent = space?.name || "Mi espacio";
    if (space?.folder && canWrite(actor(), "canvas")) {
      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "canvas-folder-title";
      rename.dataset.action = "rename-canvas-folder";
      rename.textContent = space.name;
      rename.title = "Renombrar carpeta";
      title.replaceChildren(rename);
    }
  }
  const parent = space?.folder && state.spaces.find(s => s.id === space.folder!.parentId && isMine(s.privateOwner));
  $(".back-to-spaces").textContent = parent ? "← Volver a " + parent.name : "← Volver a mis espacios";
  if (canvasDetailId && !state.nodes.some(n => n.id === canvasDetailId && n.space === activeSpace)) closeCanvasDetail(false);
  const writable = canWrite(actor(), "canvas");
  $('[data-action="canvas-metrics"]').hidden = !canView(actor(), "analytics");
  $$("#canvas-block-library [data-canvas-write]").forEach(el=>el.hidden=!writable);
  const org = spatial?.organization;
  org?.prepare();
  const nodesMarkup = state.nodes
    .filter((n) => n.space === activeSpace && (spatial?.visible(n)??true))
    .map((n) => {
      const page = n.pageId
        ? state.pages.find((p) => p.id === n.pageId)
        : undefined;
      const title = page?.title || (n.pageId ? "Nota conectada" : n.title);
      const edit = writable && (!n.pageId || canWrite(actor(), "pages"));
      const textCard=isCanvasTextCard(n);
      const pos=org?.placed.get(n.id) ?? n;
      const container=org?.container(n);
      const noteColor = n.kind === "note" ? noteColors[visibleNoteColor(n.noteColor)] : "";
      const palette = writable && noteColor ? `<div class="canvas-note-palette" role="group" aria-label="Color de la nota">${Object.entries(noteColors).map(([key, color]) => `<button type="button" style="--swatch:${color}" data-note-color="${key}" aria-pressed="${color === noteColor}" aria-label="Color ${key === "verdeLima" ? "verde lima" : key}"></button>`).join("")}</div>` : "";
      const deletion=writable?`<button class="icon-btn node-delete-button" data-delete-node="${n.id}" aria-label="Eliminar ${esc(title)}">${uiIcon("trash",15)}</button>`:"";
      return `<article class="${canvasCardClasses(n)} ${n.attachedTo ? "canvas-note-attached" : ""} ${connectFrom === n.id ? "selected-node" : ""}" data-node="${n.id}" data-motion-profile="${canvasProfile(n)}" tabindex="0" role="group" aria-label="${esc(title)}. Usa las flechas para mover.${writable ? " Delete para eliminar." : ""}" style="${noteColor ? "--note-color:"+noteColor+";--note-ink:"+noteTextColor(n.noteColor)+";" : ""}left:${pos.x}px;top:${pos.y}px;${n.width?`width:${n.width}px;`:""}${n.height?`height:${n.height}px;`:""}"><div class="canvas-node-face">${canvasCardFace(n, writable)}${canView(actor(),"tasks")?`<div class="node-task-links">${state.tasks.filter(t=>(t.privateOwner||"")===(state.spaces.find(s=>s.id===n.space)?.privateOwner||"")&&t.links?.some(l=>l.kind==="nodes"&&l.id===n.id)).map(t=>`<button class="subtle-button" data-resource-kind="tasks" data-resource-id="${t.id}">${esc(t.title)} ↗</button>`).join("")}</div>`:""}${edit && n.kind==="note" && !n.pageId && canWrite(actor(),"pages") ? `<button class="node-to-task" data-node-to-note="${esc(n.id)}">Enviar a Notas →</button>` : writable && canWrite(actor(),"tasks") && !n.spatial && !["sales","image","note"].includes(n.kind) ? `<button class="node-to-task" data-node-to-task="${n.id}">Enviar a tareas →</button>` : ""}</div>${writable && !container ? `<div class="canvas-node-actions">${deletion}${!container ? `<button class="icon-btn" ${textCard && edit ? `data-edit-card="${esc(n.id)}"` : `data-edit-node="${esc(n.id)}"`} aria-label="Opciones de ${esc(title)}">${uiIcon("pencil",14)}</button>` : ""}</div>` : ""}${n.borderStyle==="dashed" ? `<span class="idea-cloud-author" style="--author-hue:${[...(n.cloudAuthor || "")].reduce((hue, letter) => (hue * 31 + letter.charCodeAt(0)) % 360, 0)}">${esc(n.cloudAuthor?.replace(/^Órbita · Demo$/, "Orbital · Demo") || "Autor no registrado")}</span>` : ""}${palette}${edit?(org?.memberActions(n)||""):""}${writable&&!container?(spatial?.resizeHandle(n)||""):""}${((writable&&!container ? ["top", "right", "bottom", "left"] : []) as PortSide[]).map((side) => `<button type="button" class="node-port port-${side} ${state.edges.some((e) => (e.from === n.id && e.fromSide === side) || (e.to === n.id && e.toSide === side)) ? "linked-port" : ""}" data-port-node="${n.id}" data-port-side="${side}" aria-label="Conectar ${esc(title)} desde ${{ top: "arriba", bottom: "abajo", left: "la izquierda", right: "la derecha" }[side]}"></button>`).join("")}</article>`;
    })
    .join("") + canvasFolders().filter(folder => !folder.folder.groupId || org?.activeGroup() === folder.folder.groupId).map(folder => {
      const groupId = org?.activeGroup();
      const position = org?.placed.get(folder.id) ?? folder.folder;
      const muted = !!groupId && folder.folder.groupId !== groupId;
      const cards = state.nodes.filter(node => node.space === folder.id);
      const children = state.spaces.filter(child => child.folder?.parentId === folder.id && isMine(child.privateOwner));
      const grouped = new Set(cards.flatMap(node => node.spatial?.members ?? []));
      const items = [...cards.filter(node => !grouped.has(node.id)), ...children.map(child => ({ title: child.name, image: undefined } as const))];
      const preview = items.map((item, index) => {
        const content = "kind" in item
          ? canvasCardPreview(item)
          : `<span class="canvas-preview-placeholder">${uiIcon("folder", 24)}${esc(item.title)}</span>`;
        const offset = items.length > 1 ? index / (items.length - 1) : .5;
        const peekSpacing = items.length <= 3 ? (items.length - 1) * 87 : Math.min(192, (items.length - 1) * 32);
        return `<div class="canvas-preview-tile" style="--preview-index:${index};--peek-x:${(offset - .5) * peekSpacing}px;--peek-y:${-34 - 14 * (1 - Math.abs(2 * offset - 1))}px;--peek-angle:${(offset - .5) * (items.length <= 3 ? 8 : 16)}deg;--fan-layer:${items.length - index}">${content}</div>`;
      }).join("");
      const color = folder.folder.noteColor && noteColors[visibleNoteColor(folder.folder.noteColor)];
      const palette = writable ? `<div class="canvas-note-palette" role="group" aria-label="Color de la carpeta"><button type="button" style="--swatch:light-dark(#e4edf6,#2d3b4c)" data-note-color="default" aria-pressed="${!color}" aria-label="Color original"></button>${Object.entries(noteColors).map(([key, swatch]) => `<button type="button" style="--swatch:${swatch}" data-note-color="${key}" aria-pressed="${swatch === color}" aria-label="Color ${key === "verdeLima" ? "verde lima" : key}"></button>`).join("")}</div>` : "";
      return `<div class="canvas-private-folder ${muted ? "canvas-group-muted" : ""} ${folder.folder.groupId ? "canvas-group-member" : ""}" ${muted ? "inert" : ""} data-canvas-folder="${esc(folder.id)}" style="left:${position.x}px;top:${position.y}px;${color ? "--folder-swatch:"+color : ""}"><div class="canvas-folder-preview" aria-hidden="true" inert>${preview}</div><button type="button" class="canvas-folder-front" data-space="${esc(folder.id)}" aria-label="Abrir carpeta ${folder.privateOwner ? "privada " : "compartida "}${esc(folder.name)}"></button><div class="canvas-folder-caption"><strong title="${esc(folder.name)}">${esc(folder.name)}</strong><span>${items.length === 0 ? "Carpeta vacía" : items.length === 1 ? "1 elemento" : `${items.length} elementos`}</span></div>${palette}</div>`;
    }).join("");
  const layer = $("#canvas-nodes");
  if (groupTransition) {
    const template = document.createElement("template");
    template.innerHTML = nodesMarkup;
    const key = (el: Element) => el.getAttribute("data-node") || el.getAttribute("data-canvas-folder");
    const previous = new Map(Array.from(layer.children, el => [key(el), el as HTMLElement]));
    const next = Array.from(template.content.children) as HTMLElement[];
    const retained = new Set<HTMLElement>();
    for (const el of next) {
      const prior = previous.get(key(el));
      if (!prior || prior.matches(".spatial-stack,.canvas-group-member") ||
          el.matches(".spatial-stack,.canvas-group-member") || org?.placed.has(key(el) || "")) continue;
      prior.inert = el.inert;
      prior.classList.toggle("canvas-group-muted", el.classList.contains("canvas-group-muted"));
      retained.add(prior);
    }
    for (const el of previous.values()) if (!retained.has(el)) el.remove();
    let cursor = layer.firstElementChild;
    for (const el of next) {
      const prior = previous.get(key(el));
      if (prior && retained.has(prior)) {
        cursor = prior.nextElementSibling;
      } else layer.insertBefore(el, cursor);
    }
  } else layer.innerHTML = nodesMarkup;
  fitCanvasPreviews();
  org?.controls();
  if (groupTransition && !org?.activeGroup()) {
    layer.querySelectorAll(".canvas-stack-neighbor").forEach(el => el.classList.remove("canvas-stack-neighbor"));
  }
  org?.refreshGeometry();
  presence?.render();
  canvasMedia.observe();
  void spatial?.hydrate().then(()=>{if(activeView==="canvas"&&canvasOpen) canvasMedia.observe();});
  cardObserver.disconnect();
  $$(".canvas-node[data-node],.canvas-preview-node").forEach((el) => cardObserver.observe(el));
  renderConnections();
  applyCamera();
  requestAnimationFrame(() => {
    if (activeView === "canvas" && canvasOpen) {
      if (!groupTransition) alignCards();
      renderConnections();
    }
  });
}
function canvasFolders() {
  return state.spaces.flatMap(s => s.folder?.parentId === activeSpace && isMine(s.privateOwner)
    ? [{...s, folder: s.folder}] : []);
}
const canvasFolderSize = { width: 218, height: 190 };
function folderRects() {
  return canvasFolders().map(({ id, name, folder }) => ({ ...folder, ...canvasFolderSize, id, title: name }));
}
function visibleFolderRects() {
  const org = spatial?.organization;
  return folderRects().filter(folder => !folder.groupId || folder.groupId === org?.activeGroup())
    .map(folder => org?.placed.get(folder.id) ?? folder);
}
function closeCanvasToolsMenu(restoreFocus = false) {
  const menu = $("#canvas-tools-menu");
  const trigger = $('#canvas-frame [aria-controls="canvas-tools-menu"][aria-expanded="true"]');
  menu.hidden = true;
  trigger?.setAttribute("aria-expanded", "false");
  if (restoreFocus) trigger?.focus({ preventScroll: true });
}
function toggleCanvasToolsMenu(kind: "folders" | "metrics" | "shortcuts") {
  const menu = $("#canvas-tools-menu");
  const trigger = $(kind === "folders" ? '[data-action="new-canvas-folder"]' : kind === "metrics" ? '[data-action="canvas-metrics"]' : '[data-action="canvas-shortcuts"]');
  const wasOpen = trigger.getAttribute("aria-expanded") === "true";
  closeCanvasToolsMenu();
  if (wasOpen) return;

  menu.classList.toggle("canvas-shortcuts-menu", kind === "shortcuts");
  if (kind === "shortcuts") {
    menu.setAttribute("aria-label", "Atajos del lienzo");
    menu.innerHTML = `<div class="shortcut-dialog"><p>Usa ⌘ en Mac o Ctrl en Windows.</p><dl class="canvas-shortcuts"><div><dt>Buscar en Orbital</dt><dd><kbd>⌘ / Ctrl</kbd> <kbd>K</kbd></dd></div><div><dt>Agrupar la selección</dt><dd><kbd>⌘ / Ctrl</kbd> <kbd>G</kbd></dd></div><div><dt>Deshacer</dt><dd><kbd>⌘ / Ctrl</kbd> <kbd>Z</kbd></dd></div><div><dt>Rehacer</dt><dd><kbd>⌘ / Ctrl</kbd> <kbd>Mayús</kbd> <kbd>Z</kbd></dd></div><div><dt>Captura rápida</dt><dd><kbd>Alt</kbd> <kbd>Espacio</kbd></dd></div><div><dt>Mover el lienzo</dt><dd><kbd>⌘ / Ctrl</kbd> + arrastrar</dd></div><div><dt>Acercar o alejar</dt><dd><kbd>⌘ / Ctrl</kbd> + rueda</dd></div><div><dt>Abrir el elemento enfocado</dt><dd><kbd>Enter</kbd> o doble clic</dd></div><div><dt>Seleccionar la tarjeta enfocada</dt><dd><kbd>Mayús</kbd> <kbd>Espacio</kbd></dd></div><div><dt>Mover tarjeta enfocada</dt><dd><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></dd></div><div><dt>Agrupar al soltar</dt><dd>Arrastra una tarjeta sobre otra</dd></div><div><dt>Reordenar en un grupo abierto</dt><dd><kbd>Alt</kbd> + flechas</dd></div><div><dt>Eliminar tarjeta enfocada</dt><dd><kbd>Delete</kbd></dd></div><div><dt>Salir del detalle o del grupo</dt><dd><kbd>Esc</kbd></dd></div><div><dt>Pegar una imagen</dt><dd><kbd>⌘ / Ctrl</kbd> <kbd>V</kbd></dd></div></dl></div>`;
    const panel = menu.querySelector<HTMLElement>(".shortcut-dialog")!;
    const list = panel.querySelector("dl")!;
    const rows = [...list.children] as HTMLElement[];
    const filters = document.createElement("nav");
    filters.className = "chart-tabs";
    filters.setAttribute("aria-label", "Categorías de atajos");
    const columns = document.createElement("div");
    columns.className = "shortcut-columns";
    panel.append(columns);
    columns.append(filters, list);
    const categories = ["General", "Herramientas", "Zoom", "Copiar y pegar", "Selección"];
    const category = [0, 4, 0, 0, 1, 1, 2, 1, 4, 1, 4, 4, 4, 0, 3];
    let selected = 0;
    const update = () => {
      rows.forEach((row, index) => {
        row.hidden = category[index] !== selected;
      });
      [...filters.children].forEach((button, index) => {
        button.setAttribute("aria-pressed", String(index === selected));
        button.classList.toggle("active", index === selected);
      });
    };
    categories.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.onclick = () => { selected = index; update(); };
      filters.append(button);
    });
    update();
  } else if (kind === "metrics") {
    menu.setAttribute("aria-label", "Métricas de la tienda");
    menu.innerHTML = Object.entries(canvasMetrics).map(([id, label]) =>
      `<button type="button" data-canvas-metric="${id}">${uiIcon("sales", 14)} ${esc(label)}</button>`,
    ).join("");
  } else {
    menu.setAttribute("aria-label", "Carpetas");
    const privateSpace = !!state.spaces.find(space => space.id === activeSpace)?.privateOwner;
    const groupId = spatial?.organization.activeGroup();
    const folders = canvasFolders().filter(folder => folder.folder.groupId === groupId);
    menu.innerHTML = `${privateSpace ? "" : `<button type="button" data-create-canvas-folder="shared">${uiIcon("folder", 14)} Nueva carpeta pública</button>`}
      <button type="button" data-create-canvas-folder="private">${uiIcon("folderLock", 14)} Nueva carpeta privada</button>
      ${folders.length ? `<div class="canvas-menu-divider">${folders.map(folder =>
        `<button type="button" data-space="${esc(folder.id)}">${uiIcon(folder.privateOwner ? "folderLock" : "folder", 14)} ${esc(folder.name)}</button>`,
      ).join("")}</div>` : ""}`;
  }
  const frame = $("#canvas-frame").getBoundingClientRect();
  const anchor = trigger.getBoundingClientRect();
  menu.hidden = false;
  const library = $("#canvas-block-library").getBoundingClientRect();
  const left = kind === "shortcuts" ? Math.max(library.right, anchor.right) - frame.left + 12 : anchor.right - frame.left + 10;
  menu.style.maxWidth = kind === "shortcuts" ? `${Math.max(0, frame.width - left - 10)}px` : "";
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, Math.min(anchor.top - frame.top - (kind === "shortcuts" ? menu.offsetHeight + 10 : 0), frame.height - menu.offsetHeight - 12))}px`;
  trigger.setAttribute("aria-expanded", "true");
  (menu.querySelector<HTMLElement>("input,button") || menu).focus({ preventScroll: true });
}
document.addEventListener("pointerdown", event => {
  if (!(event.target as Element).closest('#canvas-tools-menu,[aria-controls="canvas-tools-menu"]')) closeCanvasToolsMenu();
});
$("#canvas-tools-menu").addEventListener("click", event => {
  const button = (event.target as Element).closest<HTMLElement>("button");
  if (!button || button.closest(".shortcut-dialog")) return;
  closeCanvasToolsMenu();
  if (button.dataset.createCanvasFolder) newCanvasFolder(button.dataset.createCanvasFolder === "private");
  if (button.dataset.canvasMetric && canView(actor(), "analytics"))
    addBlock("sales", undefined, button.dataset.canvasMetric as CanvasMetric);
});
function newCanvasFolder(privateChoice: boolean) {
  if (!canvasOpen || !canWrite(actor(), "canvas")) return;
  const parentId = activeSpace;
  const parent = state.spaces.find(space => space.id === parentId);
  const groupId = spatial?.organization.activeGroup();
  const isPrivate = !!parent?.privateOwner || privateChoice;
  const names = new Set(canvasFolders().map(folder => folder.name));
  let name = "Nueva carpeta";
  for (let suffix = 2; names.has(name); suffix++) name = `Nueva carpeta ${suffix}`;
  const id = uid();
  const frame = $("#canvas-frame");
  const point = freePosition({
    id, x: (frame.clientWidth / 2 - camera.x) / camera.z - 109,
    y: (frame.clientHeight / 2 - camera.y) / camera.z - 65, ...canvasFolderSize,
  }, [...state.nodes.filter(node => node.space === parentId && (spatial?.visible(node) ?? true)).map(nodeRect), ...visibleFolderRects()]);
  mutate(() => {
    state.spaces.push({ id, name, color: "green", createdAt: new Date().toISOString(),
      privateOwner: isPrivate ? String(actor().id) : undefined, folder: { parentId, ...point, groupId } });
  });
  revealCanvasRects([spatial?.organization.placed.get(id) ?? { id, ...point, ...canvasFolderSize }]);
  document.querySelector<HTMLElement>(`#canvas-nodes [data-space="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
function nodeRect(node: CanvasNode): Rect {
  const el = document.querySelector<HTMLElement>(`[data-node="${node.id}"]`);
  return {
    id: node.id,
    x: (spatial?.organization.placed.get(node.id)?.x ?? node.x) + (pointer?.movingIds?.has(node.id) ? pointer.dx : 0),
    y: (spatial?.organization.placed.get(node.id)?.y ?? node.y) + (pointer?.movingIds?.has(node.id) ? pointer.dy : 0),
    width: el?.offsetWidth || node.width || 255,
    height: el?.offsetHeight || node.height || 200,
  };
}
function normalizeCanvasRelationships() {
  const owners = new Map<string,string>();
  const nodes = new Map(state.nodes.map(n => [n.id,n]));
  for (const space of state.spaces) {
    const folder = space.folder;
    if (folder?.groupId && !nodes.has(folder.groupId)) delete folder.groupId;
  }
  for (const group of state.nodes)
    if (group.spatial?.type === "group" || group.spatial?.type === "stack")
      for (const id of group.spatial.members || []) owners.set(id,group.id);
  state.edges = state.edges.filter(e =>
    nodes.get(e.from)?.space === nodes.get(e.to)?.space && owners.get(e.from) === owners.get(e.to),
  );
  for (const node of state.nodes) if (node.attachedTo) {
    const host=nodes.get(node.attachedTo);
    if (!host || host.kind==="note" || host.space!==node.space || owners.get(node.id)!==owners.get(host.id))
      delete node.attachedTo;
  }
}
function sameCanvasGroup(a: string,b: string) {
  const org=spatial?.organization;
  return org?.owner(a)?.id === org?.owner(b)?.id;
}
function renderConnections() {
  $$(".node-port.linked-port").forEach((el) =>
    el.classList.remove("linked-port"),
  );
  const visible = new Map(
    state.nodes
      .filter((n) => n.space === activeSpace && (spatial?.visible(n)??true))
      .map(n => [n.id, nodeRect(n)]),
  );
  const markup = state.edges
    .filter((e) => visible.has(e.from) && visible.has(e.to) && sameCanvasGroup(e.from,e.to))
    .map((e) => {
      const line = connector(
        visible.get(e.from)!,
        visible.get(e.to)!,
        e.fromSide,
        e.toSide,
      );
      document
        .querySelector(
          `[data-port-node="${e.from}"][data-port-side="${line.source}"]`,
        )
        ?.classList.add("linked-port");
      document
        .querySelector(
          `[data-port-node="${e.to}"][data-port-side="${line.dest}"]`,
        )
        ?.classList.add("linked-port");
      const from = visible.get(e.from)!,
        to = visible.get(e.to)!;
      const offset = (
        point: { x: number; y: number },
        rect: Rect,
        side?: PortSide,
      ) => {
        const chosen =
          side ||
          (point.x === rect.x
            ? "left"
            : point.x === rect.x + rect.width
              ? "right"
              : point.y === rect.y
                ? "top"
                : "bottom");
        return {
          x: point.x + (chosen === "left" ? -30 : chosen === "right" ? 30 : 0),
          y: point.y + (chosen === "top" ? -30 : chosen === "bottom" ? 30 : 0),
        };
      };
      const start = offset(line.start, from, line.source),
        end = offset(line.end, to, line.dest);
      const dimmed = spatial?.organization.isDimmed(e.from) || spatial?.organization.isDimmed(e.to);
      return `<path ${dimmed ? 'opacity=".3"' : ""} d="${line.path}"/>${canWrite(actor(), "canvas") ? `<circle class="edge-handle" cx="${start.x}" cy="${start.y}" r="8" data-edge="${e.id}" data-edge-end="from"/><circle class="edge-handle" cx="${end.x}" cy="${end.y}" r="8" data-edge="${e.id}" data-edge-end="to"/>` : ""}`;
    })
    .join("");
  $("#connections").innerHTML = markup.replace(/<circle[^>]*\/>/g, "");
  $("#connection-handles").innerHTML = (
    markup.match(/<circle[^>]*\/>/g) || []
  ).join("");
}
function alignCards() {
  if (layoutBusy || spatial?.organization.groupOpen() || pointer?.moved || (document.activeElement as HTMLElement)?.isContentEditable)
    return;
  layoutBusy = true;
  let changed = false;
  const current = state.nodes.filter((n) => n.space === activeSpace && (spatial?.visible(n)??true));
  const org=spatial?.organization;
  const fixed=current.filter(n=>!n.attachedTo&&(org?.owner(n.id)||org?.container(n)));
  const containers = [...fixed.map(nodeRect), ...visibleFolderRects()];
  const occupied = [...containers];
  const arranged = current.filter(n=>!n.attachedTo&&!fixed.includes(n)).map(n=>{
    const rect=nodeRect(n), pos=(containers.some(o => overlaps(rect, o, 12)) || occupied.some(o => overlaps(rect, o, 0))) ? freePosition(rect, occupied, 12) : rect;
    const result={...rect,...pos}; occupied.push(result); return result;
  });
  for (const rect of arranged) {
    const node = current.find((n) => n.id === rect.id)!;
    if (node.x !== rect.x || node.y !== rect.y) {
      const dx=rect.x-node.x, dy=rect.y-node.y;
      node.x = rect.x;
      node.y = rect.y;
      for (const note of current.filter(n=>n.attachedTo===node.id)) {
        note.x+=dx; note.y+=dy;
        const el=document.querySelector<HTMLElement>(`[data-node="${CSS.escape(note.id)}"]`);
        if(el){el.style.left=note.x+"px";el.style.top=note.y+"px";}
      }
      changed = true;
      const el = document.querySelector<HTMLElement>(
        `[data-node="${node.id}"]`,
      );
      if (el) {
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";
      }
    }
  }
  if (changed && canWrite(actor(), "canvas")) save();
  layoutBusy = false;
  renderConnections();
}
function centerOnNode(id: string, focus = false) {
  requestAnimationFrame(() => {
    const node = state.nodes.find((n) => n.id === id);
    if (!node) return;
    camera.z = Math.max(camera.z, 0.9);
    const rect = nodeRect(node),
      frame = $("#canvas-frame");
    camera.x = frame.clientWidth / 2 - (rect.x + rect.width / 2) * camera.z;
    camera.y = frame.clientHeight / 2 - (rect.y + rect.height / 2) * camera.z;
    applyCamera();
    renderConnections();
    if (focus) {
      spatial?.organization.select([id]);
      document.querySelector<HTMLElement>(`#canvas-nodes [data-node="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
    }
  });
}
function revealCanvasRects(rects: Rect[], animate = false) {
  const r=canvasBounds(rects), viewport=$("#canvas-frame");
  const w=viewport.clientWidth,h=viewport.clientHeight;
  const side=w>520?96:72, top=44, bottom=105;
  const x=r.x*camera.z+camera.x,y=r.y*camera.z+camera.y;
  if(x>=side && y>=top && x+r.width*camera.z<=w-25 && y+r.height*camera.z<=h-bottom) return;
  const z=Math.max(.2,Math.min(camera.z,(w-side-25)/Math.max(1,r.width),(h-top-bottom)/Math.max(1,r.height)));
  const layer = $("#canvas-viewport"), from = layer.style.transform;
  camera={z,x:side+(w-side-25-r.width*z)/2-r.x*z,y:top+(h-top-bottom-r.height*z)/2-r.y*z};
  applyCamera();
  if (animate && from && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    layer.animate([{transform:from},{transform:layer.style.transform}], {duration:230,easing:"cubic-bezier(.2,.75,.25,1)"});
}
function addBlock(
  kind: CanvasNode["kind"] | "frame",
  position?: { x: number; y: number },
  metric?: CanvasMetric,
) {
  if (!canWrite(actor(), "canvas")) return;
  if (kind === "image") {
    pendingImagePosition = position;
    $<HTMLInputElement>("#image-input").click();
    return;
  }
  const dashed = kind === "frame";
  if (kind === "frame") kind = "page";
  const id = uid(),
    labels = {
      note: "Nueva nota",
      page: "Nueva nota",
      tasks: "Nueva lista",
      sales: "Ventas de la tienda",
      image: "Imagen",
    };
  const desired = position || {
    x: ($("#canvas-frame").clientWidth / 2 - camera.x) / camera.z - 127,
    y: ($("#canvas-frame").clientHeight / 2 - camera.y) / camera.z - 90,
  };
  const size = kind === "note" ? { width: 170, height: 170 }
    : kind === "page" && !dashed ? { width: 240, height: 310 }
    : { width: 255, height: 200 };
  const pos = freePosition(
    { id, ...desired, ...size },
    [...state.nodes.filter((n) => n.space === activeSpace).map(nodeRect), ...visibleFolderRects()],
  );
  if (!spatial?.organization.insert([{
      id,
      space: activeSpace,
      kind,
      borderStyle: dashed ? "dashed" : undefined,
      cloudAuthor: dashed ? ([actor().firstName, actor().lastName].filter(Boolean).join(" ") || actor().name).slice(0, 80) : undefined,
      title: dashed ? "Nueva idea" : metric ? canvasMetrics[metric] : labels[kind],
      metric,
      body: "",
      ...pos,
    }])) return;
  centerOnNode(id);
}
function fitCanvasPreviews() {
  for (const tile of document.querySelectorAll<HTMLElement>("#canvas-nodes .canvas-preview-tile")) {
    const preview = tile.querySelector<HTMLElement>(":scope > .canvas-preview-node");
    if (!preview) continue;
    const width = preview.offsetWidth || Number(preview.dataset.previewWidth);
    const height = (preview.firstElementChild as HTMLElement).offsetHeight || Number(preview.dataset.previewHeight);
    if (!width || !height) continue;
    if (tile.matches(".stack-preview-card")) {
      tile.style.setProperty("--natural-width", String(width));
      tile.style.setProperty("--natural-height", String(height));
      tile.style.setProperty("--packed-scale", String(Math.min(174 / width, 174 / height, 1)));
    } else if (tile.closest(".canvas-folder-preview")) {
      const scale = Math.min(140 / width, 104 / height);
      preview.style.setProperty("--preview-scale", String(scale));
      tile.style.setProperty("--visible-width", `${width * scale}px`);
    }
  }
  for (const folder of document.querySelectorAll("#canvas-nodes .canvas-folder-preview")) {
    const tiles = [...folder.querySelectorAll<HTMLElement>(":scope > .canvas-preview-tile")];
    for (let start = 0; start < tiles.length; start += 5) {
      const row = tiles.slice(start, start + 5);
      const gap = 8;
      const rowIndex = start / 5;
      const cards = row.map((tile, index) => {
        const offset = row.length > 1 ? 2 * index / (row.length - 1) - 1 : 0;
        const angle = offset * (row.length <= 3 ? 2 : 4);
        const radians = Math.abs(angle) * Math.PI / 180;
        const width = parseFloat(tile.style.getPropertyValue("--visible-width")) || 140;
        return { tile, offset, angle, width: (tiles.length <= 3 ? 1.6 : 1.4) * (width * Math.cos(radians) + 104 * Math.sin(radians)) };
      });
      folder.setAttribute("data-compact-preview", String(tiles.length <= 3));
      let left = -(cards.reduce((sum, card) => sum + card.width, 0) + gap * (row.length - 1)) / 2;
      for (const { tile, offset, angle, width } of cards) {
        tile.style.setProperty("--fan-x", `${left + width / 2}px`);
        tile.style.setProperty("--fan-y", `${-166 - rowIndex * 34 + offset ** 2 * 19}px`);
        tile.style.setProperty("--fan-rotation", `${angle}deg`);
        left += width + gap;
      }
    }
  }
}
const cardObserver = new ResizeObserver(() => {if(pointer?.moved)return; fitCanvasPreviews(); spatial?.organization.refreshGeometry(); renderConnections(); });
document.addEventListener(
  "load",
  (e) => {
    if ((e.target as HTMLElement).closest?.("#canvas-nodes"))
      renderConnections();
  },
  true,
);
function applyCamera() {
  presence?.position();
  $("#canvas-viewport").style.transform =
    `translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
  $("#zoom-value").textContent = Math.round(camera.z * 100) + "%";
}
function zoom(factor: number, cx?: number, cy?: number) {
  const rect = $("#canvas-frame").getBoundingClientRect();
  const x = cx ?? rect.width / 2,
    y = cy ?? rect.height / 2;
  const next = Math.min(2, Math.max(0.2, camera.z * factor));
  camera.x = x - ((x - camera.x) * next) / camera.z;
  camera.y = y - ((y - camera.y) * next) / camera.z;
  camera.z = next;
  applyCamera();
}
function nodeEditor(id?: string, kind: CanvasNode["kind"] = "note") {
  if (!canWrite(actor(), "canvas")) return;
  if (!canvasOpen) {
    if (!state.spaces.length) {
      spaceEditor();
      return;
    }
    openSpace(
      activeSpace && state.spaces.some((s) => s.id === activeSpace)
        ? activeSpace
        : state.spaces[0].id,
    );
  }
  const n = state.nodes.find((n) => n.id === id);
  if (n?.pageId) {
    modal(
      `<h2>Nota conectada</h2><p>Los cambios de esta tarjeta se guardan también en la nota original.</p><div class="dialog-actions">${canView(actor(), "pages") ? `<button class="button secondary" data-edit-page="${n.pageId}">Abrir nota</button>` : ""}<button class="danger-button" id="detach-page">Quitar de este espacio</button></div>`,
    );
    $("#detach-page").onclick = () => {
      mutate(() => {
        state.nodes = state.nodes.filter((x) => x.id !== n.id);
        state.edges = state.edges.filter(
          (e) => e.from !== n.id && e.to !== n.id,
        );
      });
      close();
      notify("La nota sigue disponible en Notas.");
    };
    return;
  }
  modal(
    `<h2>${n ? "Editar tarjeta" : "Nueva tarjeta"}</h2><form id="node-form">${n ? "" : '<label>Título<input name="title" required maxlength="120" placeholder="¿De qué trata esta tarjeta?"/></label>'}${(n?.kind || kind) === "image" ? `<label>Pie de foto<textarea name="body" maxlength="1000" rows="3">${esc(n?.body || "")}</textarea></label>` : `<label>Contenido<textarea name="body" maxlength="10000" style="min-height:160px">${esc(n?.body || "")}</textarea></label>`}<div class="dialog-actions">${n ? '<button type="button" class="danger-button" id="delete-node">Eliminar bloque</button>' : ""}<button class="button primary">Guardar bloque</button></div></form>`,
  );
  $("#node-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    if (n) {
      mutate(() => {
        if (f.has("body")) { n.body = String(f.get("body")); delete n.bodyHtml; }
      });
    } else if (!spatial?.organization.insert([{
      id: uid(),
      kind,
      space: activeSpace,
      title: String(f.get("title")),
      body: String(f.get("body") || ""),
      x: (100 - camera.x) / camera.z,
      y: (100 - camera.y) / camera.z,
    }])) return;
    close();
    show("canvas", true);
  };
  if (n)
    $("#delete-node").onclick = () => {
      mutate(() => {
        state.nodes = state.nodes.filter((x) => x.id !== n.id);
        state.edges = state.edges.filter(
          (x) => x.from !== n.id && x.to !== n.id,
        );
      });
      close();
    };
}
function connectPage(pageId: string) {
  if (!canWrite(actor(), "canvas")) return;
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return;
  modal(
    `<h2>Conectar «${esc(page.title)}»</h2><p>Elige dónde quieres verla. La nota seguirá disponible en Notas.</p><form id="connect-page-form"><fieldset class="permission-options space-link-options"><legend>Espacios</legend>${
      state.spaces
        .filter((s) => (s.privateOwner || "") === (page.privateOwner || ""))
        .map(
          (space) =>
            `<label><input type="checkbox" name="space" value="${esc(space.id)}" ${state.nodes.some((n) => n.pageId === page.id && n.space === space.id) ? "checked" : ""}/> ${esc(space.name)}</label>`,
        )
        .join("") || "<p>Crea un espacio para poder conectar esta nota.</p>"
    }</fieldset><button class="button primary">Guardar conexiones</button></form>`,
  );
  $("#connect-page-form").onsubmit = (e) => {
    e.preventDefault();
    const selected = new Set(
      new FormData(e.target as HTMLFormElement).getAll("space").map(String),
    );
    mutate(() => {
      const removed = state.nodes
        .filter((n) => n.pageId === page.id && !selected.has(n.space))
        .map((n) => n.id);
      state.nodes = state.nodes.filter((n) => !removed.includes(n.id));
      state.edges = state.edges.filter(
        (edge) => !removed.includes(edge.from) && !removed.includes(edge.to),
      );
      for (const space of selected)
        if (!state.nodes.some((n) => n.pageId === page.id && n.space === space))
          state.nodes.push({
            id: uid(),
            space,
            kind: "page",
            pageId: page.id,
            title: "Nota conectada",
            body: "",
            x: 100,
            y: 100,
          });
    });
    close();
    notify("Conexiones guardadas.");
  };
}
function isCanvasTextCard(node: CanvasNode) {
  return !node.spatial && ["note", "page", "tasks"].includes(node.kind);
}
function editCanvasCard(id: string, detailHost?: HTMLElement) {
  if (!canvasOpen || activeView!=="canvas" || !canWrite(actor(),"canvas")) return;
  const n=state.nodes.find(node=>node.id===id&&node.space===activeSpace);
  if (!n || (!isCanvasTextCard(n) && !(detailHost && n.spatial?.type === "media"))) return;
  const page=n.pageId ? state.pages.find(page=>page.id===n.pageId&&isMine(page.privateOwner)) : undefined;
  if (n.pageId && (!page || !canWrite(actor(),"pages"))) return;
  const host=detailHost || document.querySelector<HTMLElement>(`[data-card-editable="${CSS.escape(id)}"]`);
  if(!host || host.querySelector("form"))return;
  const item=page||n, isList=n.kind==="tasks";
  const bodyLabel = n.spatial?.type === "media" ? "Descripción del archivo" : "Contenido";
  host.innerHTML=`<form class="canvas-card-form" aria-label="Editar tarjeta">
    ${detailHost || n.borderStyle!=="dashed"?`<input name="title" aria-label="Título" maxlength="120" value="${esc(item.title)}" ${detailHost ? 'placeholder="Sin título"' : "required"}>`:""}
    ${isList?`<textarea name="items" aria-label="Elementos de la lista" placeholder="Una tarea por línea" rows="4">${esc(n.checklist?.map(row=>row.text).join("\n")||"")}</textarea>`:
      `<div class="canvas-editor-body">${detailHost ? `<button type="button" class="canvas-block-format" aria-label="Bloques de contenido" aria-expanded="false">···</button><div class="canvas-block-options" role="group" aria-label="Bloques de contenido" hidden>${[["h1","Título principal","01"],["h2","Título","02"],["h3","Subtítulo","03"],["p","Párrafo","04"],["task","Lista con casillas","□"],["ul","Lista con viñetas","≡"],["ol","Lista numerada","1."],["pre","Bloque de código","‹›"]].map(([type,label,icon])=>`<button type="button" data-content-block="${type}"><span aria-hidden="true">${icon}</span>${label}</button>`).join("")}</div>` : ""}<div data-card-editor data-rich-editor="true" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${bodyLabel}" data-placeholder="Escribe aquí…">${item.bodyHtml?sanitizeRichText(item.bodyHtml):esc(item.body)}</div></div>`}
    ${detailHost ? "" : '<div class="canvas-card-form-actions"><button type="button" data-cancel-card>Cancelar</button><button type="submit">Guardar</button></div>'}</form>`;
  const form=host.querySelector("form")!;
  const focusCard=()=>document.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  form.querySelector<HTMLElement>("[data-cancel-card]")?.addEventListener("click", () => {
    renderCanvas();
    focusCard();
  });
  if (detailHost) installCanvasBlockMenu(form);
  let dirty = false;
  form.addEventListener("input", () => { dirty = true; });
  if (detailHost) form.addEventListener("focusout", event => {
    if (event.relatedTarget instanceof Node && $("#canvas-detail").contains(event.relatedTarget) && !form.contains(event.relatedTarget)) {
      form.requestSubmit();
    }
  });
  form.onkeydown=e=>{
    if(e.key==="Escape" && !detailHost){e.preventDefault();e.stopPropagation();renderCanvas();focusCard();}
    if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();form.requestSubmit();}
  };
  form.onsubmit=e=>{
    e.preventDefault();
    if (detailHost && !dirty) return;
    const values=new FormData(form), editor=form.querySelector<HTMLElement>("[data-card-editor]");
    const update = () => {
      if(values.has("title")) item.title=String(values.get("title")).trim()||item.title;
      if(isList){
        const old=[...(n.checklist||[])];
        n.checklist=String(values.get("items")||"").split("\n").map(line=>line.trim().slice(0,2000)).filter(Boolean).slice(0,500).map(line=>{
          const previous=old.findIndex(row=>row.text.trim()===line);
          return previous>=0?old.splice(previous,1)[0]:{id:uid(),text:line,done:false};
        });
      } else if(editor){
        item.body=editor.innerText.slice(0,30000);
        item.bodyHtml=sanitizeRichText(editor.innerHTML);
      }
      if(page) page.updated=new Date().toISOString();
    };
    if (detailHost) {
      history();
      update();
      dirty = false;
      save();
    } else {
      mutate(update);
      focusCard();
    }
  };
  if (!detailHost) form.querySelector<HTMLElement>("input,textarea,[data-card-editor]")?.focus({preventScroll:true});
}
function installCanvasBlockMenu(form: HTMLFormElement) {
  const trigger = form.querySelector<HTMLButtonElement>(".canvas-block-format");
  const options = form.querySelector<HTMLElement>(".canvas-block-options");
  const editor = form.querySelector<HTMLElement>("[data-card-editor]");
  if (!trigger || !options || !editor) return;

  let caret: Range | undefined;
  const rememberCaret = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      caret = selection.getRangeAt(0).cloneRange();
    }
  };
  editor.addEventListener("focusout", rememberCaret);
  const toggle = (open: boolean) => {
    options.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  };
  trigger.onclick = () => {
    toggle(options.hasAttribute("hidden"));
    if (!options.hidden) options.querySelector("button")?.focus();
  };
  form.addEventListener("focusout", event => {
    if (!(event.relatedTarget instanceof Node) || !options.contains(event.relatedTarget) && event.relatedTarget !== trigger) toggle(false);
  });
  options.addEventListener("keydown", event => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = [...options.querySelectorAll("button")];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowUp" ? -1 : 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (current + step + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
  });
  const addListCheckboxes = (list: HTMLElement) => {
    for (const item of list.querySelectorAll(":scope > li")) {
      if (item.querySelector(":scope > input[type=checkbox]")) continue;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.contentEditable = "false";
      checkbox.setAttribute("aria-label", "Marcar como completado");
      item.prepend(checkbox);
    }
  };
  editor.addEventListener("input", () => {
    editor.querySelectorAll<HTMLElement>("ul[data-canvas-checklist]").forEach(addListCheckboxes);
  });
  options.onclick = event => {
    const type = (event.target as Element).closest<HTMLButtonElement>("[data-content-block]")?.dataset.contentBlock;
    if (!type) return;
    toggle(false);
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    if (!caret || !editor.contains(caret.commonAncestorContainer)) {
      caret = document.createRange();
      caret.selectNodeContents(editor);
      caret.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(caret);
    if (type === "ul" || type === "ol") {
      document.execCommand(type === "ul" ? "insertUnorderedList" : "insertOrderedList");
    } else if (type === "task") {
      const currentList = () => {
        const node = selection.anchorNode;
        return (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("ul");
      };
      if (!currentList()) document.execCommand("insertUnorderedList");
      const list = currentList();
      if (list && editor.contains(list)) {
        list.setAttribute("data-canvas-checklist", "");
        addListCheckboxes(list);
      }
    } else {
      document.execCommand("formatBlock", false, type);
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  };
  editor.addEventListener("change", event => {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== "checkbox") return;
    checkbox.toggleAttribute("checked", checkbox.checked);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function sendCanvasNote(id: string) {
  if (!canvasOpen || activeView!=="canvas" || !canWrite(actor(),"canvas") || !canWrite(actor(),"pages")) return;
  const space=state.spaces.find(s=>s.id===activeSpace&&isMine(s.privateOwner));
  const node=state.nodes.find(n=>n.id===id&&n.space===space?.id&&n.kind==="note"&&!n.pageId);
  if(!node || !space)return;
  const pageId=uid(), now=new Date().toISOString();
  mutate(()=>{
    state.pages.push({id:pageId,title:node.title,body:node.body,bodyHtml:node.bodyHtml,emoji:"▤",createdAt:now,updated:now,authorId:String(actor().id),privateOwner:space.privateOwner});
    node.pageId=pageId;
  });
  directories.reset(space.privateOwner?"private-notes":"notes");
  notify(space.privateOwner?"Nota guardada en tus Notas privadas.":"Nota guardada en Notas y vinculada al lienzo.");
}
document.addEventListener("click",e=>{
  const b=(e.target as Element).closest<HTMLElement>("[data-edit-card],[data-node-to-note]");
  if(b?.dataset.editCard) editCanvasCard(b.dataset.editCard);
  if(b?.dataset.nodeToNote) sendCanvasNote(b.dataset.nodeToNote);
  const fileCard = (e.target as Element).closest("#canvas-nodes [data-spatial-open-file]")?.closest<HTMLElement>("[data-node]");
  if (fileCard?.dataset.node) openCanvasDetail(fileCard.dataset.node);
});
$("#canvas-detail").addEventListener("click", event => {
  const panel = $("#canvas-detail");
  if (panel.classList.contains("canvas-image-detail") &&
      !(event.target as Element).closest(".canvas-detail-card,button")) closeCanvasDetail();
});
function animateCanvasDetail(
  panel: HTMLElement,
  source: HTMLElement,
  closing: boolean,
  interrupted?: { transform: string; borderRadius: string; background: string; barOpacity: string },
) {
  const detail = panel.querySelector<HTMLElement>(".canvas-detail-card")!;
  const destination = detail.getBoundingClientRect();
  const card = source.getBoundingClientRect();
  if (!destination.width || !destination.height || !card.width || !card.height ||
      matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const scaleX = card.width / destination.width;
  const scaleY = card.height / destination.height;
  const x = card.left - destination.left, y = card.top - destination.top;
  const compact = { transform: `translate(${x}px,${y}px) scale(${scaleX},${scaleY})`, borderRadius: "14px" };
  const expanded = { transform: "none", borderRadius: "0px" };
  const timing: KeyframeAnimationOptions = {
    duration: closing ? 350 : 480, easing: "cubic-bezier(.18,.82,.22,1)", fill: "both",
  };
  const foreground = detail.animate(closing
    ? [{ transform: interrupted?.transform || expanded.transform, borderRadius: interrupted?.borderRadius || expanded.borderRadius }, compact]
    : [compact, expanded], timing);
  const backdrop = panel.animate(
    closing ? [{backgroundColor:interrupted?.background || "var(--canvas-detail-background)"},{backgroundColor:"transparent"}]
      : [{backgroundColor:"transparent"},{backgroundColor:"var(--canvas-detail-background)"}],
    timing,
  );
  const bar = panel.querySelector(".canvas-detail-bar")?.animate(
    closing ? [{opacity:interrupted?.barOpacity || 1},{opacity:0}] : [{opacity:0},{opacity:1}], timing,
  );
  foreground.oncancel = () => {
    backdrop.cancel();
    bar?.cancel();
  };
  return foreground;
}
function closeCanvasDetail(restoreFocus = true) {
  if (!canvasDetailId) return;
  const previous = canvasDetailId;
  const panel = $("#canvas-detail"), frame = $("#canvas-frame");
  if (restoreFocus && panel.classList.contains("is-closing")) return;
  if (restoreFocus) panel.querySelector("form")?.requestSubmit();
  const interrupted = canvasDetailMotion?.playState === "running" ? {
    transform: getComputedStyle(panel.querySelector(".canvas-detail-card")!).transform,
    borderRadius: getComputedStyle(panel.querySelector(".canvas-detail-card")!).borderRadius,
    background: getComputedStyle(panel).backgroundColor,
    barOpacity: getComputedStyle(panel.querySelector(".canvas-detail-bar")!).opacity,
  } : undefined;
  canvasDetailMotion?.cancel();
  const finish = () => {
    if (canvasDetailId !== previous) return;
    canvasDetailMotion?.cancel();
    canvasDetailMotion=undefined;
    canvasDetailId = "";
    canvasMedia.pause();
    panel.hidden = true;
    panel.classList.remove("is-closing");
    panel.replaceChildren();
    frame.classList.remove("canvas-detail-open", "canvas-image-preview-open");
    frame.querySelector(".canvas-detail-source")?.classList.remove("canvas-detail-source");
    for (const child of frame.children) if (child instanceof HTMLElement && child !== panel) child.inert = false;
    if (restoreFocus) renderCanvas();
    if (restoreFocus) document.querySelector<HTMLElement>(`#canvas-nodes [data-node="${CSS.escape(previous)}"]`)?.focus({preventScroll:true});
  };
  const source = document.querySelector<HTMLElement>(`#canvas-nodes [data-node="${CSS.escape(previous)}"] .canvas-node-face`);
  if (restoreFocus && source) {
    canvasDetailMotion=animateCanvasDetail(panel,source,true,interrupted);
    if (canvasDetailMotion) {
      panel.classList.add("is-closing");
      void canvasDetailMotion.finished.then(finish,()=>{});
      return;
    }
  }
  finish();
}
function openCanvasDetail(id: string) {
  if (!canvasOpen || activeView !== "canvas" || canvasDetailId || !canView(actor(),"canvas")) return;
  const n = state.nodes.find(node => node.id === id && node.space === activeSpace);
  const source = document.querySelector<HTMLElement>(`#canvas-nodes [data-node="${CSS.escape(id)}"] .canvas-node-face`);
  if (!n || !source || !spatial || spatial.organization.container(n)) return;
  const page = n.pageId ? state.pages.find(p=>p.id===n.pageId&&isMine(p.privateOwner)) : undefined;
  const title = page?.title || n.title;
  const panel = $("#canvas-detail"), frame = $("#canvas-frame");
  const description = page || n;
  panel.classList.toggle("canvas-image-detail", n.kind === "image");
  if (n.kind === "image") {
    const image = source.querySelector("img,canvas")?.getBoundingClientRect() ?? source.getBoundingClientRect();
    panel.style.setProperty("--image-detail-width", `${image.width * 1.7}px`);
  }
  const editable = canWrite(actor(), "canvas") && (!n.pageId || (page && canWrite(actor(), "pages")));
  const detailEditor = editable && (isCanvasTextCard(n) || n.spatial?.type === "media");
  const content = n.spatial ? spatial.render(n, false)
    : n.kind === "image" ? `<figure>${n.image?.startsWith("data:image/gif") ? canvasMedia.gifMarkup(n.id, n.image, title, esc) : `<img src="${esc(n.image)}" alt="${esc(title)}"/>`}${n.body ? `<figcaption>${esc(n.body)}</figcaption>` : ""}</figure>`
    : n.kind === "tasks" ? `<ul class="canvas-detail-checklist">${(n.checklist || []).map(row=>`<li>${uiIcon(row.done?"check":"frame",18)} <span>${esc(row.text)}</span><small>${row.done?"Lista":"Pendiente"}</small></li>`).join("")}</ul>`
    : n.kind === "sales" ? canvasSalesContent(n.metric)
    : `<div class="canvas-detail-copy">${n.pageId && !page ? "No tienes acceso a esta nota." : description.bodyHtml ? sanitizeRichText(description.bodyHtml) : esc(description.body)}</div>`;
  canvasDetailId = id;
  canvasMedia.pause();
  const sourceColor = getComputedStyle(source).backgroundColor;
  panel.style.setProperty("--canvas-detail-background", n.kind === "image" ? "transparent" : sourceColor === "rgba(0, 0, 0, 0)" ? "var(--card)" : sourceColor);
  panel.style.setProperty("--canvas-detail-text", n.kind === "image" ? "#24202d" : getComputedStyle(source).color);
  panel.innerHTML = `<div class="canvas-detail-bar"><button type="button" class="canvas-detail-back" data-action="close-canvas-detail" aria-label="Volver al lienzo"><span aria-hidden="true">←</span></button></div><div class="canvas-detail-scroll" tabindex="0" aria-label="Contenido del elemento"><article class="canvas-detail-card">${n.borderStyle === "dashed" && n.cloudAuthor ? `<p class="canvas-detail-author">${esc(n.cloudAuthor)}</p>` : ""}${detailEditor ? '<div class="canvas-detail-editor"></div>' : n.kind !== "image" && n.borderStyle !== "dashed" && n.spatial?.type !== "sketch" ? `<h2>${esc(title)}</h2>` : ""}${!detailEditor || n.spatial ? content || "" : ""}</article></div>`;
  const editor = panel.querySelector<HTMLElement>(".canvas-detail-editor");
  if (editor) editCanvasCard(id, editor);
  for (const child of frame.children) if (child instanceof HTMLElement && child !== panel) child.inert = true;
  frame.classList.toggle("canvas-image-preview-open", n.kind === "image");
  frame.classList.add("canvas-detail-open");
  panel.hidden = false;
  canvasDetailMotion=animateCanvasDetail(panel,source,false);
  source.classList.add("canvas-detail-source");
  if (canvasDetailMotion) {
    const animation = canvasDetailMotion;
    void animation.finished.then(() => {
      if (canvasDetailMotion === animation) { animation.cancel(); canvasDetailMotion = undefined; }
    }, () => {});
  }
  const initialFocus = editor?.querySelector<HTMLElement>("textarea,[data-card-editor]") ||
    panel.querySelector<HTMLElement>("[data-action=close-canvas-detail]");
  initialFocus?.focus({preventScroll:true});
  canvasMedia.observe();
  void spatial.hydrate().then(() => {
    if (canvasDetailId === id) canvasMedia.observe();
  });
}
document.addEventListener("keydown", event => {
  if (dialog.open || activeView!=="canvas" || !canvasOpen) return;
  const target=event.target as HTMLElement;
  if (event.key === "Escape") {
    const format = document.querySelector<HTMLButtonElement>("#canvas-detail .canvas-block-format[aria-expanded=true]");
    if (format) { format.click(); format.focus(); event.stopImmediatePropagation(); return; }
    if (!$("#canvas-tools-menu").hidden) { closeCanvasToolsMenu(true); event.stopImmediatePropagation(); return; }
    if (!canvasDetailId && (pointer || connectionDrag || pendingPort || target.closest("input,textarea,select,[contenteditable],form"))) return;
    const closed = canvasDetailId ? (closeCanvasDetail(), true) : spatial?.organization.closeGroup(false);
    if (closed && !canvasDetailId) $("#canvas-frame").focus({preventScroll:true});
    if (closed) { event.preventDefault(); event.stopImmediatePropagation(); }
  } else if (event.key === "Enter" && target.matches("#canvas-nodes [data-node]")) {
    const id = target.dataset.node!;
    const n = state.nodes.find(node => node.id === id && node.space === activeSpace);
    if (!n || !spatial) return;
    event.preventDefault();
    if (spatial.organization.container(n)) spatial.organization.toggleStack(n);
    else openCanvasDetail(id);
  }
},true);

document.addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLButtonElement>("[data-note-color]");
  if (!target || !canvasOpen || activeView !== "canvas" || !canWrite(actor(),"canvas")) return;
  const color = target.dataset.noteColor as keyof typeof noteColors;
  const node = state.nodes.find(n => n.space === activeSpace && n.kind === "note" && n.id === target.closest<HTMLElement>("[data-node]")?.dataset.node);
  if (target.dataset.noteColor !== "default" && !Object.hasOwn(noteColors,color)) return;
  const folderId = target.closest<HTMLElement>("[data-canvas-folder]")?.dataset.canvasFolder;
  const folder = state.spaces.find(space => space.id === folderId && space.folder?.parentId === activeSpace && isMine(space.privateOwner));
  if (folder?.folder) {
    const position = folder.folder;
    const next = target.dataset.noteColor === "default" ? undefined : color;
    if (position.noteColor !== next) mutate(() => { position.noteColor = next; });
    if (event.detail === 0) document.querySelector<HTMLElement>(`[data-canvas-folder="${CSS.escape(folder.id)}"] [data-note-color="${color}"]`)?.focus({preventScroll:true});
    return;
  }
  if (!node || visibleNoteColor(node.noteColor) === color) return;
  const keyboard = event.detail === 0;
  mutate(() => { node.noteColor = color; });
  if (keyboard) document.querySelector<HTMLElement>(`[data-node="${CSS.escape(node.id)}"] [data-note-color="${color}"]`)?.focus({preventScroll:true});
});
document.addEventListener("dblclick", e => {
  const target=e.target as Element;
  if (tool==="select" && !e.ctrlKey && !e.metaKey && !target.closest("button,input,textarea,select,a,video,audio,iframe,[contenteditable]")) {
    const card=target.closest<HTMLElement>("#canvas-nodes [data-node]");
    const n = state.nodes.find(n => n.id === card?.dataset.node && n.space === activeSpace);
    if (n && spatial?.organization.isDimmed(n.id)) { e.preventDefault(); spatial.organization.closeGroup(); return; }
    if (n && spatial && !spatial.organization.container(n)) { e.preventDefault(); openCanvasDetail(n.id); return; }
    if (!card && target.closest("#canvas-frame") && !target.closest("#canvas-detail,.canvas-block-library,.canvas-heading,#canvas-tools-menu,.canvas-toolbar,.zoom-toolbar") && spatial?.organization.closeGroup()) {
      e.preventDefault(); return;
    }
  }
  const title = target.closest<HTMLElement>("[data-title-editable]");
  if (!title || !canvasOpen || activeView!=="canvas" || tool!=="select" || e.ctrlKey || e.metaKey || !canWrite(actor(),"canvas")) return;
  e.preventDefault();
  title.setAttribute("contenteditable","plaintext-only");
  title.setAttribute("role","textbox");
  title.focus({preventScroll:true});
  const range=document.createRange();
  range.selectNodeContents(title);
  const selection=window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
});
let inlineSnapshot = "";
document.addEventListener("focusin", (e) => {
  if (
    (e.target as HTMLElement).matches("[data-inline-title],[data-inline-body]")
  )
    inlineSnapshot = JSON.stringify(state);
});
document.addEventListener("focusout", (e) => {
  const el = e.target as HTMLElement;
  if (
    !el.matches("[data-inline-title],[data-inline-body]") ||
    !canWrite(actor(), "canvas")
  )
    return;
  if (el.dataset.inlineTitle) {
    el.removeAttribute("contenteditable");
    el.removeAttribute("role");
  }
  const id = el.dataset.inlineTitle || el.dataset.inlineBody;
  const node = state.nodes.find((n) => n.id === id);
  if (!node) return;
  const page = node.pageId
    ? state.pages.find((p) => p.id === node.pageId)
    : undefined;
  if (node.pageId && !canWrite(actor(), "pages")) return;
  const field = el.dataset.inlineTitle ? "title" : "body";
  let value = el.innerText;
  if (field === "title") value = value.replace(/\n/g, " ").trim().slice(0, 120);
  else value = value.slice(0, node.kind === "image" ? 1000 : 30000);
  const source = page || node;
  if (field === "title" && !value) {
    el.textContent = source.title;
    return;
  }
  const html = field === "body" && node.kind !== "image" ? sanitizeRichText(el.innerHTML) : undefined;
  if (source[field] === value && (field !== "body" || source.bodyHtml === html))
    return;
  redoStack = [];
  undoStack.push(inlineSnapshot || JSON.stringify(state));
  if (undoStack.length > 25) undoStack.shift();
  source[field] = value;
  if (field === "body") source.bodyHtml = html;
  if (page) page.updated = new Date().toISOString();
  save();
  requestAnimationFrame(alignCards);
  renderConnections();
  notify("Tarjeta guardada.");
});
document.addEventListener("keydown", (e) => {
  const el = e.target as HTMLElement;
  if (!el.matches("[data-inline-title],[data-inline-body]")) return;
  if (e.key === "Escape") {
    e.preventDefault();
    const node = state.nodes.find(
      (n) => n.id === (el.dataset.inlineTitle || el.dataset.inlineBody),
    );
    const source = node?.pageId
      ? state.pages.find((p) => p.id === node.pageId)
      : node;
    if (source)
      el.textContent = el.dataset.inlineTitle ? source.title : source.body;
    el.blur();
  }
  if (e.key === "Enter" && (el.dataset.inlineTitle || e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    el.blur();
  }
});
function renderCalendar() {
  const year = calendarDate.getFullYear(),
    month = calendarDate.getMonth();
  $("#calendar-month").textContent = calendarDate
    .toLocaleDateString("es-CL", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  $("#calendar-grid").innerHTML = cells
    .map((d) => {
      const key = dateKey(d);
      return `<button class="calendar-day ${d.getMonth() !== month ? "outside" : ""} ${key === dateKey(new Date()) ? "today" : ""}" data-event-date="${key}" aria-label="${esc(d.toLocaleDateString("es-CL", { dateStyle: "full" }))}"><span>${d.getDate()}</span>${state.events
        .filter((e) => e.date === key)
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 3)
        .map(
          (e) =>
            `<span class="event-chip" data-edit-event="${e.id}" title="${esc(e.title)}">${esc(e.time)} ${esc(e.title)}</span>`,
        )
        .join("")}${canView(actor(),"tasks")?(state.boards||[]).filter(b=>isMine(b.privateOwner)).flatMap(b=>[...(b.work?.cycles||[]).filter(c=>c.status!=="draft").map(c=>({start:c.start,end:c.end,title:c.name,board:b.id})),...(b.work?.periods||[]).map(p=>({start:p.start,end:p.end,title:b.name,board:b.id}))]).filter(p=>p.start===key||p.end===key).slice(0,2).map(p=>`<span class="event-chip" data-calendar-board="${p.board}">${p.start===key?"Inicio":"Fin"}: ${esc(p.title)}</span>`).join(""):""}</button>`;
    })
    .join("");
}
function eventEditor(id?: string, date?: string) {
  if (!canView(actor(), "calendar") || (!id && !canWrite(actor(), "calendar")))
    return;
  const event = state.events.find((e) => e.id === id);
  modal(
    `<div class="event-dialog-heading"><h2>${event ? "Editar evento" : "Nuevo evento"}</h2><button type="button" class="button secondary small-button" id="export-event">↓ Descargar .ics</button></div><p>Añade la fecha, la hora y los detalles que necesitas recordar.</p><form id="event-form"><label>Nombre del evento<input required name="title" maxlength="120" value="${esc(event?.title || "")}"/></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><label>Fecha<input required type="date" name="date" value="${esc(event?.date || date || dateKey(new Date()))}"/></label><label>Hora<input required type="time" name="time" value="${esc(event?.time || "10:00")}"/></label></div><label>Notas<textarea name="description" maxlength="5000">${esc(event?.description || "")}</textarea></label><div class="dialog-actions">${event ? '<button type="button" class="danger-button" id="delete-event">Eliminar</button>' : ""}${event && connectedProviders.includes("google") ? '<button type="button" class="button secondary" id="google-event">Enviar a Google</button>' : ""}<button class="button primary">Guardar evento</button></div></form>`,
  );
  if (!canWrite(actor(), "calendar")) {
    $$("#event-form input,#event-form textarea").forEach(
      (el) => ((el as HTMLInputElement).readOnly = true),
    );
    $$(
      "#delete-event,#google-event,#event-form .dialog-actions>button:last-child",
    ).forEach((el) => (el.hidden = true));
  }
  function value() {
    const f = new FormData($<HTMLFormElement>("#event-form"));
    return {
      id: event?.id || uid(),
      title: String(f.get("title")),
      date: String(f.get("date")),
      time: String(f.get("time")),
      description: String(f.get("description")),
    };
  }
  $("#event-form").onsubmit = (e) => {
    e.preventDefault();
    if (!canWrite(actor(), "calendar")) return;
    const v = value();
    mutate(() => {
      if (event)
        state.events = state.events.map((x) => (x.id === event.id ? v : x));
      else state.events.push(v);
    });
    close();
    notify("Evento guardado en tu calendario.");
  };
  $("#export-event").onclick = () => {
    const f = $<HTMLFormElement>("#event-form");
    if (!f.reportValidity()) return;
    const v = value();
    const dt = new Date(`${v.date}T${v.time}:00`);
    const ics = (s: string) =>
      s
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;");
    const stamp = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    download(
      "evento-orbita.ics",
      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Orbita//Workspace//ES\r\nBEGIN:VEVENT\r\nUID:${v.id}@orbita.local\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(dt)}\r\nDTEND:${stamp(new Date(dt.getTime() + 3600000))}\r\nSUMMARY:${ics(v.title)}\r\nDESCRIPTION:${ics(v.description)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
      "text/calendar",
    );
  };
  if (event && connectedProviders.includes("google"))
    $("#google-event").onclick = async () => {
      try {
        if (cloudDirty) await syncCloud();
        await api("google/events", {
          method: "POST",
          body: JSON.stringify({ id: event.id }),
        });
        notify("Evento enviado a Google Calendar.");
      } catch (e) {
        notify(e instanceof Error ? e.message : "No se pudo enviar");
      }
    };
  if (event)
    $("#delete-event").onclick = () => {
      mutate(
        () => (state.events = state.events.filter((x) => x.id !== event.id)),
      );
      close();
    };
}
function renderPages() {
  directories.render("notes", state.pages.filter(i=>!i.privateOwner), "pages", "pages-list", "notes-directory-toolbar", "notes-pagination", "pages-grid", (i,f)=>noteCard(state,i,canWrite(actor(),"canvas"),f));
}
function newNote(privateArea = false,template?:string) {
  if(template===undefined){
    if(!canWrite(actor(),"pages"))return;
    modal(`<h2>Crear nota</h2><p>Empieza con una página en blanco o una guía que puedes editar libremente.</p><div class="create-grid">${["Nota en blanco","Acuerdo de reunión","Procedimiento","Propuesta","Revisión y aprendizajes"].map((name,i)=>`<button data-note-template="${i}">${name}</button>`).join("")}</div>`);
    document.querySelectorAll<HTMLElement>("[data-note-template]").forEach(button=>button.onclick=()=>newNote(privateArea,button.dataset.noteTemplate));return;
  }
  const templates=[['Sin título',''],['Acuerdo de reunión','Fecha y participantes\n\nQué acordamos\n\nPróximos pasos y responsables'],['Procedimiento','Para qué sirve\n\nAntes de empezar\n\nPasos\n\nCómo comprobar el resultado'],['Propuesta','Contexto\n\nQué proponemos\n\nResultado esperado\n\nPróximos pasos'],['Revisión y aprendizajes','Qué queríamos lograr\n\nQué funcionó\n\nQué aprendimos\n\nQué vamos a cambiar']];
  const seed=templates[Number(template)]||templates[0];
  if (!canWrite(actor(), "pages")) return;
  const id = uid();
  directories.reset(privateArea ? "private-notes" : "notes");
  mutate(() =>
    state.pages.push({
      id,
      createdAt: new Date().toISOString(),
      title: seed[0],
      body: seed[1],
      bodyHtml: seed[1]?seed[1].split("\n").map(line=>`<p>${esc(line)||"<br>"}</p>`).join(""):"<p><br></p>",
      authorId:String(actor().id),
      emoji: "▤",
      updated: new Date().toISOString(),
      privateOwner: privateArea ? String(actor().id) : undefined,
    }),
  );
  close();
  openDetail("page", id);
  inline.focus('[data-entity-field="title"]');
}
function pageEditor(id?: string, privateArea = false) {
  if (!canView(actor(), "pages") || (!id && !canWrite(actor(), "pages")))
    return;
  const page = state.pages.find((p) => p.id === id);
  modal(
    `<h2>${page ? "Editar nota" : "Nueva nota"}</h2><p>Esta nota es independiente. Puedes conectarla a un espacio cuando lo necesites.</p><form id="page-form"><label>Título<input name="title" maxlength="140" required value="${esc(page?.title || "")}"/></label><label>Contenido<textarea name="body" maxlength="30000" style="min-height:230px">${esc(page?.body || "")}</textarea></label><div class="dialog-actions">${page ? '<button type="button" class="danger-button" id="delete-page">Eliminar</button>' : ""}<button class="button primary">Guardar nota</button></div></form>`,
  );
  if (!canWrite(actor(), "pages")) {
    $$("#page-form input,#page-form textarea").forEach(
      (el) => ((el as HTMLInputElement).readOnly = true),
    );
    $$(
      '#page-form .danger-button,#page-form button[type="submit"],#page-form .dialog-actions>button:last-child',
    ).forEach((el) => (el.hidden = true));
  }
  $("#page-form").onsubmit = (e) => {
    e.preventDefault();
    if (!canWrite(actor(), "pages")) return;
    const f = new FormData(e.target as HTMLFormElement);
    const savedPageId = page?.id || uid();
    if (!page) directories.reset(privateArea ? "private-notes" : "notes");
    mutate(() => {
      const v = {
        id: savedPageId,
        createdAt: page ? page.createdAt : new Date().toISOString(),
        privateOwner:
          page?.privateOwner || (privateArea ? String(actor().id) : undefined),
        title: String(f.get("title")),
        body: String(f.get("body")),
        bodyHtml:
          page?.body === String(f.get("body")) ? page?.bodyHtml : undefined,
        emoji: page?.emoji || "▤",
        updated: new Date().toISOString(),
      };
      if (page)
        state.pages = state.pages.map((x) => (x.id === page.id ? v : x));
      else state.pages.push(v);
    });
    close();
    if (privateArea && !page) openDetail("page", savedPageId);
    else if (activeView === "page") show("page");
    notify("Nota guardada.");
  };
  if (page) {
    $("#delete-page").onclick = () => {
      if (!canWrite(actor(), "pages")) return;
      mutate(() => {
        state.pages = state.pages.filter((x) => x.id !== page.id);
        const nodes = state.nodes
          .filter((n) => n.pageId === page.id)
          .map((n) => n.id);
        state.nodes = state.nodes.filter((n) => !nodes.includes(n.id));
        state.edges = state.edges.filter(
          (e) => !nodes.includes(e.from) && !nodes.includes(e.to),
        );
      });
      close();
      if (page.privateOwner) { privateKind = "pages"; show("private"); } else show("pages");
      notify("Nota enviada a la papelera.");
    };
  }
}
function seriesChart(values: number[], labels: string[]) {
  const max = Math.max(1, ...values);
  const points = values.map(
    (v, i) =>
      [45 + (i * 540) / Math.max(1, values.length - 1),140 - (v / max) * 110],
  );
  return `<svg class="sales-chart" viewBox="0 0 610 175" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Serie de datos reales"><path d="M45 140H590" stroke="var(--line)" fill="none"/>${points.length ? `<path d="${smoothLine(points)}" stroke="var(--chart-color)" stroke-width="2" fill="none"/>` : ""}${labels
    .filter((_, i) => i % Math.max(1, Math.floor(labels.length / 6)) === 0)
    .map((d, i) => `<text x="${45 + i * 85}" y="165">${esc(d.slice(5))}</text>`)
    .join("")}${chartSamples(points,labels,values.map(v=>v.toLocaleString("es-CL")))}</svg>`;
}
function liveMetric(kind: string): {
  stats: string[][];
  source: string;
  note: string;
  values: number[];
  labels: string[];
} | null {
  if (kind === "seo" && seoReport) {
    const rows = seoReport.rows as {
      clicks: number;
      impressions: number;
      keys: string[];
    }[];
    const clicks = rows.reduce((s, r) => s + r.clicks, 0),
      impressions = rows.reduce((s, r) => s + r.impressions, 0);
    return {
      stats: [
        ["Clics orgánicos", String(clicks)],
        ["Impresiones", String(impressions)],
        [
          "CTR",
          impressions ? ((100 * clicks) / impressions).toFixed(2) + "%" : "0%",
        ],
      ],
      source: "Search Console",
      note: `Datos de Search Console: ${seoReport.start} al ${seoReport.end}. Google puede publicar sus métricas con retraso.`,
      values: rows.map((r) => r.clicks),
      labels: rows.map((r) => r.keys[0]),
    };
  }
  if (kind === "carts" && cartsReport) {
    const rows = cartsReport.rows as {
      count: string;
      value: string;
      date: string;
    }[];
    return {
      stats: [
        [
          "Carros abandonados",
          String(rows.reduce((s, r) => s + Number(r.count), 0)),
        ],
        [
          "Valor potencial",
          new Intl.NumberFormat("es-CL", {
            style: "currency",
            currency: cartsReport.currency,
          }).format(rows.reduce((s, r) => s + Number(r.value), 0)),
        ],
        ["Ventana de medición", "30 días"],
      ],
      source: "WooCommerce · Orbital",
      note: "Carros con más de 30 minutos de inactividad. Datos capturados desde la instalación del plugin Orbital Business Metrics; no incluyen historial anterior.",
      values: rows.map((r) => Number(r.count)),
      labels: rows.map((r) => r.date),
    };
  }
  return null;
}
function renderAnalytics() {
  const live = liveMetric(analyticsKind);
  if (live) {
    $("#analytics-content").innerHTML =
      `<div class="analytics-content-inner"><div class="analytics-stats">${live.stats.map(([l, v]) => `<div class="analytics-stat"><small>${esc(l)}</small><strong>${esc(v)}</strong></div>`).join("")}</div><div class="chart-wrap">${seriesChart(live.values, live.labels)}</div><p class="analytics-note">${esc(live.note)}</p></div>`;
    return;
  }
  if (analyticsKind === "sales" && commerceReport) {
    const money = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: state.settings.currency,
      maximumFractionDigits: 0,
    });
    $("#analytics-content").innerHTML =
      `<div class="analytics-content-inner"><div class="analytics-stats"><div class="analytics-stat"><small>Ventas de WooCommerce</small><strong>${esc(money.format(Number(commerceReport.total_sales)))}</strong></div><div class="analytics-stat"><small>Pedidos</small><strong>${esc(commerceReport.total_orders)}</strong></div></div><div class="chart-wrap">${realSalesChart()}</div><p class="analytics-note">Ventas consultadas desde WooCommerce. Las métricas SEO y de carros siguen en modo de ejemplo.</p></div>`;
    return;
  }
  const meta =
    analyticsKind === "seo"
      ? [
          ["Visibilidad de ejemplo", "78 / 100"],
          ["Sesiones orgánicas", "2.481"],
          ["Clics orgánicos", "864"],
        ]
      : analyticsKind === "carts"
        ? [
            ["Carros de ejemplo", "12"],
            ["Valor potencial", "$384.900"],
            ["Tasa de abandono", "24,6%"],
          ]
        : [
            ["Ventas de ejemplo", "$2.845.900"],
            ["Pedidos", "128"],
            ["Ticket promedio", "$22.234"],
          ];
  $("#analytics-content").innerHTML =
    `<div class="analytics-content-inner"><div class="analytics-stats">${meta.map(([l, v]) => `<div class="analytics-stat"><small>${l}</small><strong>${v}</strong></div>`).join("")}</div><div class="chart-wrap">${chart(analyticsKind,analyticsKind==="sales"&&$<HTMLSelectElement>("#sales-period").value==="week")}</div><p class="analytics-note">${analyticsKind === "seo" ? "Para métricas SEO reales se necesita Google Search Console. WooCommerce no proporciona visibilidad orgánica." : analyticsKind === "carts" ? "El registro de carros abandonados requiere un plugin de captura y el consentimiento correspondiente en tu tienda." : "Datos de ejemplo. Configura la conexión de WooCommerce para consultar las ventas de tu negocio."}</p></div>`;
}
const integrations = [
  {
    id: "payload",
    name: "Payload CMS",
    logo: "P",
    color: "#eceaf6",
    text: "#6d5b9b",
    description:
      "Vincula tu tienda en Payload CMS y verifica el acceso a su API.",
    detail:
      "Conexión cifrada. Importar ventas y pedidos requiere mapear los campos de tu tienda.",
  },
  {
    id: "shopify",
    name: "Shopify",
    logo: "S",
    color: "#edf4df",
    text: "#638331",
    description:
      "Conecta la tienda de Shopify con tu negocio y valida su cuenta de Admin API.",
    detail:
      "Dominio myshopify.com y token de Admin API. Conexión cifrada y verificada.",
  },
  {
    id: "woo",
    name: "WooCommerce",
    logo: "woo",
    color: "#eee7f4",
    text: "#9b81af",
    description:
      "El pulso de tu tienda: ventas, pedidos y productos, sin salir de tu espacio.",
    detail: "Requiere URL y claves REST por negocio.",
  },
  {
    id: "google",
    name: "Google Calendar",
    logo: "G",
    color: "#edf1f9",
    text: "#7a98c1",
    description:
      "Conecta tus eventos a Calendar y consulta el SEO de tu sitio con Search Console.",
    detail: "Requiere OAuth de Google. Puedes exportar eventos .ics.",
  },
  {
    id: "email",
    name: "Correo electrónico",
    logo: "✉",
    color: "#f2eee2",
    text: "#b5a16b",
    description:
      "Recordatorios de deadlines y novedades importantes directo a tu bandeja.",
    detail: "Requiere proveedor de correo y un proceso programado.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    logo: "◉",
    color: "#eaf2e5",
    text: "#88a96c",
    description:
      "Haz que los avisos importantes lleguen donde tu equipo ya conversa.",
    detail: "Requiere Meta Cloud API y plantillas aprobadas.",
  },
];
function renderIntegrations() {
  $("#integrations-grid").innerHTML = integrations.map(i => {
    const conflict = blockedStore(i.id, connectedProviders), connected = connectedProviders.includes(i.id);
    return `<article class="integration-card ${conflict ? "is-blocked" : ""}"><div class="integration-card-head"><span class="integration-logo" style="background:${i.color};color:${i.text}">${i.logo}</span><span class="integration-status">${connected ? "Conectada" : conflict ? "No disponible" : "Pendiente de configuración"}</span></div><h2>${i.name}</h2><p>${i.description}</p><div class="integration-actions"><button class="button secondary" data-integration="${i.id}" ${conflict ? 'disabled aria-describedby="store-lock-'+i.id+'"' : ""}>${connected ? "Actualizar conexión" : "Configurar conexión"} ↗</button>${connected && isStoreProvider(i.id) ? `<button class="button secondary disconnect-store" data-disconnect-store="${i.id}">Desconectar</button>` : ""}</div><div class="integration-detail" ${conflict ? 'id="store-lock-'+i.id+'"' : ""}>${conflict ? esc(storeConflictMessage(conflict)) : i.detail}</div></article>`;
  }).join("");
}
function disconnectStore(provider: string) {
  if (!cloud || !isAdmin(actor()) || !isStoreProvider(provider) || !connectedProviders.includes(provider)) return;
  modal(`<h2>¿Desconectar ${storeNames[provider]}?</h2><p>Podrás elegir otra plataforma para tu tienda o volver a conectar esta cuando quieras.</p><p class="auth-error" id="disconnect-store-error" role="alert"></p><div class="dialog-actions"><button class="button secondary" data-close>Cancelar</button><button class="button primary" id="confirm-store-disconnect">Desconectar</button></div>`);
  $("#confirm-store-disconnect").onclick = async () => {
    const button = $<HTMLButtonElement>("#confirm-store-disconnect"); button.disabled = true;
    try {
      await api("integrations", {method:"DELETE",body:JSON.stringify({provider})});
      await loadConnections(true); close(); renderIntegrations(); notify(`${storeNames[provider]} desconectado. Ya puedes elegir otra plataforma.`);
    } catch(error) { $("#disconnect-store-error").textContent = error instanceof Error ? error.message : "No pudimos desconectar la tienda."; }
    finally { button.disabled = false; }
  };
}
function integrationInfo(id: string) {
  const conflict = blockedStore(id, connectedProviders);
  if (conflict) { notify(storeConflictMessage(conflict)); return; }
  const i = integrations.find((x) => x.id === id) || integrations[0];
  const setupHelp = id === "google"
    ? `<details class="integration-setup"><summary>Qué necesitas para Google Meet</summary><ol><li>Una cuenta de negocio activa en este SaaS.</li><li>Un proyecto de Google Cloud con Calendar API habilitada y un cliente OAuth de aplicación web.</li><li>Registrar <code>${esc(location.origin)}/api/saas/google/callback</code> como URI de redirección.</li><li>Configurar las credenciales de Google en el servidor y conectar tu cuenta desde esta sección.</li></ol><p>La cuenta organizadora debe poder crear reuniones de Meet y los invitados deben tener su correo en el equipo.</p></details>`
    : id === "woo" ? `<details class="integration-setup"><summary>Qué necesitas para WooCommerce</summary><ol><li>Una cuenta de negocio activa en este SaaS.</li><li>Una clave de lectura creada en WooCommerce → Ajustes → Avanzado → API REST.</li><li>La dirección HTTPS de tu tienda. Para esta instalación local: <code>https://tienda.local</code>.</li></ol><p>Las tiendas locales deben estar encendidas en tu equipo. En una instalación publicada, el servidor también necesitará acceso a esa tienda.</p></details>` : "";
  if (!cloud) {
    modal(
      `<div class="eyebrow">CONECTA TU NEGOCIO</div><h2>${i.name}</h2><p>${i.description}</p><p>Estás explorando una demo local. Inicia sesión con una cuenta de negocio para guardar credenciales y activar conexiones reales.</p>${setupHelp}<div class="dialog-actions"><button class="button secondary" data-close>Seguir explorando</button><a href="/acceso" class="button primary" style="display:flex;align-items:center;justify-content:center">Iniciar sesión ↗</a></div>`,
    );
    return;
  }
  if (id === "google") {
    modal(
      `<h2>Tu tiempo, conectado.</h2><p>Conecta Google para enviar eventos a Calendar y consultar el posicionamiento de tu sitio con Search Console. Google te pedirá permiso antes de conectar.</p>${setupHelp}<button class="button primary" id="connect-google">Continuar con Google ↗</button><p id="integration-error" class="auth-error" role="alert"></p>${connectedProviders.includes("google") ? '<form id="seo-form"><label>Propiedad de Search Console<input name="property" required placeholder="sc-domain:tutienda.cl"/></label><button class="button secondary">Guardar propiedad SEO</button></form>' : ""}`,
    );
    if (connectedProviders.includes("google"))
      $("#seo-form").onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api("seo", {
            method: "POST",
            body: JSON.stringify(
              Object.fromEntries(new FormData(e.target as HTMLFormElement)),
            ),
          });
          await loadConnections();
          close();
          notify("Propiedad SEO guardada.");
        } catch (e) {
          $("#integration-error").textContent =
            e instanceof Error ? e.message : "No se pudo guardar";
        }
      };
    $("#connect-google").onclick = async () => {
      try {
        const r = await api("google/start", { method: "POST", body: "{}" });
        location.href = r.url;
      } catch (e) {
        $("#integration-error").textContent =
          e instanceof Error ? e.message : "No se pudo iniciar la conexión";
      }
    };
    return;
  }
  const fields =
    id === "payload"
      ? [
          ["url", "URL de Payload CMS", "url", "https://tienda.ejemplo.cl"],
          ["token", "API key de lectura", "password", "API key de la tienda"],
          ["authCollection", "Colección de usuarios", "text", "users"],
          ["products", "Colección de productos", "text", "products"],
          ["orders", "Colección de pedidos", "text", "orders"],
        ]
      : id === "shopify"
        ? [
            ["shop", "Dominio de Shopify", "text", "tu-tienda.myshopify.com"],
            [
              "token",
              "Token de Admin API",
              "password",
              "Token de acceso de tu aplicación",
            ],
          ]
        : id === "woo"
          ? [
              ["url", "URL de tu tienda", "url", "https://tutienda.cl"],
              ["key", "Consumer key", "password", "ck_…"],
              ["secret", "Consumer secret", "password", "cs_…"],
            ]
          : id === "email"
            ? [
                ["token", "API key de Resend", "password", "re_…"],
                [
                  "from",
                  "Remitente verificado",
                  "email",
                  "avisos@tunegocio.cl",
                ],
                [
                  "to",
                  "Correo para recordatorios",
                  "email",
                  "equipo@tunegocio.cl",
                ],
              ]
            : [
                [
                  "token",
                  "Token de Meta Cloud API",
                  "password",
                  "Token de acceso",
                ],
                [
                  "phoneId",
                  "Phone number ID",
                  "text",
                  "Identificador del número de Meta",
                ],
                ["to", "WhatsApp de destino", "tel", "56912345678"],
                [
                  "template",
                  "Nombre de plantilla aprobada",
                  "text",
                  "deadline_reminder",
                ],
                ["language", "Idioma de la plantilla", "text", "es"],
              ];
  modal(
    `<h2>${i.name}</h2><p>${id === "payload" ? "Validaremos tu API key y la lectura de las colecciones de productos y pedidos. El dominio debe estar autorizado en el servidor." : id === "shopify" ? "Introduce el dominio myshopify.com y un token de Admin API de una aplicación instalada en tu tienda. Validaremos la conexión antes de guardarla." : id === "woo" ? "Conecta una clave de solo lectura. El dominio de tu tienda debe estar autorizado en el servidor." : id === "email" ? "Configura un remitente verificado de Resend y un correo que recibirá los avisos de deadlines." : "Configura Meta Cloud API con un destinatario autorizado y una plantilla aprobada con una variable para el título de la tarea."}</p>${setupHelp}<form id="integration-form">${fields.map(([key, label, type, placeholder]) => `<label>${label}<input name="${key}" type="${type}" placeholder="${placeholder}" required autocomplete="off" maxlength="2048"/></label>`).join("")}<p>Las credenciales se cifran antes de guardarse. ${id === "email" || id === "whatsapp" ? "Los envíos automáticos requieren que el proceso de recordatorios esté activo." : ""}</p><p class="auth-error" id="integration-error" role="alert"></p><button class="button primary" type="submit">Guardar conexión</button></form>`,
  );
  $("#integration-form").onsubmit = async (e) => {
    e.preventDefault();
    const button = $<HTMLButtonElement>("#integration-form button");
    button.disabled = true;
    try {
      const credentials = Object.fromEntries(
        new FormData(e.target as HTMLFormElement),
      );
      await api("integrations", {
        method: "POST",
        body: JSON.stringify({ provider: id, credentials }),
      });
      await loadConnections(true);
      close();
      renderIntegrations();
      notify("Conexión guardada para tu negocio.");
    } catch (e) {
      $("#integration-error").textContent =
        e instanceof Error ? e.message : "No se pudo guardar";
      await loadConnections(); renderIntegrations();
    } finally {
      button.disabled = false;
    }
  };
}
async function loadConnections(strict = false) {
  if (!isAdmin(actor())) return;
  const request = ++connectionsRequest;
  try {
    const data = await api("integrations");
    if (request !== connectionsRequest) return;
    const next = data.connected || [];
    const oldStore = connectedProviders.find(isStoreProvider), newStore = next.find(isStoreProvider);
    connectedProviders = next;
    if (oldStore !== newStore) { storeConnectionVersion++; commerceReport = null; cartsReport = null; advanced?.invalidateCommerce(); }
    if (connectedProviders.includes("woo")) {
      await loadCommerce();
      try {
        const carts = await api("carts");
        if (request === connectionsRequest && connectedProviders.includes("woo") && carts.connected) cartsReport = carts;
      } catch {}
    }
    if (connectedProviders.includes("google")) {
      try {
        const seo = await api("seo");
        if (seo.connected) seoReport = seo;
      } catch {}
    }
    render();
  } catch(error) { if (strict) throw error; }
}
async function loadCommerce() {
  const version = storeConnectionVersion;
  try {
    const data = await api(
      "commerce?period=" +
        ($<HTMLSelectElement>("#sales-period").value === "week"
          ? "week"
          : "month"),
    );
    if (version !== storeConnectionVersion || !connectedProviders.includes("woo")) return;
    if (data.connected) {
      commerceReport = data.report;
      render();
    }
  } catch {
    notify(
      "No se pudo actualizar WooCommerce. La vista de ejemplo sigue identificada.",
    );
  }
}

function render() {
  if (activeView !== "blocked" && !canView(actor(), viewSection(activeView))) {
    show(activeView);
    return;
  }
  document.body.classList.toggle(
    "canvas-fullscreen",
    activeView === "canvas" && canvasOpen,
  );
  renderCommon();
  if (activeView === "overview") {renderOverview();planning?.renderOverview();}
  if (activeView === "tasks") {
    renderBoardHome();
    if (boardOpen) {work?.render();renderTasks();}
    else planning?.renderTasks();
  }
  if (activeView === "canvas") renderCanvas();
  if (activeView === "calendar") renderCalendar();
  if (activeView === "pages") renderPages();
  if (activeView === "search") searchFeature?.render();
  if (activeView === "event") renderEventDetail();
  if (activeView === "private") renderPrivate();
  if (activeView === "task" || activeView === "page") renderDetail();
  if (activeView === "analytics") renderAnalytics();
  if (activeView === "integrations") renderIntegrations();
  if (activeView === "team") void features.renderTeam();
  if (activeView === "polls") void features.polls.render();
  if (activeView === "vault") void features.renderVault();
  if (activeView === "trash") void trash.render();
  if (activeView === "private-index") renderPrivateIndex();
  if (activeView === "modules") moduleView?.render();
  advanced?.render(activeView);
  workspaceFiles?.render(activeView);
  preferences?.render();
}
function createMenu() {
  modal(
    '<h2>¿Qué tienes en mente?</h2><p>Cada idea tiene su lugar. Elige por dónde empezar.</p><div class="create-grid"><button data-action="new-task">☑ Tarea<span>Un paso hacia tu objetivo</span></button><button data-action="new-note">✧ Nota en el lienzo<span>Captura una buena idea</span></button><button data-action="new-page">▤ Nota<span>Dale espacio al conocimiento</span></button><button data-action="new-event">▦ Evento<span>Reserva un momento</span></button><button data-action="new-sales">↗ Ventas de ejemplo<span>Una referencia en tu lienzo</span></button><button data-action="image">▧ Imagen<span>Una imagen dice más</span></button></div>',
  );
}
function download(name: string, value: string, type = "application/json") {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([value], { type }));
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function undo() {
  const previous = undoStack.pop();
  if (previous) {
    const current=state;
    redoStack.push(JSON.stringify(current));
    state = JSON.parse(previous);
    retainWorkOnUndo(state,current);
    save();
    render();
    notify("Cambio deshecho.");
  }
}
function redo() {
  if (activeView !== "canvas" || !canvasOpen || !canWrite(actor(),"canvas")) return;
  const next = redoStack.pop();
  if (!next) return;
  const current = state;
  undoStack.push(JSON.stringify(current));
  state = JSON.parse(next);
  retainWorkOnUndo(state,current);
  save(); render(); notify("Cambio rehecho.");
}
function ensurePrivateBoards() {
  const id = "private-" + actor().id;
  if (
    state.tasks.some(
      (t) => t.privateOwner === String(actor().id) && (t.boardId || id) === id,
    ) &&
    !state.boards?.some((b) => b.id === id)
  ) {
    state.boards ??= [];
    state.boards.push({
      id,
      name: "Mis tareas",
      description: "Mis pendientes personales.",
      color: "green",
      createdAt: new Date().toISOString(),
      privateOwner: String(actor().id),
    });
    save();
  }
}
function createPrivateElement(kind: typeof privateKind) {
  if (
    !canWrite(
      actor(),
      ({ spaces: "canvas", tasks: "tasks", pages: "pages" } as const)[kind],
    )
  )
    return;
  close();
  privateKind = kind;
  if (kind === "spaces") spaceEditor(true);
  else if (kind === "tasks") boardEditor(true);
  else newNote(true);
}
function createPrivate(kind: typeof privateKind) {
  const enabled = privateSections();
  if (
    !enabled.includes(kind) &&
    !canWrite(
      actor(),
      ({ spaces: "canvas", tasks: "tasks", pages: "pages" } as const)[kind],
    )
  ) {
    notify("Tu rol no permite crear contenido en esta sección.");
    return;
  }
  if (!enabled.includes(kind))
    preferences.update({ privateSections: [...enabled, kind] });
  privateKind = kind;
  close();
  show("private");
  if (!enabled.includes(kind)) createPrivateElement(kind);
}
function privateCreateMenu() {
  const enabled = privateSections();
  modal(
    `<h2>Tu área privada</h2><p>Agrega una sección de cada tipo. Dentro puedes crear tantos elementos como necesites.</p><div class="create-grid">${(["spaces", "tasks", "pages"] as const).map((k) => `<button data-private-create="${k}"><span class="sidebar-section-icon sidebar-section-${{spaces:"espacios",tasks:"tareas",pages:"notas"}[k]}" aria-hidden="true"></span>${{ spaces: "Espacios", tasks: "Tareas", pages: "Notas" }[k]}<span>${enabled.includes(k) ? "Abrir mi grilla" : "Agregar a mi área privada"}</span></button>`).join("")}</div>`,
  );
}
function renderPrivateIndex() {
  const host = $("#private-index-content");
  host.innerHTML = `<div class="page-heading compact"><div><h1>Mi área privada</h1><p>Solo tú puedes ver lo que guardas aquí.</p></div><button class="button primary" data-action="private-create">Agregar sección</button></div><div class="private-grid">${
    privateSections()
      .map(
        (k) =>
          `<button class="task-project-card" data-private-kind="${k}">${uiIcon({ spaces: "brain", tasks: "tasks", pages: "note" }[k], 28)}<h2>${{ spaces: "Espacios", tasks: "Tareas", pages: "Notas" }[k]}</h2><p>${{ spaces: "Conecta tus ideas en un lienzo.", tasks: "Organiza tus pendientes en tableros.", pages: "Guarda tus notas, guías y planes." }[k]}</p><span>Abrir mi grilla ↗</span></button>`,
      )
      .join("") ||
    '<p class="empty-state">Elige qué quieres agregar: Espacios, Tareas o Notas.</p>'
  }</div>`;
}
function renderPrivate() {
  const labels = {
    spaces: "Espacios privados",
    tasks: "Mis tableros",
    pages: "Notas",
  };
  $("#private-title").textContent = labels[privateKind];
  document.querySelector<HTMLElement>('[data-action="private-new"]')!.innerHTML=uiIcon("plus",17)+(privateKind==="tasks"?"Nuevo tablero":privateKind==="pages"?"Crear nota":"Nuevo espacio");
  let privateDescription=document.querySelector<HTMLElement>("#private-title + p");if(privateDescription)privateDescription.textContent=privateKind==="tasks"?"Organiza el trabajo diario y los proyectos.":privateKind==="pages"?"Tus ideas y apuntes, en un solo lugar.":"Conecta tus ideas en un lienzo privado.";
  document.querySelector<HTMLElement>(
    '[data-panel="private"] [data-trash-section]',
  )!.dataset.trashSection = (
    { spaces: "canvas", tasks: "tasks", pages: "pages" } as const
  )[privateKind];
  const writable = canWrite(
    actor(),
    ({ spaces: "canvas", tasks: "tasks", pages: "pages" } as const)[
      privateKind
    ],
  );
  document.querySelector<HTMLElement>('[data-action="private-new"]')!.hidden =
    !writable;
  const items = (
    privateKind === "tasks" ? state.boards || [] : state[privateKind]
  ).filter((i) => i.privateOwner === String(actor().id));
  const key = ({spaces:"private-spaces",tasks:"private-tasks",pages:"private-notes"} as const)[privateKind];
  const kind = ({spaces:"spaces",tasks:"boards",pages:"pages"} as const)[privateKind];
  const viewClass = {spaces:"space-directory",tasks:"task-project-grid",pages:"pages-grid"}[privateKind];
  directories.render(key, items, kind, "private-grid", "private-directory-toolbar", "private-pagination", viewClass,
    (item,f)=>privateKind==="spaces" ? spaceCard(state,item as Space,f) : privateKind==="tasks" ? boardCard(state,item as TaskBoard,f) : noteCard(state,item as Page,canWrite(actor(),"canvas"),f));
}
function openDetail(kind: "task" | "page", id: string,personalOrigin=false) {
  const item = (kind === "task" ? state.tasks : state.pages).find(
    (i) => i.id === id && isMine(i.privateOwner),
  );
  if (!item) return;
  if(kind==="task")returnToPersonalTasks=personalOrigin||(activeView==="tasks"&&personalTasksOpen)||(routing&&new URLSearchParams(location.search).get("origen")==="mis-tareas");
  detailId = id;
  show(kind);
}
document.addEventListener("click", event=>{
  const button=(event.target as Element).closest<HTMLElement>("[data-canvas-note]");
  if (!button || !canView(actor(),"pages")) return;
  const id=button.dataset.canvasNote!;
  if(!state.pages.some(page=>page.id===id&&isMine(page.privateOwner)))return;
  const origin=button.closest("[data-node]")?.querySelector<HTMLElement>("[data-inline-title]");
  if(!origin || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    openDetail("page",id);return;
  }
  origin.style.viewTransitionName="canvas-note-title";
  let destination: HTMLElement|null=null;
  const transition=document.startViewTransition(()=>{
    origin.style.viewTransitionName="";
    openDetail("page",id);
    destination=document.querySelector<HTMLElement>("#page-detail h1");
    if(destination) destination.style.viewTransitionName="canvas-note-title";
  });
  void transition.finished.finally(()=>{origin.style.viewTransitionName="";if(destination) destination.style.viewTransitionName="";}).catch(()=>{});
});
function renderDetail() {
  const kind = activeView === "task" ? "task" : "page",
    item = (kind === "task" ? state.tasks : state.pages).find(
      (i) => i.id === detailId && isMine(i.privateOwner),
    );
  const host = $("#" + kind + "-detail");
  if (!item) {
    host.innerHTML =
      '<p class="empty-state">Este elemento ya no está disponible.</p>';
    return;
  }
  const body = "description" in item ? item.description : item.body;
  const editable = canWrite(actor(), kind === "task" ? "tasks" : "pages");
  const attrs = (field: string) =>
    `data-entity-kind="${kind}" data-entity-id="${item.id}" data-entity-field="${field}" data-placeholder="${field === "body" ? "Escribe aquí…" : "Título"}" ${field === "body" ? 'data-rich-editor="true"' : ""} ${editable ? `contenteditable="${field === "title" ? "plaintext-only" : "true"}" role="textbox" aria-label="${field === "title" ? "Título" : "Contenido"}"` : ""}`;
  const linkedResources = work?.linkMarkup(item.links,item.privateOwner,{kind:kind==="task"?"tasks":"pages",id:item.id})||"";
  const related = `<section class="work-section detail-related"><h2>Vínculos y adjuntos</h2><div class="linked-resources">${linkedResources || '<p class="resource-empty">Todavía no hay vínculos ni archivos adjuntos.</p>'}</div><div class="work-actions related-create-actions">${editable?`<button class="button secondary" data-work-relations="${kind==="task"?"tasks":"pages"}" data-id="${item.id}" aria-label="Vincular contenido">${uiIcon("link",15)}Vincular</button>${!item.privateOwner&&canView(actor(),"files")?`<button class="button secondary" data-work-attachments="${kind==="task"?"tasks":"pages"}" data-id="${item.id}" aria-label="Adjuntar archivo">${uiIcon("plus",15)}Adjuntar</button>`:""}`:""}</div></section>`;
  const content = `<article class="panel entity-content" ${attrs("body")}>${kind==="task"&&(item as Task).descriptionHtml?sanitizeRichText((item as Task).descriptionHtml!):"bodyHtml" in item && item.bodyHtml ? sanitizeRichText(item.bodyHtml) : esc(body)}</article>`;
  const comments = `<section class="work-section task-detail-comments"><h2>Comentarios</h2>${features.commentPreview(item.id)}<button class="button primary" data-task-comments="${item.id}">Ver y escribir comentarios</button></section>`;
  const task = kind === "task" ? item as Task : undefined;
  const metadata = task ? `<dl class="task-detail-meta"><div class="task-summary-state"><dt>Estado</dt><dd>${{todo:"Por hacer",doing:"En progreso",done:"Completada"}[task.status]}</dd></div><div><dt>Vencimiento</dt><dd>${task.due?`<time datetime="${esc(task.due)}">${esc(relativeDue(task.due))}</time>`:"Sin fecha"}</dd></div><div><dt>Prioridad</dt><dd>${task.priority==="high"?"Alta":"Normal"}</dd></div></dl>${task.assigneeId?`<p class="task-detail-assignee">Responsable: ${esc(features.directory().find(member=>String(member.id)===task.assigneeId)?.name||"Miembro del equipo")}</p>`:""}` : "";

  host.innerHTML = `<button class="back-link" data-action="back-detail">← Volver a ${kind==="task"&&returnToPersonalTasks?"mis tareas":item.privateOwner ? "mi área privada" : kind === "task" ? "tareas" : "notas"}</button><div class="page-heading compact detail-page-heading"><div class="note-title-container"><div class="board-title-line"><h1 ${attrs("title")}>${esc(item.title)}</h1>${task?`<span class="work-mode-badge">${workModes[modeOf(state.boards?.find(b=>b.id===task.boardId)||{})]}</span>`:""}</div><p>${item.privateOwner ? "Solo tú puedes ver este contenido." : "Compartido con tu equipo."}</p></div>${editable ? `<button class="button primary detail-options" data-action="edit-detail">${task?"Editar tarea":"Opciones"}</button>` : ""}</div>${metadata}${task?`<div class="task-detail-layout"><div class="task-detail-main"><section class="task-detail-description"><h2>Descripción</h2>${content}</section>${comments}</div><aside class="task-detail-side" aria-label="Recursos de la tarea">${related}</aside></div>`:`<span class="editor-field-label note-content-label">Contenido</span>${content}${related}<p class="section-note">Actualizada: ${new Date((item as Page).updated).toLocaleString("es-CL")} · ${(item as Page).authorId===String(actor().id)?"Por ti":(item as Page).authorId?"Autor del equipo":"Nota existente"}</p>`}`;

}
function searchDialog() {
  searchFeature.open();
}
function openEventDetail(id: string) {
  if (!canView(actor(), "calendar") || !state.events.some((e) => e.id === id))
    return;
  detailId = id;
  show("event");
}
function renderEventDetail() {
  const event = state.events.find((e) => e.id === detailId);
  if (!event) return;
  $("#event-detail").innerHTML =
    `<button class="back-link" data-view="calendar">← Volver al calendario</button><div class="page-heading compact"><div><h1>${esc(event.title)}</h1><p>${esc(event.date)} · ${esc(event.time)}</p></div>${canWrite(actor(), "calendar") ? `<button class="button primary" data-edit-event="${esc(event.id)}">Editar</button>` : ""}</div><article class="panel entity-content">${esc(event.description || "Sin descripción.")}</article>`;
}
function spaceEditor(privateArea = false, editId?: string) {
  if (!canWrite(actor(), "canvas")) return;
  const existing = state.spaces.find(
    (s) => s.id === editId && isMine(s.privateOwner),
  );
  modal(
    '<h2>Nuevo espacio</h2><p>Ponle un nombre para encontrarlo fácilmente después.</p><form id="space-form"><label>Nombre del espacio<input name="name" maxlength="60" required placeholder="Por ejemplo, nueva colección"/></label><button class="button primary">Crear espacio</button></form>',
  );
  if (existing) {
    $("#dialog-content h2").textContent = existing.folder ? "Renombrar carpeta" : "Editar espacio";
    $("#space-form button").textContent = "Guardar espacio";
    $<HTMLInputElement>('#space-form [name="name"]').value = existing.name;
  }
  $("#space-form").onsubmit = (e) => {
    e.preventDefault();
    const name = String(
      new FormData(e.target as HTMLFormElement).get("name"),
    ).trim();
    if (!name) return;
    const id = existing?.id || uid();
    mutate(() => {
      if (existing) {
        existing.name = name;
        return;
      }
      directories.reset(privateArea ? "private-spaces" : "spaces");
      state.spaces.push({
        id,
        createdAt: new Date().toISOString(),
        name,
        privateOwner: privateArea ? String(actor().id) : undefined,
        color: state.spaces.length % 2 ? "orange" : "green",
      });
    });
    close();
    openSpace(id);
  };
}
function openPersonalTasks(){personalTasksOpen=true;boardOpen=false;returnToPersonalTasks=false;show("tasks",true);}
function openBoard(id: string) {
  personalTasksOpen=false;returnToPersonalTasks=false;
  if (!state.boards?.some((b) => b.id === id && isMine(b.privateOwner))) return;
  activeBoard = id;
  boardOpen = true;
  show("tasks", true);
}
function renderBoardHome() {
  $("#personal-tasks-home").hidden=!personalTasksOpen||boardOpen;
  $("#task-projects-home").hidden = boardOpen||personalTasksOpen;
  $("#task-board-editor").hidden = !boardOpen;
  if (boardOpen) return;
  if(personalTasksOpen){home?.renderPersonalTasks();return;}
  directories.render("tasks", (state.boards||[]).filter(i=>!i.privateOwner), "boards", "task-project-grid", "tasks-directory-toolbar", "tasks-pagination", "task-project-grid", (i,f)=>boardCard(state,i,f));
}
function boardEditor(privateArea = false) {
  if (!canWrite(actor(), "tasks")) return;
  modal(
    `<h2>Nuevo tablero</h2><p>Organiza el trabajo diario y los proyectos.</p><form id="board-form"><label>Nombre<input name="name" required maxlength="80" placeholder="Por ejemplo, lanzamiento de verano"/></label><label>Descripción (opcional)<textarea name="description" maxlength="2000"></textarea></label>${workModeField()}<button class="button primary">Crear tablero</button></form>`,
  );
  $("#board-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement),
      id = uid();
    if(!String(f.get("name")||"").trim()){notify("Ponle un nombre al tablero.");return;}
    directories.reset(privateArea ? "private-tasks" : "tasks");
    mutate(
      () =>
        (state.boards = [
          ...(state.boards || []),
          {
            id,
            name: String(f.get("name")).trim(),
            description: String(f.get("description")),
            privateOwner: privateArea ? String(actor().id) : undefined,
            color: "green",
            work:{mode:String(f.get("workMode")||"daily") as WorkMode,cycles:[],periods:[]},
            createdAt: new Date().toISOString(),
          },
        ]),
    );
    close();
    openBoard(id);
  };
}
let blockPointer:
  | {
      id: number;
      kind: CanvasNode["kind"] | "frame";
      x: number;
      y: number;
      moved: boolean;
    }
  | undefined;
let ignoreBlockClickUntil = 0;
document.addEventListener("pointerdown", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-add-block]");
  if (!b || !canWrite(actor(), "canvas")) return;
  e.preventDefault();
  blockPointer = {
    id: e.pointerId,
    kind: b.dataset.addBlock as CanvasNode["kind"] | "frame",
    x: e.clientX,
    y: e.clientY,
    moved: false,
  };
  b.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove", (e) => {
  if (!blockPointer || e.pointerId !== blockPointer.id) return;
  if (
    Math.abs(e.clientX - blockPointer.x) +
      Math.abs(e.clientY - blockPointer.y) >
    6
  )
    blockPointer.moved = true;
  if (blockPointer.moved) $("#canvas-frame").classList.add("adding-block");
});
document.addEventListener("pointerup", (e) => {
  if (!blockPointer || e.pointerId !== blockPointer.id) return;
  const drag = blockPointer;
  blockPointer = undefined;
  $("#canvas-frame").classList.remove("adding-block");
  if (drag.moved) {
    const rect = $("#canvas-frame").getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    )
      addBlock(drag.kind, {
        x: (e.clientX - rect.left - camera.x) / camera.z,
        y: (e.clientY - rect.top - camera.y) / camera.z,
      });
    ignoreBlockClickUntil = Date.now() + 400;
  } else {
    addBlock(drag.kind);
    ignoreBlockClickUntil = Date.now() + 400;
  }
});
document.addEventListener("pointercancel", () => {
  blockPointer = undefined;
  $("#canvas-frame").classList.remove("adding-block");
});
const actions: Record<string, () => void> = {
  create: createMenu,
  "new-task": () => {
    close();
    if (activeView !== "tasks" || !boardOpen)
      activeBoard = state.boards?.find((b) => !b.privateOwner)?.id || "general";
    boardOpen = true;
    show("tasks", true);
    work?.toBoard();
    inline.newTask();
  },
  "private-home": () => show("private-index"),
  "toggle-task-comments": () =>
    preferences.update({
      showTaskComments: preferences.get()?.showTaskComments === false,
    }),
  "delete-space": () => {
    if (!canWrite(actor(), "canvas")) return;
    const space = state.spaces.find((s) => s.id === activeSpace);
    if (!space) return;
    const spaces = new Set([space.id]);
    for (const parentId of spaces) {
      for (const child of state.spaces) {
        if (child.folder?.parentId === parentId && isMine(child.privateOwner)) spaces.add(child.id);
      }
    }
    if (space.folder) {
      const count = state.nodes.filter(node => spaces.has(node.space)).length + spaces.size - 1;
      if (!window.confirm(`¿Enviar «${space.name}» y ${count} elementos de su contenido a la papelera?`)) return;
    }
    mutate(() => {
      const ids = new Set(state.nodes.filter(node => spaces.has(node.space)).map(node => node.id));
      state.spaces = state.spaces.filter(item => !spaces.has(item.id));
      state.nodes = state.nodes.filter((n) => !ids.has(n.id));
      state.edges = state.edges.filter(
        (e) => !ids.has(e.from) && !ids.has(e.to),
      );
    });
    if (space.folder && state.spaces.some(parent => parent.id === space.folder?.parentId)) {
      openSpace(space.folder.parentId);
    } else {
      canvasOpen = false;
      show(space.privateOwner ? "private-index" : "canvas");
    }
    notify(space.folder ? "Carpeta enviada a la papelera con su contenido." : "Espacio enviado a la papelera por 30 días.");
  },
  "delete-board": () => {
    if (!canWrite(actor(), "tasks")) return;
    const wasPrivate=!!state.boards?.find(b=>b.id===activeBoard)?.privateOwner;
    mutate(() => {
      state.tasks = state.tasks.filter(
        (t) => (t.boardId || "general") !== activeBoard,
      );
      state.boards = state.boards?.filter((b) => b.id !== activeBoard);
    });
    if(wasPrivate){privateKind="tasks";show("private");}else show("tasks");
    notify("Tablero y tareas enviados a la papelera.");
  },
  "new-note": () => nodeEditor(),
  "new-page": () => newNote(),
  "new-event": () => eventEditor(),
  "new-space": () => spaceEditor(),
  "new-canvas-folder": () => toggleCanvasToolsMenu("folders"),
  "canvas-metrics": () => { if (canView(actor(), "analytics")) toggleCanvasToolsMenu("metrics"); },
  "rename-canvas-folder": () => {
    const folder = state.spaces.find(space => space.id === activeSpace && space.folder);
    if (!folder || !canWrite(actor(), "canvas")) return;
    const title = $("#canvas-title");
    if (title.querySelector("input")) return;
    const rename = title.querySelector("button");
    const input = document.createElement("input");
    input.value = folder.name;
    input.dataset.folderId = folder.id;
    input.maxLength = 60;
    input.setAttribute("aria-label", "Nombre de la carpeta");
    title.replaceChildren(input);
    let finished = false;
    const finish = (saveName: boolean, restoreFocus = false) => {
      if (finished) return;
      finished = true;
      const name = input.value.trim();
      input.remove();
      if (saveName && name && name !== folder.name && activeSpace === folder.id) {
        mutate(() => { folder.name = name; });
        const peers = state.spaces.filter(space => (space.privateOwner || "") === (folder.privateOwner || ""));
        const base = folder.privateOwner ? "/app/mi-area-privada/espacios/" : "/app/espacios/";
        writeRoute(base + entitySlug(folder, peers));
      } else if (activeSpace === folder.id && rename) title.replaceChildren(rename);
      if (restoreFocus && activeSpace === folder.id) title.querySelector("button")?.focus({preventScroll:true});
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === "Enter", true);
    });
    input.focus();
    input.select();
  },
  "canvas-shortcuts": () => toggleCanvasToolsMenu("shortcuts"),
  "close-canvas-detail": () => closeCanvasDetail(),
  "new-private-space": () => spaceEditor(true),
  "private-create": privateCreateMenu,
  "private-new": () => createPrivateElement(privateKind),
  "edit-detail": () =>
    activeView === "task" ? taskEditor(detailId) : pageEditor(detailId),
  "back-detail": () => {
    if(activeView==="task"&&returnToPersonalTasks){openPersonalTasks();return;}
    const item = (activeView === "task" ? state.tasks : state.pages).find(
      (i) => i.id === detailId,
    );
    if (item?.privateOwner) {
      privateKind = activeView === "task" ? "tasks" : "pages";
      show("private");
    } else show(activeView === "task" ? "tasks" : "pages");
  },
  "new-board": () => boardEditor(),
  "back-boards": () => {
    if (state.boards?.find((b) => b.id === activeBoard)?.privateOwner) {
      privateKind = "tasks";
      show("private");
    } else show("tasks");
  },
  "toggle-team": () => {
    const menu=$("#team-submenu");menu.hidden=!menu.hidden;document.querySelector("[data-action=toggle-team]")?.setAttribute("aria-expanded",String(!menu.hidden));
  },
  "toggle-store": () => {
    const menu = $("#store-submenu");
    menu.hidden = !menu.hidden;
    document
      .querySelector("[data-action=toggle-store]")
      ?.setAttribute("aria-expanded", String(!menu.hidden));
  },
  "new-sales": () => nodeEditor(undefined, "sales"),
  image: () => {
    close();
    $<HTMLInputElement>("#image-input").click();
  },
  search: searchDialog,
  menu: () => {
    $("#sidebar").classList.toggle("open");
    syncSidebarFocus();
  },
  business: () => show("profile"),
  profile: () => show("profile"),
  notifications: () => features.notifications(),
  "new-access": () => {
    void features.accessEditor();
  },
  "new-member": () => {
    void features.memberEditor();
  },
  "close-space": () => {
    const parentId = state.spaces.find(s => s.id === activeSpace)?.folder?.parentId;
    if (parentId && state.spaces.some(s=>s.id===parentId && isMine(s.privateOwner))) { openSpace(parentId); return; }
    if (state.spaces.find((s) => s.id === activeSpace)?.privateOwner) {
      privateKind = "spaces";
      show("private");
    } else show("canvas");
  },
  plan: () =>
    modal(
      '<div class="eyebrow">HECHO PARA CRECER CONTIGO</div><h2>Tu negocio tiene futuro.</h2><p>Esta es la base de Orbital. Los planes de pago y la facturación todavía no están habilitados.</p><p>La arquitectura separa los datos de cada negocio y permite extender el producto con límites de uso, membresías y suscripciones.</p><button class="button primary" data-close>Seguir explorando</button>',
    ),
  google: () => integrationInfo("google"),
  export: () =>
    download(
      "orbita-respaldo-" + dateKey(new Date()) + ".json",
      JSON.stringify(state, null, 2),
    ),
  import: () => $<HTMLInputElement>("#import-input").click(),
  "export-csv": () => {
    const live = liveMetric(analyticsKind);
    if (live) {
      download(
        analyticsKind + "-orbita.csv",
        "\uFEFF" +
          [
            ["fecha", "valor", "fuente"],
            ...live.values.map((v, i) => [
              live.labels[i],
              String(v),
              live.source,
            ]),
          ]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
      return;
    }
    if (analyticsKind === "sales" && commerceReport) {
      download(
        "ventas-woocommerce.csv",
        "\uFEFF" +
          [
            ["fecha", "ventas", "fuente"],
            ...Object.entries(commerceReport.totals || {}).map(([d, v]) => [
              d,
              String((v as { sales: string }).sales),
              "WooCommerce",
            ]),
          ]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
      return;
    }
    if (analyticsKind === "sales")
      download(
        "ventas-ejemplo.csv",
        "\uFEFF" +
          [
            ["fecha", "ventas_ejemplo_clp"],
            ["2026-11-01", "245900"],
            ["2026-11-05", "384900"],
            ["2026-11-10", "415800"],
            ["2026-11-15", "508600"],
            ["2026-11-20", "587900"],
            ["2026-11-25", "702800"],
          ]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
    else
      download(
        `${analyticsKind}-ejemplo.csv`,
        "\uFEFF" +
          [
            ["métrica", "valor", "fuente"],
            [
              analyticsKind === "seo" ? "visibilidad" : "carros abandonados",
              analyticsKind === "seo" ? "78" : "12",
              "datos de ejemplo",
            ],
          ]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
  },
  undo,
  redo,
  "zoom-in": () => zoom(1.2),
  "zoom-out": () => zoom(1 / 1.2),
  "zoom-reset": () => {
    camera = { x: 0, y: 0, z: 1 };
    applyCamera();
  },
  fit: () => {
    const nodes = state.nodes.filter((n) => n.space === activeSpace && (spatial?.visible(n) ?? true));
    const rects=[...nodes.map(nodeRect), ...visibleFolderRects()];
    if (!rects.length) {
      camera = { x: 0, y: 0, z: 1 };
      applyCamera();
      return;
    }
    const frame = $("#canvas-frame");
    const box = canvasBounds(rects);
    const left = frame.clientWidth > 520 ? 96 : 72;
    const top = 66;
    const width = Math.max(1, frame.clientWidth - left - 32);
    const height = Math.max(1, frame.clientHeight - top - 100);
    camera.z = Math.min(1.2, width / Math.max(1, box.width), height / Math.max(1, box.height));
    camera.x = left + (width - box.width * camera.z) / 2 - box.x * camera.z;
    camera.y = top + (height - box.height * camera.z) / 2 - box.y * camera.z;
    applyCamera();
  },
  "calendar-prev": () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  },
  "calendar-next": () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  },
  "calendar-today": () => {
    calendarDate = new Date();
    renderCalendar();
  },
};
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const b = target.closest<HTMLElement>("button,a,[data-edit-event]");
  if (!b) return;
  if (b.hasAttribute("data-close")) return close();
  if (b.dataset.openBoard) {
    openBoard(b.dataset.openBoard);
    return;
  }
  if (b.dataset.addBlock) {
    if (Date.now() > ignoreBlockClickUntil)
      addBlock(b.dataset.addBlock as CanvasNode["kind"] | "frame");
    return;
  }
  if (b.dataset.action) {
    const section = (
      {
        "delete-space": "canvas",
        "delete-board": "tasks",
        "new-task": "tasks",
        "new-note": "canvas",
        "new-sales": "canvas",
        "new-space": "canvas",
        image: "canvas",
        "new-page": "pages",
        "new-event": "calendar",
        "new-access": "vault",
        "new-member": "team",
        import: "settings",
      } as Record<string, Section>
    )[b.dataset.action];
    if (section && !canWrite(actor(), section)) {
      notify("Tu rol no permite hacer cambios en esta sección.");
      return;
    }
    actions[b.dataset.action]?.();
    return;
  }
  if (b.dataset.privateKind) {
    privateKind = b.dataset.privateKind as typeof privateKind;
      close();
    show("private");
    return;
  }
  if (b.dataset.privateCreate) {
    createPrivate(b.dataset.privateCreate as typeof privateKind);
    return;
  }

  if (b.dataset.detailType) {
    openDetail(b.dataset.detailType as "task" | "page", b.dataset.detailId!);
    return;
  }
  if (b.dataset.view) {
    close();
    show(b.dataset.view);
    return;
  }
  if (b.dataset.editSpace) {
    spaceEditor(true, b.dataset.editSpace);
    return;
  }
  if (b.dataset.space) {
    openSpace(b.dataset.space);
    return;
  }
  if (b.dataset.taskComments) {
    taskComments(b.dataset.taskComments);
    return;
  }
  if (b.dataset.deleteTask) {
    removeTask(b.dataset.deleteTask);
    return;
  }
  if (b.dataset.deleteNode) {
    removeNode(b.dataset.deleteNode);
    return;
  }
  if (b.dataset.editTask) {
    if (Date.now() < suppressTaskClickUntil) return;
    taskEditor(b.dataset.editTask);
    return;
  }
  if (b.dataset.newStatus) {
    inline.newTask(b.dataset.newStatus as Task["status"]);
    return;
  }
  if (b.dataset.connectPage) {
    connectPage(b.dataset.connectPage);
    return;
  }
  if (b.dataset.editPage) {
    pageEditor(b.dataset.editPage);
    return;
  }
  if (b.dataset.editEvent) {
    eventEditor(b.dataset.editEvent);
    return;
  }
  if (b.dataset.eventDate) {
    eventEditor(undefined, b.dataset.eventDate);
    return;
  }
  if (b.dataset.editNode) {
    nodeEditor(b.dataset.editNode);
    return;
  }
  if (b.dataset.chart) {
    chartKind = b.dataset.chart;
    $$("[data-chart]").forEach((x) =>
      x.setAttribute("aria-selected", String(x === b)),
    );
    renderOverview();
    return;
  }
  if (b.dataset.analytics) {
    analyticsKind = b.dataset.analytics;
    $$("[data-analytics]").forEach((x) =>
      x.setAttribute("aria-selected", String(x === b)),
    );
    renderAnalytics();
    return;
  }
  if (b.dataset.taskMode) {
    taskMode = b.dataset.taskMode;
    if (window.matchMedia("(max-width: 680px)").matches) mobileTaskMode = taskMode as "board" | "list";
    else preferences.update({ taskMode: taskMode as "board" | "list" });
    $$("[data-task-mode]").forEach((x) =>
      x.classList.toggle("active", x === b),
    );
    renderTasks();
    return;
  }
  if (b.dataset.tool) {
    tool = b.dataset.tool;
    frame.classList.toggle("hand-tool", tool === "hand");
    connectFrom = "";
    $$("[data-tool]").forEach(x=>{x.classList.toggle("selected",x===b);x.setAttribute("aria-pressed",String(x===b));});
    $("#canvas-frame").classList.toggle("marquee-tool",tool==="marquee");
    if (tool === "connect")
      notify("Selecciona un bloque y después otro para conectarlos.");
    return;
  }
  if (b.dataset.disconnectStore) { disconnectStore(b.dataset.disconnectStore); return; }
  if (b.dataset.integration) {
    integrationInfo(b.dataset.integration);
    return;
  }
  if (b.dataset.searchType) {
    const id = b.dataset.searchId!;
    if (b.dataset.searchType === "task") {
      close();
      openDetail("task", id);
    }
    if (b.dataset.searchType === "page") {
      close();
      openDetail("page", id);
    }
    if (b.dataset.searchType === "space") {
      close();
      openSpace(id);
    }
  }
});
document.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.toggleTask && canWrite(actor(), "tasks"))
    mutate(() => {
      const task = state.tasks.find((x) => x.id === t.dataset.toggleTask)!;
      task.status = t.checked ? "done" : "todo";
      if (t.checked) home?.removeCompleted(task.id);
    });
});
$("#sales-period").addEventListener("change", () => {
  renderOverview();
  if (cloud && connectedProviders.includes("woo")) void loadCommerce();
});
$("#task-search").addEventListener("input", renderTasks);
$("#task-filter").addEventListener("change", renderTasks);
function insertCanvasImages(files:File[],position?:{x:number;y:number}) {
  if(activeView!=="canvas"||!canvasOpen||dialog.open||!canWrite(actor(),"canvas"))return;
  const spaceId = activeSpace, personId = String(actor().id), groupId = spatial?.organization.activeGroup();
  const frame = $("#canvas-frame");
  const desired = position || {x: (frame.clientWidth / 2 - camera.x) / camera.z - 127, y: (frame.clientHeight / 2 - camera.y) / camera.z - 110};
  void (async () => {
    const prepared: string[] = [];
    notify("Preparando imágenes para el espacio…");
    for (const file of files.slice(0, 10)) {
      try { prepared.push(await prepareCanvasScreenshot(file, { maxWidth: 1600, maxLength: 1_999_990, keepSize: true })); }
      catch (error) { notify(error instanceof Error ? error.message : "No pudimos pegar el pantallazo."); }
    }
    if (!prepared.length) return;
    const space = state.spaces.find(s => s.id === spaceId && isMine(s.privateOwner));
    if (String(actor().id) !== personId || !space || !canWrite(actor(), "canvas") || activeView !== "canvas" || activeSpace !== spaceId || !canvasOpen || spatial?.organization.activeGroup() !== groupId) {
      notify("Vuelve al espacio y pega el pantallazo otra vez."); return;
    }
    const occupied = state.nodes.filter(n => n.space === spaceId).map(nodeRect), nodes: CanvasNode[] = [];
    for (const image of prepared) {
      const id = uid(), position = freePosition({id, ...desired, width: 255, height: 270}, occupied);
      nodes.push({id, space: spaceId, kind: "image", title: "Pantallazo", body: "", image, ...position});
      occupied.push({id, ...position, width: 255, height: 270});
    }
    if (!spatial?.organization.insert(nodes)) return;
    centerOnNode(nodes[nodes.length - 1].id);
    notify(nodes.length === 1 ? "Pantallazo añadido al espacio." : `${nodes.length} pantallazos añadidos al espacio.`);
  })();
}
document.addEventListener("paste",event=>{
  if(event.defaultPrevented||activeView!=="canvas"||!canvasOpen||dialog.open||!canWrite(actor(),"canvas"))return;
  if((event.target as HTMLElement|null)?.closest("input,textarea,[role=searchbox]"))return;
  const files=clipboardImageFiles(event.clipboardData);if(!files.length)return;
  event.preventDefault();insertCanvasImages(files);
});
const canvasDropFrame=$("#canvas-frame");let canvasDragDepth=0;
const canvasCanDrop=(event:DragEvent)=>activeView==="canvas"&&canvasOpen&&!dialog.open&&canWrite(actor(),"canvas")&&(Array.from(event.dataTransfer?.types||[]).includes("Files")||Array.from(event.dataTransfer?.items||[]).some(item=>item.kind==="file"));
canvasDropFrame.addEventListener("dragenter",event=>{if(!canvasCanDrop(event))return;event.preventDefault();canvasDragDepth++;canvasDropFrame.classList.add("receiving-images");});
canvasDropFrame.addEventListener("dragover",event=>{if(!canvasCanDrop(event))return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="copy";canvasDropFrame.classList.add("receiving-images");});
canvasDropFrame.addEventListener("dragleave",()=>{canvasDragDepth=Math.max(0,canvasDragDepth-1);if(!canvasDragDepth)canvasDropFrame.classList.remove("receiving-images");});
canvasDropFrame.addEventListener("drop",event=>{canvasDragDepth=0;canvasDropFrame.classList.remove("receiving-images");if(!canvasCanDrop(event))return;event.preventDefault();event.stopPropagation();const files=clipboardImageFiles(event.dataTransfer);if(!files.length){notify("Arrastra una imagen PNG, JPG, WebP, GIF o BMP.");return;}const rect=canvasDropFrame.getBoundingClientRect();insertCanvasImages(files,{x:(event.clientX-rect.left-camera.x)/camera.z-127,y:(event.clientY-rect.top-camera.y)/camera.z-110});});
$<HTMLInputElement>("#image-input").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    file.size > 1500000
  ) {
    notify("Elige una imagen PNG, JPG, WebP o GIF de hasta 1,5 MB.");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  const groupId = spatial?.organization.activeGroup(), spaceId = activeSpace;
  reader.onload = () => {
    const imageId = uid();
    if (!canvasOpen || activeSpace !== spaceId || spatial?.organization.activeGroup() !== groupId || !canWrite(actor(),"canvas")) return;
    if (!spatial?.organization.insert([{
        id: imageId,
        space: activeSpace,
        kind: "image",
        title: file.name,
        body: "",
        image: String(reader.result),
        x: pendingImagePosition?.x ?? (100 - camera.x) / camera.z,
        y: pendingImagePosition?.y ?? (100 - camera.y) / camera.z,
      }])) return;
    show("canvas", true);
    pendingImagePosition = undefined;
    centerOnNode(imageId);
    notify("Imagen añadida.");
  };
  reader.readAsDataURL(file);
  input.value = "";
};
$<HTMLInputElement>("#import-input").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4000000) throw Error();
    const data = JSON.parse(await file.text());
    if (!validateState(data)) throw Error();
    modal(
      '<h2>Recuperar tu espacio.</h2><p>Este respaldo reemplazará el contenido del negocio abierto. Puedes deshacerlo con ⌘ Z o exportar antes una copia.</p><button class="button primary" id="confirm-import">Importar respaldo</button>',
    );
    $("#confirm-import").onclick = () => {
      mutate(() => (state = data));
      activeSpace = state.spaces[0]?.id || "Negocio";
      close();
      notify("Tu respaldo está de vuelta.");
    };
  } catch {
    notify("Este archivo no es un respaldo válido de Orbital.");
  }
  input.value = "";
};
document.addEventListener("keydown", (e) => {
  const typing = (e.target as HTMLElement).closest(
    "input,textarea,select,[contenteditable]",
  );
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchDialog();
  }
  if (
    (e.metaKey || e.ctrlKey) &&
    e.key.toLowerCase() === "z" &&
    !typing &&
    !dialog.open
  ) {
    e.preventDefault();
    if (e.shiftKey && activeView === "canvas" && canvasOpen) redo();
    else undo();
  }
  if (e.key === "Escape") {
    connectFrom = "";
    $("#sidebar").classList.remove("open");
    syncSidebarFocus();
  }
});
document.addEventListener("keydown", (e) => {
  const el = e.target as HTMLElement;
  const canvas = $("#canvas-frame");
  if (activeView === "canvas" && canvasOpen && !canvasDetailId && !dialog.open && canvas.contains(el)) {
    const groupButton = el.closest(".stack-deck");
    const keyTarget = groupButton?.closest<HTMLElement>("[data-node]") || el;
    if (isSelectionDelete(e, keyTarget)) {
      const focused = keyTarget.closest<HTMLElement>("[data-node]")?.dataset.node;
      const selection = spatial?.organization.selected;
      const ids = selection?.size ? selection : focused ? [focused] : [];
      if (removeCanvasNodes(ids)) {
        e.preventDefault();
        e.stopPropagation();
        canvas.focus({preventScroll:true});
        return;
      }
    }
  }
  if (
    canWrite(actor(), "canvas") &&
    el.matches("[data-node]") && !e.altKey &&
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    const node = state.nodes.find((n) => n.id === el.dataset.node);
    if (!node) return;
    const step = e.shiftKey ? 50 : 10;
    const org=spatial?.organization;
    const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0;
    const dy=e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0;
    const items=(org?.moving(node)??[node]).map(n=>({node:n,start:nodeRect(n)}));
    mutate(()=>{if(org) org.commit(items,dx,dy,undefined,false); else {node.x+=dx;node.y+=dy;}});
    document.querySelector<HTMLElement>(`[data-node="${node.id}"]`)?.focus();
  }
});
let dragTask = "";
let suppressTaskClickUntil = 0;
function clearTaskDrag() {
  for (const el of $$("#kanban-board .task-drop-indicator")) el.removeAttribute("style");
  for (const el of $$(".drag-over,.dragging,.drop-before,.drop-after"))
    el.classList.remove("drag-over", "dragging", "drop-before", "drop-after");
  dragTask = "";
}
function taskDropAt(x: number, y: number) {
  const hit = document.elementFromPoint(x, y);
  const column = hit?.closest<HTMLElement>("[data-drop-status]");
  if (!column) return;
  const cards = [
    ...column.querySelectorAll<HTMLElement>(".kanban-task"),
  ].filter((c) => c.dataset.dragTask !== dragTask);
  const before = cards.find(
    (card) =>
      y <
      card.getBoundingClientRect().top +
        card.getBoundingClientRect().height / 2,
  );
  return {
    column,
    status: column.dataset.dropStatus as Task["status"],
    beforeId: before?.dataset.dragTask,
    before,
    last: cards.at(-1),
  };
}
function showTaskDrop(x: number, y: number) {
  $$("#kanban-board .task-drop-indicator").forEach(el => el.removeAttribute("style"));
  $$(".drag-over,.drop-before,.drop-after").forEach((el) =>
    el.classList.remove("drag-over", "drop-before", "drop-after"),
  );
  const target = taskDropAt(x, y);
  if (!target) return;
  target.column.classList.add("drag-over");
  const slot = target.column.querySelector<HTMLElement>(".task-drop-indicator");
  const list = target.column.querySelector<HTMLElement>(".task-drop-list");
  if (slot && list && (!target.column.closest(".list-mode") || !target.last)) {
    const bounds = target.column.getBoundingClientRect();
    const start = target.before?.getBoundingClientRect().top ??
      (target.last ? target.last.getBoundingClientRect().bottom + 8 : list.getBoundingClientRect().top);
    const height = touchTask?.element.offsetHeight ?? 64;
    slot.style.top = `${Math.min(start - bounds.top, bounds.height - 22)}px`;
    slot.style.height = `${Math.max(16, Math.min(height, bounds.bottom - start))}px`;
    return;
  }
  if (target.before) target.before.classList.add("drop-before");
  else target.last?.classList.add("drop-after");
}
function finishTaskDrop(x: number, y: number, original: HTMLElement) {
  const target = taskDropAt(x, y);
  const id = dragTask;
  const samePosition = target?.column === original.closest("[data-drop-status]") &&
    target?.before === (original.nextElementSibling ?? undefined);

  suppressTaskClickUntil = Date.now() + 350;
  clearTaskDrag();
  if (target && id && !samePosition && canWrite(actor(), "tasks")) {
    mutate(() => {
      state.tasks = moveTask(state.tasks, id, target.status, target.beforeId);
    });
    notify("Orden actualizado.");
  }
}
document.addEventListener("dragstart", (e) => {
  if ((e.target as HTMLElement).closest("[data-drag-task]")) e.preventDefault();
});
let touchTask:
  | {
      pointer: number;
      id: string;
      x: number;
      y: number;
      moved: boolean;
      element: HTMLElement;
      lastX: number;
      lastY: number;
      ghost?: HTMLElement;
    }
  | undefined;
function scrollWhileSorting() {
  if (!touchTask?.moved) return;
  const y = touchTask.lastY;
  const delta =
    y > innerHeight - 70
      ? Math.ceil((y - (innerHeight - 70)) / 4)
      : y < 90
        ? -Math.ceil((90 - y) / 4)
        : 0;
  if (delta) {
    window.scrollBy(0, Math.max(-20, Math.min(20, delta)));
    showTaskDrop(touchTask.lastX, y);
  }
  requestAnimationFrame(scrollWhileSorting);
}
document.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !e.isPrimary || touchTask) return;
  const target = e.target as HTMLElement;
  const card = target.closest<HTMLElement>("[data-drag-task]");
  if (
    !card ||
    !canWrite(actor(), "tasks") ||
    target.closest(
      "button:not([data-task-grip]),.task-card-menu,[contenteditable],input,textarea",
    )
  )
    return;
  const grip = target.closest("[data-task-grip]");
  if (e.pointerType !== "mouse" && !grip) return;
  if (grip) e.preventDefault();
  touchTask = {
    pointer: e.pointerId,
    id: card.dataset.dragTask!,
    x: e.clientX,
    y: e.clientY,
    moved: false,
    element: card,
    lastX: e.clientX,
    lastY: e.clientY,
  };
});
document.addEventListener(
  "pointermove",
  (e) => {
    if (!touchTask || touchTask.pointer !== e.pointerId) return;
    touchTask.lastX = e.clientX;
    touchTask.lastY = e.clientY;
    const dx = e.clientX - touchTask.x,
      dy = e.clientY - touchTask.y;
    if (!touchTask.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    e.preventDefault();
    if (!touchTask.moved) {
      touchTask.moved = true;
      requestAnimationFrame(scrollWhileSorting);
      dragTask = touchTask.id;
      if (!touchTask.element.isConnected) {
        cancelTaskDrag();
        return;
      }
      touchTask.element.setPointerCapture(e.pointerId);
      touchTask.element.classList.add("dragging");
      const ghost = touchTask.element.cloneNode(true) as HTMLElement;
      ghost.className = "task-drag-ghost";
      const cardBackground = getComputedStyle(touchTask.element).backgroundImage;
      if (cardBackground !== "none") ghost.style.backgroundImage = cardBackground;
      ghost.removeAttribute("data-drag-task");
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.width =
        touchTask.element.getBoundingClientRect().width + "px";
      document.body.append(ghost);
      touchTask.ghost = ghost;
    }
    touchTask.ghost!.style.left = e.clientX + 12 + "px";
    touchTask.ghost!.style.top = e.clientY + 12 + "px";
    showTaskDrop(e.clientX, e.clientY);
  },
  { passive: false },
);
function cancelTaskDrag(event?: PointerEvent) {
  if (!touchTask || (event && event.pointerId !== touchTask.pointer)) return;
  const current = touchTask;
  touchTask = undefined;
  current.ghost?.remove();
  clearTaskDrag();
  if (current.element.hasPointerCapture(current.pointer))
    current.element.releasePointerCapture(current.pointer);
}
window.addEventListener("pointerup", (e) => {
  if (touchTask?.pointer !== e.pointerId) return;
  const current = touchTask;
  touchTask = undefined;
  current.ghost?.remove();
  if (current.element.hasPointerCapture(e.pointerId))
    current.element.releasePointerCapture(e.pointerId);
  if (current.moved) finishTaskDrop(e.clientX, e.clientY, current.element);
}, true);
window.addEventListener("pointercancel", cancelTaskDrag, true);
window.addEventListener("lostpointercapture", cancelTaskDrag, true);
window.addEventListener("blur", () => cancelTaskDrag());
document.addEventListener("keydown", (e) => {
  const grip = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-task-grip]",
  );
  if (
    !grip ||
    !canWrite(actor(), "tasks") ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  e.preventDefault();
  const id = grip.dataset.taskGrip!,
    task = state.tasks.find((t) => t.id === id)!;
  const statuses = ["todo", "doing", "done"] as const;
  let status = task.status,
    beforeId: string | undefined;
  const list = orderedTasks(
    state.tasks.filter((t) =>
      (t.boardId || "general") === (task.boardId || "general") &&
      (t.privateOwner || "") === (task.privateOwner || "")),
    status,
  );
  const at = list.findIndex((t) => t.id === id);
  if (e.key === "ArrowUp") {
    if (!at) return;
    beforeId = list[at - 1].id;
  } else if (e.key === "ArrowDown") {
    if (at === list.length - 1) return;
    beforeId = list[at + 2]?.id;
  } else {
    const next = statuses.indexOf(status) + (e.key === "ArrowRight" ? 1 : -1);
    if (next < 0 || next >= statuses.length) return;
    status = statuses[next];
  }
  mutate(() => (state.tasks = moveTask(state.tasks, id, status, beforeId)));
  document.querySelector<HTMLElement>(`[data-task-grip="${id}"]`)?.focus();
  notify("Tarea movida.");
});
let pointer:
  | {
      id: number;
      x: number;
      y: number;
      cx: number;
      cy: number;
      node?: CanvasNode;
      moved: boolean;
      dx: number; dy: number;
      movingIds?: Set<string>;
      items?: {node:CanvasNode;start:Rect;el:HTMLElement|null}[];
      marquee?: HTMLElement;
      selectionBefore?: string[];
      additive?: boolean;
      pan?: boolean;
      stackPreview?: boolean;
      dropPreviewTarget?: HTMLElement;
      dropPreviewTimer?: number;
      folderDrag?: { space: Space; start: Rect; el: HTMLElement };
    }
  | undefined;
const frame = $("#canvas-frame");
let hoveredFolder: HTMLElement | undefined;
frame.addEventListener("pointerover", event => {
  const folder = (event.target as Element).closest<HTMLElement>("#canvas-nodes > [data-canvas-folder]");
  if (!folder || folder === hoveredFolder || pointer?.moved || event.pointerType === "touch") return;
  hoveredFolder = folder;
  const origin = folder.getBoundingClientRect();
  for (const neighbor of frame.querySelectorAll<HTMLElement>("#canvas-nodes > :is([data-node],[data-canvas-folder])")) {
    if (neighbor === folder) continue;
    const offset = canvasNeighborOffset(origin, neighbor.getBoundingClientRect(), canvasHoverRepulsion);
    if (!offset) continue;
    neighbor.style.setProperty("--folder-away-x", `${offset.x / camera.z}px`);
    neighbor.style.setProperty("--folder-away-y", `${offset.y / camera.z}px`);
    neighbor.classList.add("canvas-folder-hover-neighbor");
  }
});
frame.addEventListener("pointerout", event => {
  if (!hoveredFolder || (event.relatedTarget instanceof Node && hoveredFolder.contains(event.relatedTarget))) return;
  hoveredFolder = undefined;
  frame.querySelectorAll(".canvas-folder-hover-neighbor").forEach(neighbor => neighbor.classList.remove("canvas-folder-hover-neighbor"));
});
const canvasMedia=installCanvasMedia(frame);
let connectionDrag:
  | {
      pointer: number;
      origin: string;
      side: PortSide;
      edgeId?: string;
      reverse?: boolean;
      x: number;
      y: number;
      moved: boolean;
    }
  | undefined;
let pendingPort: { node: string; side: PortSide } | undefined;
function portTarget(x: number, y: number) {
  const hit = document.elementFromPoint(x, y),
    el = hit?.closest<HTMLElement>("[data-node]");
  const node = state.nodes.find(
    (n) => n.id === el?.dataset.node && n.space === activeSpace,
  );
  if (!node || !el) return;
  const rect = el.getBoundingClientRect();
  const distances: [PortSide, number][] = [
    ["left", Math.abs(x - rect.left)],
    ["right", Math.abs(x - rect.right)],
    ["top", Math.abs(y - rect.top)],
    ["bottom", Math.abs(y - rect.bottom)],
  ];
  return {
    node,
    side:
      (hit?.closest<HTMLElement>("[data-port-side]")?.dataset
        .portSide as PortSide) || distances.sort((a, b) => a[1] - b[1])[0][0],
  };
}
function commitConnection(
  origin: string,
  side: PortSide,
  target: ReturnType<typeof portTarget>,
  edgeId?: string,
  reverse = false,
) {
  if (!target || target.node.id === origin) return;
  const prior = state.edges.find(e=>e.id===edgeId);
  if (!sameCanvasGroup(reverse && prior ? prior.to : origin,target.node.id)) {
    notify("Conecta tarjetas del mismo grupo o tarjetas que estén fuera de grupos.");
    return;
  }
  mutate(() => {
    const edge = state.edges.find((e) => e.id === edgeId);
    if (edge) {
      if (reverse) {
        edge.from = target.node.id;
        edge.fromSide = target.side;
      } else {
        edge.to = target.node.id;
        edge.toSide = target.side;
      }
    } else if (
      !state.edges.some(
        (e) =>
          e.from === origin &&
          e.to === target.node.id &&
          e.fromSide === side &&
          e.toSide === target.side,
      )
    )
      state.edges.push({
        id: uid(),
        from: origin,
        to: target.node.id,
        fromSide: side,
        toSide: target.side,
      });
  });
  notify(edgeId ? "Conexión actualizada." : "Tarjetas conectadas.");
}
document.addEventListener("click", (e) => {
  if (e.detail !== 0 || !canWrite(actor(), "canvas")) return;
  const port = (e.target as Element).closest<HTMLElement>("[data-port-node]");
  if (!port) return;
  const id = port.dataset.portNode!,
    side = port.dataset.portSide as PortSide;
  if (pendingPort && pendingPort.node !== id) {
    const node = state.nodes.find((n) => n.id === id)!;
    commitConnection(pendingPort.node, pendingPort.side, { node, side });
    pendingPort = undefined;
  } else {
    pendingPort = { node: id, side };
    notify("Selecciona otro conector y pulsa Enter para enlazar.");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    connectionDrag = undefined;
    pendingPort = undefined;
    frame.classList.remove("connecting");
    $("#connections .connection-preview")?.remove();
    $$(".connection-target").forEach((el) =>
      el.classList.remove("connection-target"),
    );
  }
});
frame.addEventListener(
  "pointerdown",
  (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || tool === "marquee" || !canWrite(actor(), "canvas")) return;
    const port = (e.target as Element).closest<HTMLElement>("[data-port-node]"),
      handle = (e.target as Element).closest<SVGElement>("[data-edge-end]");
    if (!port && !handle) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const edge = state.edges.find(
        (i) => i.id === handle?.getAttribute("data-edge"),
      ),
      reverse = handle?.getAttribute("data-edge-end") === "from";
    const origin = port?.dataset.portNode || (reverse ? edge?.to : edge?.from);
    if (!origin) return;
    const side = (port?.dataset.portSide ||
      (reverse ? edge?.toSide : edge?.fromSide) ||
      "right") as PortSide;
    connectionDrag = {
      pointer: e.pointerId,
      origin,
      side,
      edgeId: edge?.id,
      reverse,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    frame.setPointerCapture(e.pointerId);
    frame.classList.add("connecting");
  },
  true,
);
document.addEventListener(
  "pointermove",
  (e) => {
    const drag = connectionDrag;
    if (!drag || drag.pointer !== e.pointerId) return;
    e.preventDefault();
    drag.moved ||= Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4;
    const origin = state.nodes.find((n) => n.id === drag.origin);
    if (!origin) return;
    const candidate = portTarget(e.clientX, e.clientY);
    const target = candidate && sameCanvasGroup(drag.origin,candidate.node.id) ? candidate : null;
    const rect = frame.getBoundingClientRect();
    const end =
      target && target.node.id !== drag.origin
        ? nodeRect(target.node)
        : {
            id: "pointer",
            x: (e.clientX - rect.left - camera.x) / camera.z,
            y: (e.clientY - rect.top - camera.y) / camera.z,
            width: 0,
            height: 0,
          };
    const svg = $("#connections");
    svg.querySelector(".connection-preview")?.remove();
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "connection-preview");
    path.setAttribute(
      "d",
      connector(nodeRect(origin), end, drag.side, target?.side).path,
    );
    svg.append(path);
    $$(".connection-target").forEach((el) =>
      el.classList.remove("connection-target"),
    );
    if (target && target.node.id !== drag.origin)
      document
        .querySelector(`[data-node="${target.node.id}"]`)
        ?.classList.add("connection-target");
  },
  { passive: false },
);
document.addEventListener("pointerup", (e) => {
  const drag = connectionDrag;
  if (!drag || drag.pointer !== e.pointerId) return;
  connectionDrag = undefined;
  frame.classList.remove("connecting");
  $("#connections .connection-preview")?.remove();
  $$(".connection-target").forEach((el) =>
    el.classList.remove("connection-target"),
  );
  if (frame.hasPointerCapture(e.pointerId))
    frame.releasePointerCapture(e.pointerId);
  if (drag.moved) {
    commitConnection(
      drag.origin,
      drag.side,
      portTarget(e.clientX, e.clientY),
      drag.edgeId,
      drag.reverse,
    );
    pendingPort = undefined;
  } else if (!drag.edgeId) {
    if (pendingPort && pendingPort.node !== drag.origin) {
      const node = state.nodes.find((n) => n.id === drag.origin)!;
      commitConnection(pendingPort.node, pendingPort.side, {
        node,
        side: drag.side,
      });
      pendingPort = undefined;
    } else {
      pendingPort = { node: drag.origin, side: drag.side };
      notify("Elige otro conector para enlazar las tarjetas.");
    }
  }
});
document.addEventListener("pointercancel", () => {
  connectionDrag = undefined;
  frame.classList.remove("connecting");
  $("#connections .connection-preview")?.remove();
  $$(".connection-target").forEach((el) =>
    el.classList.remove("connection-target"),
  );
});
frame.addEventListener("pointerdown", (e) => {
  const target = e.target as HTMLElement;
  if (e.button !== 0 || pointer || !canvasOpen || activeView !== "canvas") return;
  const panModifier = e.metaKey || e.ctrlKey;
  if (target.closest(".canvas-toolbar,.zoom-toolbar,.canvas-block-library,.canvas-heading,#canvas-tools-menu,#canvas-selection-actions,#canvas-detail")) return;
  if (!target.closest("[data-node],[data-canvas-folder]") &&
      document.activeElement?.closest("#canvas-nodes")) frame.focus({ preventScroll: true });
  const stackPreview=!!target.closest(".stack-deck");
  const webPreview = target.closest(".spatial-web-preview");
  if (target.closest(".canvas-note-palette,.canvas-folder-preview")) return;
  const folderEl = target.closest<HTMLElement>("[data-canvas-folder]:not([inert])");
  const folder = folderEl && canWrite(actor(),"canvas") && !panModifier && tool === "select"
    ? state.spaces.find(space => space.id === folderEl.dataset.canvasFolder && space.folder?.parentId === activeSpace && isMine(space.privateOwner))
    : undefined;
  const folderRect = folder && visibleFolderRects().find(rect => rect.id === folder.id);
  const folderDrag = folder && folderEl && folderRect ? { space: folder, start: folderRect, el: folderEl } : undefined;
  if (!panModifier && tool !== "marquee" && !stackPreview && !folderDrag && !webPreview && target.closest("button,input,textarea,select,a,video,audio,iframe")) return;
  const editor = target.closest<HTMLElement>("[contenteditable]");
  if (!panModifier && editor && tool !== "hand" && tool !== "marquee") return;
  e.preventDefault();
  frame.classList.add("is-panning");
  const nodeEl = target.closest<HTMLElement>("[data-node]");
  if (!panModifier && tool === "connect" && nodeEl && canWrite(actor(), "canvas")) {
    const id = nodeEl.dataset.node!;
    if (!connectFrom) {
      connectFrom = id;
      renderCanvas();
    } else if (connectFrom !== id && sameCanvasGroup(connectFrom,id)) {
      mutate(() => {
        if (!state.edges.some((x) => x.from === connectFrom && x.to === id))
          state.edges.push({ id: uid(), from: connectFrom, to: id });
      });
      connectFrom = "";
      renderCanvas();
    }
    return;
  }
  const node =
    !panModifier && tool !== "hand" && tool !== "marquee" && nodeEl && (spatial?.organization.canSelect(nodeEl.dataset.node!) ?? true) && canWrite(actor(), "canvas")
      ? state.nodes.find((n) => n.id === nodeEl.dataset.node)
      : undefined;
  const org=spatial?.organization;
  const additive=e.shiftKey;
  const pan=panModifier || tool==="hand";
  let marquee: HTMLElement | undefined;
  if (!node && !folderDrag && !pan && (tool === "marquee" || tool === "select") && canWrite(actor(),"canvas")) {
    marquee=document.createElement("div");
    marquee.className="canvas-marquee"; frame.append(marquee);
    frame.focus({ preventScroll: true });
  } else if (!node && !folderDrag && !pan) {
    frame.classList.remove("is-panning");
    if (tool==="select") org?.select([]);
    frame.focus({preventScroll:true});
    return;
  }
  if (node) org?.interrupt();
  const items=node?(org?.moving(node)??[node]).map(n=>({node:n,start:nodeRect(n),el:document.querySelector<HTMLElement>(`[data-node="${CSS.escape(n.id)}"]`)})):undefined;
  pointer = {
    id:e.pointerId,x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,node,moved:false,dx:0,dy:0,
    items,movingIds:items?new Set(items.map(item=>item.node.id)):undefined,marquee,additive,pan,stackPreview,folderDrag,
    selectionBefore: marquee && org ? [...org.selected] : undefined,
  };

});
const cursorId = uid();
let cursorTick = 0;
function sendPresence() {
  if (
    activeView !== "canvas" ||
    !canvasOpen || canvasDetailId ||
    state.spaces.find((s) => s.id === activeSpace)?.privateOwner
  )
    return;
  const editable = (document.activeElement as HTMLElement)
    ?.closest<HTMLElement>("[contenteditable]")
    ?.closest<HTMLElement>("[data-node]");
  const node =
    pointer?.node ||
    (editable && state.nodes.find((n) => n.id === editable.dataset.node));
  const data = {
    type: "cursor",
    id: cursorId,
    name: actor().name,
    userId: String(actor().id),
    space: activeSpace,
    x: lastCursor.x,
    y: lastCursor.y,
    action: pointer?.node ? "moving" : editable ? "editing" : "viewing",
    nodeId: node?.id || "",
  };
  if (cloud && socket?.readyState === 1) socket.send(JSON.stringify(data));
  else if (!cloud) channel?.postMessage(data);
}
let lastCursor = { x: 0, y: 0 };
frame.addEventListener("pointermove", (e) => {
  const r = frame.getBoundingClientRect();
  lastCursor = {
    x: (e.clientX - r.left - camera.x) / camera.z,
    y: (e.clientY - r.top - camera.y) / camera.z,
  };
  if (Date.now() - cursorTick > 100) {
    cursorTick = Date.now();
    sendPresence();
  }
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x,
    dy = e.clientY - pointer.y;
  if (Math.abs(dx) + Math.abs(dy) < 3 && !pointer.moved) return;
  if (!pointer.moved) {
    frame.setPointerCapture(e.pointerId);
    if(pointer.node && !spatial?.organization.selected.has(pointer.node.id)) spatial?.organization.select([pointer.node.id]);
  }
  pointer.moved = true;
  if (pointer.folderDrag) {
    dragDirty = true;
    pointer.dx = dx / camera.z;
    pointer.dy = dy / camera.z;
    pointer.folderDrag.el.style.translate = `${pointer.dx}px ${pointer.dy}px`;
    pointer.folderDrag.el.classList.add("canvas-lifted");
    const dragged = pointer.folderDrag.el.getBoundingClientRect();
    for (const neighbor of frame.querySelectorAll<HTMLElement>("#canvas-nodes > [data-node]:not(.spatial-stack):not(.canvas-note-attached)")) {
      const bounds = neighbor.getBoundingClientRect();
      const shift = canvasNeighborOffset(dragged, bounds, 145);
      neighbor.classList.toggle("canvas-folder-drag-neighbor", !!shift);
      if (shift) {
        neighbor.style.setProperty("--folder-away-x", `${shift.x / camera.z}px`);
        neighbor.style.setProperty("--folder-away-y", `${shift.y / camera.z}px`);
      }
    }
    queueDragConnections();
  } else if (pointer.items) {
    dragDirty = true;
    pointer.dx=dx/camera.z; pointer.dy=dy/camera.z;
    const movingSupports = new Set(pointer.items.flatMap(({node}) =>
      node.attachedTo && pointer?.movingIds?.has(node.attachedTo) ? [node.attachedTo] : [],
    ));
    for (const {node,el} of pointer.items) if (el) {
      el.style.translate=`${pointer.dx}px ${pointer.dy}px`;
      spatial?.organization.lift(node.id,node,dx,movingSupports.has(node.id) || movingSupports.has(node.attachedTo ?? ""));
    }
    const drop = spatial?.organization.dropAt(e.clientX,e.clientY,pointer.movingIds!);
    const folder = folderDropTarget(e, pointer.movingIds!);
    const group = drop?.kind === "stack"
      ? frame.querySelector<HTMLElement>(`[data-node="${CSS.escape(drop.id)}"]`) : undefined;
    const container = folder || group;
    if (pointer.dropPreviewTarget !== container) {
      clearTimeout(pointer.dropPreviewTimer);
      pointer.dropPreviewTarget = container ?? undefined;
      for (const {el} of pointer.items) el?.classList.remove("canvas-insert-preview");
      if (container) {
        const gesture = pointer;
        gesture.dropPreviewTimer = window.setTimeout(() => {
          if (pointer === gesture) {
            for (const {el} of gesture.items ?? []) el?.classList.add("canvas-insert-preview");
          }
        }, 300);
      }
    }
    const previousFolder = frame.querySelector(".canvas-folder-drop");
    if (previousFolder !== folder) {
      previousFolder?.classList.remove("canvas-folder-drop");
      folder?.classList.add("canvas-folder-drop");
    }
    const target = !folder && !drop ? newGroupTarget(e, pointer.movingIds!) : undefined;
    const previousTarget = frame.querySelector(".canvas-new-group-target");
    if (previousTarget !== target) {
      previousTarget?.classList.remove("canvas-new-group-target");
      target?.classList.add("canvas-new-group-target");
    }
    queueDragConnections();
  } else if(pointer.marquee) {
    updateMarquee(pointer, e);
  } else if(pointer.pan) {
    camera.x = pointer.cx + dx;
    camera.y = pointer.cy + dy;
    applyCamera();
  }
});
function updateMarquee(gesture: NonNullable<typeof pointer>, event: PointerEvent) {
  const r = frame.getBoundingClientRect();
    const left = Math.min(gesture.x, event.clientX), right = Math.max(gesture.x, event.clientX);
    const top = Math.min(gesture.y, event.clientY), bottom = Math.max(gesture.y, event.clientY);
    Object.assign(gesture.marquee!.style, {
      left: `${left - r.left}px`, top: `${top - r.top}px`,
      width: `${Math.max(1, right - left)}px`, height: `${Math.max(1, bottom - top)}px`,
    });
    const ids = [...frame.querySelectorAll<HTMLElement>("#canvas-nodes > [data-node]")].flatMap(el => {
      const card = (el.querySelector(".canvas-node-face") || el).getBoundingClientRect();
      const touches = left <= card.right && right >= card.left && top <= card.bottom && bottom >= card.top;
      return touches ? [el.dataset.node!] : [];
    });
    const before = gesture.additive ? gesture.selectionBefore ?? [] : [];
    spatial?.organization.select([...before, ...ids]);
}
function newGroupTarget(event: PointerEvent, moving: Set<string>) {
  const org = spatial?.organization;
  if (org?.groupOpen() || state.nodes.some(node => moving.has(node.id) && org?.container(node))) return;
  return document.elementsFromPoint(event.clientX, event.clientY)
    .map(hit => hit.closest<HTMLElement>("#canvas-nodes > [data-node]:not(.spatial-stack):not([inert])"))
    .find(card => card && !moving.has(card.dataset.node!));
}
function folderDropTarget(event: PointerEvent, moving: Set<string>) {
  const card = document.elementsFromPoint(event.clientX, event.clientY)
    .map(hit => hit.closest<HTMLElement>("[data-canvas-folder]:not([inert])")).find(Boolean);
  const folder = state.spaces.find(space => space.id === card?.dataset.canvasFolder);
  const source = state.spaces.find(space => space.id === activeSpace);
  if (!folder?.folder || folder.folder.parentId !== activeSpace ||
      folder.privateOwner !== source?.privateOwner || moving.has(folder.folder.groupId ?? "")) return;
  return card;
}
function moveCardsToFolder(items: { node: CanvasNode; start: Rect }[], destination: string) {
  const ids = new Set(items.map(({ node }) => node.id));
  const box = canvasBounds(items.map(({ start }) => start));
  const occupied = [
    ...state.nodes.filter(node => node.space === destination).map(nodeRect),
    ...state.spaces.flatMap(space => space.folder?.parentId === destination
      ? [{ ...space.folder, id: space.id, ...canvasFolderSize }] : []),
  ];
  const position = freePosition({ ...box, x: 0, y: 0 }, occupied);
  const dx = position.x - box.x, dy = position.y - box.y;
  for (const group of state.nodes) {
    if (!ids.has(group.id) && group.spatial?.members)
      group.spatial.members = group.spatial.members.filter(id => !ids.has(id));
  }
  for (const { node, start } of items) {
    node.space = destination;
    node.x = start.x + dx;
    node.y = start.y + dy;
  }
  for (const space of state.spaces) {
    const folder = space.folder;
    if (folder?.parentId === activeSpace && ids.has(folder.groupId ?? "")) {
      folder.parentId = destination;
      folder.x += dx;
      folder.y += dy;
    }
  }
}
let dragConnectionFrame = 0;
function queueDragConnections() {
  if (dragConnectionFrame || !state.edges.length) return;
  dragConnectionFrame = requestAnimationFrame(() => {
    dragConnectionFrame = 0;
    if (pointer?.moved) renderConnections();
  });
}
let lastCanvasClick: { id: string; time: number; x: number; y: number } | undefined;
function endPointer(event?: PointerEvent, cancel=false) {
  if (!pointer || (event && pointer.id!==event.pointerId)) return;
  const gesture=pointer, org=spatial?.organization;
  clearTimeout(gesture.dropPreviewTimer);
  const folder = gesture.items && gesture.moved && event && !cancel
    ? folderDropTarget(event, gesture.movingIds!) : undefined;
  const drop=gesture.items && gesture.moved && event && !cancel ? org?.dropAt(event.clientX,event.clientY,gesture.movingIds!) : undefined;
  const settling=gesture.items?.map(({node,el})=>{
    const face=el?.querySelector(".canvas-node-face");
    return [node.id,face ? getComputedStyle(face).transform : undefined] as const;
  });
  if (gesture.marquee && !cancel) {
    const distance = event ? Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) : 0;
    if (event && (gesture.moved || distance >= 3)) updateMarquee(gesture, event);
    else if (!gesture.additive) org?.select([]);
  }
  if (gesture.marquee && cancel) org?.select(gesture.selectionBefore ?? []);
  let detailToOpen: string | undefined;
  if (gesture.node && !gesture.moved && !gesture.stackPreview && !cancel && tool==="select") {
    const id = gesture.node.id;
    const now = performance.now();
    if (event?.pointerType === "mouse" && lastCanvasClick?.id === id &&
        now - lastCanvasClick.time < 400 && Math.hypot(gesture.x - lastCanvasClick.x, gesture.y - lastCanvasClick.y) < 8) {
      detailToOpen = id;
      lastCanvasClick = undefined;
    } else {
      lastCanvasClick = { id, time: now, x: gesture.x, y: gesture.y };
    }
    org?.toggle(id);
    frame.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  } else {
    lastCanvasClick = undefined;
  }
  gesture.marquee?.remove();
  pointer=undefined; dragDirty=false;
  frame.classList.remove("is-panning");
  org?.clearDrop();
  frame.querySelector(".canvas-new-group-target")?.classList.remove("canvas-new-group-target");
  frame.querySelector(".canvas-folder-drop")?.classList.remove("canvas-folder-drop");
  if (gesture.folderDrag && gesture.moved) {
    const { el, space, start } = gesture.folderDrag;
    el.style.removeProperty("translate");
    el.classList.remove("canvas-lifted");
    frame.querySelectorAll(".canvas-folder-drag-neighbor").forEach(neighbor => neighbor.classList.remove("canvas-folder-drag-neighbor"));
    if (!cancel && space.folder && canWrite(actor(),"canvas")) mutate(() => {
      const folder = space.folder!;
      const wanted = { ...start, x: start.x + gesture.dx, y: start.y + gesture.dy };
      if (!folder.groupId) {
        const fixed = [...visibleFolderRects().filter(rect => rect.id !== space.id),
          ...state.nodes.filter(node => node.space === activeSpace && org?.container(node)).map(nodeRect)];
        if (fixed.some(rect => overlaps(wanted, rect, 12))) Object.assign(wanted, freePosition(wanted, fixed, 12));
      }
      if (folder.groupId && org?.activeGroup() === folder.groupId) {
        const occupied = [...org.placed.values()].filter(rect => rect.id !== space.id);
        const position = occupied.some(rect => overlaps(wanted, rect, 8))
          ? freePosition(wanted, occupied, 12) : wanted;
        folder.groupOffset = {
          x: (folder.groupOffset?.x ?? 0) + position.x - start.x,
          y: (folder.groupOffset?.y ?? 0) + position.y - start.y,
        };
      } else {
        folder.x = wanted.x;
        folder.y = wanted.y;
      }
    });
  }
  if (gesture.folderDrag && cancel) renderConnections();
  if (gesture.items && gesture.moved) {
    for (const {el} of gesture.items) {el?.style.removeProperty("translate");el?.classList.remove("canvas-lifted", "canvas-insert-preview");}
    if (!cancel && canWrite(actor(),"canvas") && org) {
      const target = event && !folder && !drop ? newGroupTarget(event, gesture.movingIds!)?.dataset.node : undefined;
      if (target) {
        org.create(undefined, [...gesture.movingIds!, target], target);
        if (remotePending) { remotePending = false; void fetchCloud(); }
        return;
      }
      const beforeOrder = drop?.kind === "reorder" ? new Map([...frame.querySelectorAll<HTMLElement>(".canvas-group-member")].map(el => [el.dataset.node!, el.getBoundingClientRect()])) : null;
      mutate(() => {
        if (folder?.dataset.canvasFolder) moveCardsToFolder(gesture.items!, folder.dataset.canvasFolder);
        else {
          const groupedFolders = canvasFolders().flatMap(({ folder }) => {
            const group = gesture.items!.find(({ node }) => node.id === folder.groupId)?.node;
            return group ? [{ folder, group, x: group.x, y: group.y }] : [];
          });
          org.commit(gesture.items!, gesture.dx, gesture.dy, drop);
          for (const { folder, group, x, y } of groupedFolders) {
            folder.x += group.x - x;
            folder.y += group.y - y;
          }
        }
      });
      if (beforeOrder && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        for (const el of frame.querySelectorAll<HTMLElement>(".canvas-group-member")) {
          const prev=beforeOrder.get(el.dataset.node!);
          if (!prev) continue;
          const next=el.getBoundingClientRect();
          const x=(prev.x-next.x)/camera.z, y=(prev.y-next.y)/camera.z;
          if (x || y) el.animate([{translate:`${x}px ${y}px`},{translate:"0 0"}],{duration:235,easing:"cubic-bezier(.2,.75,.25,1)"});
        }
      }
      if (gesture.node) frame.querySelector<HTMLElement>(`[data-node="${CSS.escape(gesture.node.id)}"]`)?.focus({preventScroll:true});
      settling?.forEach(([id,from])=>org.settle(id,from));
    } else renderConnections();
  }
  if (detailToOpen) openCanvasDetail(detailToOpen);
  if (remotePending) { remotePending=false; void fetchCloud(); }
}
document.addEventListener("pointerup", event=>endPointer(event));
document.addEventListener("pointercancel", event=>endPointer(event,true));
frame.addEventListener("lostpointercapture", event=>endPointer(event,true));
document.addEventListener("keydown", event=>{if(event.key==="Escape"&&pointer) endPointer(undefined,true);});
frame.addEventListener(
  "wheel",
  (e) => {
    if ((e.target as Element).closest("#canvas-detail,#canvas-tools-menu,.canvas-folder-preview") || ((e.target as Element).closest("#canvas-block-library") && !e.ctrlKey && !e.metaKey)) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = frame.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.008), e.clientX - r.left, e.clientY - r.top);
    }
  },
  { passive: false },
);
setInterval(sendPresence, 1200);
const renderCursor = (
  data: Parameters<ReturnType<typeof installPresence>["receive"]>[0],
) => presence?.receive(data);
channel?.addEventListener("message", async (e) => {
  if (cloud) return;
  const d = e.data;
  if (d.type === "state-saved" && d.key === storageKey && !pointer &&
      !(document.activeElement as HTMLElement)?.isContentEditable) {
    const version = changeVersion;
    try {
      const next = JSON.parse(await readWorkspaceCache(storageKey,"null"));
      if (!cloud && !pointer && version === changeVersion && validateState(next)) {
        state = next;
        render();
        void features.activity();
      }
    } catch {}
  }
  if (d.type === "cursor") renderCursor(d);
});
type CloudRow = { id: string; key: string; value: unknown; canvasEncrypted?: boolean };
function entities() {
  const map = new Map<string, unknown>();
  for (const group of [
    "spaces",
    "goals",
    "focus",
    "boards",
    "pages",
    "tasks",
    "nodes",
    "edges",
    "events",
  ] as const)
    for (const item of state[group] || []) {
      if (!cloud || canWrite(actor(), sectionForKey(group + ":" + item.id)!))
        map.set(group + ":" + item.id, item);
    }
  if (!cloud || canWrite(actor(), "settings"))
    map.set("settings", state.settings);
  return map;
}
async function api(path: string, init: RequestInit = {}) {
  const response = await fetch("/api/saas/" + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "No se pudo conectar con el servidor");
  return data;
}
async function fetchCloud(draw = true) {
  if (
    syncing ||
    dragDirty ||
    syncTimer ||
    cloudDirty ||
    dialog.open ||
    (document.activeElement as HTMLElement)?.isContentEditable ||
    document.activeElement?.matches(".board-name-input")
  ) {
    remotePending = true;
    return;
  }
  const data = await api("documents");
  const next = initialState(false);
  next.spaces = [];
  next.boards = [];
  next.settings = state.settings;
  next.comments = state.comments || [];
  next.notifications = state.notifications || [];
  cloudRows.clear();
  for (const row of data.docs as CloudRow[]) {
    cloudRows.set(row.key, row.canvasEncrypted === false ? "" : JSON.stringify(row.value));
    if (row.key === "settings")
      next.settings = row.value as WorkspaceState["settings"];
    else {
      const [group] = row.key.split(":");
      if (
        [
          "tasks",
          "goals",
          "focus",
          "boards",
          "nodes",
          "pages",
          "events",
          "spaces",
          "edges",
        ].includes(group)
      )
        (next[group as "tasks"] as unknown[]).push(row.value);
    }
  }

  if (validateState(next)) {
    state = next;
    ensurePrivateBoards();
    pruneState();
    if (!state.spaces.some((s) => s.id === activeSpace))
      activeSpace = state.spaces[0]?.id || "Negocio";
    void persistWorkspace().catch(() => {});
    if (draw) render();
    if (data.docs.some((row:CloudRow) => row.canvasEncrypted === false && canWrite(actor(),sectionForKey(row.key)!))) save();
    return true;
  }
  return false;
}
async function syncCloud() {
  const generation = changeVersion;
  syncTimer = undefined as unknown as ReturnType<typeof setTimeout>;
  syncing = true;
  try {
    const current = entities();
    for (const [key, value] of [...current].sort(([a],[b])=>{const rank=(k:string)=>k.startsWith("spaces:")?0:k.startsWith("boards:")&&!cloudRows.has(k)?1:k.startsWith("pages:")?2:k.startsWith("nodes:")?3:k.startsWith("tasks:")?4:k.startsWith("boards:")?5:6;return rank(a)-rank(b);}))
      if (cloudRows.get(key) !== JSON.stringify(value)) {
        await api("documents", {
          method: "PUT",
          body: JSON.stringify({ key, value }),
        });
        cloudRows.set(key, JSON.stringify(value));
      }
    for (const key of [...cloudRows.keys()].sort((a, b) => {
      const rank = (k: string) =>
        k.startsWith("spaces:")
          ? 0
          : k.startsWith("pages:")
            ? 1
            : k.startsWith("boards:")
              ? 2
              : 3;
      return rank(a) - rank(b);
    }))
      if (!current.has(key) && canWrite(actor(), sectionForKey(key)!)) {
        await api("documents", {
          method: "DELETE",
          body: JSON.stringify({ key }),
        });
        cloudRows.delete(key);
      }
    try {
      await persistWorkspace(storageKey + ":baseline", JSON.stringify([...cloudRows]));
      if (generation === changeVersion) {
        cloudDirty = false;
        localStorage.removeItem(storageKey + ":dirty");
      }
    } catch {}
    $("#save-state").innerHTML = "<span></span>Guardado en tu negocio";
    if (socket?.readyState === 1)
      socket.send(JSON.stringify({ type: "invalidate" }));
  } catch {
    notify("Sin conexión. Tus cambios siguen guardados en este dispositivo.");
    $("#save-state").innerHTML = "<span></span>Pendiente de sincronizar";
  } finally {
    syncing = false;
  }
}
async function connectRealtime() {
  try {
    const { url, ticket } = await api("realtime");
    if (!url) return;
    socket = new WebSocket(url);
    socket.onopen = () =>
      socket?.send(JSON.stringify({ type: "auth", ticket }));
    socket.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "cursor") renderCursor(d);
      if (d.type === "invalidate") {
        void fetchCloud().catch(() => {});
        void features.activity();
      }
    };
    socket.onclose = () => {
      setTimeout(() => void connectRealtime(), 10000);
    };
  } catch {}
}
/** Fill the requested showcase once in the local demo, without touching existing cards. */
async function ensureDemoCanvasExamples() {
  if(!demoMode || !state.spaces.some(s=>s.id==="Negocio"&&!s.privateOwner)) return;
  const key=storageKey+":canvas-showcase-v2";
  try { if(localStorage.getItem(key))return; } catch {}
  const nodes=state.nodes.filter(n=>n.space==="Negocio");
  const grouped=new Set(nodes.filter(n=>n.spatial?.type==="stack"||n.spatial?.type==="group").flatMap(n=>n.spatial?.members||[]));
  const visible=nodes.filter(n=>!grouped.has(n.id));
  const occupied=visible.map(n=>({id:n.id,x:n.x,y:n.y,width:n.width||255,height:n.height||220}));
  const examples: CanvasNode[]=[];
  const add=(type:Partial<CanvasNode>&Pick<CanvasNode,"kind"|"title"|"body">)=>{
    const id=uid(),pos=freePosition({id,x:720+(examples.length%2)*312,y:480+Math.floor(examples.length/2)*270,width:255,height:220},occupied);
    occupied.push({id,...pos,width:255,height:220});
    const node={...type,id,space:"Negocio",...pos}; examples.push(node); return node;
  };
  if(!visible.some(n=>n.kind==="note"))add({kind:"note",title:"Una idea rápida",body:"Escribe una idea y envíala a Notas cuando esté lista."});
  if(!visible.some(n=>n.kind==="page"&&!n.spatial&&n.borderStyle!=="dashed"))add({kind:"page",title:"Texto de ejemplo",body:"Una tarjeta para dar contexto al equipo."});
  if(!visible.some(n=>n.kind==="tasks"))add({kind:"tasks",title:"Lista de lanzamiento",body:"",checklist:[{id:uid(),text:"Preparar las fotos",done:false}]});
  if(!visible.some(n=>n.borderStyle==="dashed"))add({kind:"page",title:"Marco de ejemplo",body:"Una hipótesis para probar antes de publicar.",borderStyle:"dashed",cloudAuthor:"Orbital · Demo"});
  if(!visible.some(n=>n.kind==="sales"))add({kind:"sales",title:"Ventas de ejemplo",body:""});
  if(!visible.some(n=>n.kind==="image"))add({kind:"image",title:"Diseño de ejemplo",body:"Una referencia visual para el lanzamiento.",image:demoCanvasImage});
  if(!visible.some(n=>n.spatial?.type==="web"))add({kind:"page",title:"Referencia · Spatial",body:"",spatial:{type:"web",url:"https://www.get-spatial.com/"}});
  if(!visible.some(n=>n.spatial?.type==="sketch"))add({kind:"page",title:"Boceto de flujo",body:"",spatial:{type:"sketch",strokes:[[[35,48],[101,48],[101,111],[35,111],[35,48]],[[101,80],[181,80],[168,70]],[[181,80],[168,90]],[[181,48],[258,48],[258,111],[181,111],[181,48]]]}});
  if(!visible.some(n=>n.spatial?.type==="media"))add({kind:"page",title:"Clip de ejemplo",body:"",spatial:{type:"media",url:new URL("/images/orbita-demo/clip.mp4",location.origin).href,mime:"video/mp4"}});
  if(!visible.some(n=>n.title==="Ideas y referencias" && n.spatial?.type==="group")){
    const a=add({kind:"note",title:"Mensaje de lanzamiento",body:"La idea que queremos compartir."});
    const b=add({kind:"page",title:"Lista de recursos",body:"Fotos, diseños y referencias para la campaña."});
    add({kind:"page",title:"Ideas y referencias",body:"",spatial:{type:"group",members:[a.id,b.id]}});
  }
  const checklist = '<ul data-canvas-checklist><li><input type="checkbox" checked> Elegir el mensaje</li><li><input type="checkbox"> Revisar el diseño</li></ul>';
  if (!nodes.some(node => node.title === "Checklist de lanzamiento")) {
    add({kind:"page",title:"Checklist de lanzamiento",body:"Elegir el mensaje\nRevisar el diseño",bodyHtml:checklist});
  }
  for (const name of ["Campaña pública", "Referencias públicas", "Borradores privados"]) {
    const privateOwner = name === "Borradores privados" ? String(actor().id) : undefined;
    if (state.spaces.some(space => space.folder?.parentId === "Negocio" && space.privateOwner === privateOwner && space.name === name)) continue;
    const id = uid();
    const point = freePosition({id,x:720,y:480,...canvasFolderSize},occupied);
    occupied.push({id,...point,...canvasFolderSize});
    state.spaces.push({id,name,color:"green",createdAt:new Date().toISOString(),privateOwner,folder:{parentId:"Negocio",...point}});
    examples.push(
      {id:uid(),space:id,kind:"page",title:"Guía del equipo",body:"Elegir el mensaje\nRevisar el diseño",bodyHtml:checklist,x:80,y:100},
      {id:uid(),space:id,kind:"image",title:"Diseño de referencia",body:"",image:demoCanvasImage,x:400,y:100},
    );
  }
  if (!nodes.some(node => node.spatial?.type === "media" && node.spatial.fileId)) {
    try {
      const [file] = await workspaceFiles.ingest([new File(["Material de referencia para el lanzamiento."], "guia-del-espacio.txt", {type:"text/plain"})]);
      if (file) add({kind:"page",title:"Recurso de Archivos",body:"",spatial:{type:"media",fileId:file.id,mime:file.mime}});
    } catch {}
  }
  state.nodes.push(...examples);
  try { await persistWorkspace(); localStorage.setItem(key,"1"); } catch {}
}
function watchAppVersion() {
  const version = import.meta.env.PUBLIC_ORBITA_BUILD;
  if (!import.meta.env.PROD || !version) return;
  const editedForms = new WeakSet<HTMLFormElement>();
  document.addEventListener("input", event => {
    const form = (event.target as Element).closest("form");
    if (form) editedForms.add(form);
  });
  document.addEventListener("submit", event => {
    if (event.target instanceof HTMLFormElement) editedForms.delete(event.target);
  });

  const ready = () => !document.hidden && !syncing && !cloudDirty && !localSavePending &&
    !pointer && !canvasDetailId && !dialog.open &&
    !document.activeElement?.closest("input, textarea, select, [contenteditable=true], [contenteditable=plaintext-only]") &&
    !Array.from(document.forms).some(form => form.getClientRects().length && editedForms.has(form));
  let checking = false;
  async function check() {
    if (checking || !ready()) return;
    checking = true;
    try {
      const response = await fetch("/api/saas/version", { cache: "no-store" });
      if (!response.ok) return;
      const latest = await response.json();
      if (typeof latest.version === "string" && latest.version && latest.version !== version && ready()) {
        location.reload();
      }
    } catch {
      // Retry at the next check if the client is offline.
    } finally {
      checking = false;
    }
  }
  window.setInterval(check, 60_000);
  document.addEventListener("visibilitychange", () => { void check(); });
}

async function bootstrap() {
  watchAppVersion();
  if (demoMode) document.querySelector<HTMLAnchorElement>("#sidebar .brand")!.href = demoPath("/app");
  if (cloud) {
    applyAccess();
    $(".sidebar-navigation").hidden = false;
    $("#save-state").innerHTML = "<span></span>Conectando con tu negocio";
    try {
      cloudDirty = localStorage.getItem(storageKey + ":dirty") === "1";
    } catch {}
  }
  await loadLocal();
  await ensureDemoCanvasExamples();
  $("#greeting-date").textContent = new Date()
    .toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();
  ensurePrivateBoards();
  if (!cloud) {
    routeHash();
    void features.activity();
    return;
  }

  let needsSync = cloudDirty;
  if (cloudDirty) {
    try {
      const baseline = await readWorkspaceCache(storageKey + ":baseline", "[]");
      cloudRows = new Map(JSON.parse(baseline));
    } catch {}
  } else {
    if (initialBranding) Object.assign(state.settings, initialBranding);
    try {
      if (await fetchCloud(false)) {
        needsSync = !cloudRows.size;
        $("#save-state").innerHTML = "<span></span>Guardado en tu negocio";
      }
    } catch {
      notify("No se pudo sincronizar con tu negocio.");
      $("#save-state").innerHTML = "<span></span>Sin conexión con tu negocio";
    }
  }

  routeHash();
  $("#workspace-loading").hidden = true;
  $("#workspace-main").hidden = false;

  if (needsSync) syncQueue = syncQueue.then(syncCloud);
  void loadConnections();
  void features.loadDirectory();
  void features.activity();
  if (canView(actor(), "canvas")) void connectRealtime();
  setInterval(() => {
    if (document.hidden || syncing || syncTimer) return;
    void (async () => {
      const session = await api("session");
      if (!session.user) {
        localStorage.removeItem(storageKey);
        location.replace("/acceso");
        return;
      }
      user = session.user;
      pruneState();
      applyAccess();
      if (activeView !== "blocked" && !canView(actor(), viewSection(activeView))) show(activeView);
      if (cloudDirty) syncQueue = syncQueue.then(syncCloud);
      else await fetchCloud();
      await features.activity();
    })().catch(() => {});
  }, 12000);
}
moduleView = installModules({cloud:()=>cloud, identity:()=>String(actor().id)});
advanced = installBusiness({
  state: () => state,
  actor,
  cloud: () => cloud,
  api,
  mutate,
  render,
  show,
  modal,
  close,
  notify,
  setActor: (member) => {
    if (cloud) user = { ...user, ...member } as any;
    else {
      const me = state.demoMembers?.find((m) => m.id === actor().id);
      if (me) Object.assign(me, member);
    }
  },
  integrations: renderIntegrations,
});
planning = installPlanning({state:()=>state,actor,mutate,modal,close,notify});
work=installWork({state:()=>state,actor,board:()=>activeBoard,mutate,modal,close,notify,render,openTask:id=>openDetail("task",id),openBoard,openPage:id=>openDetail("page",id),openSpace,deleteBoard:()=>actions["delete-board"](),pickFile:pick=>{void workspaceFiles.choose(pick);},openFile:id=>{void workspaceFiles.openLinked(id);}});
workspaceFiles = installWorkspaceFiles({actor,cloud:()=>cloud,api,notify,modal,close});
spatial=installSpatial({state:()=>state,actor,folders:folderRects,preview:canvasCardPreview,space:()=>activeSpace,active:()=>activeView==='canvas'&&canvasOpen&&!canvasDetailId,zoom:()=>camera.z,
 point:(x,y)=>{const rect=$('#canvas-frame').getBoundingClientRect();return {x:((x===undefined?rect.width/2:x-rect.left)-camera.x)/camera.z-127,y:((y===undefined?rect.height/2:y-rect.top)-camera.y)/camera.z-90};},
 rect:nodeRect,mutate,save,removeNode,gifMarkup:canvasMedia.gifMarkup,render:renderCanvas,center:(id)=>centerOnNode(id,true),reveal:(rects)=>revealCanvasRects(rects,true),modal,close,notify,files:workspaceFiles,images:insertCanvasImages});

searchFeature = installSearch({
  state: () => state,
  actor,
  modal,
  close,
  show,
  remote: (q) => advanced.searchRecords(q),
  navigate: (entry: SearchEntry) => {
    if (entry.kind === "task" || entry.kind === "page")
      openDetail(entry.kind, entry.id);
    if (entry.kind === "space") openSpace(entry.id);
    if (entry.kind === "event") openEventDetail(entry.id);
    if (entry.kind === "document") advanced.openFile(entry.id);
    if (entry.kind === "order")
      location.href =
        "/app/tienda/pedidos/" +
        encodeURIComponent(entry.id) +
        "?origen=pedidos";
    if (entry.kind === "section" && entry.view) show(entry.view);
  },
});
home = installHome({
  show,
  personalTasks:openPersonalTasks,
  state: () => state,
  actor,
  cloud: () => cloud,
  api,
  mutate,
  render,
  modal,
  close,
  notify,
  openTask: (id) => openDetail("task", id,true),
  connected: () => connectedProviders.includes("google"),
});
preferences = installPreferences({
  state: () => state,
  actor,
  mutate,
  change: () =>
    typeof commerceReport?.salesChange === "number"
      ? commerceReport.salesChange
      : cloud
        ? null
        : 18.6,
});
directories = installDirectories({get:()=>preferences.get(), update: p=>preferences.update(p),render,notify});
inline = installInline({
  state: () => state,
  actor,
  board: () => activeBoard,
  mutate,
  commit: (fn) => {
    history();
    fn();
    save();
  },
  render,
  modal,
  close,
  notify,
  privateDetail: (id) => openDetail("task", id),
});
trash = installTrash({
  state: () => state,
  actor,
  cloud: () => cloud,
  api,
  mutate,
  save,
  show,
  notify,
  refresh: async () => { await fetchCloud(); },
  forget: () => {
    undoStack = []; redoStack = [];
  },
  external: async () => [
    ...(await advanced.listTrash()),
    ...(await features.listTrash()),
  ],
  removeExternal: async (row) => {
    if (row.collection === "local-files") await advanced.removeTrashedFile(row.id);
    else await features.removeTrashedAccess(row.id);
  },
  restoreExternal: async (row) => {
    if (row.collection === "local-files") await advanced.restoreFile(row.id);
    else features.restoreTrash(row.id);
  },
});
setInterval(() => {
  if (!cloud) trash.expire();
}, 60000);
presence = installPresence({
  state: () => state,
  actor,
  id: cursorId,
  directory: async (ids) =>
    cloud
      ? (
          await api(
            "team?directory=presence&ids=" + encodeURIComponent(ids.join(",")),
          )
        ).docs
      : (state.demoMembers || [])
          .filter((m) => ids.includes(String(m.id)))
          .map((m) => ({ id: String(m.id), avatarData: m.avatarData })),
  space: () => activeSpace,
  visible: () =>
    activeView === "canvas" &&
    canvasOpen &&
    !state.spaces.find((s) => s.id === activeSpace)?.privateOwner,
  camera: () => camera,
  center: (x, y, nodeId) => {
    if (
      nodeId &&
      state.nodes.some((n) => n.id === nodeId && n.space === activeSpace)
    )
      centerOnNode(nodeId);
    else {
      camera.x = frame.clientWidth / 2 - x * camera.z;
      camera.y = frame.clientHeight / 2 - y * camera.z;
      applyCamera();
    }
  },
});
installRichToolbar();
void bootstrap().then(() => {
  if (!cloud) trash.expire();
  void features.preload();
});

document.addEventListener("click",e=>{const item=(e.target as HTMLElement).closest<HTMLElement>("[data-calendar-board]");if(item&&canView(actor(),"tasks")){e.preventDefault();e.stopImmediatePropagation();openBoard(item.dataset.calendarBoard!);}},true);

// Native disclosures retain keyboard semantics; dismiss selection menus outside their panel.
document.addEventListener("click", event => {
  document.querySelectorAll<HTMLDetailsElement>("details.selection-menu[open]").forEach(menu => {
    if (!menu.contains(event.target as Node) ||
      (menu.matches(".task-card-menu") && (event.target as Element).closest(".task-card-menu button"))) {
      menu.open = false;
    }
  });
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  document.querySelectorAll<HTMLDetailsElement>("details.selection-menu[open]").forEach(menu => {
    menu.open = false;
    menu.querySelector<HTMLElement>("summary")?.focus();
  });
});

// Give selection feedback without moving controls or obscuring their count.
document.addEventListener("change", event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.checked) return;
  const documentSelection = input.matches("[data-select-document],#document-select-all");
  const fileSelection = input.matches("[data-asset-select],#workspace-files-all");
  if (!documentSelection && !fileSelection) return;
  const summary = document.querySelector<HTMLElement>(documentSelection ? ".document-bulk-toolbar summary" : ".asset-bulk summary");
  if (!summary || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  summary.classList.remove("selection-feedback");
  void summary.offsetWidth;
  summary.classList.add("selection-feedback");
  summary.addEventListener("animationend", () => summary.classList.remove("selection-feedback"), { once: true });
});

// Close compact navigation on an outside tap without activating the control behind it.
document.addEventListener("click", event => {
  const sidebar = $("#sidebar"), target = event.target as HTMLElement;
  if (!matchMedia("(max-width:1024px)").matches || !sidebar.classList.contains("open") || sidebar.contains(target) || target.closest('[data-action="menu"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  sidebar.classList.remove("open");
  syncSidebarFocus();
  document.querySelector<HTMLElement>('[data-action="menu"]')?.focus({ preventScroll: true });
}, true);
window.matchMedia("(max-width:680px)").addEventListener("change", () => {
  if (activeView === "tasks" && boardOpen) renderTasks();
});

installChartMotion();
installChartInspection();
