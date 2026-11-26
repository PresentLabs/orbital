import {schedulingDemo} from "@/lib/saas/scheduling-demo";
import { bookingStatus } from "@/lib/saas/scheduling-status";
import { schedulingSections, type SchedulingSection } from "@/lib/saas/scheduling";
import { dashboardHTML, type SchedulingDashboard } from "./scheduling-dashboard";
import { uiIcon } from "@/lib/saas/icons";
type Entry = { id: number; kind: string; hasImage?: boolean; copyImageFrom?: number; name: string; active: boolean; version: number; value: Record<string, any> };
type Booking = {
  hold_expires_at: string | null;
  id: number; version: number; service_id: number; professional_id: number | null; location_id: number | null; customer_name: string; customer_email: string; start_at: string; end_at: string;
  quantity: number; amount_minor: number; currency: string; status: string; payment_status: string; details: any;
};
type Data = { members: { id: number; name: string; email: string }[]; settings: any; catalog: Entry[]; bookings: Booking[]; total: number; page: number; canConfigure: boolean; canWrite: boolean; actorId: number };
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const names: Record<string, string> = { package: "Paquetes", extra: "Extras", category: "Categorías", service: "Servicios", professional: "Profesionales", location: "Sucursales", resource: "Recursos", customer: "Clientes" };
const singular: Record<string, string> = { package: "paquete", extra: "extra", category: "categoría", service: "servicio", professional: "profesional", location: "sucursal", resource: "recurso", customer: "cliente" };
const statuses: Record<string, string> = { pending: "Por confirmar", confirmed: "Confirmada", canceled: "Cancelada", completed: "Realizada", no_show: "No asistió" };
const paymentStates: Record<string, string> = { unpaid: "Pendiente de pago", paid: "Pagada", partially_paid: "Pago parcial", refunded: "Reembolsada", free: "Sin cobro" };
const week = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export function installReservations(ctx: { demo?:boolean; modal: (html: string) => void; close: () => void; notify: (message: string) => void; navigate: () => void }) {
  const root = document.querySelector<HTMLElement>('[data-panel="reservations"]')!;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const dialogContent = () => document.querySelector<HTMLElement>("#dialog-content")!;
  if(ctx.demo)root.insertAdjacentHTML('afterbegin','<p class="section-note reservation-demo-note">Datos de ejemplo · Inicia sesión para editar y guardar tu agenda.</p>');
  let data: Data;
  let tab: SchedulingSection = "dashboard";
  let dashboard: SchedulingDashboard | undefined;
  let dashboardDays = 7;
  let dashboardRequest = 0;
  let day = "";
  let search = "";
  let catalogSearch = "";
  let categoryFilter = "";
  let page = 1;
  let loaded = false;
  let loading = false;
  let reloadPending = false;
  let saving = false;
  let holdRefresh: ReturnType<typeof setTimeout> | undefined;
  const amount = (minor: number, currency = data.settings.currency) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(minor / (10 ** digits(currency)));
  function digits(currency: string) {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  }
  function moneyInput(value: FormDataEntryValue | null) {
    const decimals = digits(data.settings.currency);
    const text = String(value || "0");
    if (!new RegExp("^\\d+(?:\\.\\d{1," + (decimals || 1) + "})?$").test(text))
      throw Error("Revisa el precio.");
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > decimals) throw Error("La moneda seleccionada no admite esos decimales.");
    return Number(whole) * (10 ** decimals) + Number(fraction.padEnd(decimals, "0"));
  }
  async function api(body?: unknown, query = "") {
    if(ctx.demo){if(body)throw Error('La demostración es de lectura. Inicia sesión para guardar cambios.');return schedulingDemo(query) as any;}
    const response = await fetch("/api/saas/reservations" + query, body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    } : {});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "No pudimos completar la operación.");
    return result;
  }
  function scheduleHoldRefresh() {
    clearTimeout(holdRefresh);
    if (!data || root.hidden || !["dashboard","agenda"].includes(tab)) return;
    const deadlines=data.bookings.filter(booking=>booking.status === "pending" && booking.payment_status === "unpaid" && booking.hold_expires_at).map(booking=>Date.parse(booking.hold_expires_at!));
    if (!deadlines.length) return;
    holdRefresh=setTimeout(()=>{
      if (root.hidden) return;
      if (document.hidden || saving || loading || document.querySelector<HTMLDialogElement>("#editor-dialog")!.open || (root.contains(document.activeElement) && document.activeElement?.matches("input,select,textarea"))) { holdRefresh=setTimeout(scheduleHoldRefresh,30000); return; }
      dashboard=undefined;void load();
    },Math.min(60000,Math.max(1000,Math.min(...deadlines)-Date.now()+250)));
  }
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) scheduleHoldRefresh(); });
  function holdDeadline(booking: Booking) {
    return booking.status === "pending" && booking.payment_status === "unpaid" && booking.hold_expires_at ? new Date(booking.hold_expires_at).toLocaleString("es-CL",{timeZone:data.settings.timezone,dateStyle:"short",timeStyle:"short",hourCycle:"h23"}) : "";
  }
  function message(value: string) { const status = $("#reservations-message"); status.textContent = value; status.hidden = !value; }
  function syncNavigation() {
    const current = schedulingSections.find((section) => section.id === tab)!;
    $("#scheduling-title").textContent = current.label;
    $("#scheduling-description").textContent = current.description;
    document.querySelectorAll<HTMLElement>("[data-scheduling-section]").forEach((button) => {
      const active = !root.hidden && button.dataset.schedulingSection === tab;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
  }
  async function loadDashboard() {
    const request = ++dashboardRequest;
    root.setAttribute("aria-busy", "true");
    message("Actualizando el resumen…");
    try {
      const result = await api(undefined, "?action=dashboard&days=" + dashboardDays);
      if (request !== dashboardRequest) return;
      dashboard = result;
      if (tab === "dashboard") draw();
      message("");
    } catch (failure) {
      if (request !== dashboardRequest) return;
      message((failure as Error).message);
      if (tab === "dashboard" && !dashboard) $("#reservations-content").innerHTML = '<div class="panel scheduling-loading"><p>No pudimos cargar el resumen.</p><button class="button secondary" data-dashboard-retry>Volver a intentar</button></div>';
    } finally { if (request === dashboardRequest) root.setAttribute("aria-busy", "false"); }
  }
  async function load() {
    if (saving) return;
    if (loading) { reloadPending = true; return; }
    loading = true;
    root.setAttribute("aria-busy", "true");
    message("Cargando agendamiento…");
    try {
      data = await api(undefined, "?" + new URLSearchParams({ page: String(page), ...(day ? { day } : {}), ...(search ? { search } : {}) }));
      loaded = true;
      if (!reloadPending) { draw(); message(""); }
    } catch (error) { message(error instanceof Error ? error.message : "No pudimos cargar Agendamiento."); }
    finally {
      loading = false; root.setAttribute("aria-busy", "false"); scheduleHoldRefresh();
      if (reloadPending) { reloadPending = false; void load(); }
    }
  }
  function categoryTrail(id: number) {
    const trail: Entry[] = [], seen = new Set<number>();
    let entry = data.catalog.find(entry => entry.kind === "category" && entry.id === id);
    while (entry && !seen.has(entry.id)) { seen.add(entry.id); trail.unshift(entry); entry = data.catalog.find(item => item.kind === "category" && item.id === entry!.value.parentId); }
    return trail;
  }
  function categoryPath(id: number) { return categoryTrail(id).map(entry=>entry.name).join(" / "); }
  function categoryCompare(a: Entry, b: Entry) {
    const left=categoryTrail(a.id),right=categoryTrail(b.id);
    for(let i=0;i<Math.min(left.length,right.length);i++) {
      const order=(left[i].value.sortOrder || 0)-(right[i].value.sortOrder || 0) || left[i].name.localeCompare(right[i].name,"es-CL") || left[i].id-right[i].id;
      if(order) return order;
    }
    return left.length-right.length;
  }
  function categoryOptions(selected?: number | null, excludeId?: number) {
    return data.catalog.filter(entry => entry.kind === "category" && entry.id !== excludeId && (entry.active || entry.id === selected))
      .sort(categoryCompare)
      .map(entry => `<option value="${entry.id}" ${entry.id === selected ? "selected" : ""}>${esc(categoryPath(entry.id))}${entry.active ? "" : " (inactiva)"}</option>`).join("");
  }
  function withinCategory(id: number | null, wanted: string) {
    if (!wanted) return true;
    const seen = new Set<number>();
    while (id && !seen.has(id)) { if (id === Number(wanted)) return true; seen.add(id); id=data.catalog.find(entry=>entry.kind==="category" && entry.id===id)?.value.parentId || null; }
    return false;
  }
  function draw() {
    if(ctx.demo)queueMicrotask(()=>root.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('[data-entry-new],[data-entry-edit],[data-entry-copy],#reservation-settings input,#reservation-settings select,#reservation-settings textarea,#reservation-settings button').forEach(el=>{el.disabled=true;el.title='Inicia sesión para editar y guardar';}));
    $<HTMLButtonElement>("#reservation-new").hidden = !data.canWrite || !["dashboard", "agenda"].includes(tab);
    if (!data.canConfigure && ["customer", "settings", "category", "extra", "package"].includes(tab)) tab = "dashboard";
    syncNavigation();
    const host = $("#reservations-content");
    if (tab === "dashboard") {
      if (dashboard) {
        const selectedTab = host.querySelector('[role="tab"][aria-selected="true"]')?.id;
        host.innerHTML = dashboardHTML(dashboard);
        const tabs = [...host.querySelectorAll<HTMLButtonElement>('.scheduling-chart [role="tab"]')];
        const selectTab = (selected: HTMLButtonElement) => {
          for (const tab of tabs) {
            const active = tab === selected;
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
            document.getElementById(tab.getAttribute("aria-controls")!)!.hidden = !active;
          }
        };
        for (const [index, tab] of tabs.entries()) {
          tab.onclick = () => selectTab(tab);
          tab.onkeydown = (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = tabs[event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + 1) % tabs.length];
            selectTab(next);
            next.focus();
          };
        }
        selectTab(tabs.find(tab => tab.id === selectedTab) || tabs[0]);
        $<HTMLSelectElement>("#scheduling-period").onchange = (event) => {
          dashboardDays = Number((event.target as HTMLSelectElement).value); void loadDashboard();
        };
      } else { host.innerHTML = '<div class="panel scheduling-loading" role="status">Cargando el resumen de tu agenda…</div>'; void loadDashboard(); }
      return;
    }
    if (tab === "agenda") {
      host.innerHTML = `<div class="reservations-toolbar"><p>${data.total} ${data.total === 1 ? "hora agendada" : "horas agendadas"}</p>
        <form id="reservation-search" class="heading-actions"><label>Buscar hora<span class="filter-search">${uiIcon("search", 16)}<input name="search" type="search" maxlength="160" placeholder="Cliente, correo o servicio" value="${esc(search)}"/></span></label><button class="button secondary" type="submit">Buscar</button></form>
        <div class="heading-actions"><label>Filtrar por fecha<input id="reservations-day" type="date" value="${esc(day)}"/></label>${day ? '<button class="button secondary" data-clear-day>Todas las fechas</button>' : ""}</div></div>
        <div class="panel table-panel"><table class="business-table reservation-table"><thead><tr><th>Cliente</th><th>Servicio</th><th>Fecha y hora</th><th>Estado</th><th>Monto</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
        ${data.bookings.map((booking) => `<tr><td><strong>${esc(booking.customer_name)}</strong><small>${esc(booking.customer_email)}</small></td>
          <td>${esc(booking.details.serviceName)}<small>${esc(booking.details.professionalName || "Sin profesional")} · ${booking.quantity} ${booking.quantity === 1 ? "asistente" : "asistentes"}</small></td>
          <td>${esc(new Date(booking.start_at).toLocaleString("es-CL", { timeZone: data.settings.timezone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }))}<small>${esc(booking.details.locationName || "Sin sucursal")}</small></td>
          <td><span class="commerce-pill order-status-${bookingStatus(booking.status).commerce}">${bookingStatus(booking.status).label}</span>${holdDeadline(booking) ? `<small>Pago hasta ${esc(holdDeadline(booking))}</small>` : ""}</td><td>${amount(booking.amount_minor, booking.currency)}<small>${paymentStates[booking.payment_status]}</small></td>
          <td><button class="button primary compact-table-action" data-booking-manage="${booking.id}" aria-label="Ver hora de ${esc(booking.customer_name)}">Ver hora ↗</button></td></tr>`).join("") || '<tr><td colspan="6"><p class="empty-state">Todavía no hay horas agendadas para esta selección.</p></td></tr>'}
        </tbody></table></div>
        <div class="directory-pagination"><button class="button secondary" data-bookings-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${page}</span><button class="button secondary" data-bookings-page="${page + 1}" ${page * 100 >= data.total ? "disabled" : ""}>Siguiente</button></div>`;
      $<HTMLFormElement>("#reservation-search").onsubmit = (event) => {
        event.preventDefault(); search = String(new FormData(event.currentTarget as HTMLFormElement).get("search") || "").trim();
        page = 1; void load();
      };
      $("#reservations-day").addEventListener("change", (event) => {
        day = (event.target as HTMLInputElement).value;
        page = 1;
        void load();
      });
      return;
    }
    if (tab === "settings") { settingsForm(); return; }
    const entries = data.catalog.filter((entry) => entry.kind === tab && (tab !== "service" || withinCategory(entry.value.categoryId, categoryFilter)) &&
      [entry.name, entry.value.email, entry.value.description].join(" ").toLocaleLowerCase().includes(catalogSearch.toLocaleLowerCase())).sort((a,b)=>tab === "category" ? categoryCompare(a,b) : (tab === "package" ? (a.value.sortOrder || 0)-(b.value.sortOrder || 0) : 0) || a.name.localeCompare(b.name,"es-CL"));
    host.innerHTML = `<div class="reservations-toolbar"><form id="catalog-search" class="heading-actions"><label class="filter-search">${uiIcon("search", 16)}<span class="sr-only">Buscar en ${names[tab].toLocaleLowerCase()}</span><input name="search" type="search" placeholder="Buscar en ${names[tab].toLocaleLowerCase()}" maxlength="160" value="${esc(catalogSearch)}"/></label>${tab === "service" ? `<label><span class="sr-only">Filtrar por categoría</span><select name="category"><option value="">Todas las categorías</option>${categoryOptions(Number(categoryFilter) || null)}</select></label>` : ""}<button class="button secondary" type="submit">Buscar</button></form><div class="heading-actions"><span class="directory-count">${entries.length} ${entries.length === 1 ? "registro" : "registros"}</span>${data.canConfigure ? `<button class="button primary" data-entry-new>${uiIcon("plus", 16)}Agregar ${singular[tab]}</button>` : ""}</div></div>
      <div class="${tab === 'category' ? 'category-directory' : tab==='customer'?'customer-directory':'reservation-grid catalog-grid'}" data-catalog-kind="${tab}">${(tab==='category'?categoryTree(entries):tab==='customer'?customerTable(entries):entries.map(catalogCard).join('')) || '<div class="panel scheduling-directory-empty"><h2>Todo listo para comenzar</h2><p>No hay registros para esta búsqueda. Agrega uno nuevo o cambia los filtros.</p></div>'}</div>`;
    host.querySelectorAll<HTMLImageElement>(".catalog-image-frame img").forEach(image => { image.onerror = () => image.remove(); });
    $<HTMLFormElement>("#catalog-search").onsubmit = (event) => {
      event.preventDefault(); const fields = new FormData(event.currentTarget as HTMLFormElement); catalogSearch = String(fields.get("search") || "").trim(); categoryFilter = String(fields.get("category") || ""); draw();
    };
  }
  async function submitForm(form: HTMLFormElement, body: unknown, close = true) {
    if (saving) return;
    saving = true;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    const error = form.querySelector<HTMLElement>("[data-reservation-error]")!;
    error.textContent = "";
    try {
      await api(body);
      if (["create-booking", "reschedule-booking"].includes((body as any).action)) {
        tab = "agenda"; day = ""; search = ""; page = 1;
      }
      if (close) ctx.close();
      ctx.navigate();
      ctx.notify("Cambios guardados.");
      loaded = false; dashboard = undefined;
    } catch (failure) { error.textContent = failure instanceof Error ? failure.message : "No pudimos guardar."; }
    finally { saving = false; button.disabled = false; }
    if (!loaded) await load();
  }
  function scheduleEditor(value: any, inherit = false) {
    const schedule = value.schedule || [];
    const row = (period: any) => `<div class="reservation-period" data-week-period><label>Día<select data-weekday>${week.map((name, day) => `<option value="${day}" ${period.weekday === day ? "selected" : ""}>${name}</option>`).join("")}</select></label><label>Inicio<input type="time" data-start required value="${esc(period.start)}"/></label><label>Término<input type="time" data-end required value="${esc(period.end)}"/></label><button class="button secondary" type="button" data-remove-period aria-label="Eliminar tramo">${uiIcon("trash", 16)}</button></div>`;
    const exceptionRow = (day: string, period?: any) => `<div class="reservation-period" data-date-period><label>Fecha<input type="date" data-date required value="${esc(day)}"/></label><label class="inline-check"><input type="checkbox" data-closed ${period ? "" : "checked"}/>Cerrado</label><label>Inicio<input type="time" data-start ${period ? "required" : "disabled"} value="${esc(period?.start || "09:00")}"/></label><label>Término<input type="time" data-end ${period ? "required" : "disabled"} value="${esc(period?.end || "18:00")}"/></label><button class="button secondary" type="button" data-remove-period aria-label="Eliminar fecha especial">${uiIcon("trash", 16)}</button></div>`;
    const html = `<section class="reservation-hours" data-schedule-editor aria-label="Horarios y fechas especiales"><h2>Horarios y fechas especiales</h2>
      ${inherit ? `<label class="inline-check"><input type="checkbox" data-custom-schedule ${value.schedule ? "checked" : ""}/>Usar un horario semanal propio</label><p class="section-note">El horario propio se cruza con los horarios del negocio y de las demás asignaciones.</p>` : ""}
      <div data-week-editor ${inherit && !value.schedule ? "hidden" : ""}><div data-week-periods>${schedule.map(row).join("")}</div><button class="button secondary" type="button" data-add-period>Agregar tramo semanal</button></div>
      <p class="section-note">Agrega varios tramos para separar mañana y tarde. Las fechas especiales reemplazan el horario semanal de ese día; marca cerrado para vacaciones o festivos.</p>
      <div data-date-periods>${(value.exceptions || []).flatMap((item: any) => item.periods.length ? item.periods.map((period: any) => exceptionRow(item.day, period)) : [exceptionRow(item.day)]).join("")}</div>
      <button class="button outline" type="button" data-add-exception>Agregar fecha especial</button></section>`;
    function mount(form: HTMLFormElement) {
      const editor = form.querySelector<HTMLElement>("[data-schedule-editor]")!;
      const toggle = () => {
        const own = !inherit || editor.querySelector<HTMLInputElement>("[data-custom-schedule]")!.checked;
        editor.querySelector<HTMLElement>("[data-week-editor]")!.hidden = !own;
        editor.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-week-editor] input, [data-week-editor] select").forEach((input) => input.disabled = !own);
        editor.querySelectorAll<HTMLElement>("[data-date-period]").forEach((period) => {
          const closed = period.querySelector<HTMLInputElement>("[data-closed]")!.checked;
          period.querySelectorAll<HTMLInputElement>("[data-start], [data-end]").forEach((input) => { input.disabled = closed; input.required = !closed; });
        });
      };
      editor.addEventListener("change", toggle);
      editor.addEventListener("click", (event) => {
        const button = (event.target as Element).closest("button");
        if (!button) return;
        if (button.hasAttribute("data-add-period")) editor.querySelector("[data-week-periods]")!.insertAdjacentHTML("beforeend", row({ weekday: 1, start: "09:00", end: "18:00" }));
        if (button.hasAttribute("data-add-exception")) editor.querySelector("[data-date-periods]")!.insertAdjacentHTML("beforeend", exceptionRow(""));
        if (button.hasAttribute("data-remove-period")) button.closest("[data-week-period], [data-date-period]")!.remove();
        toggle();
      });
      toggle();
    }
    function read(form: HTMLFormElement) {
      const editor = form.querySelector<HTMLElement>("[data-schedule-editor]")!;
      const val = (row: Element, selector: string) => row.querySelector<HTMLInputElement>(selector)!.value;
      const own = !inherit || editor.querySelector<HTMLInputElement>("[data-custom-schedule]")!.checked;
      const schedule = own ? Array.from(editor.querySelectorAll("[data-week-period]")).map((row) => ({
        weekday: Number(val(row, "[data-weekday]")), start: val(row, "[data-start]"), end: val(row, "[data-end]"),
      })) : undefined;
      const exceptions: { day: string; periods: { start: string; end: string }[] }[] = [];
      for (const row of editor.querySelectorAll("[data-date-period]")) {
        const day = val(row, "[data-date]"), closed = row.querySelector<HTMLInputElement>("[data-closed]")!.checked;
        let entry = exceptions.find((item) => item.day === day);
        if (entry && (closed || !entry.periods.length)) throw Error("Una fecha cerrada no puede tener otros tramos.");
        if (!entry) { entry = { day, periods: [] }; exceptions.push(entry); }
        if (!closed) entry.periods.push({ start: val(row, "[data-start]"), end: val(row, "[data-end]") });
      }
      return { schedule, exceptions };
    }
    return { html, mount, read };
  }
  function selectAssignments(kind: string, field: string, selected: number[] = []) {
    const entries = data.catalog.filter((entry) => entry.kind === kind && entry.active);
    return `<label>${names[kind]}<select name="${field}" multiple size="${Math.max(2, Math.min(5, entries.length))}">${entries.map((entry) =>
      `<option value="${entry.id}" ${selected.includes(entry.id) ? "selected" : ""}>${esc(entry.name)}</option>`).join("")}</select></label>`;
  }
  function durationRow(option: { minutes: number; priceMinor: number }) {
    return `<div class="service-duration-row" data-service-duration><label>Minutos<input data-duration-minutes type="number" min="5" max="1440" required value="${option.minutes}"/></label><label>Precio (${esc(data.settings.currency)})<input data-duration-price type="number" min="0" step="${10 ** -digits(data.settings.currency)}" required value="${option.priceMinor / 10 ** digits(data.settings.currency)}"/></label><button class="button secondary" type="button" data-duration-remove aria-label="Eliminar duración">${uiIcon("trash",16)}</button></div>`;
  }
  const imageURL = (id: number) => "/api/saas/reservations?action=image&id=" + id;
  function catalogImage(entry: Entry) {
    return entry.hasImage ? `<div class="catalog-image-frame"><img src="${imageURL(entry.id)}" alt="" width="960" height="640" loading="lazy" decoding="async"/></div>` : `<div class="catalog-symbol" aria-hidden="true">${uiIcon(entry.kind === 'package'?'layers':entry.kind === 'extra'?'plus':'calendar',24)}</div>`;
  }
  function customerTable(entries:Entry[]){return `<div class="panel table-panel"><table class="business-table scheduling-customers"><thead><tr><th>Cliente</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${entries.map(entry=>`<tr><td><strong>${esc(entry.name)}</strong></td><td>${esc(entry.value.email||'—')}</td><td>${esc(entry.value.phone||'—')}</td><td><span class="catalog-status ${entry.active?'is-active':''}"><i></i>${entry.active?'Activo':'Inactivo'}</span></td><td>${data.canConfigure?`<button class="button secondary" data-entry-edit="${entry.id}">${uiIcon('pencil',14)}Editar</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5">No hay clientes que coincidan con la búsqueda.</td></tr>'}</tbody></table></div>`;}
  function categoryTree(entries:typeof data.catalog) {
    const selected=new Set(entries.map(e=>e.id));
    const children=(id:number)=>entries.filter(e=>Number(e.value.parentId)===id);
    const renderChildren=(id:number):string=>{const rows=children(id);return rows.length?`<ul class="category-children">${rows.map(child=>`<li>${catalogCard(child)}${renderChildren(child.id)}</li>`).join('')}</ul>`:'';};
    return entries.filter(e=>!selected.has(Number(e.value.parentId))).map(root=>`<section class="category-group" aria-label="${esc(root.name)}">${catalogCard(root)}${renderChildren(root.id)}</section>`).join('');
  }
  function catalogCard(entry:Entry){
    const state=`<span class="catalog-status ${entry.active?'is-active':''}"><i></i>${entry.active?'Activo':'Inactivo'}</span>`;
    const edit=data.canConfigure?`<button class="button secondary" data-entry-edit="${entry.id}">${uiIcon('pencil',14)}Editar</button>`:'';
    const copy=data.canConfigure && ['service','package'].includes(entry.kind)?`<button class="catalog-copy" data-entry-copy="${entry.id}" title="Duplicar ${esc(entry.name)}" aria-label="Duplicar ${esc(entry.name)}">${uiIcon('copy',16)}</button>`:'';
    if(entry.kind === 'category'){
      const count=data.catalog.filter(service=>service.kind==='service' && withinCategory(service.value.categoryId,String(entry.id))).length;
      return `<article class="category-row" style="--category-depth:${Math.min(4,categoryTrail(entry.id).length-1)}"><span class="catalog-symbol">${uiIcon('folder',21)}</span><div class="category-copy"><h2>${esc(entry.name)}</h2><p>${entry.value.parentId?'Subcategoría de '+esc(categoryPath(entry.value.parentId)):'Categoría principal'}</p></div><span class="category-service-count">${count} ${count===1?'servicio':'servicios'}</span>${state}${edit}</article>`;
    }
    if(['professional','customer','location','resource'].includes(entry.kind)){
      const initials=entry.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('');
      const contact=entry.value.email || data.members.find(member=>member.id===entry.value.userId)?.email || '';
      return `<article class="panel reservation-card directory-person-card"><div class="catalog-person-top"><span class="directory-person-avatar ${entry.kind}">${['professional','customer'].includes(entry.kind)?esc(initials):uiIcon(entry.kind==='location'?'pin':'layers',25)}</span>${state}</div><h2>${esc(entry.name)}</h2><p class="catalog-description">${esc(entry.value.description || entry.value.address || (entry.kind==='professional'?'Profesional de atención':entry.kind==='customer'?'Cliente del negocio':' '))}</p><dl class="catalog-contact">${contact?`<div><dt>${uiIcon('mail',15)}<span class="sr-only">Correo</span></dt><dd>${esc(contact)}</dd></div>`:''}${entry.value.phone?`<div><dt>${uiIcon('phone',15)}<span class="sr-only">Teléfono</span></dt><dd>${esc(entry.value.phone)}</dd></div>`:''}${entry.kind==='resource'?`<div><dt>Disponibles</dt><dd>${entry.value.capacity} unidades</dd></div>`:''}${entry.kind==='professional' && entry.value.maxBookingsPerDay?`<div><dt>Límite diario</dt><dd>${entry.value.maxBookingsPerDay} horas</dd></div>`:''}</dl><footer class="catalog-card-footer">${edit}</footer></article>`;
    }
    const sessions=entry.value.sessions || [];
    const facts=entry.kind==='service'?[[uiIcon('clock',15),'Duración',entry.value.durationMinutes+' min'],[uiIcon('users',15),'Capacidad',entry.value.capacity+' '+(entry.value.capacity===1?'persona':'personas')]]:entry.kind==='extra'?[[uiIcon('clock',15),'Tiempo adicional',entry.value.durationMinutes+' min'],[uiIcon('layers',15),'Máximo',entry.value.maxQuantity+' unidades']]:[[uiIcon('calendar',15),'Sesiones',sessions.reduce((sum:number,line:any)=>sum+line.quantity,0)],[uiIcon('users',15),'Visibilidad',entry.value.visibility==='internal'?'Uso interno':'Público']];
    return `<article class="panel reservation-card catalog-product-card ${entry.hasImage?'has-image':''}"><div class="catalog-card-heading">${catalogImage(entry)}${state}</div><h2>${esc(entry.name)}</h2>${entry.kind==='service'?`<span class="catalog-category-label">${entry.value.categoryId?esc(categoryPath(entry.value.categoryId)):'&nbsp;'}</span>`:''}${entry.value.description?`<p class="catalog-description">${esc(entry.value.description)}</p>`:''}<div class="catalog-price"><strong>${amount(entry.value.priceMinor)}</strong><span>${entry.kind==='extra'?'por unidad':entry.kind==='package'?'el paquete':'por atención'}</span>${entry.value.referencePriceMinor!==undefined && entry.value.referencePriceMinor!==null?`<small>Referencia ${amount(entry.value.referencePriceMinor)}</small>`:''}</div><dl class="catalog-facts">${facts.map(([icon,label,value])=>`<div><dt>${icon}${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${entry.kind==='package'?`<details class="catalog-package-content"><summary>Servicios incluidos · ${sessions.length}</summary><ul class="package-includes">${sessions.map((line:any)=>`<li>${line.quantity} × ${esc(data.catalog.find(service=>service.id===line.serviceId)?.name || 'Servicio no disponible')}<small>${line.durationMinutes} min · ${line.attendees} ${line.attendees===1?'persona':'personas'}</small></li>`).join('')}</ul></details>`:''}<footer class="catalog-card-footer">${entry.kind==='service' && entry.value.durations?.length?`<small>${entry.value.durations.length+1} duraciones disponibles</small>`:'<span></span>'}<span>${copy}${edit}</span></footer></article>`;
  }
  function packageDurations(serviceId: number, selected?: number) {
    const service = data.catalog.find(entry=>entry.kind === "service" && entry.id === serviceId);
    if (!service) return '<option value="">Selecciona un servicio</option>';
    const durations = [service.value.durationMinutes,...(service.value.durations || []).map((option:any)=>option.minutes)];
    return `${selected && !durations.includes(selected) ? `<option value="${selected}" selected>${selected} minutos (ya no disponible)</option>` : ""}${durations.map(minutes=>`<option value="${minutes}" ${minutes === selected ? "selected" : ""}>${minutes} minutos</option>`).join("")}`;
  }
  function packageRow(line: {serviceId:number;quantity:number;durationMinutes:number;attendees:number}) {
    const services=data.catalog.filter(entry=>entry.kind === "service" && (entry.active || entry.id === line.serviceId));
    const service=services.find(entry=>entry.id === line.serviceId);
    return `<fieldset class="package-session-row" data-package-line><legend>Servicio incluido</legend><label>Servicio<select data-package-service required>${services.map(entry=>`<option value="${entry.id}" ${entry.id===line.serviceId ? "selected" : ""}>${esc(entry.name)}${entry.active ? "" : " (inactivo)"}</option>`).join("")}</select></label><div class="form-grid"><label>Número de sesiones<input data-package-quantity type="number" min="1" max="1000" required value="${line.quantity}"/></label><label>Personas por sesión<input data-package-attendees type="number" min="1" max="${service?.value.capacity || 1}" required value="${line.attendees}"/></label></div><label>Duración de cada sesión<select data-package-duration required>${packageDurations(line.serviceId,line.durationMinutes)}</select></label><button class="button secondary" type="button" data-package-remove>${uiIcon("trash",16)}Quitar servicio</button></fieldset>`;
  }
  function editEntry(entry?: Entry) {
    const kind = entry?.kind || tab;
    const requestKey = crypto.randomUUID();
    const value = entry?.value || {};
    const hours = scheduleEditor(value, true);
    ctx.modal(`<h2>${entry?.id ? "Editar" : "Agregar"} ${singular[kind]}</h2><form id="reservation-entry-form">
      <label>Nombre<input name="name" required maxlength="160" value="${esc(entry?.name || "")}"/></label>
      ${["service","extra","package"].includes(kind) ? `<fieldset class="catalog-image-editor"><legend>Imagen ${kind === "package" ? "del paquete" : kind === "extra" ? "del extra" : "del servicio"}</legend><div class="catalog-image-preview">${uiIcon("image",28)}<img data-catalog-image-preview ${entry?.hasImage ? `src="${imageURL(entry.copyImageFrom || entry.id)}"` : "hidden"} alt="Vista previa"/></div><label>Subir o reemplazar imagen<input name="catalogImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"/></label><p class="field-hint">PNG, JPG, WebP o GIF, hasta 4 MB. Se usará una imagen fija y se guardará junto con los cambios.</p><button class="button secondary" type="button" data-image-remove ${entry?.hasImage ? "" : "hidden"}>Quitar imagen</button><p data-image-status role="status" class="field-hint"></p></fieldset>` : ""}
      ${kind === "package" ? `<div class="form-grid"><label>Precio de cobro (${esc(data.settings.currency)})<input name="price" type="number" min="0" step="${10 ** -digits(data.settings.currency)}" required value="${(value.priceMinor || 0) / 10 ** digits(data.settings.currency)}"/></label><label>Precio de referencia (${esc(data.settings.currency)}, opcional)<input name="referencePrice" type="number" min="0" step="${10 ** -digits(data.settings.currency)}" value="${value.referencePriceMinor === undefined || value.referencePriceMinor === null ? "" : value.referencePriceMinor / 10 ** digits(data.settings.currency)}"/></label><label>Visibilidad en catálogo<select name="visibility"><option value="public" ${value.visibility !== "internal" ? "selected" : ""}>Catálogo público</option><option value="internal" ${value.visibility === "internal" ? "selected" : ""}>Solo uso interno</option></select></label><label>Orden de aparición<input name="sortOrder" type="number" min="0" max="100000" required value="${value.sortOrder || 0}"/></label></div><fieldset class="package-sessions-editor"><legend>Sesiones incluidas</legend><p class="field-hint">Define cuántas sesiones de cada servicio incluye el paquete. Cada sesión conserva su duración y número de personas.</p><div data-package-lines>${(value.sessions || []).map(packageRow).join("")}</div><p data-package-summary class="field-hint" role="status"></p><button type="button" class="button secondary" data-package-add>${uiIcon("plus",16)}Agregar servicio</button></fieldset>` : ""}
      ${kind === "extra" ? `<div class="form-grid"><label>Precio por unidad (${esc(data.settings.currency)})<input name="price" type="number" min="0" step="${10 ** -digits(data.settings.currency)}" required value="${(value.priceMinor || 0) / 10 ** digits(data.settings.currency)}"/></label><label>Tiempo adicional por unidad (minutos)<input name="durationMinutes" type="number" min="0" max="1440" required value="${value.durationMinutes || 0}"/></label><label>Máximo de unidades por reserva<input name="maxQuantity" type="number" min="1" max="1000" required value="${value.maxQuantity || 1}"/></label></div><p class="field-hint">Asigna este extra a los servicios que lo ofrecen. El cargo se suma una vez por unidad, independiente del número de personas.</p>` : ""}
      ${kind === "category" ? `<label>Categoría superior<select name="parentId"><option value="">Sin categoría superior</option>${categoryOptions(value.parentId,entry?.id)}</select></label><label>Orden de aparición<input name="sortOrder" type="number" min="0" max="100000" value="${value.sortOrder || 0}"/></label><p class="field-hint">Desactivar una categoría no cancela las horas de sus servicios.</p>` : ""}
      ${kind === "service" ? `<label>Categoría<select name="categoryId"><option value="">Sin categoría</option>${categoryOptions(value.categoryId)}</select></label><div class="form-grid"><label>Duración en minutos<input name="durationMinutes" type="number" min="5" max="1440" required value="${value.durationMinutes || 60}"/></label>
      <label>Precio de cobro (${esc(data.settings.currency)})<input name="price" type="number" min="0" step="${String(10 ** -digits(data.settings.currency))}" required value="${(value.priceMinor || 0) / 10 ** digits(data.settings.currency)}"/></label>
      <label>Precio de referencia (${esc(data.settings.currency)}, opcional)<input name="referencePrice" type="number" min="0" step="${10 ** -digits(data.settings.currency)}" value="${value.referencePriceMinor === undefined || value.referencePriceMinor === null ? "" : value.referencePriceMinor / 10 ** digits(data.settings.currency)}"/><small>Se muestra como referencia. La reserva se calcula con el precio de cobro y la duración elegida.</small></label>
      <label>Capacidad por horario<input name="capacity" type="number" min="1" max="1000" value="${value.capacity || 1}" required/></label>
      <label>Máximo de horas diarias<input name="maxBookingsPerDay" type="number" min="0" max="10000" value="${value.maxBookingsPerDay || 0}"/></label>
      <label>Tiempo de preparación (minutos)<input name="bufferBefore" type="number" min="0" max="1440" value="${value.bufferBefore || 0}"/></label>
      <label>Tiempo entre atenciones (minutos)<input name="bufferAfter" type="number" min="0" max="1440" value="${value.bufferAfter || 0}"/></label></div>
      <fieldset class="service-duration-options"><legend>Otras duraciones y precios</legend><p class="field-hint">La duración principal ya está incluida. Agrega alternativas para que el cliente o el equipo elijan al agendar.</p><div data-service-durations>${(value.durations || []).map(durationRow).join("")}</div><button class="button secondary" type="button" data-duration-add>${uiIcon("plus",16)}Agregar duración</button></fieldset>
      <fieldset class="service-duration-options"><legend>Extras disponibles</legend>${selectAssignments("extra", "extraIds", value.extraIds)}<div class="form-grid"><label>Mínimo de extras distintos<input name="minExtras" type="number" min="0" max="100" value="${value.minExtras || 0}"/></label><label>Máximo de extras distintos<input name="maxExtras" type="number" min="0" max="100" value="${value.maxExtras || 0}"/></label></div><p class="field-hint">Elige los complementos ofrecidos. Los límites cuentan tipos distintos, no unidades. Usa 0 en el máximo para no limitar.</p></fieldset>
      ${selectAssignments("professional", "professionalIds", value.professionalIds)}
      ${selectAssignments("location", "locationIds", value.locationIds)}
      ${selectAssignments("resource", "resourceIds", value.resourceIds)}` : ""}
      ${kind === "professional" ? `<label>Persona del equipo asignada<select name="userId"><option value="">Sin cuenta asignada</option>${data.members.map((member) => `<option value="${member.id}" ${Number(value.userId) === member.id ? "selected" : ""}>${esc(member.name)} · ${esc(member.email)}</option>`).join("")}</select><small>Esta persona podrá gestionar las reservas de su agenda.</small></label>` : ""}
      ${kind === "professional" ? `<label>Máximo de horas al día<input name="maxBookingsPerDay" type="number" min="0" max="10000" value="${value.maxBookingsPerDay || 0}"/><small>Usa 0 para no limitar la agenda de esta persona.</small></label>` : ""}
      ${kind === "resource" ? `<label>Unidades disponibles<input name="capacity" type="number" min="1" max="1000" required value="${value.capacity || 1}"/></label>` : ""}
      ${kind === "customer" ? `<label>Correo electrónico<input name="email" type="email" required maxlength="254" value="${esc(value.email || "")}"/></label>` : ""}
      ${kind === "location" ? `<label>Dirección<input name="address" maxlength="2000" value="${esc(value.address || "")}"/></label>` : ""}
      ${["professional", "customer"].includes(kind) ? `<label>Teléfono<input type="tel" name="phone" maxlength="100" value="${esc(value.phone || "")}"/></label>` : ""}
      ${["service", "professional", "location"].includes(kind) ? hours.html : ""}
      <label>Descripción<textarea name="description" maxlength="2000" rows="3">${esc(value.description || "")}</textarea></label>
      <label class="inline-check"><input type="checkbox" name="active" ${entry?.active !== false ? "checked" : ""}/>Activo</label>
      <p class="form-error" data-reservation-error role="alert"></p><button type="submit" class="button primary">Guardar</button></form>`);
    const form = dialogContent().querySelector<HTMLFormElement>("#reservation-entry-form")!;
    let selectedImage: File | null = null, imageChanged = false, objectURL = "", preparingImage = false;
    const imageInput = form.querySelector<HTMLInputElement>("[name=catalogImage]");
    const preview = form.querySelector<HTMLImageElement>("[data-catalog-image-preview]");
    const removeImage = form.querySelector<HTMLButtonElement>("[data-image-remove]");
    const imageStatus = form.querySelector<HTMLElement>("[data-image-status]");
    const releaseImage = () => { if (objectURL) URL.revokeObjectURL(objectURL); objectURL = ""; };
    document.querySelector<HTMLDialogElement>("#editor-dialog")!.addEventListener("close",releaseImage,{once:true});
    if (imageInput && preview && removeImage && imageStatus) {
      preview.onerror = () => { if(!preview.hasAttribute("src") || preview.hidden) return; preview.hidden = true; imageStatus.textContent = "No pudimos mostrar la imagen. Puedes reemplazarla o quitarla."; };
      imageInput.onchange = () => {
        const file = imageInput.files?.[0];
        if (!file) return;
        if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type) || !file.size || file.size > 4 * 1024 * 1024) {
          imageStatus.textContent = "Usa una imagen PNG, JPG, WebP o GIF de hasta 4 MB."; imageInput.value = ""; return;
        }
        releaseImage(); selectedImage = file; imageChanged = true;
        objectURL = URL.createObjectURL(file); preview.src = objectURL; preview.hidden = false;
        removeImage.hidden = false; imageStatus.textContent = "Imagen lista. Guarda los cambios para aplicarla.";
      };
      removeImage.onclick = () => {
        releaseImage(); selectedImage = null; imageChanged = true; imageInput.value = "";
        preview.removeAttribute("src"); preview.hidden = true; removeImage.hidden = true;
        imageStatus.textContent = "La imagen se quitará al guardar los cambios.";
      };
    }
    if (kind === "package") {
      const lines=form.querySelector<HTMLElement>("[data-package-lines]")!;
      const refreshPackage = () => {
        const rows=[...lines.querySelectorAll<HTMLElement>("[data-package-line]")];
        const selected=rows.map(row=>Number(row.querySelector<HTMLSelectElement>("[data-package-service]")!.value));
        rows.forEach((row,index)=>row.querySelectorAll<HTMLOptionElement>("[data-package-service] option").forEach(option=>option.disabled=selected.some((id,other)=>other!==index && id===Number(option.value))));
        const total=rows.reduce((sum,row)=>sum+Number(row.querySelector<HTMLInputElement>("[data-package-quantity]")!.value || 0),0);
        form.querySelector<HTMLElement>("[data-package-summary]")!.textContent=rows.length ? `${total} ${total === 1 ? "sesión incluida" : "sesiones incluidas"} en ${rows.length} ${rows.length === 1 ? "servicio" : "servicios"}.` : "Agrega al menos un servicio al paquete.";
      };
      form.addEventListener("click",event=>{
        const button=(event.target as Element).closest("button");
        if (button?.hasAttribute("data-package-add")) {
          const selected=[...lines.querySelectorAll<HTMLSelectElement>("[data-package-service]")].map(select=>Number(select.value));
          const service=data.catalog.find(entry=>entry.kind === "service" && entry.active && !selected.includes(entry.id));
          if (!service) { form.querySelector<HTMLElement>("[data-reservation-error]")!.textContent="No hay más servicios activos disponibles. Puedes crearlos en Servicios."; return; }
          lines.insertAdjacentHTML("beforeend",packageRow({serviceId:service.id,quantity:1,durationMinutes:service.value.durationMinutes,attendees:1}));
        }
        if (button?.hasAttribute("data-package-remove")) button.closest("[data-package-line]")!.remove();
        refreshPackage();
      });
      form.addEventListener("change",event=>{
        const select=event.target as HTMLSelectElement;
        if (select.hasAttribute("data-package-service")) {
          const row=select.closest("[data-package-line]")!;
          row.querySelector<HTMLSelectElement>("[data-package-duration]")!.innerHTML=packageDurations(Number(select.value));
          row.querySelector<HTMLInputElement>("[data-package-attendees]")!.max=String(data.catalog.find(entry=>entry.id===Number(select.value))?.value.capacity || 1);
        }
        refreshPackage();
      });
      refreshPackage();
    }
    if (kind === "service") form.addEventListener("click", event => {
      const button=(event.target as Element).closest("button");
      if (button?.hasAttribute("data-duration-add")) form.querySelector("[data-service-durations]")!.insertAdjacentHTML("beforeend",durationRow({minutes:30,priceMinor:0}));
      if (button?.hasAttribute("data-duration-remove")) button.closest("[data-service-duration]")!.remove();
    });
    if (["service", "professional", "location"].includes(kind)) hours.mount(form);
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (saving || preparingImage) return;
      const fields = new FormData(form);
      try {
        const next: Record<string, any> = { ...value, description: String(fields.get("description") || "") };
        if (kind === "service") {
          for (const field of ["durationMinutes", "capacity", "bufferBefore", "bufferAfter", "maxBookingsPerDay", "minExtras", "maxExtras"])
            next[field] = Number(fields.get(field));
          next.priceMinor = moneyInput(fields.get("price"));
          next.referencePriceMinor = String(fields.get("referencePrice") || "").trim() ? moneyInput(fields.get("referencePrice")) : null;
          next.categoryId = Number(fields.get("categoryId")) || null;
          next.durations = Array.from(form.querySelectorAll<HTMLElement>("[data-service-duration]")).map(row=>({minutes:Number(row.querySelector<HTMLInputElement>("[data-duration-minutes]")!.value),priceMinor:moneyInput(row.querySelector<HTMLInputElement>("[data-duration-price]")!.value)}));
          for (const field of ["professionalIds", "locationIds", "resourceIds", "extraIds"]) next[field] = fields.getAll(field).map(Number);
        }
        if (["service", "professional", "location"].includes(kind)) Object.assign(next, hours.read(form));
        if (["professional", "customer"].includes(kind)) next.phone = fields.get("phone");
        if (kind === "package") {
          next.priceMinor=moneyInput(fields.get("price")); next.referencePriceMinor=String(fields.get("referencePrice") || "").trim() ? moneyInput(fields.get("referencePrice")) : null;
          next.visibility=fields.get("visibility"); next.sortOrder=Number(fields.get("sortOrder"));
          next.sessions=[...form.querySelectorAll<HTMLElement>("[data-package-line]")].map(row=>({serviceId:Number(row.querySelector<HTMLSelectElement>("[data-package-service]")!.value),quantity:Number(row.querySelector<HTMLInputElement>("[data-package-quantity]")!.value),durationMinutes:Number(row.querySelector<HTMLSelectElement>("[data-package-duration]")!.value),attendees:Number(row.querySelector<HTMLInputElement>("[data-package-attendees]")!.value)}));
          if (!next.sessions.length) throw Error("Agrega al menos un servicio al paquete.");
        }
        if (kind === "extra") { next.durationMinutes = Number(fields.get("durationMinutes")); next.priceMinor = moneyInput(fields.get("price")); next.maxQuantity = Number(fields.get("maxQuantity")); }
        if (kind === "category") { next.parentId = Number(fields.get("parentId")) || null; next.sortOrder = Number(fields.get("sortOrder")); }
        if (kind === "resource") next.capacity = Number(fields.get("capacity"));
        if (kind === "professional") { next.userId = fields.get("userId") ? Number(fields.get("userId")) : null; next.maxBookingsPerDay = Number(fields.get("maxBookingsPerDay")); }
        if (kind === "customer") next.email = fields.get("email");
        if (kind === "location") next.address = fields.get("address");
        let image: { data: string; mime: string } | null | undefined;
        if (imageChanged) {
          if (!selectedImage) image = null;
          else {
            preparingImage = true;
            form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = true;
            const file = selectedImage;
            const data = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onerror = () => reject(Error("No pudimos leer la imagen. Selecciona el archivo nuevamente.")); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.readAsDataURL(file); });
            if (!form.isConnected || !document.querySelector<HTMLDialogElement>("#editor-dialog")!.open) return;
            if (selectedImage !== file) throw Error("La imagen cambió. Revisa la vista previa y guarda nuevamente.");
            image = { data, mime: file.type };
          }
        }
        await submitForm(form, { action: "save-entry", requestKey, ...(image !== undefined ? {image} : entry?.copyImageFrom ? {copyImageFrom:entry.copyImageFrom} : {}), id: entry?.id, version: entry?.version,
          kind, name: fields.get("name"), active: fields.has("active"), value: next });
      } catch (failure) { if(form.isConnected) form.querySelector<HTMLElement>("[data-reservation-error]")!.textContent = (failure as Error).message; }
      finally { preparingImage = false; if(form.isConnected) form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = false; }
    };
  }
  function settingsForm() {
    const settings = data.settings;
    const hours = scheduleEditor(settings);
    $("#reservations-content").innerHTML = `<form id="reservation-settings" class="reservation-settings"><section class="reservation-preferences panel"><h2>Horario y preferencias</h2>
      <div class="form-grid"><label>Zona horaria<input name="timezone" required value="${esc(settings.timezone)}"/></label><label>Moneda<input name="currency" required maxlength="3" pattern="[A-Z]{3}" value="${esc(settings.currency)}"/></label>
      <label>Intervalo entre horarios (minutos)<input name="intervalMinutes" type="number" min="5" max="240" required value="${settings.intervalMinutes}"/></label>
      <label>Anticipación mínima (minutos)<input name="advanceMinutes" type="number" min="0" max="525600" value="${settings.advanceMinutes}"/></label>
      <label>Días disponibles a futuro<input name="horizonDays" type="number" min="1" max="730" value="${settings.horizonDays}"/></label>
      <label>Máximo diario de horas<input name="maxBookingsPerDay" type="number" min="0" max="10000" value="${settings.maxBookingsPerDay}"/></label><label>Máximo de horas futuras por cliente<input name="maxFutureBookingsPerCustomer" type="number" min="0" max="10000" value="${settings.maxFutureBookingsPerCustomer}"/><small>Usa 0 para no limitar la cantidad de horas futuras.</small></label><label>Tiempo para pagar una reserva (minutos)<input name="paymentHoldMinutes" type="number" min="5" max="120" value="${settings.paymentHoldMinutes}" required/><small>Al vencer el plazo sin pago, se libera el horario y se conserva el historial.</small></label></div>
      <label class="inline-check"><input type="checkbox" name="allowPayLater" ${settings.allowPayLater ? "checked" : ""}/>Permitir confirmar reservas con saldo pendiente</label></section>
      ${hours.html}
      <p class="form-error" data-reservation-error role="alert"></p><button type="submit" class="button primary">Guardar preferencias</button></form>`;
    const form = $<HTMLFormElement>("#reservation-settings");
    hours.mount(form);
    form.onsubmit = (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      try {
      const value = { ...settings, ...hours.read(form), timezone: fields.get("timezone"), currency: fields.get("currency"), allowPayLater: fields.has("allowPayLater") };
      for (const field of ["intervalMinutes", "advanceMinutes", "horizonDays", "maxBookingsPerDay", "maxFutureBookingsPerCustomer", "paymentHoldMinutes"]) value[field] = Number(fields.get(field));
      void submitForm(form, { action: "save-settings", version: settings.version, value }, false);
      } catch (error) { form.querySelector<HTMLElement>("[data-reservation-error]")!.textContent = (error as Error).message; }
    };
  }
  function bookingForm(booking?: Booking, changeExtras = false) {
    const services = data.catalog.filter((entry) => entry.kind === "service" && (booking ? entry.id === booking.service_id : entry.active));
    if (!services.length) { message("Configura al menos un servicio activo para crear una reserva."); return; }
    const requestKey = crypto.randomUUID();
    const bookingDuration = booking ? (Date.parse(booking.end_at)-Date.parse(booking.start_at))/60000 - (changeExtras ? (booking.details.extras || []).reduce((sum:number,extra:any)=>sum + extra.durationMinutes * extra.quantity,0) : 0) : undefined;
    ctx.modal(`<h2>${changeExtras ? "Cambiar extras de la hora" : booking ? "Reagendar hora" : "Agendar hora"}</h2><p>Zona horaria ${esc(data.settings.timezone)}</p><form id="reservation-create-form">
      <label>Servicio<select name="serviceId">${services.map((entry) => `<option value="${entry.id}">${esc(entry.name)} · ${bookingDuration || entry.value.durationMinutes} min</option>`).join("")}</select></label>
      <label>Duración y precio<select name="durationMinutes"></select></label><div data-booking-extras></div>
      <div class="form-grid"><label>Profesional<select name="professionalId"></select></label><label>Sucursal<select name="locationId"></select></label>
      <label>Fecha<input name="day" type="date" required/></label><label>Personas<input name="quantity" type="number" min="1" max="1000" value="1" required/></label></div>
      <button class="button secondary" type="button" id="reservation-find-slots">${changeExtras ? "Verificar disponibilidad y total" : "Buscar horarios disponibles"}</button>
      <label>Horario<select name="startAt" required><option value="">Selecciona una fecha y busca horarios</option></select></label>
      <p id="reservation-quote" class="section-note"></p>
      <label>Nombre del cliente<input name="customerName" required maxlength="160" autocomplete="name" value="${esc(booking?.customer_name || "")}"/></label>
      <label>Correo del cliente<input name="customerEmail" type="email" required maxlength="254" autocomplete="email" list="reservation-customer-emails" value="${esc(booking?.customer_email || "")}"/><datalist id="reservation-customer-emails">${data.catalog.filter((entry) => entry.kind === "customer").map((entry) => `<option value="${esc(entry.value.email)}">${esc(entry.name)}</option>`).join("")}</datalist></label>
      ${booking ? '<label>Motivo del cambio (opcional)<textarea name="reason" maxlength="2000" rows="2"></textarea></label>' : ""}<p class="form-error" data-reservation-error role="alert"></p><button class="button primary" type="submit">${changeExtras ? "Guardar extras" : booking ? "Guardar nuevo horario" : "Agendar hora"}</button></form>`);
    const form = dialogContent().querySelector<HTMLFormElement>("#reservation-create-form")!;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
    const options = (kind: string, ids: number[]) => data.catalog.filter((entry) => entry.active && entry.kind === kind && ids.includes(entry.id) &&
      (kind !== "professional" || data.canConfigure || entry.value.userId === data.actorId));
    function updateAssignments() {
      const service = services.find((entry) => entry.id === Number(field("serviceId").value))!;
      field("durationMinutes").innerHTML = booking ? `<option value="${bookingDuration}">${bookingDuration} minutos · Duración original</option>` : [{minutes:service.value.durationMinutes,priceMinor:service.value.priceMinor},...(service.value.durations || [])].map(option=>`<option value="${option.minutes}" ${option.minutes === service.value.durationMinutes ? "selected" : ""}>${option.minutes} minutos · ${amount(option.priceMinor)}</option>`).join("");
      const extrasHost = form.querySelector<HTMLElement>("[data-booking-extras]")!;
      const extras = data.catalog.filter(entry => entry.kind === "extra" && entry.active && service.value.extraIds?.includes(entry.id));
      extrasHost.innerHTML = booking && !changeExtras ? (booking.details.extras?.length ? `<div class="service-duration-options"><h3>Extras de esta hora</h3>${booking.details.extras.map((extra:any)=>`<p>${esc(extra.name)} × ${extra.quantity}</p>`).join("")}<p class="field-hint">Se conservan los extras y el total original al reagendar.</p></div>` : "") : extras.length ? `<fieldset class="service-duration-options"><legend>Complementa la atención</legend><p class="field-hint">${service.value.minExtras ? `Elige al menos ${service.value.minExtras} ${service.value.minExtras === 1 ? "tipo de extra" : "tipos de extras"}. ` : "Opcional. "}${service.value.maxExtras ? `Máximo ${service.value.maxExtras} ${service.value.maxExtras === 1 ? "tipo de extra" : "tipos distintos"}. ` : ""}Cada unidad suma el precio y el tiempo indicados.</p>${extras.map(extra=>`<label class="booking-extra-row"><span><strong>${esc(extra.name)}</strong><small>${amount(extra.value.priceMinor)} · ${extra.value.durationMinutes} minutos por unidad</small></span><input data-booking-extra="${extra.id}" type="number" min="0" max="${extra.value.maxQuantity}" value="${changeExtras ? booking?.details.extras?.find((item:any)=>item.id===extra.id)?.quantity || 0 : 0}" aria-label="Unidades de ${esc(extra.name)}"/></label>`).join("")}</fieldset>` : "";
      for (const [kind, key] of [["professional", "professionalId"], ["location", "locationId"]]) {
        const available = options(kind, service.value[kind === "professional" ? "professionalIds" : "locationIds"]);
        field(key).innerHTML = available.length ? available.map((entry) => `<option value="${entry.id}">${esc(entry.name)}</option>`).join("") : '<option value="">Sin asignar</option>';
      }
    }
    updateAssignments();
    if (booking) {
      field("professionalId").value = String(booking.professional_id || "");
      field("locationId").value = String(booking.location_id || "");
      field("quantity").value = String(booking.quantity);
      for (const name of ["serviceId", "durationMinutes", "professionalId", "locationId", "quantity", "customerName", "customerEmail"]) field(name).disabled = true;
    }
    field("day").value = booking ? new Intl.DateTimeFormat("sv-SE", { timeZone: data.settings.timezone }).format(new Date(booking.start_at)) : day;
    field("customerEmail").addEventListener("change", () => {
      if (booking) return;
      const customer = data.catalog.find((entry) => entry.kind === "customer" && entry.value.email === field("customerEmail").value.trim().toLowerCase());
      if (customer) field("customerName").value = customer.name;
    });
    const selectedExtras = () => Array.from(form.querySelectorAll<HTMLInputElement>("[data-booking-extra]")).filter(input => Number(input.value) !== 0).map(input => ({ id: Number(input.dataset.bookingExtra), quantity: Number(input.value) }));
    if (changeExtras) {
      field("day").disabled = true;
      const unavailable = booking?.details.extras?.filter((extra:any)=>!data.catalog.some(entry=>entry.id===extra.id && entry.active && services[0].value.extraIds?.includes(entry.id))) || [];
      if (unavailable.length) form.querySelector("[data-booking-extras]")!.insertAdjacentHTML("afterbegin",`<p class="field-hint">${unavailable.map((extra:any)=>esc(extra.name)).join(", ")}: ya no disponibles; se quitarán al guardar los nuevos extras.</p>`);
    }
    let slotRequest = 0;
    form.addEventListener("change", (event) => {
      const name = (event.target as HTMLInputElement).name;
      if (name === "serviceId") updateAssignments();
      if (["serviceId", "durationMinutes", "professionalId", "locationId", "day", "quantity"].includes(name) || (event.target as HTMLElement).hasAttribute("data-booking-extra")) {
        slotRequest++;
        field("startAt").innerHTML = '<option value="">Busca los horarios disponibles</option>';
        form.querySelector("#reservation-quote")!.textContent = "";
      }
    });
    form.querySelector<HTMLButtonElement>("#reservation-find-slots")!.onclick = async () => {
      const button = form.querySelector<HTMLButtonElement>("#reservation-find-slots")!;
      const error = form.querySelector<HTMLElement>("[data-reservation-error]")!;
      error.textContent = "";
      if (!field("day").value) { error.textContent = "Selecciona una fecha."; return; }
      button.disabled = true;
      const currentRequest = ++slotRequest;
      try {
        const query = new URLSearchParams({ action: "availability", ...(booking ? { booking: String(booking.id) } : {}) });
        for (const [name, key] of [["serviceId", "service"], ["durationMinutes", "duration"], ["professionalId", "professional"], ["locationId", "location"], ["day", "day"], ["quantity", "quantity"]])
          query.set(key, field(name).value);
        if (!booking || changeExtras) query.set("extras", JSON.stringify(selectedExtras()));
        if (changeExtras) query.set("editExtras", "true");
        const result = await api(undefined, "?" + query);
        if (!form.isConnected || currentRequest !== slotRequest) return;
        if (changeExtras) result.slots = result.slots.filter((slot:any)=>slot.start === booking!.start_at);
        field("startAt").innerHTML = result.slots.length ? result.slots.map((slot: any) => `<option value="${esc(slot.start)}">${esc(slot.time)}</option>`).join("") : '<option value="">Sin horarios disponibles</option>';
        form.querySelector("#reservation-quote")!.textContent = "Total " + amount(result.amountMinor, result.currency) + " · " + result.durationMinutes + " minutos en total";
      } catch (failure) { if (form.isConnected) error.textContent = (failure as Error).message; }
      finally { button.disabled = false; }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      if (changeExtras) { void submitForm(form, { action: "update-booking-extras", id: booking!.id, version: booking!.version, extras: selectedExtras(), reason: String(new FormData(form).get("reason") || "") }); return; }
      if (booking) { void submitForm(form, { action: "reschedule-booking", id: booking.id, version: booking.version, startAt: field("startAt").value, reason: String(new FormData(form).get("reason") || "") }); return; }
      void submitForm(form, { action: "create-booking", requestKey, serviceId: Number(field("serviceId").value), durationMinutes: Number(field("durationMinutes").value), extras: selectedExtras(),
        professionalId: Number(field("professionalId").value) || null, locationId: Number(field("locationId").value) || null,
        quantity: Number(field("quantity").value), startAt: field("startAt").value,
        customerName: field("customerName").value, customerEmail: field("customerEmail").value });
    };
  }
  function manageBooking(id: number) {
    const booking = data.bookings.find((row) => row.id === id)!;
    const transitions: Record<string, string[]> = { pending: ["confirmed", "canceled"], confirmed: ["completed", "no_show", "canceled"], canceled: [], completed: [], no_show: ["completed"] };
    const choices = transitions[booking.status];

    const editable = data.canWrite && choices.length > 0;
    ctx.modal(`<div class="booking-detail-heading"><span class="commerce-pill order-status-${bookingStatus(booking.status).commerce}">${bookingStatus(booking.status).label}</span><h2>${esc(booking.details.serviceName)}</h2><p>${esc(booking.customer_name)}</p></div><form id="reservation-state-form">
      ${data.canWrite && ["pending", "confirmed"].includes(booking.status) ? '<button type="button" class="button secondary" data-reschedule>Reprogramar fecha y hora</button>' : ""}
      ${data.canWrite && ["pending", "confirmed"].includes(booking.status) && ["unpaid", "free"].includes(booking.payment_status) ? '<button type="button" class="button secondary" data-edit-booking-extras>Cambiar extras</button>' : ""}
      <div class="booking-time-summary"><div><span>Fecha y hora</span><strong>${esc(new Date(booking.start_at).toLocaleString("es-CL", { timeZone: data.settings.timezone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }))}</strong><small>${esc(data.settings.timezone)}</small></div><div><span>Total de la hora</span><strong>${amount(booking.amount_minor, booking.currency)}</strong><small>${booking.status==='canceled'&&booking.payment_status==='unpaid'?'Sin pago registrado':paymentStates[booking.payment_status]}</small></div></div>
      ${booking.details.extras?.length ? `<div class="booking-extras-summary"><h3>Extras incluidos</h3>${booking.details.extras.map((extra:any)=>`<p>${esc(extra.name)} × ${extra.quantity} · ${amount(extra.priceMinor * extra.quantity,booking.currency)} · ${extra.durationMinutes * extra.quantity} minutos adicionales</p>`).join("")}</div>` : ""}
      ${holdDeadline(booking) ? `<div class="payment-hold-note"><strong>Plazo para pagar</strong><p>Horario reservado hasta ${esc(holdDeadline(booking))} (${esc(data.settings.timezone)}).</p><p>Si el pago de la tienda no se confirma a tiempo, el horario se libera automáticamente.</p></div>` : ""}

      <dl class="booking-detail-facts"><div><dt>Cliente</dt><dd>${esc(booking.customer_email)}</dd></div><div><dt>Profesional</dt><dd>${esc(booking.details.professionalName || "Sin asignar")}</dd></div><div><dt>Sucursal</dt><dd>${esc(booking.details.locationName || "Sin asignar")}</dd></div><div><dt>Personas</dt><dd>${booking.quantity}</dd></div></dl>
      ${editable ? `<label>Estado de la hora<select name="status" required><option value="" disabled selected>Selecciona un estado</option>${choices.map((value) => `<option value="${value}" ${value === "confirmed" && booking.payment_status === "unpaid" && !data.settings.allowPayLater ? "disabled" : ""}>${statuses[value]}${value === "confirmed" && booking.payment_status === "unpaid" && !data.settings.allowPayLater ? " · requiere pago en la tienda" : ""}</option>`).join("")}</select></label><label>Motivo del cambio (opcional)<textarea name="reason" maxlength="2000" rows="2"></textarea></label>` : '<p>Esta hora se conserva en el historial.</p>'}
      ${editable?'<p class="booking-change-note">La cancelación libera el horario y conserva el historial de la reserva.</p>':""}
      <p class="form-error" data-reservation-error role="alert"></p>${editable ? '<button type="submit" class="button primary">Guardar estado</button>' : ""}</form><details class="booking-history"><summary>Historial de la hora</summary><div data-booking-history role="status">Cargando historial…</div></details>`);
    const form = dialogContent().querySelector<HTMLFormElement>("#reservation-state-form")!;
    const historyHost = dialogContent().querySelector<HTMLElement>("[data-booking-history]")!;
    void api(undefined, "?action=booking-details&id=" + id).then((result) => {
      if (!historyHost.isConnected) return;
      const labels: Record<string,string> = { "create-booking": "Hora agendada", "booking-status": "Estado actualizado", "reschedule-booking": "Hora reagendada", "update-booking-extras": "Extras actualizados", "payment-hold-expired": "Horario liberado al vencer el plazo de pago" };
      historyHost.innerHTML = result.history.length ? `<ol>${result.history.map((event: any) => `<li><strong>${labels[event.action] || "Cambio registrado"}</strong><time>${esc(new Date(event.created_at).toLocaleString("es-CL", { timeZone:data.settings.timezone, dateStyle:"medium", timeStyle:"short", hourCycle:"h23" }))}</time>${event.data?.reason ? `<p>${esc(event.data.reason)}</p>` : ""}</li>`).join("")}</ol>` : "No hay cambios anteriores registrados.";
    }).catch(() => { if (historyHost.isConnected) historyHost.textContent = "No pudimos cargar el historial. Cierra y vuelve a abrir el detalle para intentar nuevamente."; });
    const extrasEdit = form.querySelector<HTMLButtonElement>("[data-edit-booking-extras]");
    if (extrasEdit) extrasEdit.onclick = () => bookingForm(booking, true);
    const reschedule = form.querySelector<HTMLButtonElement>("[data-reschedule]");
    if (reschedule) reschedule.onclick = () => bookingForm(booking);
    form.onsubmit = (event) => {
      event.preventDefault();
      void submitForm(form, { action: "booking-status", id, version: booking.version, status: new FormData(form).get("status"), reason: String(new FormData(form).get("reason") || "") });
    };
  }
  $("#reservations-refresh").onclick = () => { dashboard = undefined; void load(); };
  $("#reservation-new").onclick = () => { if (data && !loading && !saving) bookingForm(); };
  document.querySelectorAll<HTMLButtonElement>("[data-scheduling-section]").forEach((button) => {
    button.onclick = () => {
      if (saving) return;
      setSection(button.dataset.schedulingSection as SchedulingSection);
      ctx.navigate();
      window.scrollTo({ top: 0, behavior: "auto" });
    };
  });
  function setSection(section: SchedulingSection) {
    tab = section;
    scheduleHoldRefresh();
    catalogSearch = ""; categoryFilter = "";
    syncNavigation();
    if (data && !loading) draw();
  }
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || loading || saving || !data) return;
    if (button.hasAttribute("data-dashboard-retry")) void loadDashboard();
    if (button.dataset.schedulingGo) { setSection(button.dataset.schedulingGo as SchedulingSection); ctx.navigate(); }
    if (button.dataset.agendaDay) { day = button.dataset.agendaDay; page = 1; setSection("agenda"); ctx.navigate(); void load(); }
    if (button.hasAttribute("data-entry-new")) editEntry();
    if (button.dataset.entryCopy) {
      const entry = data.catalog.find((item) => item.id === Number(button.dataset.entryCopy));
      if (entry) editEntry({ ...entry, copyImageFrom: entry.hasImage ? entry.id : undefined, id: 0, version: 0, name: entry.name + " (copia)" });
    }
    if (button.dataset.entryEdit) editEntry(data.catalog.find((entry) => entry.id === Number(button.dataset.entryEdit)));
    if (button.dataset.bookingManage) manageBooking(Number(button.dataset.bookingManage));
    if (button.dataset.bookingsPage) { page = Number(button.dataset.bookingsPage); void load(); }
    if (button.hasAttribute("data-clear-day")) { day = ""; page = 1; void load(); }
  });
  return { section: () => tab, setSection, render: () => { syncNavigation(); scheduleHoldRefresh(); if (!loaded && !loading && !saving) void load(); } };
}
