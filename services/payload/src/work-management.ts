/** Shared, additive work model. Missing configuration means daily work; legacy sprints stay untouched. */
export type WorkMode = "daily" | "cycles" | "project";
export const workModes = {
  daily: "Trabajo diario",
  cycles: "Por ciclos",
  project: "Proyecto con tiempo definido",
} as const;
export type WorkEvent = {
  id: string;
  at: string;
  kind: "started" | "added" | "removed" | "completed" | "reopened" | "trashed";
  taskId?: string;
  remaining: number;
  scope: number;
};
export type WorkCycle = {
  id: string;
  name: string;
  goal: string;
  start: string;
  end: string;
  status: "draft" | "active" | "closed";
  taskIds: string[];
  initial?: number;
  initialScope?: number;
  events: WorkEvent[];
  startedAt?: string;
  closedAt?: string;
  review?: {
    achieved: string;
    worked: string;
    improve: string;
    pending: "backlog" | "later";
  };
};
export type WorkPeriod = {
  id: string;
  start: string;
  end: string;
  status: "active" | "closed" | "replanned";
  decision?: string;
  result?: string;
  closedAt?: string;
};
export type BoardWork = {
  mode: WorkMode;
  summary?: Record<string, string>;
  limit?: number;
  cycles: WorkCycle[];
  periods: WorkPeriod[];
};
export type ResourceLink = {
  kind: "tasks" | "boards" | "pages" | "spaces" | "nodes" | "files";
  id: string;
};
export const validDay = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
  new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
const id = (v: any) =>
  typeof v === "string" && /^[a-zA-Z0-9 _-]{1,100}$/.test(v);
const text = (v: any, n = 5000) => typeof v === "string" && v.length <= n;
const stamp = (v: any) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
export function companyDay(timezone = "America/Santiago", now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
export const modeOf = (board: { work?: BoardWork }) =>
  board.work?.mode || "daily";
export const activeCycle = (board: { work?: BoardWork }) =>
  board.work?.cycles.find((c) => c.status === "active");
export function validLinks(v: any) {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.length <= 50 &&
      v.every(
        (l) =>
          l &&
          ["tasks", "boards", "pages", "spaces", "nodes", "files"].includes(
            l.kind,
          ) &&
          (l.kind === "files"
            ? typeof l.id === "string" && /^[a-zA-Z0-9 _:-]{1,160}$/.test(l.id)
            : id(l.id)),
      ))
  );
}
export function validTaskWork(v: any) {
  return (
    (!v.blockedAt || stamp(v.blockedAt)) &&
    (v.startDate === undefined || v.startDate === "" || (validDay(v.startDate) && (!v.due || v.startDate<=v.due))) &&
    (v.blockedReason === undefined || text(v.blockedReason, 1000)) &&
    (v.assigneeId === undefined || v.assigneeId === "" || id(v.assigneeId)) &&
    (v.descriptionHtml === undefined || text(v.descriptionHtml, 30000)) &&
    validLinks(v.links) &&
    (v.activity === undefined ||
      (Array.isArray(v.activity) &&
        v.activity.length <= 2000 &&
        v.activity.every(
          (e: any) =>
            e && stamp(e.at) && ["completed", "reopened"].includes(e.kind),
        )))
  );
}
export function validBoardWork(v: any): boolean {
  if (v === undefined) return true;
  if (
    !v ||
    !["daily", "cycles", "project"].includes(v.mode) ||
    !Array.isArray(v.cycles) ||
    v.cycles.length > 100 ||
    !Array.isArray(v.periods) ||
    v.periods.length > 100
  )
    return false;
  if (
    v.limit !== undefined &&
    (!Number.isInteger(v.limit) || v.limit < 1 || v.limit > 1000)
  )
    return false;
  if (
    v.summary !== undefined &&
    (!v.summary ||
      Object.keys(v.summary).length > 20 ||
      !Object.entries(v.summary).every(
        ([k, x]) => /^[a-zA-Z]+$/.test(k) && text(x, 30000),
      ))
  )
    return false;
  if (
    v.cycles.filter((c: any) => c.status === "active").length > 1 ||
    v.periods.filter((p: any) => p.status === "active").length > 1
  )
    return false;
  if (v.mode !== "cycles" && v.cycles.some((c: any) => c.status === "active"))
    return false;
  if (v.mode !== "project" && v.periods.some((p: any) => p.status === "active"))
    return false;
  if (new Set(v.cycles.map((c: any) => c.id)).size !== v.cycles.length)
    return false;
  return (
    v.cycles.every(
      (c: any) =>
        c &&
        id(c.id) &&
        text(c.name, 80) &&
        text(c.goal, 2000) &&
        validDay(c.start) &&
        validDay(c.end) &&
        c.end >= c.start &&
        ["draft", "active", "closed"].includes(c.status) &&
        Array.isArray(c.taskIds) &&
        c.taskIds.length <= 1000 &&
        c.taskIds.every(id) &&
        new Set(c.taskIds).size === c.taskIds.length &&
        Array.isArray(c.events) &&
        c.events.length <= 10000 &&
        c.events.every(
          (e: any) =>
            e &&
            id(e.id) &&
            stamp(e.at) &&
            [
              "started",
              "added",
              "removed",
              "completed",
              "reopened",
              "trashed",
            ].includes(e.kind) &&
            (!e.taskId || id(e.taskId)) &&
            Number.isInteger(e.remaining) &&
            e.remaining >= 0 &&
            Number.isInteger(e.scope) &&
            e.scope >= e.remaining,
        ) &&
        (c.status === "draft" ||
          (c.goal.trim() &&
            stamp(c.startedAt) &&
            Number.isInteger(c.initial) &&
            c.initial >= 0 &&
            Number.isInteger(c.initialScope) &&
            c.initialScope >= c.initial &&
            c.events.length > 0)) &&
        (c.status !== "closed" ||
          (stamp(c.closedAt) &&
            c.review &&
            text(c.review.achieved, 80) &&
            text(c.review.worked) &&
            text(c.review.improve) &&
            ["backlog", "later"].includes(c.review.pending))),
    ) &&
    v.periods.every(
      (p: any) =>
        p &&
        id(p.id) &&
        validDay(p.start) &&
        validDay(p.end) &&
        p.end >= p.start &&
        ["active", "closed", "replanned"].includes(p.status) &&
        (p.status === "active" ||
          (stamp(p.closedAt) &&
            text(p.decision, 2000) &&
            text(p.result, 5000))),
    )
  );
}
/** Do not drop past decisions when changing the current mode. */
export function boardTransitionError(previous: any, next: any): string | null {
  if (!validBoardWork(next))
    return "Revisa la forma de trabajo, las fechas y los ciclos activos.";
  if (!previous) return null;
  for (const old of previous.cycles || []) {
    const item = next?.cycles?.find((c: any) => c.id === old.id);
    if (!item) return "Conserva el historial de ciclos.";
    if (old.status === "closed" && !sameWorkData(item, old))
      return "La revisión cerrada se conserva como historial.";
    if (old.status === "active" && item.status === "draft")
      return "Un ciclo iniciado debe cerrarse explícitamente.";
    if (
      old.events?.some((e: any, i: number) => !sameWorkData(e, item.events[i]))
    )
      return "Conserva los registros anteriores del ciclo.";
  }
  for (const old of previous.periods || []) {
    const item = next?.periods?.find((p: any) => p.id === old.id);
    if (!item) return "Conserva los períodos anteriores.";
    if (old.status !== "active" && !sameWorkData(item, old))
      return "Las decisiones anteriores se conservan.";
  }
  return null;
}

export function sameWorkData(a: any, b: any): boolean {
  const canonical = (v: any): any =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .filter((k) => v[k] !== undefined)
              .map((k) => [k, canonical(v[k])]),
          )
        : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
