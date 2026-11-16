export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export function expired(deletedAt: unknown, now = Date.now()) {
  const time = Date.parse(String(deletedAt || ""));
  return Number.isFinite(time) && now - time >= RETENTION_MS;
}
export function trashDaysLeft(deletedAt: string, now = Date.now()) {
  return Math.max(
    0,
    Math.ceil((Date.parse(deletedAt) + RETENTION_MS - now) / 86400000),
  );
}

/** Retention starts at the first deletion; clients cannot shorten or extend it. */
export function normalizeDeletion(
  data: any,
  originalDoc: any,
  now = Date.now(),
) {
  if (!data || !Object.hasOwn(data, "deletedAt")) return;
  if (data.deletedAt === null) {
    if (expired(originalDoc?.deletedAt, now))
      throw Error("El plazo de recuperación terminó.");
    return;
  }
  if (data.deletedAt === undefined) return;
  if (data.deletedAt === "" || data.deletedAt === false)
    throw Error("Fecha de eliminación no válida.");
  if (data.deletedAt)
    data.deletedAt = originalDoc?.deletedAt || new Date(now).toISOString();
}
