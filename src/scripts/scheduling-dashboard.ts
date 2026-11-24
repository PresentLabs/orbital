import { smoothLine } from "@/lib/saas/chart-path";
import { schedulingChart } from "@/lib/saas/scheduling-chart";
import { bookingStatus } from "@/lib/saas/scheduling-status";
import { chartSamples } from "./workspace-chart-inspect";
import { uiIcon } from "@/lib/saas/icons";
export type SchedulingDashboard = {
  from: string; to: string; days: number; timezone: string; currency: string;
  totals: { bookings: number; confirmed: number; pending: number; canceled: number; completed: number; customers: number; paidMinor: number };
  daily: { day: string; count: number; canceled: number; customers?: number; pending?: number; paidMinor?: number }[];
  upcoming: Appointment[]; today: Appointment[]; todayTotal?: number;
  services: { service_id: number; name: string; count: number }[];
  professionals: { professional_id: number | null; name: string; count: number }[];
};
type Appointment = { id: number; customerName: string; serviceName: string; professionalName?: string; locationName?: string; startAt: string; endAt: string; status: string };
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const dayLabel = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
function dailyComparison(days: SchedulingDashboard["daily"]) {
  if (!days.length) return '<p class="scheduling-empty">Aún no hay datos para este período.</p>';

  const left = 30, right = 410, top = 14, baseline = 137;
  const slot = (right - left) / days.length;
  const barWidth = Math.min(16, slot * .31);
  const { maximum } = schedulingChart(days.map(day => ({
    day: day.day,
    count: Math.max(day.count, day.canceled),
  })));
  const barHeight = (value: number) => value / maximum * (baseline - top);
  const tickEvery = Math.ceil(days.length / 7);

  return `<figure class="scheduling-daily-comparison">
    <div class="scheduling-comparison-legend" aria-hidden="true"><span>Agendadas</span><span>Canceladas</span></div>
    <svg viewBox="0 0 420 164" role="group" aria-label="Horas agendadas y canceladas por día">
      ${[0, maximum / 2, maximum].map(value => {
        const y = baseline - barHeight(value);
        return `<line class="scheduling-gridline" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text x="${left - 7}" y="${y + 4}" text-anchor="end">${value}</text>`;
      }).join("")}
      ${days.map((day, index) => {
        const x = left + index * slot;
        const center = x + slot / 2;
        const date = dayLabel(day.day);
        const values = `${day.count} agendadas · ${day.canceled} canceladas`;
        const bar = (amount: number, offset: number, style: string) => {
          const height = barHeight(amount);
          return `<rect class="${style}" x="${center + offset}" y="${baseline - height}" width="${barWidth}" height="${height}" rx="2"/>`;
        };
        return `<g>
          ${bar(day.count, -barWidth - 1, "scheduled-bar")}
          ${bar(day.canceled, 1, "canceled-bar")}
          ${index % tickEvery === 0 || index === days.length - 1 && index % tickEvery >= tickEvery / 2 ? `<text x="${center}" y="156" text-anchor="middle">${esc(date)}</text>` : ""}
          <rect class="chart-sample comparison-sample" x="${x}" y="${top}" width="${slot}" height="${baseline - top + 5}" tabindex="0" role="button" aria-label="${esc(date + ": " + values)}" data-chart-label="${esc(date)}" data-chart-value="${esc(values)}"><title>${esc(date + ": " + values)}</title></rect>
        </g>`;
      }).join("")}
    </svg>
    <figcaption>Toca o selecciona un día para consultar sus cifras.</figcaption>
  </figure>`;
}

export function dashboardHTML(data: SchedulingDashboard) {
  const { totals } = data;
  const time = (instant: string) => new Date(instant).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: data.timezone });
  const localDay = (instant: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: data.timezone }).format(new Date(instant));
  const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: data.currency }).format(Number(totals.paidMinor) / 10 ** (new Intl.NumberFormat("es-CL", { style: "currency", currency: data.currency }).resolvedOptions().maximumFractionDigits ?? 2));
  const plot = schedulingChart(data.daily);
  const metric = (label: string, value: string | number, detail: string, icon: string, field: "count" | "customers" | "pending" | "paidMinor") => {
    const samples = data.daily.map(day => Number(day[field] ?? 0));
    const max = Math.max(1, ...samples);
    const points = samples.map((value, index) => [1 + index / Math.max(1, samples.length - 1) * 98, 28 - value / max * 24]);
    return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon">${uiIcon(icon, 17)}</span></div><div class="metric-value">${value}</div><div class="metric-bottom"><span>${detail}</span><svg class="sparkline" viewBox="0 0 100 32" role="img" aria-label="${label} por día"><path d="${smoothLine(points)}"/></svg></div></article>`;
  };
  const appointment = (item: Appointment, compact = false) => `<li class="scheduling-appointment"><div class="scheduling-time"><strong>${time(item.startAt)}</strong><span class="commerce-pill booking-status order-status-${bookingStatus(item.status).commerce}" data-booking-status="${esc(item.status)}">${bookingStatus(item.status).label}</span><small>${dayLabel(localDay(item.startAt))} · ${time(item.endAt)}</small></div><div class="scheduling-appointment-copy"><div class="scheduling-person-heading"><strong>${esc(item.customerName)}</strong></div><span>${esc(item.serviceName)}</span><small>${esc(item.professionalName || "Sin profesional asignado")}${item.locationName ? " · " + esc(item.locationName) : ""}</small></div><div class="scheduling-appointment-end"><button class="subtle-button" data-agenda-day="${esc(localDay(item.startAt))}" aria-label="Ver agenda del ${esc(dayLabel(localDay(item.startAt)))}">Ver día ${uiIcon("arrowRight", 14)}</button></div></li>`;
  const ranking = (items: { name: string; count: number }[], empty: string) => {
    const max = Math.max(1, ...items.map((item) => item.count));
    return items.length ? `<ol class="scheduling-ranking">${items.map((item,index) => `<li><div class="ranking-label"><span class="ranking-position">${index+1}</span><strong>${esc(item.name)}</strong><span class="ranking-count"><b>${item.count}</b> ${item.count === 1 ? "atención" : "atenciones"}</span></div><div class="scheduling-track"><span style="width:${item.count / max * 100}%"></span></div></li>`).join("")}</ol>` : `<p class="scheduling-empty">${empty}</p>`;
  };
  return `    <div class="scheduling-priority-grid"><section class="panel scheduling-today"><div class="scheduling-panel-heading"><div><h2>Agenda de hoy</h2><p>${dayLabel(data.to)} · ${data.todayTotal ?? data.today.length} ${(data.todayTotal ?? data.today.length) === 1 ? "hora agendada" : "horas agendadas"}</p></div><button class="button secondary" data-agenda-day="${data.to}">Ver agenda del día ${uiIcon("arrowRight",14)}</button></div><div class="overflow-hint scheduling-today-scroll"><ul data-scroll-region tabindex="0" aria-label="Agenda de hoy">${data.today.length ? data.today.map((item) => appointment(item)).join("") : '<li class="scheduling-empty">Tu agenda está libre por hoy.</li>'}</ul></div></section><section class="panel scheduling-upcoming"><div class="scheduling-panel-heading"><div><h2>Próximas atenciones</h2><p>Lo que viene en tu agenda</p></div><button class="subtle-button" data-scheduling-go="agenda">Ver agenda ${uiIcon("arrowRight", 14)}</button></div><div class="overflow-hint scheduling-upcoming-scroll"><ul data-scroll-region tabindex="0" aria-label="Próximas atenciones">${data.upcoming.length ? data.upcoming.map((item) => appointment(item, true)).join("") : '<li class="scheduling-empty">No hay próximas atenciones. Las horas que agendes aparecerán aquí.</li>'}</ul></div></section></div>

    <div class="scheduling-period"><div><p>${dayLabel(data.from)} al ${dayLabel(data.to)}</p></div><label>Período<select id="scheduling-period"><option value="7" ${data.days === 7 ? "selected" : ""}>Últimos 7 días</option><option value="30" ${data.days === 30 ? "selected" : ""}>Últimos 30 días</option></select></label></div>
    <div class="metric-grid scheduling-kpis">${metric("Horas agendadas", totals.bookings, `${totals.confirmed} confirmadas · ${totals.completed} realizadas`, "calendar", "count")}${metric("Clientes", totals.customers, "Clientes únicos del período", "users", "customers")}${metric("Por confirmar", totals.pending, "Horas pendientes en el período", "clock", "pending")}${metric("Monto pagado", money, "De las horas del período, sin cancelaciones", "dollar", "paidMinor")}</div>
    <div class="scheduling-insights-grid"><div class="scheduling-main-grid"><section class="panel scheduling-chart"><div class="scheduling-panel-heading"><div><h2>Movimiento de la agenda</h2><p>Horas por día según su fecha de atención</p></div></div>
      <div class="chart-tabs" role="tablist" aria-label="Movimiento de la agenda"><button type="button" role="tab" id="scheduling-chart-tab" aria-controls="scheduling-chart-panel" aria-selected="true">Horas agendadas</button><button type="button" role="tab" id="scheduling-comparison-tab" aria-controls="scheduling-comparison-panel" aria-selected="false" tabindex="-1">Comparación diaria</button></div>
      <div role="tabpanel" id="scheduling-chart-panel" aria-labelledby="scheduling-chart-tab"><figure><svg class="sales-chart scheduling-line-chart" viewBox="0 0 ${plot.width} ${plot.height}" role="group" aria-label="Horas agendadas por día">
      <defs><linearGradient id="scheduling-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--chart-color)" stop-opacity=".18"/><stop offset="100%" stop-color="var(--chart-color)" stop-opacity="0"/></linearGradient></defs>
      ${[0,.5,1].map((ratio) => `<line x1="${plot.left}" x2="${plot.right}" y1="${plot.baseline-ratio*(plot.baseline-plot.top)}" y2="${plot.baseline-ratio*(plot.baseline-plot.top)}" class="scheduling-gridline"/><text x="${plot.left-10}" y="${plot.baseline-ratio*(plot.baseline-plot.top)+4}" text-anchor="end">${plot.maximum*ratio}</text>`).join("")}
      <path d="${plot.area}" fill="url(#scheduling-area-fill)"/><path d="${plot.path}" fill="none" stroke="var(--chart-color)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      ${data.daily.map((item,i) => data.daily.length <=7 || i%5===0 || i===data.daily.length-1 ? `<text x="${plot.points[i][0]}" y="203" text-anchor="${i===0?"start":i===data.daily.length-1?"end":"middle"}">${dayLabel(item.day)}</text>` : "").join("")}
      ${chartSamples(plot.points,data.daily.map(item=>dayLabel(item.day)),data.daily.map(item=>`${item.count} ${item.count===1?"hora":"horas"} · ${item.canceled} canceladas`))}</svg>
      <p class="chart-instruction">Toca un día o recorre el gráfico para ver sus horas y cancelaciones.</p><figcaption>${totals.bookings ? `${totals.bookings} horas agendadas · ${totals.canceled} canceladas en el período.` : "Aún no hay horas agendadas en este período."}</figcaption></figure></div><div role="tabpanel" id="scheduling-comparison-panel" aria-labelledby="scheduling-comparison-tab" hidden>${dailyComparison(data.daily)}</div>
    </section></div>
    <div class="scheduling-bottom-grid"><section class="panel"><div class="scheduling-panel-heading"><div><h2>Servicios más agendados</h2><p>Atenciones sin cancelaciones en el período</p></div></div>${ranking(data.services, "Todavía no hay actividad para comparar servicios.")}</section><section class="panel"><div class="scheduling-panel-heading"><div><h2>Actividad por profesional</h2><p>Distribución de las atenciones del período</p></div></div>${ranking(data.professionals, "La actividad de tu equipo aparecerá aquí.")}</section></div></div>`;
}
