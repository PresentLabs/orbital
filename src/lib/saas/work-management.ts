import type { WorkspaceState, TaskBoard, Task } from "./model";
import {
  activeCycle,
  companyDay,
  validDay,
  type BoardWork,
  type WorkCycle,
  type WorkEvent,
} from "../../../services/payload/src/work-management.ts";
export * from "../../../services/payload/src/work-management.ts";
export function ensureWork(board: TaskBoard): BoardWork {
  return (board.work ??= { mode: "daily", cycles: [], periods: [] });
}
export const boardTasks = (state: WorkspaceState, board: TaskBoard) =>
  state.tasks.filter(
    (t) =>
      (t.boardId || "general") === board.id &&
      (t.privateOwner || "") === (board.privateOwner || ""),
  );
export function cycleCounts(c: WorkCycle, tasks: Task[]) {
  const selected = tasks.filter((t) => c.taskIds.includes(t.id));
  return {
    scope: selected.length,
    remaining: selected.filter((t) => t.status !== "done").length,
  };
}
export function startCycle(
  board: TaskBoard,
  cycle: WorkCycle,
  tasks: Task[],
  now = new Date(),
  timezone = "America/Santiago",
) {
  const work = ensureWork(board),
    today = companyDay(timezone, now);
  if (
    cycle.status !== "draft" ||
    !validDay(cycle.start) ||
    !validDay(cycle.end) ||
    work.mode !== "cycles" ||
    activeCycle(board) ||
    !cycle.goal.trim() ||
    !cycle.name.trim() ||
    cycle.end < cycle.start ||
    cycle.start > today ||
    !cycle.taskIds.length ||
    cycle.taskIds.some((id) => !tasks.some((t) => t.id === id))
  )
    throw Error(
      "Define un objetivo, fechas válidas y al menos una tarea. Solo puede haber un ciclo activo; su inicio no puede ser futuro.",
    );
  const counts = cycleCounts(cycle, tasks);
  cycle.status = "active";
  cycle.startedAt = now.toISOString();
  cycle.initial = counts.remaining;
  cycle.initialScope = counts.scope;
  cycle.events = [
    {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      kind: "started",
      ...counts,
    },
  ];
}
/** Observe actual mutations only. Missing tasks are removed from scope but participation remains in events. */
export function reconcileWork(
  state: WorkspaceState,
  before: WorkspaceState,
  now = new Date(),
) {
  const at = now.toISOString();
  for (const t of state.tasks) {
    const old = before.tasks.find((x) => x.id === t.id);
    if (
      old &&
      old.status !== t.status &&
      (old.status === "done" || t.status === "done")
    )
      t.activity = [
        ...(old.activity || []),
        { at, kind: t.status === "done" ? "completed" : "reopened" },
      ];
  }
  for (const b of state.boards || []) {
    const c = activeCycle(b),
      previous = before.boards?.find((x) => x.id === b.id),
      old = previous && activeCycle(previous);
    if (!c || old?.id !== c.id) continue;
    const tasks = boardTasks(state, b),
      past = boardTasks(before, previous!),
      previousIds = new Set(old.taskIds),
      newIds = new Set(c.taskIds);
    const changes: { kind: WorkEvent["kind"]; taskId: string }[] = [];
    for (const id of previousIds) {
      const t = tasks.find((t) => t.id === id),
        p = past.find((t) => t.id === id);
      if (!t) {
        c.taskIds = c.taskIds.filter((x) => x !== id);
        changes.push({ kind: "trashed", taskId: id });
      } else if (!newIds.has(id)) changes.push({ kind: "removed", taskId: id });
      else if (
        p &&
        p.status !== t.status &&
        (p.status === "done" || t.status === "done")
      )
        changes.push({
          kind: t.status === "done" ? "completed" : "reopened",
          taskId: id,
        });
    }
    for (const id of newIds)
      if (!previousIds.has(id)) changes.push({ kind: "added", taskId: id });
    // Each transaction records its real final counts; individual events explain all changes in that transaction.
    for (const change of changes)
      c.events.push({
        id: crypto.randomUUID(),
        at,
        ...change,
        ...cycleCounts(c, tasks),
      });
  }
}
export function cycleSeries(c: WorkCycle, timezone: string, now = new Date()) {
  const today = companyDay(timezone, now),
    start = Date.parse(c.start + "T12:00:00Z");
  const records = new Map<string, WorkEvent>();
  for (const e of c.events) {
    const day = companyDay(timezone, new Date(e.at));
    if (day <= today) records.set(day, e);
  }
  const domainEnd = [c.end, ...records.keys()].sort().at(-1)!;
  const days = Math.max(
    1,
    (Date.parse(domainEnd + "T12:00:00Z") - start) / 86400000,
  );
  return {
    domainEnd,
    ideal: [
      { date: c.start, value: c.initial || 0 },
      { date: c.end, value: 0 },
    ],
    observed: [...records]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => ({ date, value: e.remaining, scope: e.scope })),
    position: (date: string) =>
      Math.max(
        0,
        Math.min(
          1,
          (Date.parse(date + "T12:00:00Z") - start) / (days * 86400000),
        ),
      ),
  };
}
/** Undo a task mutation as a new fact; never erase a started cycle or a closed decision. */
export function retainWorkOnUndo(
  next: WorkspaceState,
  current: WorkspaceState,
) {
  for (const b of next.boards || []) {
    const old = current.boards?.find((i) => i.id === b.id);
    if (!old?.work) continue;
    const recorded =
      old.work.cycles.some((c) => c.status !== "draft") ||
      old.work.periods.length > 0;
    if (!recorded) continue;
    const w = ensureWork(b);
    w.cycles = structuredClone(old.work.cycles);
    w.periods = structuredClone(old.work.periods);
    if (activeCycle(old) || old.work.periods.some((p) => p.status === "active"))
      w.mode = old.work.mode;
  }
  reconcileWork(next, current);
}
