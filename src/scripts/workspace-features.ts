import {notificationTime} from '@/lib/saas/notification-time';
import {installPolls} from './workspace-polls';
import { uiIcon } from "@/lib/saas/icons";
import { expired } from "../../services/payload/src/retention";
import {
  uid,
  type WorkspaceState,
  type WorkspaceMember,
  type TaskComment,
} from "@/lib/saas/model";
import {
  isAdmin,
  canView,
  canWrite,
  defaultPermissions,
  type Section,
} from "@/lib/saas/permissions";
type Context = {
  state: () => WorkspaceState;
  cloud: () => boolean;
  actor: () => WorkspaceMember;
  api: (path: string, init?: RequestInit) => Promise<any>;
  mutate: (fn: () => void) => void;
  render: () => void;
  modal: (html: string) => void;
  close: () => void;
  notify: (text: string) => void;
  openTask: (id: string) => void;
  flush: () => Promise<void>;
  invalidate: () => void;
  switchDemo: (id: string) => void;
};
type AccessCard = {
  id: string;
  title: string;
  category: string;
  url: string;
  username: string;
  password?: string;
  notes?: string;
  hasSecret?: boolean;
  deletedAt?: string;
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const labels = {
  overview: "Vista general",
  canvas: "Espacios",
  tasks: "Tareas",
  calendar: "Calendario",
  files: "Archivos",
  pages: "Notas",
  vault: "Accesos",
  profile: "Mi perfil y votaciones",
  analytics: "Métricas",
  orders: "Pedidos",
  invoices: "Facturas y boletas",
  customers: "Clientes",
  documents: "Documentos",
  team: "Equipo",
  settings: "Configuración",
  integrations: "Integraciones",
} satisfies Record<Section, string>;
const roleLabels: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  editor: "Editor",
  member: "Colaborador",
  viewer: "Lector",
};
export function installWorkspaceFeatures(ctx: Context) {
  const polls=installPolls({...ctx,refreshNotifications:activity});
  let directory: { id: string; name: string }[] = [];
  let members: WorkspaceMember[] = [];
  let vaultRows: AccessCard[] = [];
  let activityLoaded = false;
  let notificationsSeen = new Set<string>();
  let busyActivity = false;
  let selectedMentions = new Map<string, string>();
  let mentionOptions: { id: string; name: string }[] = [];
  let mentionIndex = 0;
  let mentionRange: { start: number; end: number } | undefined;
  let commentingTask = "";
  const demoSecrets = new Map<string, AccessCard>(
    [
      {
        id: "demo-v1",
        title: "Hosting del sitio",
        category: "Hosting",
        url: "https://example.com",
        username: "equipo@ejemplo.cl",
        password: "",
        notes:
          "Acceso de ejemplo. Añade tu proveedor cuando configures el negocio.",
      },
      {
        id: "demo-v2",
        title: "Instagram del negocio",
        category: "Redes sociales",
        url: "https://instagram.com",
        username: "cuenta_de_ejemplo",
        password: "",
        notes: "",
      },
    ].map((v) => [v.id, v]),
  );
  function persistDemoTrash() {
    localStorage.setItem(
      "orbita:demo:access-trash",
      JSON.stringify(
        [...demoSecrets.values()]
          .filter((v) => v.deletedAt)
          .map((v) => ({ id: v.id, deletedAt: v.deletedAt })),
      ),
    );
  }
  try {
    for (const item of JSON.parse(
      localStorage.getItem("orbita:demo:access-trash") || "[]",
    )) {
      const value = demoSecrets.get(item.id);
      if (value) {
        if (expired(item.deletedAt)) demoSecrets.delete(item.id);
        else value.deletedAt = item.deletedAt;
      }
    }
  } catch {}
  async function listTrash() {
    return [...demoSecrets.values()]
      .filter((v) => v.deletedAt && !expired(v.deletedAt))
      .map((v) => ({
        id: v.id,
        title: v.title,
        section: "vault",
        deletedAt: v.deletedAt!,
        collection: "local-vault",
      }));
  }
  async function removeTrashedAccess(id: string) {
    if (demoSecrets.get(id)?.deletedAt) demoSecrets.delete(id);
    persistDemoTrash();
  }
  async function restoreTrash(id: string) {
    const item = demoSecrets.get(id);
    if (item) {
      delete item.deletedAt;
      persistDemoTrash();
    }
    ctx.render();
  }
  function demoMembers() {
    return ctx.state().demoMembers || [];
  }
  async function loadDirectory() {
    if (!ctx.cloud()) {
      directory = demoMembers()
        .filter((m) => !m.disabled && canView(m, "tasks"))
        .map((m) => ({ id: m.id, name: m.name }));
      return;
    }
    if (!canView(ctx.actor(), "tasks")) {
      directory = [];
      return;
    }
    try {
      directory = (await ctx.api("team?directory=1")).docs;
    } catch {
      directory = [];
    }
  }
  function renderBell() {
    const pending=polls.pendingIds();
    const count = (ctx.state().notifications || []).filter(
      (n) => n.recipientId === String(ctx.actor().id) && !n.readAt && (n.kind!=='poll'||pending.has(n.pollId||'')),
    ).length;
    const voteBadge=$('#vote-notification');
    voteBadge.hidden=!pending.size;
    const badge = $("#notification-count");
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = !count || pending.size>0;
    document
      .querySelector('[data-action="notifications"]')
      ?.setAttribute(
        "aria-label",
        (count ? `Notificaciones, ${count} sin leer` : "Notificaciones") + (pending.size ? ", tienes una votación pendiente" : ""),
      );
  }
  let notificationAudio: AudioContext | undefined;
  document.addEventListener("click", () => {
    if (!("AudioContext" in window)) return;
    notificationAudio ??= new AudioContext();
    if (notificationAudio.state === "suspended") void notificationAudio.resume().catch(() => {});
  });
  function playNotification() {
    const audio = notificationAudio;
    if (audio?.state !== "running" || document.hidden) return;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    tone.frequency.setValueAtTime(660, now);
    tone.frequency.setValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.10, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);
    tone.connect(gain).connect(audio.destination);
    tone.start(now);
    tone.stop(now + 0.28);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }
  async function activity() {
    if (busyActivity || !canView(ctx.actor(), "profile")) {
      renderBell();
      return;
    }
    busyActivity = true;
    try {
      if (ctx.cloud()) {
        const [comments, notifications] = await Promise.all([
          canView(ctx.actor(), "tasks")
            ? ctx.api("comments")
            : Promise.resolve({ docs: [] }),
          ctx.api("notifications"),
        ]);
        ctx.state().comments = comments.docs;
        ctx.state().notifications = notifications.docs;
      } else await loadDirectory();
      await polls.refresh().catch(()=>{});
      const relevant = (ctx.state().notifications || []).filter(
        (n) => n.recipientId === String(ctx.actor().id),
      );
      const incoming = activityLoaded ? relevant.filter(n => !n.readAt && !notificationsSeen.has(n.id)) : [];
      if (incoming.length) playNotification();
      for (const n of incoming) ctx.notify(n.text);
      notificationsSeen = new Set(relevant.map((n) => n.id));
      activityLoaded = true;
      renderBell();
      renderCommentThread();
      refreshInlineComments();
      if (document.querySelector('[data-panel="tasks"]:not([hidden])')) {
        for (const badge of document.querySelectorAll<HTMLElement>(
          "[data-comment-count]",
        )) {
          const count = (ctx.state().comments || []).filter(
            (c) => c.taskId === badge.dataset.commentCount,
          ).length;
          badge.textContent = String(count);
          badge.parentElement?.setAttribute(
            "aria-label",
            `${count} comentario${count === 1 ? "" : "s"} en ${badge.closest("[data-drag-task]")?.querySelector("h3")?.textContent || "la tarea"}`,
          );
        }
      }
    } catch {
    } finally {
      busyActivity = false;
    }
  }
  function commentPreview(taskId: string) {
    return (ctx.state().comments || [])
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(
        (c) =>
          `<article class="inline-task-comment"><header><strong>${esc(c.authorName)}</strong><time datetime="${esc(c.createdAt)}">${esc(new Date(c.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" }))}</time></header><p>${esc(c.text)}</p></article>`,
      )
      .join("");
  }
  function refreshInlineComments() {
    document
      .querySelectorAll<HTMLElement>("[data-card-comments]")
      .forEach(
        (el) => (el.innerHTML = commentPreview(el.dataset.cardComments!)),
      );
    document
      .querySelectorAll<HTMLElement>("[data-comment-count]")
      .forEach(
        (el) =>
          (el.textContent = String(
            (ctx.state().comments || []).filter(
              (c) => c.taskId === el.dataset.commentCount,
            ).length,
          )),
      );
  }
  function renderCommentThread() {
    const thread = document.querySelector("#comment-thread");
    if (!thread || !commentingTask) return;
    const comments = (ctx.state().comments || [])
      .filter((c) => c.taskId === commentingTask)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    thread.innerHTML =
      comments
        .map(
          (c) =>
            `<article class="task-comment" data-comment-id="${esc(c.id)}"><span class="comment-avatar">${esc(
              c.authorName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join(""),
            )}</span><div><header><strong>${esc(c.authorName)}</strong><time datetime="${esc(c.createdAt)}">${esc(new Date(c.createdAt).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</time></header><p>${esc(c.text)}</p>${c.mentions.length ? '<span class="comment-mention-mark">Mención al equipo</span>' : ""}</div></article>`,
        )
        .join("") ||
      '<p class="comments-empty">Todavía no hay comentarios. Puedes dejar una nota o preguntar algo al equipo.</p>';
    const count = document.querySelector("#thread-count");
    if (count) count.textContent = String(comments.length);
  }
  function attachComments(taskId: string) {
    commentingTask = taskId;
    selectedMentions.clear();
    const writable = canWrite(ctx.actor(), "tasks");
    const section = $("#task-comments");
    section.innerHTML = `<div class="comments-heading"><h3>Comentarios <span id="thread-count">0</span></h3></div><div id="comment-thread"></div>${writable ? '<form id="comment-form" class="comment-composer"><label for="comment-input">Añadir un comentario</label><textarea id="comment-input" name="text" required maxlength="5000" placeholder="Escribe aquí. Usa @ para mencionar a alguien." aria-controls="mention-options" aria-expanded="false"></textarea><div id="mention-options" class="mention-options" role="listbox" aria-label="Personas del equipo" hidden></div><div id="selected-mentions" class="selected-mentions"></div><div class="comment-compose-footer"><span>Las menciones llegan a las notificaciones de cada persona.</span><button class="button primary" type="submit">Publicar comentario</button></div><p id="comment-error" class="form-error" role="alert"></p></form>' : '<p class="section-note">Tu acceso es de solo lectura.</p>'}`;
    renderCommentThread();
    void loadDirectory();
    if (!writable) return;
    const input = $<HTMLTextAreaElement>("#comment-input");
    const suggestions = $("#mention-options");
    function hideSuggestions() {
      suggestions.hidden = true;
      input.setAttribute("aria-expanded", "false");
      mentionRange = undefined;
    }
    function renderSelected() {
      const el = $("#selected-mentions");
      el.innerHTML = [...selectedMentions]
        .map(
          ([id, name]) =>
            `<button type="button" data-unmention="${esc(id)}" aria-label="Quitar mención a ${esc(name)}">@${esc(name)} ×</button>`,
        )
        .join("");
      el.querySelectorAll<HTMLElement>("[data-unmention]").forEach(
        (b) =>
          (b.onclick = () => {
            selectedMentions.delete(b.dataset.unmention!);
            renderSelected();
          }),
      );
    }
    function choose(index: number) {
      const person = mentionOptions[index];
      if (!person || !mentionRange) return;
      input.setRangeText(
        "@" + person.name + " ",
        mentionRange.start,
        mentionRange.end,
        "end",
      );
      selectedMentions.set(person.id, person.name);
      hideSuggestions();
      renderSelected();
      input.focus();
    }
    function suggest() {
      const caret = input.selectionStart;
      const before = input.value.slice(0, caret);
      const match = before.match(/(?:^|\s)@([^@\n]{0,60})$/);
      if (!match) {
        hideSuggestions();
        return;
      }
      const query = match[1].toLocaleLowerCase();
      mentionRange = { start: caret - match[1].length - 1, end: caret };
      mentionOptions = directory
        .filter(
          (m) =>
            !ctx.state().tasks.find((t) => t.id === commentingTask)
              ?.privateOwner || m.id === String(ctx.actor().id),
        )
        .filter((m) => m.name.toLocaleLowerCase().includes(query))
        .slice(0, 8);
      mentionIndex = 0;
      suggestions.innerHTML = mentionOptions.length
        ? mentionOptions
            .map(
              (m, i) =>
                `<button type="button" role="option" aria-selected="${i === mentionIndex}" data-mention-index="${i}"><span class="comment-avatar">${esc(m.name.slice(0, 1))}</span>${esc(m.name)}</button>`,
            )
            .join("")
        : '<span class="mention-empty">No hay personas que coincidan.</span>';
      suggestions.hidden = false;
      input.setAttribute("aria-expanded", "true");
      suggestions
        .querySelectorAll<HTMLElement>("[data-mention-index]")
        .forEach((b) => {
          b.onpointerdown = (e) => e.preventDefault();
          b.onclick = () => choose(Number(b.dataset.mentionIndex));
        });
    }
    input.oninput = suggest;
    input.addEventListener("keydown", (e) => {
      if (suggestions.hidden) return;
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        mentionIndex =
          (mentionIndex +
            (e.key === "ArrowDown" ? 1 : -1) +
            Math.max(1, mentionOptions.length)) %
          Math.max(1, mentionOptions.length);
        suggestions
          .querySelectorAll<HTMLElement>("[role=option]")
          .forEach((b, i) =>
            b.setAttribute("aria-selected", String(i === mentionIndex)),
          );
      }
      if (e.key === "Enter" && !e.shiftKey && mentionOptions.length) {
        e.preventDefault();
        choose(mentionIndex);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        hideSuggestions();
      }
    });
    $("#comment-form").onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const mentions = [...selectedMentions]
        .filter(([, name]) => text.includes("@" + name))
        .map(([id]) => id);
      const submit = $<HTMLButtonElement>("#comment-form button[type=submit]");
      submit.disabled = true;
      $("#comment-error").textContent = "";
      try {
        if (ctx.cloud()) {
          await ctx.flush();
          const result = await ctx.api("comments", {
            method: "POST",
            body: JSON.stringify({ taskId, text, mentions }),
          });
          ctx.state().comments = [...(ctx.state().comments || []), result.doc];
          ctx.invalidate();
        } else {
          const comment: TaskComment = {
            id: uid(),
            taskId,
            authorId: String(ctx.actor().id),
            authorName: ctx.actor().name,
            text,
            mentions,
            createdAt: new Date().toISOString(),
          };
          ctx.mutate(() => {
            ctx.state().comments = [...(ctx.state().comments || []), comment];
            for (const recipientId of mentions)
              if (recipientId !== String(ctx.actor().id))
                ctx.state().notifications = [
                  ...(ctx.state().notifications || []),
                  {
                    id: uid(),
                    taskId,
                    commentId: comment.id,
                    recipientId,
                    text: ctx.actor().name + " te mencionó en un comentario.",
                    createdAt: comment.createdAt,
                  },
                ];
          });
        }
        input.value = "";
        selectedMentions.clear();
        renderSelected();
        hideSuggestions();
        renderCommentThread();
        refreshInlineComments();
        renderBell();
        ctx.notify(
          mentions.length
            ? "Comentario publicado. Ya avisamos a las personas mencionadas."
            : "Comentario publicado.",
        );
      } catch (e) {
        $("#comment-error").textContent =
          e instanceof Error ? e.message : "No pudimos publicar el comentario.";
      } finally {
        submit.disabled = false;
      }
    };
  }
  let notificationDismissedAt=0,notificationOpening=false;
  async function notifications() {
    if(notificationOpening||performance.now()-notificationDismissedAt<150)return;
    const existing=document.querySelector<HTMLElement>('#notification-popover');
    if(existing?.matches(':popover-open')){existing.hidePopover();return;}
    existing?.remove();
    notificationOpening=true;
    await polls.refresh().catch(()=>{});
    notificationOpening=false;
    const pending=polls.pendingIds(),items=(ctx.state().notifications||[]).filter(n=>n.recipientId===String(ctx.actor().id)&&(n.kind!=='poll'||pending.has(n.pollId||''))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    let tab='all',kind='all',marking=false;
    const popover=document.createElement('div');
    popover.id='notification-popover';popover.className='notification-popover';popover.setAttribute('popover','auto');popover.setAttribute('role','region');popover.setAttribute('aria-label','Notificaciones');
    popover.innerHTML=`<section class="notification-center"><header class="notification-center-heading"><h2>Notificaciones</h2><details class="selection-menu notification-filter"><summary aria-label="Filtrar notificaciones">${uiIcon('list',19)}</summary><div class="selection-menu-panel"><label>Tipo de aviso<select id="notification-kind"><option value="all">Todos los avisos</option><option value="mention">Menciones</option><option value="message">Mensajes</option><option value="poll">Votaciones</option></select></label></div></details></header><div class="notification-tabs"><div role="tablist" aria-label="Notificaciones"><button role="tab" id="notifications-all" data-notifications-tab="all" aria-controls="notification-results" aria-selected="true">Todas</button><button role="tab" id="notifications-unread" data-notifications-tab="unread" aria-controls="notification-results" aria-selected="false">Sin leer</button></div><button class="subtle-button" id="notifications-mark-all">Marcar todas como leídas</button></div><div class="notification-list" id="notification-results" role="tabpanel" aria-labelledby="notifications-all" aria-live="polite"></div><footer><div id="notification-compose"><p class="field-hint">Cargando equipo…</p></div><span id="notification-feedback" role="status"></span></footer></section>`;
    document.body.append(popover);
    const bell=document.querySelector<HTMLElement>('[data-action="notifications"]')!;
    function position(){const r=bell.getBoundingClientRect(),width=Math.min(380,innerWidth-24),left=Math.max(12,Math.min(r.right-width,innerWidth-width-12));popover.style.top=Math.min(r.bottom+12,innerHeight-100)+'px';popover.style.left=left+'px';popover.style.setProperty('--notification-arrow-left',Math.max(16,Math.min(width-16,r.left+r.width/2-left))+'px');}

    function dismiss(){if(popover.matches(':popover-open'))popover.hidePopover();}
    popover.addEventListener('beforetoggle',e=>{if((e as ToggleEvent).newState==='closed')notificationDismissedAt=performance.now();});
    position();popover.showPopover();bell.setAttribute('aria-expanded','true');bell.setAttribute('aria-controls',popover.id);
    window.addEventListener('resize',position);document.addEventListener('orbita:view-change',dismiss);
    popover.addEventListener('toggle',event=>{if((event as ToggleEvent).newState==='closed'){bell.setAttribute('aria-expanded','false');bell.removeAttribute('aria-controls');window.removeEventListener('resize',position);document.removeEventListener('orbita:view-change',dismiss);popover.remove();}},{once:false});
    popover.querySelector<HTMLButtonElement>('[role="tab"]')?.focus();
    void composeNotification(popover.querySelector<HTMLElement>('#notification-compose')!).catch(()=>{if(popover.isConnected)$('#notification-compose').textContent='No pudimos cargar al equipo. Vuelve a abrir el panel.';});
    function draw(){
      const list=items.filter(n=>(tab==='all'||!n.readAt)&&(kind==='all'||(n.kind||'mention')===kind));
      document.querySelectorAll<HTMLButtonElement>('[data-notifications-tab]').forEach(b=>{const active=b.dataset.notificationsTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
      $('#notification-results').setAttribute('aria-labelledby',tab==='all'?'notifications-all':'notifications-unread');
      $<HTMLButtonElement>('#notifications-mark-all').disabled=marking||!items.some(n=>!n.readAt);
      $('#notification-results').innerHTML=list.map(n=>{const type=n.kind||'mention',title=type==='poll'?'Votación pendiente':type==='message'?n.authorName||'Mensaje del equipo':ctx.state().tasks.find(t=>t.id===n.taskId)?.title||'Te mencionaron en una tarea';const remove = `<button type="button" class="icon-btn notification-remove" data-remove-notification="${esc(n.id)}" aria-label="Eliminar aviso: ${esc(title)}">${uiIcon('trash',16)}</button>`;if(type==='poll'&&n.pollId)return `<article class="notification-poll">${remove}<span class="notification-poll-label">${uiIcon('list',13)}Votación pendiente</span><div data-inline-poll="${esc(n.pollId)}" data-notification-id="${esc(n.id)}">${polls.inlineMarkup(n.pollId)}</div></article>`;return `<div class="notification-entry"><button data-open-notification="${esc(n.id)}" class="notification-row ${n.readAt?'':'unread'}" aria-label="${esc(title+(n.readAt?'':', sin leer')+'. '+n.text)}"><span class="notification-type-icon" data-kind="${esc(type)}" aria-hidden="true">${uiIcon(type==='poll'?'list':type==='message'?'comment':'tasks',21)}</span><span class="notification-copy"><strong>${esc(title)}</strong><span class="notification-description">${esc(n.text)}</span><time datetime="${esc(n.createdAt)}" title="${esc(new Date(n.createdAt).toLocaleString('es-CL'))}">${esc(notificationTime(n.createdAt))}</time></span>${n.readAt?'':'<span class="notification-unread-dot" aria-hidden="true"></span>'}</button>${remove}</div>`;}).join('')||`<p class="notification-empty">${tab==='unread'?'Estás al día. No tienes avisos sin leer.':'No hay notificaciones para mostrar.'}</p>`;
    popover.querySelectorAll<HTMLButtonElement>("[data-remove-notification]").forEach(button => {
      button.onclick = async () => {
        const id = button.dataset.removeNotification!;
        button.disabled = true;
        try {
          const remove = () => {
            ctx.state().notifications = ctx.state().notifications?.filter(n => n.id !== id);
          };
          if (ctx.cloud()) {
            await ctx.api("notifications", { method: "DELETE", body: JSON.stringify({ id }) });
            remove();
          } else ctx.mutate(remove);
          const index = items.findIndex(n => n.id === id);
          if (index >= 0) items.splice(index, 1);
          renderBell();
          if (popover.isConnected) {
            draw();
            popover.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
            $("#notification-feedback").textContent = "Notificación eliminada.";
          }
        } catch {
          if (popover.isConnected) $("#notification-feedback").textContent = "No pudimos eliminar el aviso.";
          button.disabled = false;
        }
      };
    });
    document.querySelectorAll<HTMLElement>("[data-open-notification]").forEach(
      (b) =>
        (b.onclick = async () => {
          const n = items.find((n) => n.id === b.dataset.openNotification)!;
          try {
            if (ctx.cloud())
              await ctx.api("notifications", {
                method: "PATCH",
                body: JSON.stringify({ id: n.id }),
              });
            n.readAt = new Date().toISOString();
            if (!ctx.cloud()) ctx.mutate(() => {});
            renderBell();
            if(n.kind === "poll" && n.pollId){dismiss();await polls.open(n.pollId,notifications);return;}
            dismiss();
            if (n.taskId) ctx.openTask(n.taskId);
            else
              ctx.modal(
                `<h2>${esc(n.authorName || "Mensaje del equipo")}</h2><p class="direct-message">${esc(n.text)}</p><button class="button secondary" id="back-notifications">Volver a notificaciones</button>`,
              );
            const back = document.querySelector<HTMLElement>(
              "#back-notifications",
            );
            if (back) back.onclick = notifications;
          } catch {
            ctx.notify("No pudimos abrir este aviso. Inténtalo otra vez.");
          }
        }),
    );
    popover.querySelectorAll<HTMLElement>('[data-inline-poll]').forEach(host=>polls.bindInline(host,()=>{
      const n=items.find(n=>n.id===host.dataset.notificationId);if(n){n.readAt=new Date().toISOString();if(ctx.cloud())void ctx.api('notifications',{method:'PATCH',body:JSON.stringify({id:n.id})}).catch(()=>{});else ctx.mutate(()=>{});}renderBell();
      host.closest('.notification-poll')?.querySelector('.notification-poll-label')?.replaceChildren(document.createTextNode('Tu voto quedó registrado'));
    }));
    }
    document.querySelectorAll<HTMLButtonElement>('[data-notifications-tab]').forEach(button=>{button.onclick=()=>{tab=button.dataset.notificationsTab!;draw();};button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();tab=e.key==='Home'?'all':e.key==='End'?'unread':tab==='all'?'unread':'all';draw();document.querySelector<HTMLButtonElement>(`[data-notifications-tab="${tab}"]`)?.focus();};});
    $('#notification-kind').onchange=e=>{kind=(e.target as HTMLSelectElement).value;draw();};
    $('#notifications-mark-all').onclick=async()=>{if(marking)return;const unread=items.filter(n=>!n.readAt);if(!unread.length)return;marking=true;draw();let done=0;for(let start=0;start<unread.length;start+=5)await Promise.all(unread.slice(start,start+5).map(async n=>{try{if(ctx.cloud())await ctx.api('notifications',{method:'PATCH',body:JSON.stringify({id:n.id})});n.readAt=new Date().toISOString();done++;}catch{}}));if(!ctx.cloud())ctx.mutate(()=>{});renderBell();marking=false;if(popover.isConnected){$('#notification-feedback').textContent=done===unread.length?'Todo marcado como leído.':'Algunos avisos no se pudieron actualizar. Inténtalo otra vez.';draw();}};
    draw();
  }
  async function composeNotification(host?:HTMLElement) {
    const people = ctx.cloud()
      ? (await ctx.api("team?directory=notifications")).docs
      : demoMembers().filter((m) => !m.disabled);
    const selected = new Map<string, string>();
    let requestId = uid();
    if(host&&!host.isConnected)return;
    const show=(html:string)=>{if(host)host.innerHTML=html;else ctx.modal(html);};
    show(
      '<h2>Notificar al equipo</h2><p>Escribe @ y selecciona a la persona. El aviso llegará a su campanita.</p><form id="direct-notification-form"><label>Notificar al equipo<textarea id="direct-message" maxlength="280" rows="2" required placeholder="Escribe @ y elige a alguien…"></textarea></label><div id="direct-mentions" class="mention-suggestions"></div><div id="direct-selected" class="mention-chips"></div><p id="direct-error" class="form-error" role="alert"></p><div class="direct-compose-actions"><span id="direct-feedback" role="status"></span><button class="button primary">Enviar aviso</button></div></form>',
    );
    const input = $<HTMLTextAreaElement>("#direct-message");
    let range: { start: number; end: number } | undefined;
    function chips() {
      $("#direct-selected").innerHTML = [...selected]
        .map(
          ([id, name]) =>
            `<button type="button" data-remove-direct="${esc(id)}">@${esc(name)} ×</button>`,
        )
        .join("");
      $("#direct-selected")
        .querySelectorAll<HTMLElement>("[data-remove-direct]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              selected.delete(b.dataset.removeDirect!);
              chips();
            }),
        );
    }
    input.oninput = () => {
      $("#direct-error").textContent="";$("#direct-feedback").textContent="";
      const before = input.value.slice(0, input.selectionStart),
        match = before.match(/(?:^|\s)@([^@\n]{0,50})$/);
      if (!match) {
        $("#direct-mentions").innerHTML = "";
        return;
      }
      range = {
        start: input.selectionStart - match[1].length - 1,
        end: input.selectionStart,
      };
      const choices = people
        .filter(
          (p: any) =>
            p.id !== String(ctx.actor().id) &&
            p.name.toLowerCase().includes(match[1].toLowerCase()),
        )
        .slice(0, 6);
      $("#direct-mentions").innerHTML = choices
        .map(
          (p: any) =>
            `<button type="button" data-direct-person="${esc(p.id)}">@${esc(p.name)}</button>`,
        )
        .join("");
      $("#direct-mentions")
        .querySelectorAll<HTMLElement>("[data-direct-person]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              const person = people.find(
                (p: any) => String(p.id) === b.dataset.directPerson,
              );
              if (!person || !range) return;
              selected.set(String(person.id), person.name);
              input.value =
                input.value.slice(0, range.start) +
                "@" +
                person.name +
                " " +
                input.value.slice(range.end);
              $("#direct-mentions").innerHTML = "";
              chips();
              input.focus();
            }),
        );
    };
    $("#direct-notification-form").onsubmit = async (e) => {
      e.preventDefault();
      const recipients = [...selected]
        .filter(([, name]) => input.value.includes("@" + name))
        .map(([id]) => id);
      if (!recipients.length) {
        $("#direct-error").textContent =
          "Selecciona a alguien con @ para enviar el aviso.";
        return;
      }
      const submit=(e.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type=submit],button.button.primary')!;
      if(submit.disabled)return;submit.disabled=true;
      try {
        if (ctx.cloud()) {
          await ctx.api("notifications", {
            method: "POST",
            body: JSON.stringify({
              text: input.value.trim(),
              recipients,
              requestId,
            }),
          });
          ctx.invalidate();
        } else
          ctx.mutate(() => {
            ctx.state().notifications ??= [];
            for (const id of recipients)
              ctx.state().notifications!.push({
                id: uid(),
                kind: "message",
                authorName: ctx.actor().name,
                recipientId: id,
                text: input.value.trim(),
                createdAt: new Date().toISOString(),
              });
          });
        if(host){if(host.isConnected){input.value='';selected.clear();chips();$('#direct-error').textContent='';$('#direct-feedback').textContent='Aviso enviado.';requestId=uid();}}else ctx.close();
        ctx.notify("Notificación enviada.");
      } catch {
        if(input.isConnected)$("#direct-error").textContent = "No pudimos enviar el aviso.";
      }finally{submit.disabled=false;}
    };
  }
  async function loadTeam() {
    if (!isAdmin(ctx.actor())) return;
    members = ctx.cloud() ? (await ctx.api("team")).docs : demoMembers();
  }
  async function renderTeam() {
    const list = $("#team-list");
    if (!isAdmin(ctx.actor())) {
      list.innerHTML =
        '<p class="empty-state">Solo los administradores pueden gestionar el equipo.</p>';
      return;
    }
    $("#team-note").textContent = ctx.cloud()
      ? "Los administradores gestionan usuarios y permisos. El propietario siempre conserva su acceso."
      : "Equipo de ejemplo. Gestiona los permisos desde esta sección.";
    try {
      await loadTeam();
      list.innerHTML =
        '<div class="team-row team-head"><span></span><strong>Nombre y apellido</strong><strong>Correo</strong><strong>Rol</strong><strong>Estado</strong><strong>Gestionar</strong><strong>Eliminar</strong></div>' +
        members
          .filter((m) => !m.deletedAt)
          .map(
            (m) =>
              `<article class="team-row"><span class="comment-avatar">${esc(
                m.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join(""),
              )}</span><div class="team-identity"><strong>${esc(m.name)} ${String(m.id) === String(ctx.actor().id) ? "<small>(tú)</small>" : ""}</strong></div><span class="team-email">${esc(m.email)}</span><span class="commerce-pill team-role-pill" data-role="${esc(m.role)}">${esc(roleLabels[m.role] || m.role)}</span><span class="member-status ${m.disabled ? "disabled" : ""}">${m.disabled ? "Sin acceso" : "Activo"}</span>${m.role !== "owner" && String(m.id) !== String(ctx.actor().id) ? `<button class="button primary compact-table-action" data-edit-member="${esc(m.id)}">${m.disabled ? "Restaurar acceso" : "Gestionar"}</button>` : '<span class="team-protected">Cuenta protegida</span>'}<span class="team-delete-cell">${m.role !== "owner" && String(m.id) !== String(ctx.actor().id) ? `<button class="icon-btn" data-delete-member="${esc(m.id)}" aria-label="Eliminar a ${esc(m.name)}">${uiIcon("trash", 17)}</button>` : "—"}</span></article>`,
          )
          .join("");
      list
        .querySelectorAll<HTMLElement>("[data-edit-member]")
        .forEach((b) => (b.onclick = () => memberEditor(b.dataset.editMember)));
      list.querySelectorAll<HTMLElement>("[data-delete-member]").forEach(
        (b) =>
          (b.onclick = () => {
            const member = members.find((m) => m.id === b.dataset.deleteMember);
            if (member) confirmRemoveMember(member);
          }),
      );
    } catch {
      list.innerHTML =
        '<p class="empty-state">No pudimos cargar el equipo. Inténtalo de nuevo.</p>';
    }
  }
  async function memberEditor(id?: string) {
    if (!isAdmin(ctx.actor())) return;
    await loadTeam();
    const target = members.find((m) => m.id === id);
    if (target?.role === "owner" || target?.id === ctx.actor().id) return;
    ctx.modal(
      `<h2>${target ? esc(target.name) : "Añadir al equipo"}</h2><p>${target ? "Elige su rol y las secciones que puede consultar." : "Invítala por correo para que cree su propia contraseña. El enlace vence en una hora."}</p><form id="member-form">${!ctx.cloud()?'<p class="section-note">Modo demo: puedes revisar el formulario; no se enviará ningún correo.</p>':""}${!target ? '<label>Nombre<input name="name" required maxlength="80" autocomplete="off"/></label><label>Correo<input type="email" name="email" required autocomplete="off"/></label>' : ""}<label>Rol<select name="role" id="member-role">${["admin", "editor", "member", "viewer"].map((role) => `<option value="${role}" ${role === (target?.role || "member") ? "selected" : ""}>${roleLabels[role]}</option>`).join("")}</select></label><p class="role-description" id="role-description"></p><fieldset class="permission-options"><legend>Puede ver</legend>${Object.entries(
        labels,
      )
        .map(
          ([section, label]) =>
            `<label><input type="checkbox" name="permission" value="${section}"/> ${label}</label>`,
        )
        .join(
          "",
        )}</fieldset><p class="section-note">Tienda, Documentos, Equipo, Configuración e Integraciones son exclusivos de administradores.</p><p id="member-error" class="form-error" role="alert"></p><div class="dialog-actions">${target ? `<button type="button" class="${target.disabled ? "button secondary" : "danger-button"}" id="remove-member">${target.disabled ? "Restaurar acceso" : "Eliminar usuario"}</button>` : ""}${target?'<button type="button" class="button secondary" id="send-member-link">Enviar enlace de contraseña</button>':""}<button class="button primary">${target ? "Guardar permisos" : "Invitar persona"}</button></div></form>`,
    );
    const role = $<HTMLSelectElement>("#member-role");
    const fields = [...$<HTMLFormElement>("#member-form").querySelectorAll<HTMLInputElement>('[name="permission"]')];
    const roleDefaults: Record<string, string[]> = {
      editor: defaultPermissions,
      member: ["overview", "canvas", "tasks", "calendar", "pages"],
      viewer: ["overview", "canvas", "tasks", "pages"],
    };
    const applyRole = (permissions: string[]) => {
      const admin = role.value === "admin";
      $("#role-description").textContent = admin
        ? "Tiene acceso a todas las secciones."
        : role.value === "viewer"
          ? "Puede consultar las secciones seleccionadas."
          : "Puede trabajar en las secciones seleccionadas.";
      for (const field of fields) {
        const section = field.value as Section;
        const available = canView({ role: role.value, permissions: [section] }, section);
        field.disabled = admin || !available || section === "profile";
        field.checked = available && (admin || section === "profile" || permissions.includes(section));
      }
    };
    const defaults = () => roleDefaults[role.value] ?? [];
    role.onchange = () => applyRole(defaults());
    applyRole(target?.permissions ?? defaults());
    function showInvite(result:any){
      if(result?.invite?.url){ctx.modal(`<h2>Enlace de invitación listo</h2><p>${esc(result.invite.message)}</p><label>Enlace privado<input id="member-invite-url" readonly value="${esc(result.invite.url)}"/></label><button class="button primary" id="copy-member-invite">Copiar enlace</button><p id="member-invite-status" role="status"></p>`);$('#copy-member-invite').onclick=async()=>{try{await navigator.clipboard.writeText(result.invite.url);$('#member-invite-status').textContent='Enlace copiado. Compártelo solo con la persona invitada.';}catch{$('#member-invite-status').textContent='Selecciona y copia el enlace del campo.';}};}
      else if(result?.invite)ctx.notify(result.invite.message);
    }
    $('#send-member-link')?.addEventListener('click',async()=>{if(!ctx.cloud()){ctx.notify('La demo no envía invitaciones. Conecta Payload para invitar personas.');return;}const button=$<HTMLButtonElement>('#send-member-link');button.disabled=true;try{const result=await ctx.api('team',{method:'POST',body:JSON.stringify({id:target!.id})});ctx.close();showInvite(result);}catch{$('#member-error').textContent='No pudimos enviar el enlace. Espera un minuto y vuelve a intentarlo.';button.disabled=false;}});
    $("#member-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const value = {
        role: String(f.get("role")),
        permissions: fields.filter(field => field.checked).map(field => field.value),
      };
      let invitation:any;
      const submit=(e.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"],button.primary')!;if(submit.disabled)return;submit.disabled=true;
      try {
        if (ctx.cloud()) {
          invitation=await ctx.api("team", {
            method: target ? "PATCH" : "POST",
            body: JSON.stringify({
              ...value,
              ...(!target
                ? {
                    name: f.get("name"),
                    email: f.get("email"),
                  }
                : { id: target.id }),
            }),
          });
        } else
          ctx.mutate(() => {
            if (target)
              Object.assign(
                demoMembers().find((m) => m.id === target.id)!,
                value,
              );
            else
              ctx.state().demoMembers = [
                ...demoMembers(),
                {
                  id: uid(),
                  name: String(f.get("name")),
                  email: String(f.get("email")),
                  ...value,
                },
              ];
          });
        await loadDirectory();
        ctx.close();
        void renderTeam();
        ctx.notify(
          target ? "Permisos actualizados." : ctx.cloud()?"Invitación preparada.":"Persona añadida a la demo; no se envió ningún correo.",
        );
        if(!target)showInvite(invitation);
      } catch (e) {
        submit.disabled=false;
        $("#member-error").textContent =
          e instanceof Error ? e.message : "No pudimos guardar los cambios.";
      }
    };
    if (target)
      $("#remove-member").onclick = () => {
        if (target.disabled) {
          void restoreMember(target);
          return;
        }
        confirmRemoveMember(target);
      };
  }
  function confirmRemoveMember(target: WorkspaceMember) {
    if (
      !isAdmin(ctx.actor()) ||
      target.role === "owner" ||
      String(target.id) === String(ctx.actor().id)
    )
      return;
    ctx.modal(
      `<h2>¿Quitar el acceso a ${esc(target.name)}?</h2><p>Ya no podrá entrar al negocio. Sus comentarios se conservan. Puedes recuperar la cuenta desde la papelera durante 30 días.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancelar</button><button class="danger-button" id="confirm-remove-member">Eliminar usuario</button></div><p id="member-error" class="form-error" role="alert"></p>`,
    );
    $("#confirm-remove-member").onclick = async () => {
      try {
        if (ctx.cloud())
          await ctx.api("team", {
            method: "DELETE",
            body: JSON.stringify({ id: target.id }),
          });
        else
          ctx.mutate(() => {
            demoMembers().find((m) => m.id === target.id)!.disabled = true;
            demoMembers().find((m) => m.id === target.id)!.deletedAt =
              new Date().toISOString();
          });
        ctx.close();
        await loadDirectory();
        void renderTeam();
        ctx.notify("Su acceso al negocio se ha desactivado.");
      } catch (e) {
        $("#member-error").textContent =
          e instanceof Error ? e.message : "No pudimos quitar su acceso.";
      }
    };
  }
  async function restoreMember(target: WorkspaceMember) {
    try {
      if (ctx.cloud())
        await ctx.api("team", {
          method: "PATCH",
          body: JSON.stringify({ id: target.id, restore: true }),
        });
      else
        ctx.mutate(() => {
          demoMembers().find((m) => m.id === target.id)!.disabled = false;
          delete demoMembers().find((m) => m.id === target.id)!.deletedAt;
        });
      ctx.close();
      void renderTeam();
      await loadDirectory();
      ctx.notify("Acceso restaurado.");
    } catch {
      ctx.notify("No pudimos restaurar su acceso.");
    }
  }
  function profile() {
    ctx.notify("Abre Mi perfil para actualizar tus datos.");
  }
  let vaultLoadedAt = 0;
  let vaultLoading: Promise<void> | undefined;
  async function loadVault() {
    if (vaultLoading) return vaultLoading;
    vaultLoading = (async () => {
      vaultRows = ctx.cloud()
        ? (await ctx.api("vault")).docs
        : [...demoSecrets.values()]
            .filter((v) => !v.deletedAt)
            .map(({ password, notes, ...v }) => ({
              ...v,
              hasSecret: !!password,
            }));
      vaultLoadedAt = Date.now();
    })();
    try {
      await vaultLoading;
    } finally {
      vaultLoading = undefined;
    }
  }
  async function renderVault() {
    if (!canView(ctx.actor(), "vault")) return;
    $("#vault-note").textContent = ctx.cloud()
      ? "Los accesos se guardan cifrados. Solo las personas con permiso pueden consultarlos."
      : "Estos accesos son ejemplos y se borran al recargar. No uses credenciales reales en la demo.";
    try {
      if (vaultRows.length) drawVault();
      if (Date.now() - vaultLoadedAt > 20000) await loadVault();
      drawVault();
    } catch (e) {
      $("#vault-grid").innerHTML =
        `<p class="empty-state">${esc(e instanceof Error ? e.message : "No pudimos cargar los accesos.")}</p>`;
    }
  }
  function drawVault() {
    const term = $<HTMLInputElement>("#vault-search").value.toLowerCase(),
      category = $<HTMLSelectElement>("#vault-category").value;
    $("#vault-grid").innerHTML =
      vaultRows
        .filter(
          (v) =>
            (v.title + " " + v.username).toLowerCase().includes(term) &&
            (category === "all" || v.category === category),
        )
        .map(
          (v) =>
            `<article class="access-card"><div><span class="access-symbol">${v.category === "Hosting" ? "⌘" : v.category === "Redes sociales" ? "@" : "▣"}</span><span class="commerce-pill access-category-pill" data-category="${esc(v.category)}">${esc(v.category)}</span></div><h2>${esc(v.title)}</h2><p>${esc(v.username || "Sin usuario")}</p><span class="masked-secret">${v.hasSecret ? "••••••••••••" : "Sin contraseña guardada"}</span><div class="access-actions"><button class="button primary" data-access="${esc(v.id)}">Ver acceso</button>${v.url && /^https?:\/\//.test(v.url) ? `<a class="button secondary access-launch access-outline" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">Abrir plataforma ↗</a>` : ""}</div></article>`,
        )
        .join("") ||
      '<div class="empty-state">No hay accesos que coincidan. Puedes añadir el primero.</div>';
    document
      .querySelectorAll<HTMLElement>("[data-access]")
      .forEach((b) => (b.onclick = () => accessEditor(b.dataset.access)));
  }
  $("#vault-search").addEventListener("input", drawVault);
  $("#vault-category").addEventListener("change", drawVault);
  async function accessEditor(id?: string) {
    if (!canView(ctx.actor(), "vault")) return;
    if (!id && !canWrite(ctx.actor(), "vault")) return;
    let v: AccessCard | undefined;
    try {
      if (id)
        v = ctx.cloud()
          ? (await ctx.api("vault?id=" + encodeURIComponent(id))).doc
          : demoSecrets.get(id);
    } catch (e) {
      ctx.notify(
        e instanceof Error ? e.message : "No pudimos abrir este acceso.",
      );
      return;
    }
    const editable = canWrite(ctx.actor(), "vault");
    ctx.modal(
      `<h2>${v ? esc(v.title) : "Guardar un acceso"}</h2><p>${ctx.cloud() ? "Comparte este acceso solo con quienes lo necesitan." : "Usa datos ficticios para probar este formulario."}</p><form id="access-form"><label>Nombre<input name="title" required maxlength="100" value="${esc(v?.title || "")}" ${!editable ? "readonly" : ""}/></label><label>Categoría<select name="category" ${!editable ? "disabled" : ""}>${["Plataformas", "Redes sociales", "Hosting", "Otros"].map((c) => `<option ${c === v?.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>URL<input name="url" type="url" value="${esc(v?.url || "")}" placeholder="https://…" ${!editable ? "readonly" : ""}/></label><label>Usuario o correo<div class="secret-input"><input id="access-username" aria-label="Usuario o correo" name="username" autocomplete="off" maxlength="10000" value="${esc(v?.username || "")}" ${!editable ? "readonly" : ""}/><button type="button" id="copy-username" aria-label="Copiar usuario">${uiIcon("copy", 17)}</button><span id="username-copy-tip" class="secret-copy-tip" role="status" hidden></span></div></label><label>Contraseña<div class="secret-input"><input name="password" id="access-password" aria-label="Contraseña" type="password" autocomplete="off" maxlength="10000" value="${esc(v?.password || "")}" ${!editable ? "readonly" : ""}/><button type="button" id="reveal-secret" class="tooltip-control" aria-pressed="false" aria-label="Mostrar contraseña" data-tooltip="Mostrar contraseña">${passwordEye(false)}</button><button type="button" id="copy-secret" aria-label="Copiar contraseña">${uiIcon("copy", 17)}</button><span id="secret-copy-tip" class="secret-copy-tip" role="status" hidden></span></div></label><p class="section-note access-autofill-note">Para rellenar el inicio de sesión al abrir otro sitio, guarda ese acceso en el gestor de contraseñas de tu navegador. <a href="https://support.google.com/chrome/answer/95606?hl=es" target="_blank" rel="noopener noreferrer">Cómo hacerlo en Chrome ↗</a></p><label>Notas<textarea name="notes" maxlength="10000" ${!editable ? "readonly" : ""}>${esc(v?.notes || "")}</textarea></label><p id="access-error" class="form-error" role="alert"></p><div class="dialog-actions">${id && isAdmin(ctx.actor()) ? '<button type="button" class="danger-button" id="remove-access">Eliminar acceso</button>' : ""}${editable ? '<button class="button primary">Guardar acceso</button>' : '<button type="button" class="button secondary" data-close>Cerrar</button>'}</div></form>`,
    );
    function passwordEye(hidden: boolean) {
      return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>${hidden ? '<path d="m3 3 18 18"/>' : ""}</svg>`;
    }
    $("#reveal-secret").onclick = () => {
      const input = $<HTMLInputElement>("#access-password"),
        visible = input.type === "password";
      input.type = visible ? "text" : "password";
      const toggle = $("#reveal-secret");
      const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
      toggle.innerHTML = passwordEye(visible);
      toggle.setAttribute("aria-label", label);
      toggle.dataset.tooltip = label;
      $("#reveal-secret").setAttribute("aria-pressed", String(visible));
    };
    $("#copy-username").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          $<HTMLInputElement>("#access-username").value,
        );
        const tip = $("#username-copy-tip");
        tip.textContent = "Copiado";
        tip.hidden = false;
        setTimeout(() => (tip.hidden = true), 2000);
      } catch {
        $("#access-error").textContent = "No pudimos copiar el usuario.";
      }
    };
    $("#copy-secret").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          $<HTMLInputElement>("#access-password").value,
        );
        const tip = $("#secret-copy-tip");
        tip.textContent = "Copiado";
        tip.hidden = false;
        setTimeout(() => (tip.hidden = true), 2000);
      } catch {
        $("#access-error").textContent =
          "No pudimos copiar. Selecciona la contraseña y cópiala manualmente.";
      }
    };
    $("#access-form").onsubmit = async (e) => {
      e.preventDefault();
      if (!editable) return;
      try {
        const data = {
          ...Object.fromEntries(new FormData(e.target as HTMLFormElement)),
          ...(id ? { id } : {}),
        };
        if (ctx.cloud())
          await ctx.api("vault", {
            method: "POST",
            body: JSON.stringify(data),
          });
        else {
          const key = id || uid();
          demoSecrets.set(key, { ...data, id: key } as AccessCard);
        }
        ctx.close();
        vaultLoadedAt = 0;
        void renderVault();
        ctx.notify("Acceso guardado.");
      } catch (e) {
        $("#access-error").textContent =
          e instanceof Error ? e.message : "No pudimos guardar el acceso.";
      }
    };
    if (id && isAdmin(ctx.actor()))
      $("#remove-access").onclick = () => {
        ctx.modal(
          '<h2>¿Eliminar este acceso?</h2><p>Se quitará de las tarjetas del negocio.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancelar</button><button class="danger-button" id="confirm-remove-access">Eliminar acceso</button></div>',
        );
        $("#confirm-remove-access").onclick = async () => {
          try {
            if (ctx.cloud())
              await ctx.api("vault", {
                method: "DELETE",
                body: JSON.stringify({ id }),
              });
            else {
              demoSecrets.get(id)!.deletedAt = new Date().toISOString();
              persistDemoTrash();
            }
            ctx.close();
            vaultLoadedAt = 0;
            void renderVault();
            ctx.notify("Acceso eliminado.");
          } catch {
            ctx.notify("No pudimos eliminar este acceso.");
          }
        };
      };
  }
  return {
    polls,
    activity,
    listTrash,
    restoreTrash,
    removeTrashedAccess,
    renderBell,
    attachComments,
    commentPreview,
    notifications,
    renderTeam,
    memberEditor,
    profile,
    renderVault,
    accessEditor,
    loadDirectory,
    directory:()=>directory,
    preload: () =>
      canView(ctx.actor(), "vault")
        ? loadVault().catch(() => {})
        : Promise.resolve(),
  };
}
