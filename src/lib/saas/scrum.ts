import type { Sprint } from "../../../services/payload/src/planning";
export function burndown(s: Sprint, today: string) {
  const days = Math.round(
      (Date.parse(s.end + "T12:00:00Z") - Date.parse(s.start + "T12:00:00Z")) /
        86400000,
    ),
    history = [...s.history].sort((a, b) => a.date.localeCompare(b.date));
  let remaining = s.initial;
  return Array.from({ length: days + 1 }, (_, index) => {
    const date = new Date(Date.parse(s.start + "T12:00:00Z") + index * 86400000)
        .toISOString()
        .slice(0, 10),
      record = history.find((p) => p.date === date);
    if (record) remaining = record.remaining;
    return {
      date,
      ideal: s.initial * (1 - index / days),
      actual: date <= today ? remaining : null,
    };
  });
}
export function recordSprintProgress(
  state: {
    boards?: { id: string; privateOwner?: string; sprints?: Sprint[] }[];
    tasks: { boardId?: string; privateOwner?: string; status: string }[];
  },
  today: string,
) {
  for (const board of state.boards || []) {
    const s = board.sprints?.at(-1);
    if (!s || today < s.start || today > s.end) continue;
    const tasks = state.tasks.filter(
        (t) =>
          (t.boardId || "general") === board.id &&
          (t.privateOwner || "") === (board.privateOwner || ""),
      ),
      remaining = tasks.filter((t) => t.status !== "done").length,
      point = s.history.find((p) => p.date === today);
    if (point) {
      point.remaining = remaining;
      point.scope = tasks.length;
    } else s.history.push({ date: today, remaining, scope: tasks.length });
  }
}
