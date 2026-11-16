/** Move a selection before a neighbour, retaining both groups' relative order. */
export function moveBefore(order: string[], moving: string[], before: string) {
  const picked = new Set(moving);
  if (picked.has(before) || !order.includes(before)) return [...order];
  const group = order.filter((id) => picked.has(id)),
    rest = order.filter((id) => !picked.has(id));
  rest.splice(rest.indexOf(before), 0, ...group);
  return rest;
}
export function ordered<T extends { id: string }>(items: T[], order: string[]) {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  );
}
export function pageNumbers(current: number, total: number): (number | "…")[] {
  const keep = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  return keep.flatMap((n, i) =>
    i && n - keep[i - 1] > 1 ? ["…" as const, n] : [n],
  );
}

export function moveRelative(
  order: string[],
  moving: string[],
  target: string,
  after = false,
) {
  if (!after) return moveBefore(order, moving, target);
  const picked = new Set(moving);
  if (picked.has(target) || !order.includes(target)) return [...order];
  const group = order.filter((id) => picked.has(id)),
    rest = order.filter((id) => !picked.has(id));
  rest.splice(rest.indexOf(target) + 1, 0, ...group);
  return rest;
}
