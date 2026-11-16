import type { Task, PersonalFocus } from "./model.ts";
export function eligibleTasks(tasks: Task[], userId: string) {
  return tasks.filter(
    (t) =>
      ["todo", "doing"].includes(t.status) &&
      (!t.privateOwner || t.privateOwner === userId),
  );
}
export function focusTasks(
  tasks: Task[],
  focus: PersonalFocus | undefined,
  userId: string,
) {
  const eligible = new Map(eligibleTasks(tasks, userId).map((t) => [t.id, t]));
  return (focus?.selections || []).flatMap((entry) => {
    const task = eligible.get(entry.taskId);
    return task ? [{ task, addedOn: entry.addedOn }] : [];
  });
}

import type { WorkspaceState, WorkspaceMember } from "./model.ts";
import { canView } from "../../../services/payload/src/permissions.ts";
import {
  companyDay,
  validDay,
} from "../../../services/payload/src/work-management.ts";
const calendarNumber = (day: string) =>
  Date.parse(day + "T12:00:00Z") / 86400000;
export function taskDueLabel(due: string, today: string) {
  if (!validDay(due) || !validDay(today)) return "";
  const days = Math.round(calendarNumber(due) - calendarNumber(today));
  return days < 0
    ? `Vencida hace ${-days} ${days === -1 ? "día" : "días"}`
    : days === 0
      ? "Vence hoy"
      : days === 1
        ? "Vence mañana"
        : `Vence en ${days} días`;
}
export const priorityProgressLabel = (count: number) =>
  count > 0
    ? `${count} ${count === 1 ? "prioridad" : "prioridades"} en progreso`
    : "";
/** State has already been tenant-scoped by Payload. Personal selection never broadens resource visibility. */
export function personalDay(
  state: Pick<
    WorkspaceState,
    "tasks" | "boards" | "focus" | "settings" | "trash"
  >,
  actor: WorkspaceMember,
  now = new Date(),
) {
  const today = companyDay(state.settings.timezone, now);
  if (!canView(actor, "tasks"))
    return { today, personal: [], priorities: [], attention: [], progress: 0 };
  const me = String(actor.id),
    focus = state.focus?.find((f) => f.id === me && f.privateOwner === me),
    selected = new Set(focus?.selections.map((e) => e.taskId) || []);
  const available = pendingHomeTasks(state, actor);
  const personal = available.filter(
    (t) => String(t.assigneeId || "") === me || selected.has(t.id),
  );
  const byDue = (a: Task, b: Task) =>
    (validDay(a.due) ? a.due : "9999-12-31").localeCompare(
      validDay(b.due) ? b.due : "9999-12-31",
    ) || a.title.localeCompare(b.title, "es");
  const order = new Map((focus?.selections || []).map((entry, i) => [entry.taskId, i]));
  const priorities = personal.filter((t) => selected.has(t.id)).sort((a,b) => order.get(a.id)! - order.get(b.id)!);
  const attention = personal
    .filter(
      (t) =>
        !selected.has(t.id) &&
        validDay(t.due) &&
        calendarNumber(t.due) <= calendarNumber(today) + 7,
    )
    .sort(byDue)
    .slice(0, 3);
  return {
    today,
    personal: personal.sort(byDue),
    priorities,
    attention,
    progress: priorities.filter((t) => t.status === "doing").length,
  };
}

export function pendingHomeTasks(state: Pick<WorkspaceState, "tasks" | "boards" | "trash">, actor: WorkspaceMember) {
  return visibleHomeTasks(state, actor).filter(task => task.status !== "done");
}

export function visibleHomeTasks(
  state: Pick<WorkspaceState, "tasks" | "boards" | "trash">,
  actor: WorkspaceMember,
) {
  if (!canView(actor, "tasks")) return [];
  const me = String(actor.id);
  const deleted = new Set(
    (state.trash || []).flatMap((t) =>
      t.items.filter((i) => i.group === "tasks").map((i) => i.value?.id),
    ),
  );
  const deletedBoards = new Set(
    (state.trash || []).flatMap((t) =>
      t.items.filter((i) => i.group === "boards").map((i) => i.value?.id),
    ),
  );
  return state.tasks.filter((t) => {
    if (t.privateOwner && t.privateOwner !== me) return false;
    const flags = t as Task & {
      deletedAt?: string;
      archivedAt?: string;
      archived?: boolean;
    };
    if (
      deleted.has(t.id) ||
      deletedBoards.has(t.boardId || "general") ||
      flags.deletedAt ||
      flags.archivedAt ||
      flags.archived
    )
      return false;
    const board = state.boards?.find((b) => b.id === (t.boardId || "general"));
    if (board) {
      if (board.privateOwner && board.privateOwner !== me) return false;
      if ((board.privateOwner || "") !== (t.privateOwner || "")) return false;
      if (
        (board as any).deletedAt ||
        (board as any).archivedAt ||
        (board as any).archived
      )
        return false;
    } else if (t.boardId && t.boardId !== "general" && state.boards)
      return false;
    return true;
  });
}
