export function notificationTime(value: string, now = Date.now()) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Fecha no disponible";
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return "Ahora";
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  return seconds < 3600
    ? formatter.format(-Math.floor(seconds / 60), "minute")
    : seconds < 86400
      ? formatter.format(-Math.floor(seconds / 3600), "hour")
      : formatter.format(-Math.floor(seconds / 86400), "day");
}
