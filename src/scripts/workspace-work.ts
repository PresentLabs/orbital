import {
  type WorkspaceState,
  type WorkspaceMember,
  type TaskBoard,
  type Task,
  uid,
} from "@/lib/saas/model";
import { canView, canWrite } from "@/lib/saas/permissions";
import {
  ensureWork,
  modeOf,
  workModes,
  activeCycle,
  boardTasks,
  startCycle,
  cycleCounts,
  cycleSeries,
  companyDay,
  type WorkMode,
  type WorkCycle,
  type ResourceLink,
} from "@/lib/saas/work-management";
import { sanitizeRichText } from "@/lib/saas/rich-text";
import { uiIcon } from "@/lib/saas/icons";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const $ = <T extends HTMLElement = HTMLElement>(q: string) =>
  document.querySelector<T>(q)!;
const date = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const options = (value: WorkMode) =>
  Object.entries(workModes)
    .map(
      ([k, v]) =>
        `<option value="${k}" ${value === k ? "selected" : ""}>${v}</option>`,
    )
    .join("");
export const workModeField = (value: WorkMode = "daily") =>
  `<label>Forma de trabajo<select name="workMode">${options(value)}</select></label><p class="field-hint">Trabajo diario: pendientes continuos. Por ciclos: un objetivo durante un período. Proyecto con tiempo definido: un problema y el tiempo que decides dedicarle. Son prácticas adaptadas; no requieren conocer Scrum, Lean o Shape Up.</p>`;
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  board: () => string;
  mutate: (fn: () => void) => void;
  modal: (s: string) => void;
  close: () => void;
  notify: (s: string) => void;
  render: () => void;
  openTask: (id: string) => void;
  openBoard: (id: string) => void;
  openPage: (id: string) => void;
  openSpace: (id: string) => void;
  deleteBoard: () => void;
  pickFile: (pick: (id: string) => void) => void;
  openFile: (id: string) => void;
};
export function installWork(ctx: Ctx) {
  let tab: "board" | "summary" | "progress" = "board",
    boardId = "",
    scope = "all",
    historyId = "",
    periodDays = 30;
  const board = () =>
    ctx
      .state()
      .boards?.find(
        (b) =>
          b.id === ctx.board() &&
          (!b.privateOwner || b.privateOwner === String(ctx.actor().id)),
      );
  const writable = () => canWrite(ctx.actor(), "tasks");
  const today = () => companyDay(ctx.state().settings.timezone);
  function filterTask(t: Task) {
    const b = board(),
      c = b && activeCycle(b);
    return scope !== "current" || !c || c.taskIds.includes(t.id);
  }
  function render() {
    const b = board();
    if (!b) return;
    if (boardId !== b.id) {
      boardId = b.id;
      tab = "board";
      scope = "all";
      historyId = "";
    }
    $("#board-description").textContent = b.description || "";
    $("#board-work-mode").textContent = workModes[modeOf(b)];
    document.querySelector<HTMLElement>(".board-menu")!.hidden = !writable();
    $("#board-secondary-menu").hidden = !writable();
    $("#board-secondary-menu").innerHTML =
      `<button class="button secondary" data-work="settings">${uiIcon("settings", 16)} Configurar tablero</button><button class="button secondary" data-trash-section="tasks" data-trash-private="${!!b.privateOwner}">${uiIcon("trash", 16)} Papelera</button><button class="danger-button" data-work="delete">Eliminar tablero</button>`;
    document.querySelectorAll<HTMLElement>("[data-board-tab]").forEach((el) => {
      el.setAttribute("aria-selected", String(el.dataset.boardTab === tab));
      el.tabIndex = el.dataset.boardTab === tab ? 0 : -1;
    });
    $("#board-main-pane").hidden = tab !== "board";
    $("#board-summary-pane").hidden = tab !== "summary";
    $("#board-progress-pane").hidden = tab !== "progress";
    const cycle = activeCycle(b),
      period = b.work?.periods.find((p) => p.status === "active");
    $("#board-active-work").innerHTML = cycle
      ? `<div class="work-active"><div><strong>${esc(cycle.name)}</strong><p>${esc(cycle.goal)}</p><small>${date(cycle.start)} — ${date(cycle.end)} · ${today() > cycle.end ? "Período vencido; sigue abierto" : Math.max(0, Math.ceil((Date.parse(cycle.end) - Date.parse(today())) / 86400000)) + " días restantes"}</small></div><button class="button secondary" data-board-tab="progress">Ver avance</button></div>`
      : period
        ? `<p class="work-active">${date(period.start)} — ${date(period.end)}${today() > period.end ? " · Terminó el tiempo previsto. Revisa qué se logró y decide cómo continuar." : ""}</p>`
        : "";
    const filter = $<HTMLSelectElement>("#cycle-task-filter");
    filter.hidden = !cycle;
    filter.value = scope;
    if (tab === "summary") renderSummary(b);
    if (tab === "progress") renderProgress(b);
  }
  function renderSummary(b: TaskBoard) {
    const mode = modeOf(b),
      summary = b.work?.summary || {},
      fields =
        mode === "daily"
          ? [
              ["purpose", "Propósito"],
              ["agreements", "Acuerdos de trabajo"],
              ["done", "Criterios para considerar una tarea terminada"],
              ["resources", "Recursos y enlaces"],
            ]
          : mode === "cycles"
            ? [
                ["purpose", "Contexto general"],
                ["resources", "Recursos y enlaces"],
              ]
            : [
                ["problem", "Problema que queremos resolver"],
                ["outcome", "Resultado esperado"],
                ["appetite", "Tiempo que estamos dispuestos a dedicarle"],
                ["solution", "Solución general"],
                ["outside", "Qué queda fuera"],
                ["risks", "Riesgos o dudas"],
                ["resources", "Recursos y enlaces"],
              ];
    $("#board-summary-pane").innerHTML =
      `<form id="board-summary-form" class="work-summary"><p class="section-note">El contexto queda en este tablero; no necesitas crear una nota aparte.</p>${fields.map(([key, label]) => `<label>${label}<div data-work-summary="${key}" class="work-rich-editor" ${writable() ? 'contenteditable="true"' : ""} role="textbox" aria-label="${label}" data-rich-editor="true">${sanitizeRichText(summary[key] || "<p><br></p>")}</div></label>`).join("")}${
        Object.entries(summary).some(
          ([key]) => !fields.some(([k]) => key === k),
        )
          ? `<details><summary>Contexto guardado de otras formas de trabajo</summary>${Object.entries(
              summary,
            )
              .filter(([key]) => !fields.some(([k]) => key === k))
              .map(
                ([, value]) =>
                  `<div class="work-review">${sanitizeRichText(value)}</div>`,
              )
              .join("")}</details>`
          : ""
      }${writable() ? '<button class="button primary">Guardar resumen</button>' : ""}</form>`;
    $("#board-summary-form").onsubmit = (e) => {
      e.preventDefault();
      if (!writable()) return;
      const values: Record<string, string> = { ...summary };
      document
        .querySelectorAll<HTMLElement>("[data-work-summary]")
        .forEach(
          (el) =>
            (values[el.dataset.workSummary!] = sanitizeRichText(el.innerHTML)),
        );
      ctx.mutate(() => (ensureWork(b).summary = values));
      ctx.notify("Resumen guardado.");
    };
  }
  function cycleChart(c: WorkCycle) {
    const series = cycleSeries(c, ctx.state().settings.timezone),
      max = Math.max(1, c.initial || 0, ...series.observed.map((p) => p.value)),
      x = (d: string) => 42 + series.position(d) * 610,
      y = (v: number) => 204 - (v / max) * 165;
    return `<svg viewBox="0 0 700 245" class="burndown-chart" role="img" aria-label="Trabajo pendiente del ciclo: línea de referencia ideal y mediciones reales"><path class="burndown-ideal" d="M${x(c.start)} ${y(c.initial || 0)} L${x(c.end)} ${y(0)}"/><path class="burndown-actual" d="${series.observed.map((p, i) => (i ? "L" : "M") + x(p.date) + " " + y(p.value)).join(" ")}"/>${series.observed.map((p) => `<circle class="burndown-point" tabindex="0" cx="${x(p.date)}" cy="${y(p.value)}" r="4"><title>${date(p.date)}: ${p.value} pendientes</title></circle>`).join("")}<text x="42" y="238">${date(c.start)}</text><text x="545" y="238">${date(series.domainEnd)}</text></svg><p>Alcance inicial: ${c.initialScope} tareas · Trabajo pendiente inicial: ${c.initial}. Cada tarea cuenta como una unidad; no representa su esfuerzo relativo.</p>${series.observed.length <= 1 ? '<p class="section-note">El avance aparecerá a medida que el equipo actualice las tareas.</p>' : ""}<div class="burndown-legend"><span><i></i>Trabajo pendiente registrado</span><span><i></i>Referencia ideal</span></div><details><summary>Ver registros y cambios de alcance</summary><div class="work-table-wrap"><table class="work-table"><thead><tr><th>Fecha (${esc(ctx.state().settings.timezone)})</th><th>Registro</th><th>Pendientes</th><th>Alcance</th></tr></thead><tbody>${c.events.map((e) => `<tr><td>${new Date(e.at).toLocaleString("es-CL", { timeZone: ctx.state().settings.timezone })}</td><td>${{ started: "Inicio", added: "Tarea incorporada", removed: "Tarea retirada", completed: "Tarea completada", reopened: "Tarea reabierta", trashed: "Retirada por papelera o cambio de tablero" }[e.kind]}</td><td>${e.remaining}</td><td>${e.scope}</td></tr>`).join("")}</tbody></table></div><p>Las tareas retiradas o enviadas a papelera salen del alcance, sin contar como completadas. Su participación permanece en estos registros. La referencia inicial no se modifica.</p></details>`;
  }
  function renderProgress(b: TaskBoard) {
    const tasks = boardTasks(ctx.state(), b),
      mode = modeOf(b),
      work = b.work,
      c = activeCycle(b),
      cycles = work?.cycles || [],
      selected = cycles.find((c) => c.id === historyId) || c || cycles.at(-1),
      since = new Date(
        Date.parse(today() + "T12:00:00Z") - (periodDays - 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10),
      completed = tasks.filter((t) =>
        t.activity?.some(
          (e) =>
            e.kind === "completed" &&
            companyDay(ctx.state().settings.timezone, new Date(e.at)) >=
              since &&
            companyDay(ctx.state().settings.timezone, new Date(e.at)) <=
              today(),
        ),
      ).length;
    $("#board-progress-pane").innerHTML =
      `<div class="work-metrics" aria-label="Situación actual de todo el tablero"><article><span>Pendientes actuales</span><strong>${tasks.filter((t) => t.status === "todo").length}</strong></article><article><span>En progreso ahora</span><strong>${tasks.filter((t) => t.status === "doing").length}</strong></article><article><span>Bloqueadas ahora</span><strong>${tasks.filter((t) => t.blockedAt && t.status !== "done").length}</strong></article></div><div class="work-period-metric"><label>Completadas entre ${date(since)} y ${date(today())}<select id="work-metric-period"><option value="7" ${periodDays === 7 ? "selected" : ""}>Últimos 7 días</option><option value="30" ${periodDays === 30 ? "selected" : ""}>Últimos 30 días</option></select></label><strong>${completed} tareas con finalización registrada</strong><small>Solo registros desde esta actualización. Las tareas en papelera no se incluyen. No se deducen tiempos de entrega de fechas de edición.</small></div>${mode === "cycles" || cycles.length ? `<section class="panel work-section"><div class="panel-heading"><h2>Ciclos de trabajo</h2>${writable() && mode === "cycles" ? '<button class="button primary" data-work="prepare">Preparar ciclo</button>' : ""}</div>${cycles.length ? `<label>Ciclo<select id="work-cycle-history">${cycles.map((item) => `<option value="${item.id}" ${selected?.id === item.id ? "selected" : ""}>${esc(item.name)} · ${{ draft: "En preparación", active: "Activo", closed: "Cerrado" }[item.status]}</option>`).join("")}</select></label>` : "<p>Define un objetivo y elige tareas de este tablero para tu primer ciclo.</p>"}${selected ? `<h3>${esc(selected.name)}</h3><p>${esc(selected.goal)}</p><p>${date(selected.start)} — ${date(selected.end)}</p>${writable() && mode === "cycles" && selected.status !== "closed" ? `<div class="work-actions"><button class="button secondary" data-work="edit-cycle" data-id="${selected.id}">${selected.status === "draft" ? "Editar preparación" : "Ajustar tareas del ciclo"}</button><button class="button primary" data-work="${selected.status === "draft" ? "start-cycle" : "close-cycle"}" data-id="${selected.id}">${selected.status === "draft" ? "Iniciar ciclo" : "Revisar y cerrar"}</button></div>` : ""}${selected.status === "draft" ? "<p>La medición comienza cuando inicies el ciclo.</p>" : `<h3>Trabajo pendiente del ciclo</h3><small>Burndown por cantidad de tareas</small>${cycleChart(selected)}`}${selected.review ? `<div class="work-review"><h3>Revisión</h3><p>Objetivo: ${esc(selected.review.achieved)}</p><p>Qué funcionó: ${esc(selected.review.worked)}</p><p>Qué mejorar: ${esc(selected.review.improve)}</p><p>Pendientes: ${selected.review.pending === "backlog" ? "Vuelven al trabajo pendiente" : "Disponibles para elegir en otro ciclo; no se incorporan automáticamente"}</p>${canWrite(ctx.actor(), "pages") ? `<button class="button secondary" data-work="review-note" data-id="${selected.id}">Guardar revisión como Nota</button>` : ""}</div>` : ""}` : ""}</section>` : ""}${mode === "project" || work?.periods.length ? projectProgress(b) : ""}${(b.sprints || []).length ? `<details class="panel work-section"><summary>Historial anterior de ciclos (${b.sprints!.length})</summary><p>Se conservan los sprints originales. No hay registro fiable de las tareas participantes ni de cada cambio de alcance anterior a esta actualización.</p>${b.sprints!.map((s) => `<h3>${esc(s.name)}</h3><p>${date(s.start)} — ${date(s.end)} · Referencia inicial: ${s.initial} pendientes / ${s.initialScope} tareas</p><table class="work-table"><thead><tr><th>Fecha registrada</th><th>Pendientes</th><th>Alcance</th></tr></thead><tbody>${s.history.map((p) => `<tr><td>${date(p.date)}</td><td>${p.remaining}</td><td>${p.scope}</td></tr>`).join("")}</tbody></table>`).join("")}</details>` : ""}`;
    $("#work-metric-period").onchange = (e) => {
      periodDays = Number((e.target as HTMLSelectElement).value);
      renderProgress(b);
    };
    $("#work-cycle-history")?.addEventListener("change", (e) => {
      historyId = (e.target as HTMLSelectElement).value;
      renderProgress(b);
    });
  }
  function projectProgress(b: TaskBoard) {
    const periods = b.work?.periods || [],
      active = periods.find((p) => p.status === "active");
    return `<section class="panel work-section"><div class="panel-heading"><h2>Períodos del proyecto</h2>${writable() && modeOf(b) === "project" && !active ? '<button class="button primary" data-work="period">Iniciar período de trabajo</button>' : ""}</div><p>Estado del proyecto: ${active ? "En curso" : periods.at(-1)?.status === "replanned" ? "Por replantear" : periods.length ? "Cerrado" : "En preparación"}. El tiempo disponible expresa cuánto decides invertir; no estima automáticamente las tareas.</p>${!periods.length ? "<p>Completa el contexto en Resumen y decide un período de trabajo.</p>" : ""}${periods.map((p) => `<article class="work-review"><strong>${date(p.start)} — ${date(p.end)} · ${{ active: "Activo", closed: "Cerrado", replanned: "Replanteado" }[p.status]}</strong>${p.status === "active" ? `${today() > p.end ? "<p>Terminó el tiempo previsto. Revisa qué se logró y decide cómo continuar.</p>" : ""}${writable() ? `<button class="button secondary" data-work="period-close" data-id="${p.id}">Revisar y decidir</button>` : ""}` : `<p>${esc(p.decision)}</p><p>${esc(p.result)}</p>${canWrite(ctx.actor(), "pages") ? `<button class="button secondary" data-work="period-note" data-id="${p.id}">Guardar resultado como Nota</button>` : ""}`}</article>`).join("")}</section>`;
  }
  function settings() {
    const b = board();
    if (!b || !writable()) return;
    ctx.modal(
      `<h2>Configurar tablero</h2><form id="work-settings"><label>Nombre<input name="name" value="${esc(b.name)}" maxlength="80" required/></label><label>Descripción<textarea name="description" maxlength="2000">${esc(b.description)}</textarea></label>${workModeField(modeOf(b))}<label>Límite de tareas en curso (opcional)<input name="limit" type="number" min="1" max="1000" value="${b.work?.limit || ""}"/></label><p>El límite avisa; no impide mover tareas. Cambiar la forma de trabajo conserva tareas, resúmenes e historial. Cierra el ciclo o período activo antes de cambiar a otra forma.</p><p id="work-error" role="alert"></p><button class="button primary">Guardar configuración</button></form>`,
    );
    $("#work-settings").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        mode = String(f.get("workMode")) as WorkMode;
      if (
        mode !== modeOf(b) &&
        (activeCycle(b) || b.work?.periods.some((p) => p.status === "active"))
      ) {
        $("#work-error").textContent =
          "Primero revisa y cierra el ciclo o período activo en Avance.";
        return;
      }
      ctx.mutate(() => {
        b.name = String(f.get("name")).trim();
        b.description = String(f.get("description"));
        const w = ensureWork(b);
        w.mode = mode;
        w.limit = f.get("limit") ? Number(f.get("limit")) : undefined;
      });
      ctx.close();
      ctx.notify("Configuración guardada.");
    };
  }
  function cycleEditor(id?: string) {
    const b = board();
    if (!b || !writable()) return;
    const current = b.work?.cycles.find((c) => c.id === id),
      tasks = boardTasks(ctx.state(), b);
    ctx.modal(
      `<h2>${current?.status === "active" ? "Ajustar tareas del ciclo" : "Preparar ciclo"}</h2><form id="work-cycle-form"><label>Nombre<input name="name" value="${esc(current?.name || "Nuevo ciclo")}" maxlength="80" required ${current?.status === "active" ? "readonly" : ""}/></label><label>Objetivo<textarea name="goal" maxlength="2000" required ${current?.status === "active" ? "readonly" : ""}>${esc(current?.goal || "")}</textarea></label><div class="work-form-row"><label>Inicio<input type="date" name="start" value="${current?.start || today()}" required ${current?.status === "active" ? "readonly" : ""}/></label><label>Fin<input type="date" name="end" value="${current?.end || today()}" required ${current?.status === "active" ? "readonly" : ""}/></label></div><fieldset class="work-task-picker"><legend>Tareas de este tablero</legend>${tasks.map((t) => `<label><input type="checkbox" name="tasks" value="${t.id}" ${current?.taskIds.includes(t.id) ? "checked" : ""}/><span>${esc(t.title)} <small>${{ todo: "Por hacer", doing: "En progreso", done: "Completada" }[t.status]}</small></span></label>`).join("") || "<p>Añade una tarea al tablero antes de iniciar un ciclo.</p>"}</fieldset><p>La fecha de vencimiento de cada tarea se conserva. Las tareas fuera del ciclo siguen disponibles.</p><p id="work-error" role="alert"></p><button class="button primary">Guardar ${current?.status === "active" ? "selección" : "preparación"}</button></form>`,
    );
    $("#work-cycle-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        start = String(f.get("start")),
        end = String(f.get("end"));
      if (end < start) {
        $("#work-error").textContent =
          "La fecha final debe ser igual o posterior al inicio.";
        return;
      }
      const saved: WorkCycle = current || {
        id: uid(),
        name: "",
        goal: "",
        start,
        end,
        status: "draft",
        taskIds: [],
        events: [],
      };
      ctx.mutate(() => {
        Object.assign(saved, {
          name: String(f.get("name")).trim(),
          goal: String(f.get("goal")).trim(),
          start,
          end,
          taskIds: f.getAll("tasks").map(String),
        });
        if (!current) ensureWork(b).cycles.push(saved);
      });
      historyId = saved.id;
      ctx.close();
      ctx.render();
      ctx.notify("Ciclo guardado. Puedes iniciarlo desde Avance.");
    };
  }
  function start(id: string) {
    const b = board(),
      c = b?.work?.cycles.find((c) => c.id === id);
    if (!b || !c || !writable()) return;
    try {
      const copy = structuredClone(c);
      startCycle(
        b,
        copy,
        boardTasks(ctx.state(), b),
        new Date(),
        ctx.state().settings.timezone,
      );
      ctx.mutate(() => Object.assign(c, copy));
      ctx.notify("Ciclo iniciado. Las mediciones comienzan ahora.");
    } catch (e) {
      ctx.notify((e as Error).message);
    }
  }
  function closeCycle(id: string) {
    const b = board(),
      c = b?.work?.cycles.find((c) => c.id === id);
    if (!b || !c || c.status !== "active" || !writable()) return;
    const counts = cycleCounts(c, boardTasks(ctx.state(), b));
    ctx.modal(
      `<h2>Revisar y cerrar ciclo</h2><p>${counts.scope - counts.remaining} terminadas · ${counts.remaining} pendientes del ciclo.</p><form id="work-close-cycle"><label>¿Se alcanzó el objetivo?<select name="achieved" required><option value="">Elige una respuesta</option><option>Sí</option><option>Parcialmente</option><option>No</option></select></label><label>Qué funcionó<textarea name="worked" maxlength="5000"></textarea></label><label>Qué mejorar<textarea name="improve" maxlength="5000"></textarea></label><label>Qué hacemos con las pendientes<select name="pending" required><option value="">Elige una decisión</option><option value="backlog">Volver al trabajo pendiente (Por hacer)</option><option value="later">Mantener estado y elegirlas en otro ciclo cuando corresponda</option></select></label><p>No se duplicarán ni pasarán automáticamente al siguiente ciclo.</p><button class="button primary">Cerrar y guardar revisión</button></form>`,
    );
    $("#work-close-cycle").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      ctx.mutate(() => {
        c.status = "closed";
        c.closedAt = new Date().toISOString();
        c.review = {
          achieved: String(f.get("achieved")),
          worked: String(f.get("worked")),
          improve: String(f.get("improve")),
          pending: f.get("pending") as "backlog" | "later",
        };
        if (c.review.pending === "backlog")
          for (const task of boardTasks(ctx.state(), b))
            if (c.taskIds.includes(task.id) && task.status !== "done")
              task.status = "todo";
      });
      ctx.close();
      ctx.notify("Ciclo cerrado. Su historial queda disponible.");
    };
  }
  function period() {
    const b = board();
    if (!b || !writable() || b.work?.periods.some((p) => p.status === "active"))
      return;
    ctx.modal(
      `<h2>Iniciar período de trabajo</h2><form id="work-period"><label>Inicio<input type="date" name="start" value="${today()}" required/></label><label>Fin<input type="date" name="end" value="${today()}" required/></label><p>El período no se amplía ni cierra automáticamente.</p><p id="work-error" role="alert"></p><button class="button primary">Iniciar período</button></form>`,
    );
    $("#work-period").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        start = String(f.get("start")),
        end = String(f.get("end"));
      if (end < start) {
        $("#work-error").textContent = "Revisa las fechas.";
        return;
      }
      ctx.mutate(() =>
        ensureWork(b).periods.push({ id: uid(), start, end, status: "active" }),
      );
      ctx.close();
    };
  }
  function closePeriod(id: string) {
    const b = board(),
      p = b?.work?.periods.find((p) => p.id === id);
    if (!b || !p || p.status !== "active" || !writable()) return;
    ctx.modal(
      `<h2>Revisar el proyecto</h2><form id="work-period-close"><label>Resultado<textarea name="result" maxlength="5000" required></textarea></label><label>Cómo continuamos<select name="decision"><option value="close">Cerrar y registrar el resultado</option><option value="replan">Replantear o reducir el alcance</option><option value="renew">Autorizar un nuevo período</option></select></label><div class="work-form-row"><label>Nuevo inicio<input name="start" type="date" value="${today()}"/></label><label>Nuevo fin<input name="end" type="date" value="${today()}"/></label></div><p>Las nuevas fechas se usan solo si autorizas un nuevo período. La decisión y el período anterior se conservan.</p><p id="work-error" role="alert"></p><button class="button primary">Guardar decisión</button></form>`,
    );
    const decisionSelect = $<HTMLSelectElement>(
      "#work-period-close [name=decision]",
    );
    const dates = $("#work-period-close .work-form-row");
    const drawDecision = () => {
      dates.hidden = decisionSelect.value !== "renew";
      dates
        .querySelectorAll<HTMLInputElement>("input")
        .forEach((i) => (i.required = decisionSelect.value === "renew"));
    };
    decisionSelect.onchange = drawDecision;
    drawDecision();
    $("#work-period-close").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        decision = String(f.get("decision")),
        start = String(f.get("start")),
        end = String(f.get("end"));
      if (decision === "renew" && (start <= p.end || end < start)) {
        $("#work-error").textContent =
          "El nuevo período debe comenzar después del anterior, sin superponerse.";
        return;
      }
      ctx.mutate(() => {
        p.status = decision === "replan" ? "replanned" : "closed";
        p.closedAt = new Date().toISOString();
        p.decision = {
          close: "Cerrar y registrar el resultado",
          replan: "Replantear o reducir el alcance",
          renew: "Autorizar un nuevo período",
        }[decision];
        p.result = String(f.get("result"));
        if (decision === "renew")
          ensureWork(b).periods.push({
            id: uid(),
            start,
            end,
            status: "active",
          });
      });
      ctx.close();
    };
  }
  function reviewNote(id: string, isPeriod = false) {
    const b = board();
    if (!b || !canWrite(ctx.actor(), "pages")) return;
    const cycle = b.work?.cycles.find((c) => c.id === id),
      period = b.work?.periods.find((p) => p.id === id),
      text = isPeriod
        ? period && `${period.decision}\n\n${period.result}`
        : cycle?.review &&
          `Objetivo: ${cycle.review.achieved}\n\nQué funcionó\n${cycle.review.worked}\n\nQué mejorar\n${cycle.review.improve}`;
    if (!text) return;
    const pageId = uid();
    ctx.mutate(() =>
      ctx
        .state()
        .pages.push({
          id: pageId,
          title: `Revisión · ${isPeriod ? b.name : cycle!.name}`,
          body: text,
          emoji: "▤",
          createdAt: new Date().toISOString(),
          updated: new Date().toISOString(),
          authorId: String(ctx.actor().id),
          privateOwner: b.privateOwner,
          links: [{ kind: "boards", id: b.id }],
        }),
    );
    ctx.notify("Revisión guardada como Nota.");
    ctx.openPage(pageId);
  }
  function relations(kind: "tasks" | "pages", id: string) {
    const source = ctx.state()[kind].find((i) => i.id === id);
    if (!source || !canWrite(ctx.actor(), kind)) return;
    const owner = source.privateOwner || "",
      groups = [
        ["tasks", "Tareas", "tasks"],
        ["boards", "Tableros", "tasks"],
        ["pages", "Notas", "pages"],
        ["spaces", "Espacios", "canvas"],
      ] as const;
    ctx.modal(
      `<h2>Vincular contenido</h2><p>Solo se muestran recursos accesibles con la misma privacidad. Se vinculan sin copiar el contenido.</p><form id="work-relations"><label>¿Qué quieres vincular?<select id="relation-type"><option value="">Elige un tipo de contenido</option>${groups.filter(([, , section]) => canView(ctx.actor(), section)).map(([k,label])=>`<option value="${k}">${label}</option>`).join("")}</select></label><p id="relation-prompt" class="section-note">Elige un tipo para ver los elementos disponibles.</p><div class="relations-picker">${groups
        .filter(([, , section]) => canView(ctx.actor(), section))
        .map(
          ([k, label]) =>
            `<fieldset data-relation-group="${k}" hidden><legend>${label}</legend>${(
              ctx.state()[k] || []
            )
              .filter(
                (item: any) =>
                  (item.privateOwner || "") === owner &&
                  !(k === kind && item.id === id),
              )
              .map(
                (item: any) =>
                  `<label class="focus-picker-row"><input name="links" type="checkbox" value="${k}:${item.id}" ${source.links?.some((l) => l.kind === k && l.id === item.id) ? "checked" : ""}/><span>${esc(item.title || item.name)}</span></label>`,
              )
              .join("")}</fieldset>`,
        )
        .join(
          "",
        )}</div><p id="relations-picked" class="section-note" aria-live="polite"></p><button class="button primary">Guardar vínculos</button></form>`,
    );
    document.querySelectorAll<HTMLElement>("[data-relation-group]").forEach(group => {
      if (!group.querySelector("input")) group.insertAdjacentHTML("beforeend", '<p class="empty-state">No hay elementos disponibles de este tipo.</p>');
    });
    const updateCount = () => {
      const count = $("#work-relations").querySelectorAll('input[name="links"]:checked').length;
      $("#relations-picked").textContent = `${count} ${count === 1 ? "vínculo seleccionado" : "vínculos seleccionados"}`;
    };
    $("#relation-type").onchange = () => {
      const value = $<HTMLSelectElement>("#relation-type").value;
      document.querySelectorAll<HTMLElement>("[data-relation-group]").forEach(group => {
        group.hidden = group.dataset.relationGroup !== value;
      });
      $("#relation-prompt").hidden = !!value;
    };
    $("#work-relations").onchange = updateCount;
    updateCount();
    $("#work-relations").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const current = ctx.state()[kind].find(item => item.id === id);
      if (!current || !canWrite(ctx.actor(), kind) || (current.privateOwner || "") !== owner) return;
      ctx.mutate(
        () =>
          (current.links = [
            ...(current.links || []).filter(
              (l) => l.kind === "nodes" || l.kind === "files",
            ),
            ...f.getAll("links").map((v) => {
              const [kind, id] = String(v).split(":");
              return { kind: kind as ResourceLink["kind"], id };
            }),
          ].slice(0, 50)),
      );
      ctx.close();
      ctx.notify("Vínculos guardados.");
    };
  }
  function linkMarkup(links: ResourceLink[] | undefined, owner?: string, source?: { kind: "tasks" | "pages"; id: string }) {
    return (links || [])
      .map((l) => {
        const section = (
          {
            tasks: "tasks",
            boards: "tasks",
            pages: "pages",
            spaces: "canvas",
            nodes: "canvas",
            files: "files",
          } as const
        )[l.kind];
        if (!canView(ctx.actor(), section)) return "";
        if (l.kind === "files")
          return `<span class="attachment-link"><button class="linked-file-open" data-resource-kind="files" data-resource-id="${esc(l.id)}">${uiIcon("folder",16)}<span>Archivo adjunto</span><span class="linked-file-hint">Abrir vista previa →</span></button>${source && canWrite(ctx.actor(), source.kind) ? `<button class="attachment-unlink" data-unlink-file="${esc(l.id)}" data-source-kind="${source.kind}" data-id="${esc(source.id)}" aria-label="Desvincular archivo adjunto">Desvincular</button>` : ""}</span>`;
        const item = (ctx.state()[l.kind] || []).find(
          (i: any) => i.id === l.id,
        );
        if (!item)
          return '<span class="section-note">Vínculo no disponible</span>';
        const visibility =
          l.kind === "nodes"
            ? ctx.state().spaces.find((s) => s.id === (item as any).space)
                ?.privateOwner
            : (item as any).privateOwner;
        if ((visibility || "") !== (owner || "")) return "";
        const labels = {tasks:"Tarea",boards:"Tablero",pages:"Nota",spaces:"Espacio",nodes:"Tarjeta",files:"Archivo"};
        const icons = {tasks:"tasks",boards:"tasks",pages:"note",spaces:"brain",nodes:"note",files:"folder"};
        return `<button class="resource-row linked-content-item" data-resource-kind="${l.kind}" data-resource-id="${esc(l.id)}"><span class="resource-icon">${uiIcon(icons[l.kind],18)}</span><span class="resource-copy"><strong>${esc((item as any).title || (item as any).name || "Elemento original")}</strong><small>${labels[l.kind]}</small></span><span class="resource-arrow" aria-hidden="true">→</span></button>`;
      })
      .join("");
  }
  document.addEventListener("keydown", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-board-tab]",
    );
    if (!el || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
      return;
    e.preventDefault();
    const tabs = ["board", "summary", "progress"],
      index = tabs.indexOf(el.dataset.boardTab!);
    tab = tabs[
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 2
          : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3
    ] as typeof tab;
    render();
    document.querySelector<HTMLElement>(`[data-board-tab="${tab}"]`)?.focus();
  });
  document.addEventListener("change", (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.id === "cycle-task-filter") {
      scope = el.value;
      ctx.render();
    }
  });
  document.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!button) return;
    button.closest("details.board-menu")?.removeAttribute("open");
    if (button.dataset.boardTab) {
      tab = button.dataset.boardTab as typeof tab;
      render();
    }
    if (button.dataset.unlinkFile) {
      const kind = button.dataset.sourceKind;
      if (kind !== "tasks" && kind !== "pages") return;
      const source = ctx.state()[kind].find(item => item.id === button.dataset.id);
      if (!source || !canWrite(ctx.actor(), kind) || !canView(ctx.actor(), "files") ||
          (source.privateOwner && String(source.privateOwner) !== String(ctx.actor().id))) return;
      ctx.mutate(() => {
        source.links = (source.links || []).filter(link => !(link.kind === "files" && link.id === button.dataset.unlinkFile));
      });
      ctx.notify("Archivo desvinculado. Sigue disponible en Archivos.");
      return;
    }
    if (button.dataset.workAttachments) {
      const kind = button.dataset.workAttachments as "tasks" | "pages",
        source = ctx.state()[kind].find((i) => i.id === button.dataset.id);
      if (!source || !canWrite(ctx.actor(), kind)) return;
      if (source.privateOwner) {
        ctx.notify(
          "Los archivos del equipo son compartidos. Para conservar la privacidad, aquí puedes vincular notas o tareas privadas.",
        );
        return;
      }
      const sourceId = source.id;
      ctx.pickFile((fileId) => {
        const current = ctx.state()[kind].find(item => item.id === sourceId);
        if (!current || current.privateOwner || !canWrite(ctx.actor(), kind) || !canView(ctx.actor(), "files")) return;
        ctx.mutate(
          () =>
            (current.links = [
              ...(current.links || []).filter(
                (l) => !(l.kind === "files" && l.id === fileId),
              ),
              { kind: "files", id: fileId },
            ]),
        );
        ctx.close();
        ctx.notify("Archivo vinculado sin crear una copia.");
      });
    }
    const action = button.dataset.work,
      id = button.dataset.id || "";
    if (action === "settings") settings();
    if (action === "prepare") cycleEditor();
    if (action === "edit-cycle") cycleEditor(id);
    if (action === "start-cycle") start(id);
    if (action === "close-cycle") closeCycle(id);
    if (action === "period") period();
    if (action === "period-close") closePeriod(id);
    if (action === "review-note") reviewNote(id);
    if (action === "period-note") reviewNote(id, true);
    if (action === "delete" && writable()) {
      ctx.modal(
        '<h2>¿Enviar tablero a la papelera?</h2><p>El tablero y sus tareas se podrán restaurar durante 30 días.</p><button class="button primary" data-work="confirm-delete">Enviar a la papelera</button>',
      );
    }
    if (action === "confirm-delete" && writable()) {
      ctx.close();
      ctx.deleteBoard();
    }
    if (button.dataset.workRelations)
      relations(
        button.dataset.workRelations as "tasks" | "pages",
        button.dataset.id!,
      );
    if (button.dataset.resourceKind) {
      ctx.close();
      const id = button.dataset.resourceId!,
        kind = button.dataset.resourceKind;
      if (kind === "files") ctx.openFile(id);
      if (kind === "tasks") ctx.openTask(id);
      if (kind === "boards") ctx.openBoard(id);
      if (kind === "pages") ctx.openPage(id);
      if (kind === "spaces") ctx.openSpace(id);
      if (kind === "nodes") {
        const n = ctx.state().nodes.find((n) => n.id === id);
        if (n) ctx.openSpace(n.space);
      }
    }
  });
  return {
    render,
    filterTask,
    relations,
    linkMarkup,
    toBoard: () => {
      tab = "board";
      scope = "all";
      render();
    },
  };
}
