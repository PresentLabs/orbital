import {showNotice,installDrawer,type NoticeKind} from "@/lib/saas/ui-feedback";
import { uiIcon } from "@/lib/saas/icons";

type Person = {
  id: number;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
  deletedAt?: string | null;
  createdAt: string;
  nextPaymentAt?: string | null;
};
type Business = {
  id: number;
  name: string;
  plan: string;
  billingStatus: string;
  userCount: number;
  active: boolean;
  nextPaymentAt?: string | null;
  createdAt: string;
};
type Page<T> = { docs: T[]; totalDocs: number; page: number; totalPages: number };
type ModuleAccess = {
  id: string; name: string; description: string; version: string;
  enabled: boolean; configured: boolean; changedBy?: string; updatedAt?: string;
};
type Directory = {
  workspaces: Page<Business>;
  selected: Business | null;
  owners: Person[];
  users: Page<Person>;
  modules: ModuleAccess[];
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const roles: Record<string, string> = {
  owner: "Propietario", admin: "Administrador", editor: "Editor", member: "Colaborador", viewer: "Lector",
};
const statuses: Record<string, string> = {
  trial: "En prueba", active: "Activa", past_due: "Pago pendiente", canceled: "Cancelada",
};
const date = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString("es-CL", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    })
  : "Sin definir";
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2)
  .map((word) => word.charAt(0)).join("").toUpperCase();
const planName = (plan: string) => plan === "pro" ? "Pro" : "Starter";
const params = new URLSearchParams(location.search);
const dialog = $<HTMLDialogElement>("#platform-dialog");
const drawer=installDrawer(dialog);
const popover = $<HTMLDivElement>("#person-actions");
let directory: Directory;
const businessTabs = ["people", "subscription", "modules"];
let activeTab = businessTabs.includes(params.get("tab") || "") ? params.get("tab")! : "people";
let requestVersion = 0;
let loadController: AbortController | undefined;
let businessSearchTimer: ReturnType<typeof setTimeout>;
let userSearchTimer: ReturnType<typeof setTimeout>;
let noticeTimer: ReturnType<typeof setTimeout>;
let busy = false;
let loading = false;

async function api(query: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/saas/platform-admin" + query, {
    signal,
    ...(body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "No pudimos completar la operación.");
  return result;
}
function notice(message:string,kind:NoticeKind|'loading'='success'){showNotice($("#platform-status"),message,kind==='loading'?'info':kind);}

function updateURL() {
  history.replaceState(null, "", location.pathname + "?" + params);
}
function pagination(page: Page<unknown>, kind: string) {
  if (page.totalPages <= 1) return "";
  return `<button data-page-kind="${kind}" data-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>Anterior</button>
    <span>Página ${page.page} de ${page.totalPages}</span>
    <button data-page-kind="${kind}" data-page="${page.page + 1}" ${page.page >= page.totalPages ? "disabled" : ""}>Siguiente</button>`;
}
function searchField() {
  return `<form id="user-search" role="search" aria-label="Buscar personas">
    <label class="sr-only" for="user-query">Buscar persona</label>
    <div class="search-field">${uiIcon("search", 16)}
      <input id="user-query" name="userQ" type="search" maxlength="160" placeholder="Buscar por nombre o correo…" value="${esc(params.get("userQ") || "")}" autocomplete="off"/>
      <button class="search-clear" type="button" data-clear-search="user-query" aria-label="Limpiar búsqueda de personas"><span aria-hidden="true">×</span></button>
    </div>
  </form>`;
}
function peopleView() {
  const resultCount = directory.users.totalDocs;
  const query = params.get("userQ");
  const countLabel = query ? `${resultCount} ${resultCount === 1 ? "resultado" : "resultados"}`
    : `${resultCount} ${resultCount === 1 ? "persona registrada" : "personas registradas"}`;
  const rows = directory.users.docs.map((user) => {
    const state = user.deletedAt ? "deleted" : user.disabled ? "disabled" : "active";
    const stateLabel = user.deletedAt ? "Eliminado" : user.disabled ? "Desactivado" : "Activo";
    return `<tr>
      <td><div class="person-cell"><span class="person-avatar" data-owner="${user.role === "owner"}" aria-hidden="true">${esc(initials(user.name))}</span>
        <div class="person-copy"><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small>
        ${user.role === "owner" ? `<small class="owner-payment">Próximo pago · ${date(user.nextPaymentAt)}</small>` : ""}</div>
      </div></td>
      <td><span class="role-pill" data-role="${esc(user.role)}">${roles[user.role] || esc(user.role)}</span></td>
      <td><span class="status-pill" data-status="${state}">${stateLabel}</span></td>
      <td class="registered-date">${date(user.createdAt)}</td>
      <td><div class="row-actions">
        ${user.deletedAt
          ? `<button class="row-edit" data-user-action="restore-user" data-user="${user.id}">Restaurar</button>`
          : `<button class="row-edit" data-user-action="edit" data-user="${user.id}" id="edit-user-${user.id}" aria-label="Editar a ${esc(user.name)}">Editar</button>`}
        <button class="icon-button row-more" id="user-options-${user.id}" data-user-menu="${user.id}" popovertarget="person-actions" aria-expanded="false" aria-label="Más opciones para ${esc(user.name)}"><span class="menu-dots" aria-hidden="true">⋯</span></button>
      </div></td>
    </tr>`;
  }).join("");
  const empty = `<div class="empty-state">${uiIcon("search", 26)}
    <h3>${query ? "No encontramos a esa persona" : "Este negocio todavía no tiene personas"}</h3>
    <p>${query ? "Prueba con otro nombre o correo electrónico." : "Las personas registradas aparecerán aquí."}</p>
    ${query ? '<button type="button" data-clear-search="user-query">Limpiar búsqueda</button>' : ""}
  </div>`;
  return `<section class="people-panel" aria-label="Personas del negocio">
    <div class="people-toolbar"><div class="people-heading"><h3>Personas</h3><p>${countLabel}</p></div>${searchField()}</div>
    ${rows ? `<div class="table-scroll"><table><thead><tr>
      <th scope="col">Persona</th><th scope="col">Rol</th><th scope="col">Acceso</th><th scope="col">Fecha de registro</th><th scope="col"><span class="sr-only">Acciones</span></th>
      </tr></thead><tbody>${rows}</tbody></table></div>` : empty}
    <div class="pagination people-pagination">${pagination(directory.users, "userPage")}</div>
  </section>`;
}
function subscriptionView(workspace: Business) {
  return `<section class="billing-panel" aria-label="Suscripción del negocio">
    <div class="section-heading"><div><h3>Suscripción del negocio</h3><p>El plan y la fecha de pago corresponden al propietario actual. Estos datos se actualizan manualmente.</p></div>
      <button id="edit-subscription" type="button" data-edit-subscription>${uiIcon("pencil", 15)}Editar suscripción</button>
    </div>
    <dl class="billing-details">
      <div><dt>Plan contratado</dt><dd>${planName(workspace.plan)}</dd></div>
      <div><dt>Estado de la suscripción</dt><dd><span class="status-pill" data-status="${esc(workspace.billingStatus)}">${statuses[workspace.billingStatus] || "Sin definir"}</span></dd></div>
      <div><dt>Próximo pago</dt><dd>${date(workspace.nextPaymentAt)}</dd></div>
      <div><dt>Propietario</dt><dd>${directory.owners.map((owner) => `${esc(owner.name)}<small>${esc(owner.email)}</small>`).join("") || "Sin propietario asignado"}</dd></div>
    </dl>
  </section>`;
}
function modulesView() {
  return `<section class="module-access-panel" aria-label="Módulos del negocio">
    <div class="section-heading"><div><h3>Módulos del negocio</h3><p>Activa las herramientas que podrá utilizar este negocio desde su espacio.</p></div></div>
    <div class="module-access-grid">${(directory.modules || []).map((module) => `
      <article class="module-access-card">
        <div class="module-access-heading"><h3>${esc(module.name)}</h3><span class="status-pill" data-status="${module.enabled ? "active" : "disabled"}">${module.enabled ? "Activo" : "Inactivo"}</span></div>
        <p>${esc(module.description)}</p>
        <div class="module-access-footer"><small>Versión ${esc(module.version)}</small>
          <button id="module-${esc(module.id)}" data-module-access="${esc(module.id)}" class="${module.enabled ? "" : "primary"}">${module.enabled ? "Desactivar" : "Activar"}</button></div>
        ${module.updatedAt ? `<small>Último cambio ${date(module.updatedAt)}${module.changedBy ? ` · ${module.changedBy === "migration" ? "Instalación anterior" : "Administrador #" + esc(module.changedBy)}` : ""}</small>` : ""}
      </article>`).join("") || '<p>No hay módulos disponibles.</p>'}</div>
  </section>`;
}
function editModuleAccess(id: string) {
  const module = directory.modules.find((item) => item.id === id);
  if (!module || !directory.selected) return;
  const workspace = directory.selected.id;
  const enabled = !module.enabled;
  openDialog(`${enabled ? "Activar" : "Desactivar"} ${module.name}`,
    `<p class="dialog-intro">${esc(directory.selected.name)}</p><p class="confirm-note">${enabled
      ? "El negocio podrá configurar y utilizar esta herramienta desde su panel."
      : "Se pausarán las nuevas operaciones de esta herramienta. Su configuración e historial se conservarán."}</p>`,
    enabled ? "Activar módulo" : "Desactivar módulo");
  $("#platform-edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    void save({ action: "module", workspace, moduleId: module.id, enabled },
      form.querySelector('button[type="submit"]')!, "module-" + module.id);
  });
}
function render() {
  const focused = document.activeElement;
  const focusedID = focused?.id;
  const selection = focused instanceof HTMLInputElement && focused.type === "search"
    ? [focused.selectionStart, focused.selectionEnd] : null;
  const home = !params.has('workspace');
  const chooser = $('#business-directory');
  if(home) {if(chooser.matches(':popover-open'))chooser.hidePopover();chooser.removeAttribute('popover');chooser.removeAttribute('role');}
  else {chooser.setAttribute('popover','auto');chooser.setAttribute('role','dialog');}
  document.body.classList.toggle('directory-home',home);
  $('#toggle-businesses').hidden=home;
  $('#business-detail').hidden=home;
  $("#selected-business-label").textContent=directory.selected?.name || "Cambiar negocio";
  $("#business-total").textContent = String(directory.workspaces.totalDocs);
  $("#businesses").innerHTML = directory.workspaces.docs.map((workspace) =>
    `<button class="business-choice" data-business="${workspace.id}" title="${esc(workspace.name)}" aria-pressed="${!home && workspace.id === directory.selected?.id}">
      <span class="business-avatar" aria-hidden="true">${esc(initials(workspace.name))}</span>
      <span class="business-choice-copy"><strong>${esc(workspace.name)}</strong><small>Plan ${planName(workspace.plan)} · ${workspace.userCount} ${workspace.userCount === 1 ? "usuario" : "usuarios"}</small><span class="status-pill" data-status="${workspace.active ? "active" : "canceled"}" title="Suscripción: ${statuses[workspace.billingStatus] || workspace.billingStatus}">${workspace.active ? "Activo" : "Inactivo"}</span><span class="business-renewal"><span>Próximo vencimiento</span><strong>${workspace.nextPaymentAt ? date(workspace.nextPaymentAt) : "Sin fecha asignada"}</strong></span></span>
      ${workspace.id === directory.selected?.id ? uiIcon("arrowRight", 15) : ""}
    </button>`).join("") || `<div class="empty-state"><h3>No encontramos negocios</h3><p>Prueba con otro nombre.</p><button type="button" data-clear-search="business-query">Limpiar búsqueda</button></div>`;
  $("#business-pages").innerHTML = pagination(directory.workspaces, "page");
  if(home) return;
  const workspace = directory.selected;
  if (!workspace) {
    $("#business-detail").innerHTML = `<div class="empty-state">${uiIcon("folder", 30)}<h2>Selecciona un negocio</h2><p>Su equipo y suscripción aparecerán aquí.</p></div>`;
    $(".platform-layout").setAttribute("data-directory-open", "");
    $("#toggle-businesses").setAttribute("aria-expanded", "true");
    return;
  }
  const owner = directory.owners[0];
  const login = "/acceso?negocio=" + workspace.id;
  $("#business-detail").innerHTML = `
    <div class="business-heading"><div><h2>${esc(workspace.name)}</h2><p>Creado el ${date(workspace.createdAt)} · ID ${workspace.id}</p></div>
      <div class="business-link-actions">
        <button type="button" data-copy-access>${uiIcon("copy", 15)}Copiar acceso</button>
        <a class="button icon-button" href="${login}" target="_blank" rel="noopener noreferrer" aria-label="Abrir acceso de ${esc(workspace.name)}" title="Abrir acceso">${uiIcon("arrowRight", 16)}</a>
      </div>
    </div>
    <div class="summary-grid" aria-label="Resumen del negocio">
      <div class="summary-item"><div class="summary-label">Propietario</div><div class="summary-value"><span>${esc(owner?.name || "Sin asignar")}</span></div><small>${esc(owner?.email || "Asigna un propietario para este negocio")}</small></div>
      <div class="summary-item"><div class="summary-label">Suscripción</div><div class="summary-value"><span>${planName(workspace.plan)}</span><span class="status-pill" data-status="${esc(workspace.billingStatus)}">${statuses[workspace.billingStatus] || "Sin definir"}</span></div></div>
      <div class="summary-item"><div class="summary-label">Próximo pago</div><div class="summary-value"><span>${date(workspace.nextPaymentAt)}</span></div>${workspace.nextPaymentAt ? "" : "<small>Fecha pendiente de asignar</small>"}</div>
    </div>
    <div class="business-tabs" role="tablist" aria-label="Administrar negocio">
      <button id="people-tab" type="button" role="tab" data-business-tab="people" aria-controls="business-tab-panel" aria-selected="${activeTab === "people"}" tabindex="${activeTab === "people" ? "0" : "-1"}">Personas</button>
      <button id="subscription-tab" type="button" role="tab" data-business-tab="subscription" aria-controls="business-tab-panel" aria-selected="${activeTab === "subscription"}" tabindex="${activeTab === "subscription" ? "0" : "-1"}">Suscripción</button>
      <button id="modules-tab" type="button" role="tab" data-business-tab="modules" aria-controls="business-tab-panel" aria-selected="${activeTab === "modules"}" tabindex="${activeTab === "modules" ? "0" : "-1"}">Módulos</button>
    </div>
    <div id="business-tab-panel" role="tabpanel" aria-labelledby="${activeTab}-tab" tabindex="0">
      ${activeTab === "people" ? peopleView() : activeTab === "modules" ? modulesView() : subscriptionView(workspace)}
    </div>`;
  if (focusedID) {
    const next = document.getElementById(focusedID);
    next?.focus({ preventScroll: true });
    if (selection && next instanceof HTMLInputElement)
      next.setSelectionRange(selection[0], selection[1]);
  }
}
async function load() {
  const version = ++requestVersion;
  loadController?.abort();
  loadController = new AbortController();
  loading = true;
  $("#business-detail").setAttribute("aria-busy", "true");
  $("#refresh-platform").setAttribute("aria-busy", "true");
  notice("Actualizando negocios…", "loading");
  try {
    const result = await api("?" + params, undefined, loadController.signal);
    if (version !== requestVersion) return false;
    directory = result;

    updateURL();
    render();
    notice("");
    return true;
  } catch (error) {
    if (version !== requestVersion) return false;
    notice(error instanceof Error ? error.message : "No pudimos cargar los negocios. Intenta actualizar.", "error");
    if (!directory) {
      $("#businesses").innerHTML = '<div class="empty-state"><h3>No pudimos cargar los negocios</h3><button type="button" data-retry>Reintentar</button></div>';
      $("#business-detail").innerHTML = '<div class="empty-state"><h2>La administración no está disponible</h2><p>Revisa tu conexión e intenta nuevamente.</p></div>';
    }
    return false;
  } finally {
    if (version === requestVersion) {
      loading = false;
      $("#business-detail").setAttribute("aria-busy", "false");
      $("#refresh-platform").setAttribute("aria-busy", "false");
    }
  }
}
async function save(body: unknown, submit: HTMLButtonElement, returnFocusID: string) {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("button,input,select")];
  const disabled = controls.map((control) => control.disabled);
  const label = submit.innerHTML;
  controls.forEach((control) => { control.disabled = true; });
  submit.textContent = "Guardando…";
  try {
    await api("", body);
    drawer.close();
    if (await load()) {
      notice("Cambios guardados.");
      document.getElementById(returnFocusID)?.focus({ preventScroll: true });
    }
  } catch (error) {
    const target = $("#dialog-error");
    target.textContent = error instanceof Error ? error.message : "No pudimos guardar el cambio.";
  } finally {
    busy = false;
    if (submit.isConnected) submit.innerHTML = label;
    controls.forEach((control, index) => {
      if (control.isConnected) control.disabled = disabled[index];
    });
  }
}
function openDialog(title: string, fields: string, buttonLabel: string, dangerous = false) {
  clearTimeout(businessSearchTimer);
  clearTimeout(userSearchTimer);
  popover.hidePopover();
  $("#platform-dialog-title").textContent = title;
  $("#platform-dialog-content").innerHTML = `<form id="platform-edit-form">${fields}
    <p id="dialog-error" class="dialog-error" role="alert"></p>
    <div class="dialog-actions"><button type="button" data-dismiss-dialog>Cancelar</button>
      <button class="${dangerous ? "danger-button" : "primary"}" type="submit">${buttonLabel}</button></div></form>`;
  drawer.open();
  dialog.querySelector<HTMLElement>("#platform-edit-form input, #platform-edit-form select")?.focus();
}
function editSubscription() {
  const workspace = directory.selected!;
  openDialog("Editar suscripción", `
    <p class="dialog-intro">${esc(workspace.name)}</p>
    <label>Plan<select name="plan">${["starter", "pro"].map((plan) => `<option value="${plan}" ${plan === workspace.plan ? "selected" : ""}>${planName(plan)}</option>`).join("")}</select></label>
    <label>Estado de suscripción<select name="billingStatus">${Object.entries(statuses).map(([key, label]) => `<option value="${key}" ${key === workspace.billingStatus ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <label>Próximo pago del propietario<input name="nextPaymentAt" type="date" value="${esc(workspace.nextPaymentAt?.slice(0, 10) || "")}"/></label>
  `, "Guardar suscripción");
  $("#platform-edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    void save({
      action: "subscription", workspace: workspace.id, plan: data.get("plan"),
      billingStatus: data.get("billingStatus"), nextPaymentAt: data.get("nextPaymentAt") || null,
    }, form.querySelector('button[type="submit"]')!, "edit-subscription");
  });
}
function editUser(user: Person, action: string) {
  const workspace = directory.selected!;
  let fields = "";
  let title = "Editar persona";
  let buttonLabel = "Guardar cambios";
  const person = `<div class="confirm-person"><span class="person-avatar" aria-hidden="true">${esc(initials(user.name))}</span><div><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></div></div>`;
  if (action === "edit") {
    fields = `<p class="dialog-intro">${esc(workspace.name)}</p>
      <label>Nombre<input name="name" required maxlength="80" value="${esc(user.name)}" autocomplete="off"/></label>
      <label>Correo electrónico<input name="email" type="email" required maxlength="254" value="${esc(user.email)}" autocomplete="off"/></label>
      <label>Rol<select name="role">${Object.entries(roles).filter(([role]) => user.role === "owner" ? role === "owner" : role !== "owner").map(([role, label]) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      ${user.role !== "owner" ? `<label class="check-label"><input name="disabled" type="checkbox" ${user.disabled ? "checked" : ""}/>Desactivar acceso al negocio</label>` : ""}`;
  } else if (action === "transfer-owner") {
    title = "Transferir propiedad";
    buttonLabel = "Transferir propiedad";
    fields = `<p class="dialog-intro">Nuevo propietario de ${esc(workspace.name)}</p>${person}
      <p class="confirm-note">${esc(directory.owners[0]?.name)} pasará a ser administrador. La suscripción y la próxima fecha de pago quedarán a cargo de ${esc(user.name)}.</p>`;
  } else if (action === "delete-user") {
    title = "Eliminar persona";
    buttonLabel = "Eliminar persona";
    fields = `${person}<p class="confirm-note danger">Perderá el acceso a ${esc(workspace.name)}. Podrás restaurar su cuenta durante los próximos 30 días.</p>`;
  } else {
    title = "Restaurar persona";
    buttonLabel = "Restaurar acceso";
    fields = `${person}<p class="confirm-note">Volverá a tener acceso a ${esc(workspace.name)} con su rol de ${esc(roles[user.role] || user.role).toLowerCase()}.</p>`;
  }
  openDialog(title, fields, buttonLabel, action === "delete-user");
  $("#platform-edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    void save({
      action: action === "edit" ? "user" : action, workspace: workspace.id,
      user: user.id, previousOwner: directory.owners[0]?.id,
      ...(action === "edit" ? {
        name: data.get("name"), email: data.get("email"), role: data.get("role"), disabled: data.has("disabled"),
      } : {}),
    }, form.querySelector('button[type="submit"]')!, "user-options-" + user.id);
  });
}
function prepareUserMenu(button: HTMLButtonElement) {
  const user = directory.users.docs.find((person) => String(person.id) === button.dataset.userMenu);
  if (!user) return;
  const action = (value: string, label: string, icon: string, dangerous = false) =>
    `<button type="button" class="${dangerous ? "danger" : ""}" data-user-action="${value}" data-user="${user.id}">${uiIcon(icon, 15)}${label}</button>`;
  document.querySelectorAll("[data-user-menu]").forEach((trigger) => {
    trigger.setAttribute("aria-expanded", String(trigger === button));
  });
  popover.innerHTML = user.deletedAt ? action("restore-user", "Restaurar acceso", "undo")
    : action("edit", "Editar persona", "pencil")
      + (user.role !== "owner" && !user.disabled && directory.owners.length === 1 ? action("transfer-owner", "Transferir propiedad", "arrowRight") : "")
      + (user.role !== "owner" ? action("delete-user", "Eliminar persona", "trash", true) : "");
  const rect = button.getBoundingClientRect();
  const height = popover.children.length * 42 + 16;
  popover.style.left = Math.max(12, Math.min(rect.right - 218, window.innerWidth - 230)) + "px";
  popover.style.top = (rect.bottom + height < window.innerHeight - 12 ? rect.bottom + 5 : Math.max(12, rect.top - height)) + "px";
}
function searchBusinesses() {
  clearTimeout(businessSearchTimer);
  const query = $<HTMLInputElement>("#business-query").value.trim();
  if (query === (params.get("q") || "")) return;
  if (query) params.set("q", query);
  else params.delete("q");
  ["page", "workspace", "userQ", "userPage"].forEach((key) => params.delete(key));
  void load();
}
function searchUsers() {
  clearTimeout(userSearchTimer);
  const input = document.querySelector<HTMLInputElement>("#user-query");
  if (!input) return;
  const query = input.value.trim();
  if (query === (params.get("userQ") || "")) return;
  if (query) params.set("userQ", query);
  else params.delete("userQ");
  params.delete("userPage");
  void load();
}
function selectTab(tab: string, focus = false) {
  clearTimeout(userSearchTimer);
  activeTab = tab;
  if (tab === "people") params.delete("tab");
  else params.set("tab", tab);
  updateURL();
  render();
  if (focus) $(`#${tab}-tab`).focus();
}
popover.addEventListener("toggle", () => {
  if (!popover.matches(":popover-open"))
    document.querySelectorAll("[data-user-menu]").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
});
$("#business-search").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!busy) searchBusinesses();
});
$<HTMLInputElement>("#business-query").value = params.get("q") || "";
$("#business-query").addEventListener("input", () => {
  clearTimeout(businessSearchTimer);
  businessSearchTimer = setTimeout(searchBusinesses, 280);
});
document.addEventListener("input", (event) => {
  if ((event.target as HTMLElement).id !== "user-query" || busy) return;
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(searchUsers, 280);
});
document.addEventListener("submit", (event) => {
  if ((event.target as HTMLElement).id !== "user-search") return;
  event.preventDefault();
  if (!busy) searchUsers();
});
$("#refresh-platform").onclick = () => { if (!busy) void load(); };
$("#close-platform-dialog").onclick = () => { if (!busy) drawer.close(); };
dialog.addEventListener("cancel", (event) => { if (busy) event.preventDefault(); });
const chooser=$("#business-directory");
$("#toggle-businesses").onclick=()=>chooser.togglePopover();
chooser.addEventListener('toggle',(event:Event)=>{const open=chooser.matches(':popover-open');$("#toggle-businesses").setAttribute('aria-expanded',String(open));if(open)$("#business-query").focus();});

document.addEventListener("keydown", (event) => {
  const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-business-tab]");
  if (!tab || busy || loading || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = businessTabs.indexOf(activeTab);
  const next = event.key === "Home" ? businessTabs[0] : event.key === "End" ? businessTabs[2]
    : businessTabs[(index + (event.key === "ArrowLeft" ? 2 : 1)) % businessTabs.length];
  selectTab(next, true);
});
document.addEventListener("click", async (event) => {
  const target = (event.target as Element).closest<HTMLButtonElement>("button");
  if (!target) return;
  if (busy) { event.preventDefault(); return; }
  if (target.hasAttribute("data-dismiss-dialog")) { drawer.close(); return; }
  if (target.hasAttribute("data-retry")) { void load(); return; }
  if (target.dataset.clearSearch) {
    const input = $<HTMLInputElement>("#" + target.dataset.clearSearch);
    input.value = "";
    input.focus();
    if (input.id === "business-query") searchBusinesses();
    else searchUsers();
    return;
  }
  if (target.dataset.business) {
    clearTimeout(userSearchTimer);
    params.set("workspace", target.dataset.business);
    params.delete("userPage");
    params.delete("userQ");
    $(".platform-layout").removeAttribute("data-directory-open");
    $("#toggle-businesses").setAttribute("aria-expanded", "false");
    if(chooser.matches(":popover-open"))chooser.hidePopover();
    void load();
    return;
  }
  if (target.dataset.pageKind && target.dataset.page) {
    params.set(target.dataset.pageKind, target.dataset.page);
    if (target.dataset.pageKind === "page")
      ["workspace", "userQ", "userPage"].forEach((key) => params.delete(key));
    void load();
    return;
  }
  if (loading && target.closest("#business-detail, #person-actions")) {
    event.preventDefault();
    return;
  }
  if (target.dataset.moduleAccess) { editModuleAccess(target.dataset.moduleAccess); return; }
  if (target.dataset.businessTab) { selectTab(target.dataset.businessTab); return; }
  if (target.hasAttribute("data-edit-subscription")) { editSubscription(); return; }
  if (target.hasAttribute("data-copy-access")) {
    try {
      await navigator.clipboard.writeText(location.origin + "/acceso?negocio=" + directory.selected!.id);
      notice("Enlace de acceso copiado.");
    } catch {
      notice("No pudimos copiar el enlace. Puedes abrirlo con el botón de al lado.", "error");
    }
    return;
  }
  if (target.dataset.userMenu) { prepareUserMenu(target); return; }
  if (target.dataset.userAction) {
    const user = directory.users.docs.find((person) => String(person.id) === target.dataset.user);
    if (user) editUser(user, target.dataset.userAction);
  }
});
void load();
