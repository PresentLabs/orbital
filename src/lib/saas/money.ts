export function percentageChange(current: unknown, previous: unknown) {
  if (
    current === null ||
    current === undefined ||
    current === "" ||
    previous === null ||
    previous === undefined ||
    previous === ""
  )
    return null;
  const a = Number(current),
    b = Number(previous);
  return Number.isFinite(a) && Number.isFinite(b) && b > 0
    ? ((a - b) / b) * 100
    : null;
}
export function salesPeriods(
  week: boolean,
  now = new Date(),
  timezone = "America/Santiago",
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now),
    part = (key: string) => Number(parts.find((p) => p.type === key)!.value);
  const year = part("year"),
    month = part("month") - 1,
    day = part("day"),
    date = (y: number, m: number, d: number) =>
      new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  return {
    from: date(year, month, week ? day - 6 : 1),
    to: date(year, month, day),
    previousFrom: date(year, week ? month : month - 1, week ? day - 13 : 1),
    previousTo: date(
      year,
      week ? month : month - 1,
      week
        ? day - 7
        : Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()),
    ),
  };
}
