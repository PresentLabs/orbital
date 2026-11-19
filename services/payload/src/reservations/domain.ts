import { ModuleError } from "../modules/security.ts";

export type CatalogKind = "service" | "professional" | "location" | "resource" | "customer" | "category" | "extra" | "package";
export type CatalogEntry = {
  id: number; kind: CatalogKind; name: string; active: boolean; value: Record<string, any>;
};
export type WorkPeriod = { weekday: number; start: string; end: string };
export type DateOverride = { day: string; periods: { start: string; end: string }[] };
export type Booking = {
  hold_expires_at?: string | null; payment_status?: string;
  id?: number; service_id: number; professional_id: number | null; location_id: number | null;
  start_at: string; end_at: string; quantity: number; status: string; details: any;
};
export const catalogKinds: CatalogKind[] = ["service", "professional", "location", "resource", "customer", "category", "extra", "package"];
export const occupyingStatuses = ["pending", "confirmed", "completed", "no_show"];
export const defaultSettings = {
  timezone: "America/Santiago", currency: "CLP", intervalMinutes: 15,
  advanceMinutes: 0, horizonDays: 180, paymentHoldMinutes: 15, allowPayLater: false, maxBookingsPerDay: 0, maxFutureBookingsPerCustomer: 0,
  exceptions: [] as DateOverride[],
  schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "18:00" })),
};
export function integer(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    throw new ModuleError("Revisa " + label + ".");
  return value;
}
export function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function minutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ModuleError("Hora no válida.");
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
export function validateSchedule(value: unknown): WorkPeriod[] {
  if (!Array.isArray(value) || value.length > 28) throw new ModuleError("Revisa el horario semanal.");
  const schedule = value.map((period) => {
    const weekday = integer(period?.weekday, 0, 6, "el día de la semana");
    const start = String(period.start), end = String(period.end);
    if (minutes(end) <= minutes(start)) throw new ModuleError("La hora de cierre debe ser posterior al inicio.");
    return { weekday, start, end };
  });
  for (let i = 0; i < schedule.length; i++)
    for (let j = i + 1; j < schedule.length; j++)
      if (schedule[i].weekday === schedule[j].weekday && schedule[i].start < schedule[j].end && schedule[j].start < schedule[i].end)
        throw new ModuleError("Los horarios de un mismo día no pueden superponerse.");
  return schedule;
}
export function validateExceptions(input: unknown): DateOverride[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 366) throw new ModuleError("Revisa las fechas especiales.");
  const seen = new Set<string>();
  return input.map((item) => {
    if (!validDay(item?.day) || seen.has(item.day) || !Array.isArray(item.periods))
      throw new ModuleError("Revisa las fechas especiales: cada fecha debe aparecer una vez.");
    seen.add(item.day);
    const periods = validateSchedule(item.periods.map((period: any) => ({ ...period, weekday: 0 })));
    return { day: item.day, periods: periods.map(({ start, end }) => ({ start, end })) };
  });
}
export function validateSettings(input: any) {
  const value = { ...defaultSettings, ...input };
  try {
    new Intl.DateTimeFormat("es", { timeZone: value.timezone }).format();
    new Intl.NumberFormat("es", { style: "currency", currency: value.currency }).format(0);
  } catch { throw new ModuleError("Zona horaria o moneda no válida."); }
  if (!/^[A-Z]{3}$/.test(value.currency)) throw new ModuleError("Moneda no válida.");
  return {
    timezone: value.timezone, currency: value.currency,
    intervalMinutes: integer(value.intervalMinutes, 5, 240, "el intervalo"),
    advanceMinutes: integer(value.advanceMinutes, 0, 525600, "la anticipación"),
    horizonDays: integer(value.horizonDays, 1, 730, "el plazo máximo"),
    maxBookingsPerDay: integer(value.maxBookingsPerDay, 0, 10000, "el límite diario"),
    maxFutureBookingsPerCustomer: integer(value.maxFutureBookingsPerCustomer, 0, 10000, "el máximo de horas futuras por cliente"),
    paymentHoldMinutes: integer(value.paymentHoldMinutes,5,120,"el plazo de pago"),
    allowPayLater: value.allowPayLater === true,
    schedule: validateSchedule(value.schedule),
    exceptions: validateExceptions(value.exceptions),
  };
}
export function validateEntry(kind: unknown, name: unknown, input: any, active: unknown) {
  if (!catalogKinds.includes(kind as CatalogKind)) throw new ModuleError("Categoría no válida.");
  if (typeof name !== "string" || !name.trim() || name.length > 160 || typeof active !== "boolean")
    throw new ModuleError("Revisa el nombre y estado.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ModuleError("Datos no válidos.");
  const value: Record<string, any> = {};
  if (kind === "service") {
    value.durationMinutes = integer(input.durationMinutes, 5, 1440, "la duración");
    value.priceMinor = integer(input.priceMinor, 0, 100000000000, "el precio");
    value.referencePriceMinor = input.referencePriceMinor === undefined || input.referencePriceMinor === null ? null : integer(input.referencePriceMinor, 0, 100000000000, "el precio de referencia");
    value.categoryId = input.categoryId ? integer(input.categoryId, 1, 2147483647, "la categoría") : null;
    if (!Array.isArray(input.durations ?? []) || (input.durations?.length || 0) > 12) throw new ModuleError("Puedes configurar hasta 12 duraciones alternativas.");
    const seenDurations = new Set<number>([value.durationMinutes]);
    value.durations = (input.durations || []).map((option: any) => {
      const minutes = integer(option?.minutes, 5, 1440, "la duración alternativa");
      if (seenDurations.has(minutes)) throw new ModuleError("Cada duración debe ser distinta, incluida la principal.");
      seenDurations.add(minutes);
      return { minutes, priceMinor: integer(option?.priceMinor, 0, 100000000000, "el precio de la duración") };
    });
    value.capacity = integer(input.capacity ?? 1, 1, 1000, "la capacidad");
    value.bufferBefore = integer(input.bufferBefore ?? 0, 0, 1440, "el margen anterior");
    value.bufferAfter = integer(input.bufferAfter ?? 0, 0, 1440, "el margen posterior");
    value.baseFeeMinor = integer(input.baseFeeMinor ?? 0, 0, 100000000000, "la tarifa base");
    value.maxBookingsPerDay = integer(input.maxBookingsPerDay ?? 0, 0, 10000, "el límite diario");
    value.minExtras = integer(input.minExtras ?? 0, 0, 100, "el mínimo de extras distintos");
    value.maxExtras = integer(input.maxExtras ?? 0, 0, 100, "el máximo de extras distintos");
    if (value.maxExtras && value.minExtras > value.maxExtras) throw new ModuleError("El mínimo de extras no puede superar el máximo.");
    for (const field of ["professionalIds", "locationIds", "resourceIds", "extraIds"]) {
      if (!Array.isArray(input[field] ?? []) || (input[field]?.length || 0) > 100)
        throw new ModuleError("Revisa las asignaciones.");
      value[field] = [...new Set((input[field] || []).map((id: any) => integer(id, 1, 2147483647, "la asignación")))];
    }
  }
  if (kind === "package") {
    value.priceMinor = integer(input.priceMinor,0,100000000000,"el precio del paquete");
    value.referencePriceMinor = input.referencePriceMinor === undefined || input.referencePriceMinor === null ? null : integer(input.referencePriceMinor,0,100000000000,"el precio de referencia");
    value.sortOrder = integer(input.sortOrder ?? 0,0,100000,"el orden del paquete");
    if (!["public","internal"].includes(input.visibility ?? "public")) throw new ModuleError("Revisa la visibilidad del paquete.");
    value.visibility = input.visibility ?? "public";
    if (!Array.isArray(input.sessions) || !input.sessions.length || input.sessions.length > 100) throw new ModuleError("Agrega entre 1 y 100 servicios al paquete.");
    const seen = new Set<number>();
    value.sessions = input.sessions.map((line: any) => {
      const serviceId = integer(line?.serviceId,1,2147483647,"el servicio del paquete");
      if (seen.has(serviceId)) throw new ModuleError("Cada servicio debe aparecer una vez. Ajusta su número de sesiones.");
      seen.add(serviceId);
      return { serviceId, quantity: integer(line.quantity,1,1000,"las sesiones del servicio"), durationMinutes: integer(line.durationMinutes,5,1440,"la duración de cada sesión"), attendees: integer(line.attendees,1,1000,"las personas por sesión") };
    });
  }
  if (kind === "extra") {
    value.durationMinutes = integer(input.durationMinutes ?? 0, 0, 1440, "la duración adicional");
    value.priceMinor = integer(input.priceMinor, 0, 100000000000, "el precio del extra");
    value.maxQuantity = integer(input.maxQuantity ?? 1, 1, 1000, "el máximo de unidades del extra");
  }
  if (kind === "category") {
    value.parentId = input.parentId ? integer(input.parentId, 1, 2147483647, "la categoría superior") : null;
    value.sortOrder = integer(input.sortOrder ?? 0, 0, 100000, "el orden de la categoría");
  }
  if (kind === "professional") {
    value.userId = input.userId ? integer(input.userId, 1, 2147483647, "el usuario asignado") : null;
    value.maxBookingsPerDay = integer(input.maxBookingsPerDay ?? 0, 0, 10000, "el límite diario del profesional");
  }
  if (kind === "resource") value.capacity = integer(input.capacity ?? 1, 1, 1000, "la cantidad de recursos");
  if (kind === "customer") {
    const email = String(input.email || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ModuleError("Correo no válido.");
    value.email = email;
  }
  for (const field of ["description", "phone", "address"]) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== "string" || input[field].length > 2000) throw new ModuleError("Revisa " + field + ".");
      value[field] = input[field].trim();
    }
  }
  if (input.schedule !== undefined) value.schedule = validateSchedule(input.schedule);
  if (input.exceptions !== undefined) value.exceptions = validateExceptions(input.exceptions);
  return { kind: kind as CatalogKind, name: name.trim(), active, value };
}
export function validatePackageServices(entries: CatalogEntry[], value: Record<string, any>, active: boolean) {
  for (const line of value.sessions || []) {
    const service = entries.find(entry => entry.id === line.serviceId && entry.kind === "service");
    if (!service) throw new ModuleError("Los servicios del paquete deben pertenecer a este negocio.");
    if (active && !service.active) throw new ModuleError("Activa los servicios del paquete o guarda el paquete como inactivo.");
    selectServiceDuration(service,line.durationMinutes);
    if (line.attendees > service.value.capacity) throw new ModuleError("Las personas por sesión superan la capacidad de " + service.name + ".");
  }
}
export function selectServiceDuration(service: CatalogEntry, minutes?: number): CatalogEntry {
  if (minutes === undefined || minutes === service.value.durationMinutes) return service;
  integer(minutes, 5, 1440, "la duración elegida");
  const option = (service.value.durations || []).find((option: any) => option.minutes === minutes);
  if (!option) throw new ModuleError("La duración elegida no está disponible para este servicio.");
  return { ...service, value: { ...service.value, durationMinutes: option.minutes, priceMinor: option.priceMinor } };
}
export function normalizeExtraSelection(input: unknown = []): { id: number; quantity: number }[] {
  if (!Array.isArray(input) || input.length > 100) throw new ModuleError("Revisa los extras seleccionados.");
  const seen = new Set<number>();
  return input.map(item => {
    const id = integer(item?.id, 1, 2147483647, "el extra");
    if (seen.has(id)) throw new ModuleError("Cada extra debe aparecer una sola vez.");
    seen.add(id);
    return { id, quantity: integer(item?.quantity, 1, 1000, "la cantidad del extra") };
  }).sort((a,b)=>a.id-b.id);
}
export function selectServiceExtras(service: CatalogEntry, entries: CatalogEntry[], input: unknown = []): CatalogEntry {
  const selected = normalizeExtraSelection(input);
  if (selected.length < (service.value.minExtras || 0)) throw new ModuleError("Selecciona al menos " + service.value.minExtras + " extras distintos.");
  if (service.value.maxExtras && selected.length > service.value.maxExtras) throw new ModuleError("Selecciona como máximo " + service.value.maxExtras + " extras distintos.");
  let duration = service.value.durationMinutes, fee = 0;
  const extras = selected.map(item => {
    const extra = entries.find(entry => entry.id === item.id && entry.kind === "extra" && entry.active);
    if (!extra || !service.value.extraIds?.includes(item.id)) throw new ModuleError("Un extra no está disponible para este servicio.");
    if (item.quantity > extra.value.maxQuantity) throw new ModuleError("El máximo para " + extra.name + " es " + extra.value.maxQuantity + " unidades.");
    duration += extra.value.durationMinutes * item.quantity;
    fee += extra.value.priceMinor * item.quantity;
    return { ...item, name: extra.name, priceMinor: extra.value.priceMinor, durationMinutes: extra.value.durationMinutes };
  });
  integer(duration, 5, 1440, "la duración total con extras");
  integer(fee, 0, 100000000000, "el total de extras");
  return { ...service, value: { ...service.value, durationMinutes: duration, extrasFeeMinor: fee, selectedExtras: extras } };
}
export function bookingExtrasChange(booking: { details: any; start_at: string; end_at: string; amount_minor: number | string }, current: CatalogEntry, entries: CatalogEntry[], selection: unknown) {
  const oldExtras = booking.details.extras || [];
  const originalMinutes = (Date.parse(booking.end_at)-Date.parse(booking.start_at))/60000;
  const baseMinutes = originalMinutes - oldExtras.reduce((sum: number, extra: any) => sum + extra.durationMinutes * extra.quantity, 0);
  const oldFee = oldExtras.reduce((sum: number, extra: any) => sum + extra.priceMinor * extra.quantity, 0);
  const service = selectServiceExtras({ ...current, value: { ...current.value, durationMinutes: baseMinutes,
    bufferBefore: booking.details.bufferBefore, bufferAfter: booking.details.bufferAfter, resourceIds: booking.details.resourceIds,
  } }, entries, selection);
  const amountMinor = integer(Number(booking.amount_minor)-oldFee+service.value.extrasFeeMinor, 0, 100000000000, "el nuevo total");
  return { service, amountMinor };
}
export function validateCategoryLink(entries: CatalogEntry[], kind: string, value: Record<string, any>, editingId?: number) {
  const parentId = kind === "category" ? value.parentId : kind === "service" ? value.categoryId : null;
  if (!parentId) return;
  const categories = new Map(entries.filter(entry => entry.kind === "category").map(entry => [entry.id, entry]));
  if (!categories.has(parentId)) throw new ModuleError("La categoría debe pertenecer a este negocio.");
  if (kind !== "category") return;
  const seen = new Set<number>();
  if (editingId) seen.add(editingId);
  let current: number | null = parentId;
  while (current) {
    if (seen.has(current)) throw new ModuleError("Las categorías no pueden formar un ciclo.");
    seen.add(current);
    const category = categories.get(current);
    if (!category) throw new ModuleError("La categoría superior ya no está disponible.");
    current = category.value.parentId || null;
  }
}
export function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
export function localInstant(day: string, time: string, timezone: string) {
  if (!validDay(day)) throw new ModuleError("Fecha no válida.");
  minutes(time);
  const desired = Date.parse(day + "T" + time + ":00Z");
  let instant = desired;
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = localParts(new Date(instant), timezone);
    const difference = desired - Date.parse(local.day + "T" + local.time + ":00Z");
    if (difference === 0) return new Date(instant);
    instant += difference;
  }
  throw new ModuleError("Esta hora no existe por el cambio de horario. Elige otra.");
}
function insideSchedule(day: string, start: number, duration: number, schedule: WorkPeriod[]) {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  return schedule.some((period) => period.weekday === weekday && start >= minutes(period.start) &&
    start + duration <= minutes(period.end));
}
export function slotAvailable(input: {
  start: Date; service: CatalogEntry; professionalId: number | null; locationId: number | null;
  quantity: number; catalog: CatalogEntry[]; bookings: Booking[]; settings: ReturnType<typeof validateSettings>;
  now?: Date; excludeId?: number;
}) {
  const { start, service, professionalId, locationId, quantity, catalog, settings } = input;
  const now = input.now || new Date();
  if (!service.active || service.kind !== "service" || quantity > service.value.capacity) return false;
  if (start.getTime() < now.getTime() + settings.advanceMinutes * 60000 ||
      start.getTime() > now.getTime() + settings.horizonDays * 86400000) return false;
  const local = localParts(start, settings.timezone);
  const startMinutes = minutes(local.time);
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0 ||
      startMinutes % settings.intervalMinutes !== 0) return false;
  const duration = service.value.durationMinutes;
  const end = new Date(start.getTime() + duration * 60000);
  const endLocal = localParts(end, settings.timezone);
  if (endLocal.day !== local.day || minutes(endLocal.time) - startMinutes !== duration) return false;
  const professional = catalog.find((row) => row.id === professionalId && row.kind === "professional" && row.active);
  const location = catalog.find((row) => row.id === locationId && row.kind === "location" && row.active);
  if (professionalId && (!professional || !service.value.professionalIds.includes(professionalId))) return false;
  if (locationId && (!location || !service.value.locationIds.includes(locationId))) return false;
  if (service.value.professionalIds.length && !professionalId) return false;
  if (service.value.locationIds.length && !locationId) return false;
  for (const owner of [settings, service.value, professional?.value, location?.value]) {
    if (!owner) continue;
    const exception = owner.exceptions?.find((item: DateOverride) => item.day === local.day);
    const schedule = exception
      ? exception.periods.map((period: any) => ({ ...period, weekday: new Date(local.day + "T12:00:00Z").getUTCDay() }))
      : owner.schedule;
    if (schedule && !insideSchedule(local.day, startMinutes, duration, schedule)) return false;
  }
  const active = input.bookings.filter((row) => row.id !== input.excludeId && occupyingStatuses.includes(row.status) && !(row.status === "pending" && row.payment_status === "unpaid" && row.hold_expires_at && Date.parse(row.hold_expires_at) <= now.getTime()));
  const inDay = active.filter((row) => localParts(new Date(row.start_at), settings.timezone).day === local.day);
  if (settings.maxBookingsPerDay && inDay.length >= settings.maxBookingsPerDay) return false;
  if (service.value.maxBookingsPerDay &&
      inDay.filter((row) => row.service_id === service.id).length >= service.value.maxBookingsPerDay) return false;
  if (professional?.value.maxBookingsPerDay && inDay.filter((row) => row.professional_id === professionalId).length >= professional.value.maxBookingsPerDay) return false;
  const blockStart = start.getTime() - service.value.bufferBefore * 60000;
  const blockEnd = end.getTime() + service.value.bufferAfter * 60000;
  const overlapping = active.filter((row) =>
    Date.parse(row.start_at) - (row.details?.bufferBefore || 0) * 60000 < blockEnd &&
    Date.parse(row.end_at) + (row.details?.bufferAfter || 0) * 60000 > blockStart);
  const sameSlot = (row: Booking) => row.service_id === service.id && row.professional_id === professionalId &&
    row.location_id === locationId && Date.parse(row.start_at) === start.getTime() && Date.parse(row.end_at) === end.getTime();
  if (overlapping.some((row) => professionalId && row.professional_id === professionalId && !sameSlot(row))) return false;
  if (overlapping.some((row) => row.service_id === service.id && row.professional_id === professionalId &&
      row.location_id === locationId && !sameSlot(row))) return false;
  const attendees = overlapping.filter(sameSlot).reduce((count, row) => count + row.quantity, 0);
  if (attendees + quantity > service.value.capacity) return false;
  for (const id of service.value.resourceIds) {
    const resource = catalog.find((row) => row.id === id && row.kind === "resource" && row.active);
    if (!resource) return false;
    const used = overlapping.filter((row) => row.details?.resourceIds?.includes(id)).length;
    if (used + 1 > resource.value.capacity) return false;
  }
  return true;
}
export function quote(service: CatalogEntry, quantity: number) {
  integer(quantity, 1, 1000, "la cantidad de asistentes");
  const amount = service.value.priceMinor * quantity + service.value.baseFeeMinor + (service.value.extrasFeeMinor || 0);
  return integer(amount, 0, 100000000000, "el total");
}
