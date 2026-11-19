import {companyDay} from "@/lib/saas/work-management";
import { uiIcon } from "@/lib/saas/icons";
import {
  dateKey,
  uid,
  type WorkspaceState,
  type WorkspaceMember,
  type PersonalFocus,
} from "@/lib/saas/model";
import { canView, canWrite } from "@/lib/saas/permissions";
import { pendingHomeTasks, personalDay, taskDueLabel, visibleHomeTasks } from "@/lib/saas/home";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  cloud: () => boolean;
  api: (path: string, init?: RequestInit) => Promise<any>;
  mutate: (fn: () => void) => void;
  render: () => void;
  show: (view: string) => void;
  modal: (html: string) => void;
  close: () => void;
  notify: (s: string) => void;
  openTask: (id: string) => void;
  connected: () => boolean;
  personalTasks:()=>void;
};
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function installHome(ctx: Ctx) {
  let goalMonth = dateKey(new Date()).slice(0, 7);
  function myFocus(): PersonalFocus | undefined {
    return ctx.state().focus?.find((f) => f.id === String(ctx.actor().id));
  }
  function ensureFocus() {
    ctx.state().focus ??= [];
    let focus = myFocus();
    if (!focus) {
      focus = {
        id: String(ctx.actor().id),
        privateOwner: String(ctx.actor().id),
        selections: [],
      };
      ctx.state().focus!.push(focus);
    }
    return focus;
  }
  function removeCompleted(id: string) {
    const focus = myFocus();
    if (focus)
      focus.selections = focus.selections.filter((e) => e.taskId !== id);
  }
  const personalView=()=>personalDay(ctx.state(),ctx.actor());
  function personalTaskRow(t:WorkspaceState['tasks'][number],today:string){const due=taskDueLabel(t.due,today);return `<li><button class="my-day-task" data-home-task="${esc(t.id)}"><span class="my-day-task-title">${esc(t.title)}</span><span class="my-day-task-meta">${due?`<time datetime="${esc(t.due)}">${esc(due)}</time>`:t.status==='doing'?'En progreso':'Por hacer'}${t.blockedAt?' · Bloqueada':''}</span></button></li>`;}
  function taskRow(t:WorkspaceState['tasks'][number],today:string,priority=false){
    const due=taskDueLabel(t.due,today),editable=canWrite(ctx.actor(),'tasks');
    return `<li class="priority-row ${t.status === "done" ? "day-task-done" : ""}" data-day-task="${esc(t.id)}" data-day-status="${t.status}" ${priority?`data-priority-id="${esc(t.id)}"`:''}>
      ${(t.status !== "done" && (priority||editable))?`<button class="priority-grip icon-btn" data-priority-grip="${esc(t.id)}" aria-label="Reordenar ${esc(t.title)}" title="Arrastra para ordenar. También puedes usar las flechas arriba y abajo.">${uiIcon('grip',16)}</button>`:''}
      <button type="button" class="day-task-switch" role="switch" aria-checked="${t.status==='doing'}" aria-label="En progreso: ${esc(t.title)}" data-home-switch="${esc(t.id)}" ${editable && t.status !== "done"?'':'disabled'}></button>
      <button class="my-day-task" data-home-task="${esc(t.id)}"><span class="priority-task-copy"><span class="my-day-task-title">${esc(t.title)}</span><span class="my-day-task-meta">${t.privateOwner?'Privada':'Del equipo'}${due?` · <time datetime="${esc(t.due)}">${esc(due)}</time>`:''}${t.status === "done" ? " · Completada" : t.blockedAt?' · Bloqueada':''}</span></span>${uiIcon('arrowRight',18)}</button>
      <button type="button" class="day-task-complete" data-home-complete="${esc(t.id)}" aria-label="Completar ${esc(t.title)}" ${editable && t.status === "doing"?'':'disabled'}>${uiIcon('party',18)}</button>
    </li>`;
  }
  let renderedDay = "";
  function renderToday() {
    const view=personalView(),allowed=canView(ctx.actor(),'tasks'),daily=myFocus()?.daily;
    document.querySelectorAll<HTMLElement>('[data-home-action="choose-today"]').forEach(b=>b.hidden=!allowed);
    $('[data-home-action="new-priority"]').hidden=!canWrite(ctx.actor(),'tasks');
    renderedDay = view.today;
    const completion = myFocus()?.completedDay;
    const completed = completion?.date === view.today && Array.isArray(completion.taskIds)
      ? visibleHomeTasks(ctx.state(), ctx.actor())
          .filter(task => task.status === "done" && completion.taskIds.includes(task.id))
      : [];
    $('#my-day-count').textContent=String(view.priorities.length);
    $('#my-day-count').setAttribute('aria-label',`${view.priorities.length} ${view.priorities.length===1?'prioridad':'prioridades'}`);
    $('[data-home-action="my-tasks"]').hidden=!allowed;
    const dailyButton=$('[data-home-action="daily"]');dailyButton.hidden=!allowed;dailyButton.textContent=daily?.date===view.today?'Editar planificación':'Planificar mi día';
    const markup=!allowed?'<p class="my-day-empty">Tu perfil no tiene acceso a Tareas.</p>':`${view.priorities.length?`<section class="my-day-group" aria-label="Prioridades del día"><ul>${view.priorities.map(t=>taskRow(t,view.today,true)).join('')}</ul></section>`:''}${view.attention.length?`<section class="my-day-group"><h3>Necesitan atención</h3><ul>${view.attention.map(t=>taskRow(t,view.today)).join('')}</ul></section>`:''}${completed.length ? `<section class="my-day-group" aria-label="Completadas hoy"><ul>${completed.map(t=>taskRow(t,view.today)).join('')}</ul></section>` : ''}${!view.priorities.length&&!view.attention.length&&!completed.length?'<p class="my-day-empty">No tienes tareas próximas a vencer. Puedes elegir tus prioridades para hoy.</p>':''}`;
    const list = $("#today-tasks");
    const next = document.createElement("template");
    next.innerHTML = markup;
    const currentRows = [...list.querySelectorAll<HTMLElement>("[data-day-task]")];
    const nextRows = [...next.content.querySelectorAll<HTMLElement>("[data-day-task]")];
    const draft = list.cloneNode(true) as HTMLElement;
    const draftRows = [...draft.querySelectorAll<HTMLElement>("[data-day-task]")];
    function applyStatus(row: HTMLElement, source: HTMLElement) {
      row.dataset.dayStatus = source.dataset.dayStatus;
      row.querySelector(".day-task-switch")?.setAttribute("aria-checked", String(source.dataset.dayStatus === "doing"));
      const complete = row.querySelector<HTMLButtonElement>(".day-task-complete");
      if (complete) complete.disabled = source.querySelector<HTMLButtonElement>(".day-task-complete")!.disabled;
    }
    draftRows.forEach((row, index) => {
      const source = nextRows[index];
      if (source?.dataset.dayTask === row.dataset.dayTask && source.dataset.dayStatus !== row.dataset.dayStatus)
        applyStatus(row, source);
    });
    // Keep the existing controls mounted when only the task status changes.
    if (draft.childNodes.length === next.content.childNodes.length &&
        [...draft.childNodes].every((node, index) => node.isEqualNode(next.content.childNodes[index]))) {
      currentRows.forEach((row, index) => {
        if (row.dataset.dayStatus !== nextRows[index].dataset.dayStatus) applyStatus(row, nextRows[index]);
      });
    } else {
      list.replaceChildren(next.content);
    }
  }
  window.setInterval(() => {
    if (renderedDay && companyDay(ctx.state().settings.timezone) !== renderedDay &&
        !$("#today-tasks").closest("[hidden]")) renderToday();
  }, 15_000);
  function reorderPriority(id:string,target:string){
    if(!canView(ctx.actor(),'tasks')||id===target)return;
    const visible=new Set(personalView().priorities.map(t=>t.id));
    if(!visible.has(id)||!visible.has(target))return;
    ctx.mutate(()=>{const focus=ensureFocus(),from=focus.selections.findIndex(e=>e.taskId===id),to=focus.selections.findIndex(e=>e.taskId===target);if(from<0||to<0)return;const [entry]=focus.selections.splice(from,1);focus.selections.splice(to,0,entry);});
    document.querySelector<HTMLButtonElement>(`[data-priority-grip="${CSS.escape(id)}"]`)?.focus();
    ctx.notify('Orden de prioridades guardado.');
  }
  function changeDayTask(id: string, complete = false) {
    const { priorities, attention } = personalView();
    const task = [...priorities, ...attention].find(item => item.id === id);
    if (!task || !canWrite(ctx.actor(), "tasks") || (complete && task.status !== "doing")) return;
    const row = document.querySelector<HTMLElement>(`[data-day-task="${CSS.escape(id)}"]`);
    if (complete && row && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rect = row.getBoundingClientRect();
      const burst = document.createElement("div");
      burst.className = "day-task-confetti";
      burst.setAttribute("aria-hidden", "true");
      Object.assign(burst.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      for (let index = 0; index < 30; index++) {
        const piece = document.createElement("i");
        piece.style.left = `${(index + .5) / 30 * 100}%`;
        piece.style.setProperty("--scatter", `${Math.random() * 72 - 36}px`);
        piece.style.setProperty("--rise", `${-16 - Math.random() * 55}px`);
        piece.style.setProperty("--spin", `${Math.random() * 520 - 260}deg`);
        burst.append(piece);
      }
      for (const position of [12, 88]) {
        const horn = document.createElement("span");
        horn.className = "day-task-horn";
        horn.style.left = `${position}%`;
        horn.innerHTML = uiIcon("party", 24);
        burst.append(horn);
      }
      document.body.append(burst);
      window.setTimeout(() => burst.remove(), 720);
    }
    const restoreFocus = row?.contains(document.activeElement) || document.activeElement === document.body;
    ctx.mutate(() => {
      task.status = complete ? "done" : task.status === "doing" ? "todo" : "doing";
      if (complete) {
        const focus = ensureFocus();
        const date = companyDay(ctx.state().settings.timezone);
        const previous = focus.completedDay?.date === date ? focus.completedDay.taskIds : [];
        focus.completedDay = { date, taskIds: [...new Set([...previous, id])] };
        removeCompleted(id);
      }
    });
    if (restoreFocus) {
      const next = complete
        ? document.querySelector<HTMLElement>("#today-tasks [data-home-complete]:not(:disabled)") || document.querySelector<HTMLElement>("[data-home-action=choose-today]")
        : document.querySelector<HTMLElement>(`[data-home-switch="${CSS.escape(id)}"]`);
      next?.focus({ preventScroll: true });
    }
    if (complete) ctx.notify("Tarea completada.");
  }
  let drag:{id:string;target:string;x:number;y:number;pointerId:number;moved:boolean}|undefined;
  document.addEventListener('pointerdown',e=>{const grip=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-priority-grip]');if(drag||!grip||e.button!==0)return;e.preventDefault();drag={id:grip.dataset.priorityGrip!,target:grip.dataset.priorityGrip!,x:e.clientX,y:e.clientY,pointerId:e.pointerId,moved:false};grip.setPointerCapture(e.pointerId);});
  document.addEventListener('pointermove',e=>{if(!drag||drag.pointerId!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6&&!drag.moved)return;drag.moved=true;document.querySelectorAll('.priority-drop').forEach(el=>el.classList.remove('priority-drop'));const list=$('#today-tasks'),bounds=list.getBoundingClientRect();if(e.clientY>bounds.bottom-35)list.scrollTop+=12;else if(e.clientY<bounds.top+35)list.scrollTop-=12;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-priority-id]');if(row){drag.target=row.dataset.priorityId!;row.classList.add('priority-drop');}});
  function endDrag(event?: PointerEvent, cancel=false){if(!drag||(event&&drag.pointerId!==event.pointerId))return;const previous=drag;drag=undefined;document.querySelectorAll('.priority-drop').forEach(el=>el.classList.remove('priority-drop'));if(cancel||!previous.moved)return;
    const bounds = $("#today-tasks").getBoundingClientRect();
    if (event && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) && canWrite(ctx.actor(), "tasks"))
      changeDayTask(previous.id, true);
    else reorderPriority(previous.id,previous.target);}
  document.addEventListener('pointerup',event=>endDrag(event));document.addEventListener('pointercancel',event=>endDrag(event,true));
  document.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();endDrag(undefined,true);return;}const grip=(e.target as HTMLElement).closest<HTMLElement>('[data-priority-grip]');if(!grip||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const priorities=personalView().priorities,index=priorities.findIndex(t=>t.id===grip.dataset.priorityGrip),target=priorities[index+(e.key==='ArrowUp'?-1:1)];if(target)reorderPriority(grip.dataset.priorityGrip!,target.id);});
  let personalQuery='',personalStatus='all';
  function renderPersonalTasks(){
    const host=$('#personal-tasks-home'),view=personalView();
    if(!host.querySelector('#my-tasks-query')){host.innerHTML=`<div class="page-heading compact"><div><h1>Mis tareas</h1><p>Tareas asignadas a ti y prioridades que elegiste.</p></div><button class="button secondary" data-view="tasks">Tableros del equipo</button></div><div class="view-toolbar"><label class="filter-search">${uiIcon('search',16)}<input id="my-tasks-query" aria-label="Buscar mis tareas" placeholder="Buscar mis tareas…"/></label><select id="my-tasks-status" aria-label="Estado de mis tareas"><option value="all">Todos los estados pendientes</option><option value="todo">Por hacer</option><option value="doing">En progreso</option></select></div><ul class="personal-task-results"></ul>`;
      $('#my-tasks-query').oninput=e=>{personalQuery=(e.target as HTMLInputElement).value;renderPersonalTasks();};$('#my-tasks-status').onchange=e=>{personalStatus=(e.target as HTMLSelectElement).value;renderPersonalTasks();};}
    $<HTMLInputElement>('#my-tasks-query').value=personalQuery;$<HTMLSelectElement>('#my-tasks-status').value=personalStatus;
    const tasks=view.personal.filter(t=>t.title.toLocaleLowerCase('es').includes(personalQuery.toLocaleLowerCase('es'))&&(personalStatus==='all'||t.status===personalStatus));
    host.querySelector('.personal-task-results')!.innerHTML=tasks.map(t=>personalTaskRow(t,view.today)).join('')||'<li class="my-day-empty">No hay tareas personales que coincidan con estos filtros.</li>';
  }
  function editDaily() {
    if (!canView(ctx.actor(), "tasks")) return;
    const today = companyDay(ctx.state().settings.timezone),
      old = myFocus()?.daily;
    ctx.modal(
      `<h2>Mi día de hoy</h2><p>Un momento para ordenar tus avances, tu foco y lo que necesitas resolver.</p><form id="personal-daily-form"><label>Qué avancé<textarea name="done" maxlength="1000" placeholder="Lo que pude completar…">${esc(old?.date === today ? old.done : "")}</textarea></label><label>Qué haré hoy<textarea name="plan" maxlength="1000" placeholder="Mi siguiente paso…">${esc(old?.date === today ? old.plan : "")}</textarea></label><label>Qué me bloquea<textarea name="blockers" maxlength="1000" placeholder="Necesito ayuda con…">${esc(old?.blockers || "")}</textarea></label><p class="field-hint">Esta nota es personal. Los bloqueos se mantienen hasta que los actualices.</p><button class="button primary">Guardar mi día</button></form>`,
    );
    $("#personal-daily-form").onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(e.target as HTMLFormElement);
      ctx.mutate(
        () =>
          (ensureFocus().daily = {
            date: today,
            done: String(data.get("done") || "").slice(0, 1000),
            plan: String(data.get("plan") || "").slice(0, 1000),
            blockers: String(data.get("blockers") || "").slice(0, 1000),
          }),
      );
      ctx.close();
      ctx.notify("Tu día está organizado.");
    };
  }
  function newPriority(){
    if(!canWrite(ctx.actor(),'tasks'))return;
    const boards=(ctx.state().boards||[]).filter(b=>!b.privateOwner||b.privateOwner===String(ctx.actor().id));
    if(!boards.length){ctx.notify('Crea primero un tablero en Tareas para guardar tu prioridad.');return;}
    ctx.modal(`<h2>Nueva tarea prioritaria</h2><p>Se guardará en el tablero que elijas y aparecerá entre tus prioridades.</p><form id="priority-create"><label>Título<input name="title" required maxlength="140" placeholder="¿Qué necesitas hacer?"/></label><label>Tablero<select name="board">${boards.map(b=>`<option value="${esc(b.id)}">${esc(b.name)} · ${b.privateOwner?'Privado':'Del equipo'}</option>`).join('')}</select></label><label>Vencimiento<input name="due" type="date" required value="${companyDay(ctx.state().settings.timezone)}"/></label><button class="button primary" type="submit">Crear prioridad</button></form>`);
    $<HTMLFormElement>('#priority-create').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target as HTMLFormElement),title=String(f.get('title')||'').trim().slice(0,140),board=boards.find(b=>b.id===f.get('board'));if(!title||!board||!canWrite(ctx.actor(),'tasks'))return;ctx.mutate(()=>{const id=uid();ctx.state().tasks.unshift({id,title,description:'',project:board.name.slice(0,60),boardId:board.id,...(board.privateOwner?{privateOwner:board.privateOwner}:{}),assigneeId:String(ctx.actor().id),status:'todo',priority:'high',due:String(f.get('due'))});ensureFocus().selections.unshift({taskId:id,addedOn:companyDay(ctx.state().settings.timezone)});});ctx.close();ctx.notify('Tarea creada y añadida a tus prioridades.');};
  }
  function chooseToday() {
    if (!canView(ctx.actor(), "tasks")) return;
    const candidates = pendingHomeTasks(ctx.state(),ctx.actor());
    const selected = new Set(myFocus()?.selections.map((e) => e.taskId) || []);
    ctx.modal(
      `<h2>¿En qué quieres avanzar hoy?</h2><p>Elige tareas por hacer o en progreso. Se quedarán aquí hasta completarlas o quitarlas.</p><label>Grupo de tareas<select id="focus-group"><option value="all">Todos los grupos</option>${(
        ctx.state().boards || []
      )
        .filter((b) => !b.privateOwner)
        .map(
          (b) => `<option value="shared:${esc(b.id)}">${esc(b.name)}</option>`,
        )
        .join(
          "",
        )}<option value="private">Mi área privada</option></select></label><label>Buscar tarea<input id="focus-search" type="search" placeholder="Escribe el nombre de una tarea"/></label><div id="focus-options" class="focus-picker-list"></div><p id="focus-picked" class="section-note" aria-live="polite"></p><button class="button primary" id="save-focus">Guardar mi selección</button>`,
    );
    function draw() {
      const group = $<HTMLSelectElement>("#focus-group").value,
        q = $<HTMLInputElement>("#focus-search").value.trim().toLowerCase();
      $("#focus-options").innerHTML =
        candidates
          .filter(
            (t) =>
              (group === "all" ||
                (group === "private" && !!t.privateOwner) ||
                (group === "shared:" + (t.boardId || "general") &&
                  !t.privateOwner)) &&
              t.title.toLowerCase().includes(q),
          )
          .map(
            (t) =>
              `<label class="focus-picker-row"><input type="checkbox" data-focus-option="${esc(t.id)}" ${selected.has(t.id) ? "checked" : ""}/><span>${esc(t.title)}<small class="focus-pills"><span class="focus-pill">${t.privateOwner ? "Privada" : esc(ctx.state().boards?.find((b) => b.id === (t.boardId || "general"))?.name || "Compartida")}</span><span class="focus-pill status">${t.status === "doing" ? "En progreso" : "Por hacer"}</span></small></span></label>`,
          )
          .join("") ||
        '<p class="empty-state">No hay tareas pendientes en este grupo.</p>';
      $("#focus-picked").textContent = `${selected.size} tareas seleccionadas`;
    }
    $("#focus-group").onchange = draw;
    $("#focus-search").oninput = draw;
    $("#focus-options").onchange = (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.dataset.focusOption) return;
      if (input.checked) selected.add(input.dataset.focusOption);
      else selected.delete(input.dataset.focusOption);
      $("#focus-picked").textContent = `${selected.size} tareas seleccionadas`;
    };
    $("#save-focus").onclick = () => {
      ctx.mutate(() => {
        const focus = ensureFocus(),
          existing = new Map(focus.selections.map((e) => [e.taskId, e]));
        focus.selections = [...selected]
          .filter((id) => candidates.some((t) => t.id === id))
          .map(
            (taskId) =>
              existing.get(taskId) || { taskId, addedOn: companyDay(ctx.state().settings.timezone) },
          );
      });
      ctx.close();
      ctx.notify("Tus prioridades quedaron guardadas.");
    };
    draw();
  }
  function renderCards() {
    const goals = (ctx.state().goals || []).filter(
      (g) => g.month === goalMonth,
    );
    const [year, month] = goalMonth.split("-");
    $("#goals-month").textContent = `${month}/${year}`;
    $('[data-home-action="new-goal"]').hidden = !canWrite(
      ctx.actor(),
      "overview",
    );
    $("#monthly-goals").innerHTML =
      goals
        .map(
          (g) =>
            `<div class="monthly-goal ${g.done ? "done" : ""}"><input type="checkbox" data-goal-toggle="${esc(g.id)}" aria-label="Completar objetivo ${esc(g.title)}" ${g.done ? "checked" : ""} ${!canWrite(ctx.actor(), "overview") ? "disabled" : ""}/><span>${esc(g.title)}</span>${canWrite(ctx.actor(), "overview") ? `<button class="icon-btn" data-goal-edit="${esc(g.id)}" aria-label="Editar objetivo ${esc(g.title)}">${uiIcon("pencil", 15)}</button><button class="icon-btn" data-goal-delete="${esc(g.id)}" aria-label="Eliminar objetivo ${esc(g.title)}">${uiIcon("trash", 15)}</button>` : ""}</div>`,
        )
        .join("") ||
      '<p class="empty-state">¿Qué quiere lograr el equipo este mes?</p>';
    $("#goal-progress").textContent = goals.length
      ? `${goals.filter((g) => g.done).length} de ${goals.length} objetivos completados`
      : "";
    $('[data-home-action="new-meeting"]').hidden = !canWrite(
      ctx.actor(),
      "calendar",
    );
    $('[data-home-action="schedule-meeting"]').hidden = !canWrite(
      ctx.actor(),
      "calendar",
    );
    $("#meet-connection-note").textContent = ctx.cloud()
      ? ctx.connected()
        ? "Usaremos la cuenta de Google conectada al negocio."
        : "Comprueba la conexión de Google al crear la reunión."
      : "Demo: puedes explorar los invitados. Para enviar invitaciones necesitas conectar Google.";
  }
  function goalEditor(id?: string) {
    if (!canWrite(ctx.actor(), "overview")) return;
    const goal = ctx.state().goals?.find((g) => g.id === id);
    ctx.modal(
      `<h2>${goal ? "Editar" : "Nuevo"} objetivo del mes</h2><p>Este objetivo será visible para todo el equipo.</p><form id="goal-form"><label>Objetivo<input name="title" required maxlength="160" value="${esc(goal?.title || "")}" placeholder="Por ejemplo, reducir los tiempos de despacho"/></label><label>Mes<input type="month" name="month" required value="${esc(goal?.month || goalMonth)}"/></label><button class="button primary">Guardar objetivo</button></form>`,
    );
    $("#goal-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      goalMonth = String(f.get("month"));
      ctx.mutate(() => {
        const value = {
          id: goal?.id || uid(),
          title: String(f.get("title")).trim(),
          month: goalMonth,
          done: goal?.done || false,
          createdBy: goal?.createdBy || String(ctx.actor().id),
        };
        ctx.state().goals ??= [];
        if (goal) Object.assign(goal, value);
        else ctx.state().goals!.push(value);
      });
      ctx.close();
      ctx.notify("Objetivo guardado para el equipo.");
    };
  }
  async function newMeeting(immediate = false) {
    if (!canWrite(ctx.actor(), "calendar")) return;
    ctx.modal(
      "<h2>Crear Google Meet</h2><p>Preparando la lista de invitados…</p>",
    );
    const loading = $("#dialog-content h2");
    const dialog = $<HTMLDialogElement>("#editor-dialog");
    try {
      const info = ctx.cloud()
        ? await ctx.api("google/meet")
        : {
            connected: false,
            members: (ctx.state().demoMembers || []).filter((m) => !m.disabled),
          };
      if (!dialog.open || !loading.isConnected) return;
      const unavailable = !ctx.cloud()
        ? "En la demo no se crean reuniones ni se envían invitaciones."
        : !info.configured
          ? "El servidor necesita las credenciales OAuth de Google para crear reuniones."
          : "Conecta Google Calendar desde Configuración → Integraciones para crear la reunión.";
      const members = info.members.filter(
        (m: any) => String(m.id) !== String(ctx.actor().id),
      );
      const start = new Date(Date.now() + (immediate ? 0 : 30 * 60 * 1000));
      if (!immediate)
        start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
      ctx.modal(
        `<h2>${immediate ? "Reunirse ahora" : "Programar Google Meet"}</h2><p>Selecciona a las personas de tu organización. Al crear la reunión, Google les enviará una invitación por correo.</p><form id="meet-form"><label>Nombre de la reunión<input name="title" required maxlength="120" placeholder="Por ejemplo, planificación de la semana"/></label><div class="form-grid" ${immediate ? "hidden" : ""}><label>Fecha<input type="date" name="date" required value="${dateKey(start)}"/></label><label>Hora<input type="time" name="time" required value="${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}"/></label><label>Duración<select name="duration"><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1 hora y media</option></select></label></div><p class="section-note">Zona horaria: ${esc(ctx.state().settings.timezone || "America/Santiago")}</p><fieldset><legend>A quién invitar</legend><div class="member-picker">${members.map((m: any) => `<label><input type="checkbox" name="members" value="${esc(m.id)}"/><span>${esc(m.name)}${m.email ? `<small>${esc(m.email)}</small>` : ""}</span></label>`).join("") || '<p class="section-note">No hay otras personas activas en tu organización.</p>'}</div></fieldset>${!info.connected ? `<p class="section-note">${unavailable}</p>` : ""}<p class="form-error" id="meet-error" role="alert"></p><button class="button primary" id="create-meeting" ${!info.connected ? "disabled" : ""}>Crear y enviar invitaciones</button></form>`,
      );
      const requestId = uid();
      $("#meet-form").onsubmit = async (e) => {
        e.preventDefault();
        if (!info.connected) return;
        const f = new FormData(e.target as HTMLFormElement),
          button = $<HTMLButtonElement>("#create-meeting");
        button.disabled = true;
        try {
          const result = await ctx.api("google/meet", {
            method: "POST",
            body: JSON.stringify({
              requestId,
              immediate,
              title: String(f.get("title")).trim(),
              date: String(f.get("date")),
              time: String(f.get("time")),
              duration: Number(f.get("duration")),
              members: f.getAll("members").map(String),
            }),
          });
          ctx.mutate(() => {
            if (!ctx.state().events.some((v) => v.id === result.event.id))
              ctx.state().events.push(result.event);
          });
          ctx.close();
          $("#meeting-result").innerHTML = result.meetUrl
            ? `<a class="button secondary" href="${esc(result.meetUrl)}" target="_blank" rel="noopener noreferrer">Abrir reunión ↗</a>`
            : `<p>La reunión está creada. Google está preparando el enlace.</p><button class="button secondary" data-refresh-meet="${esc(result.event.googleEventId)}">Actualizar enlace</button><a class="subtle-button" href="${esc(result.calendarUrl || "https://calendar.google.com")}" target="_blank" rel="noopener noreferrer">Ver en Google Calendar ↗</a>`;
          ctx.notify("Reunión creada. Google enviará las invitaciones.");
        } catch (error) {
          $("#meet-error").textContent =
            error instanceof Error
              ? error.message
              : "No pudimos crear la reunión.";
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      };
    } catch (error) {
      if (!dialog.open || !loading.isConnected) return;
      ctx.modal(
        `<h2>No pudimos preparar la reunión</h2><p>${esc(error instanceof Error ? error.message : "Revisa la conexión con Google.")}</p>`,
      );
    }
  }
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b) return;
    if (b.dataset.homeAction === "choose-today") chooseToday();
    if (b.dataset.homeAction === "new-priority") newPriority();
    if (b.dataset.homeAction === "daily") editDaily();
    if (b.dataset.homeAction === "my-tasks") ctx.personalTasks();
    if (b.dataset.homeAction === "new-goal") goalEditor();
    if (b.dataset.homeAction === "new-meeting") void newMeeting(true);
    if (b.dataset.homeAction === "schedule-meeting") void newMeeting(false);
    if (b.dataset.goalDelete && canWrite(ctx.actor(), "overview")) {
      ctx.mutate(() => {
        ctx.state().goals = ctx
          .state()
          .goals?.filter((g) => g.id !== b.dataset.goalDelete);
      });
      ctx.notify("Objetivo enviado a la papelera.");
    }
    if (b.dataset.refreshMeet)
      void (async () => {
        try {
          (b as HTMLButtonElement).disabled = true;
          const result = await ctx.api(
            "google/meet?eventId=" + encodeURIComponent(b.dataset.refreshMeet!),
          );
          if (result.meetUrl) {
            ctx.mutate(() => {
              const event = ctx
                .state()
                .events.find((e) => e.googleEventId === b.dataset.refreshMeet);
              if (event) event.meetUrl = result.meetUrl;
            });
            $("#meeting-result").innerHTML =
              `<a class="button secondary" href="${esc(result.meetUrl)}" target="_blank" rel="noopener noreferrer">Abrir reunión ↗</a>`;
          } else
            ctx.notify(
              "Google todavía está preparando el enlace. Puedes volver a consultarlo.",
            );
        } catch (error) {
          ctx.notify(
            error instanceof Error
              ? error.message
              : "No pudimos consultar el enlace.",
          );
        } finally {
          if (b.isConnected) (b as HTMLButtonElement).disabled = false;
        }
      })();
    if (b.dataset.homeSwitch) changeDayTask(b.dataset.homeSwitch);
    if (b.dataset.homeComplete) changeDayTask(b.dataset.homeComplete, true);
    if (b.dataset.homeTask) ctx.openTask(b.dataset.homeTask);
    if (b.dataset.removeFocus)
      ctx.mutate(() => removeCompleted(b.dataset.removeFocus!));
    if (b.dataset.goalEdit) goalEditor(b.dataset.goalEdit);
  });
  document.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.goalToggle && canWrite(ctx.actor(), "overview"))
      ctx.mutate(() => {
        const goal = ctx
          .state()
          .goals?.find((g) => g.id === input.dataset.goalToggle);
        if (goal) goal.done = input.checked;
      });
  });
  return { renderToday, renderCards, removeCompleted,renderPersonalTasks };
}
