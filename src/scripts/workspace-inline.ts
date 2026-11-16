import {demoPath} from "@/lib/saas/routes";
import { uiIcon } from "@/lib/saas/icons";
import {
  uid,
  moveTask,
  orderedTasks,
  type WorkspaceState,
  type WorkspaceMember,
  type CanvasNode,
  type Task,
} from "@/lib/saas/model";
import { canWrite } from "@/lib/saas/permissions";
import { entitySlug } from "@/lib/saas/routes";
import { sanitizeRichText } from "@/lib/saas/rich-text";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  board: () => string;
  mutate: (f: () => void) => void;
  commit: (f: () => void) => void;
  render: () => void;
  modal: (s: string) => void;
  close: () => void;
  notify: (s: string) => void;
  privateDetail: (id: string) => void;
};
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function installInline(ctx: Ctx) {
  function focus(selector: string) {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }
  function newTask(status: Task["status"] = "todo", privateArea = false) {
    if (!canWrite(ctx.actor(), "tasks")) return;
    const board = ctx.state().boards?.find((b) => b.id === ctx.board());
    const owner = privateArea ? String(ctx.actor().id) : board?.privateOwner;
    const id = uid();
    ctx.mutate(() => {
      ctx.state().tasks.push({
        id,
        title: "Nueva tarea",
        description: "",
        project: owner ? "Mi área privada" : "Mi negocio",
        boardId: privateArea ? "private-" + ctx.actor().id : ctx.board(),
        privateOwner: owner,
        status,
        priority: "normal",
        due: "",
      });
      const created = ctx.state().tasks.find(t => t.id === id)!;
      const first = orderedTasks(ctx.state().tasks.filter(t => t.id !== id && (t.boardId || "general") === (created.boardId || "general") && (t.privateOwner || "") === (owner || "")), status)[0]?.id;
      ctx.state().tasks = moveTask(ctx.state().tasks, id, status, first);
    });
    if (privateArea) {
      ctx.privateDetail(id);
      focus('[data-entity-kind="task"][data-entity-field="title"]');
    } else focus(`[data-task-title="${id}"]`);
  }
  function formatTaskDescription(description: string) {
    const listItem = /^\s*(?:([-*•])\s+(?:\[([ xX])\]\s+)?|([□☐☑✓])\s+)(\S.*)$/;
    let html = "";
    let openList = false;
    for (const line of description.split(/\r?\n/)) {
      const item = line.match(listItem);
      if (item) {
        if (!openList) html += "<ul>";
        openList = true;
        const marker = item[2] !== undefined || item[3]
          ? ' class="' + (/[xX☑✓]/.test(item[2] || item[3]) ? "task-check-done" : "task-check") + '"'
          : "";
        html += `<li${marker}>${esc(item[4])}</li>`;
      } else {
        if (openList) html += "</ul>";
        else if (html) html += "\n";
        openList = false;
        html += esc(line);
      }
    }
    return openList ? html + "</ul>" : html;
  }

  function taskContent(task: Task, menu: string) {
    const writable = canWrite(ctx.actor(), "tasks");
    return `<div class="task-editable"><div class="task-card-label">${writable ? `<button class="task-grip" data-task-grip="${task.id}" draggable="false" aria-label="Mover ${esc(task.title)}. Usa arriba y abajo para ordenar; izquierda y derecha para cambiar de estado.">${uiIcon("grip", 16)}</button>` : ""}<span class="task-tag ${task.priority}">${esc(task.project || "General")}</span>${menu}</div><h3 data-task-title="${task.id}" ${writable ? 'contenteditable="plaintext-only" role="textbox" aria-label="Título de la tarea"' : ""}>${esc(task.title)}</h3><div class="task-inline-description" data-task-description="${task.id}" ${writable ? 'contenteditable="plaintext-only" role="textbox" aria-label="Contenido de la tarea"' : ""} data-placeholder="Añade una descripción…">${formatTaskDescription(task.description || "")}</div></div>`;
  }
  function renderList(node: CanvasNode, preview = false) {
    const items = node.checklist?.length
        ? node.checklist
        : [{ id: "first-" + node.id, text: "", done: false }],
      writable = canWrite(ctx.actor(), "canvas");
    return `<div class="node-checklist">${items.map((item) => `<div class="node-check-row"><input type="checkbox" ${preview ? "" : `data-check-node="${node.id}" data-check-id="${item.id}"`} aria-label="Completar ${esc(item.text || "elemento")}" ${item.done ? "checked" : ""} ${!writable ? "disabled" : ""}/><div class="list-edit ${item.done ? "done" : ""}" data-list-id="${item.id}" data-placeholder="Doble clic para editar la lista">${esc(item.text)}</div></div>`).join("")}</div>`;
  }
  function ensureList(node: CanvasNode, id: string) {
    node.checklist ??= [{ id, text: "", done: false }];
    return node.checklist.find((item) => item.id === id);
  }
  function saveText(el: HTMLElement) {
    const taskId = el.dataset.taskTitle || el.dataset.taskDescription;
    if (taskId && canWrite(ctx.actor(), "tasks")) {
      const task = ctx.state().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const key = el.dataset.taskTitle ? "title" : "description",
        text =
          el.innerText.trim().slice(0, key === "title" ? 140 : 5000) ||
          (key === "title" ? "Sin título" : "");
      if (task[key] !== text) ctx.commit(() => {task[key] = text;if(key==="description")delete task.descriptionHtml;});
      return;
    }
    if (el.dataset.listNode && canWrite(ctx.actor(), "canvas")) {
      const node = ctx.state().nodes.find((n) => n.id === el.dataset.listNode);
      if (!node) return;
      const text = el.innerText.slice(0, 2000),
        item = node.checklist?.find((i) => i.id === el.dataset.listId);
      if (item?.text !== text)
        ctx.commit(() => {
          const row = ensureList(node, el.dataset.listId!);
          if (row) row.text = text;
        });
      return;
    }
    if (el.dataset.entityKind) {
      const kind = el.dataset.entityKind,
        field = el.dataset.entityField;
      if (!canWrite(ctx.actor(), kind === "task" ? "tasks" : "pages")) return;
      const item = (
        kind === "task" ? ctx.state().tasks : ctx.state().pages
      ).find((i) => i.id === el.dataset.entityId);
      if (!item) return;
      const text =
        el.innerText
          .trim()
          .slice(0, field === "title" ? 140 : kind === "task" ? 5000 : 30000) ||
        (field === "title" ? "Sin título" : "");
      const property =
        field === "title" ? "title" : kind === "task" ? "description" : "body";
      if (
        (item as any)[property] === text &&
        !(
          field !== "title" &&
          (kind === "page" ? (item as any).bodyHtml : (item as Task).descriptionHtml) !== sanitizeRichText(el.innerHTML)
        )
      )
        return;
      ctx.commit(() => {
        (item as any)[property] = text;
        if(kind === "task" && field !== "title") (item as Task).descriptionHtml=sanitizeRichText(el.innerHTML);
        if (kind === "page") {
          (item as any).updated = new Date().toISOString();
          if (field !== "title")
            (item as any).bodyHtml = sanitizeRichText(el.innerHTML);
        }
      });
      if (field === "title") {
        const privatePrefix = item.privateOwner ? "mi-area-privada/" : "";
        const segment = kind === "task" ? "tareas" : "notas";
        const slug = entitySlug(
          item,
          (kind === "task" ? ctx.state().tasks : ctx.state().pages).filter(
            (i) => (i.privateOwner || "") === (item.privateOwner || ""),
          ),
        );
        window.history.replaceState(
          null,
          "",
          demoPath("/app/" +
            privatePrefix +
            segment +
            (privatePrefix ? "/" : "/detalle/") +
            slug),
        );
      }
    }
  }
  document.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement;
    if (!el.matches("[data-task-description][contenteditable]") || !el.querySelector("ul")) return;
    const task = ctx.state().tasks.find((item) => item.id === el.dataset.taskDescription);
    if (task) el.textContent = task.description;
  });
  document.addEventListener("focusout", (e) => {
    const el = e.target as HTMLElement;
    if (
      el.matches(
        "[data-task-title],[data-task-description],[data-list-node],[data-entity-kind]",
      )
    ) {
      saveText(el);
      if (el.matches("[data-task-description][contenteditable]")) {
        el.innerHTML = formatTaskDescription(el.innerText.trim().slice(0, 5000));
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (el.matches("[data-task-title]") && e.key === "Enter") {
      e.preventDefault();
      saveText(el);
      document
        .querySelector<HTMLElement>(
          `[data-task-description="${el.dataset.taskTitle}"]`,
        )
        ?.focus();
    }
    if (
      el.matches("[data-list-node]") &&
      canWrite(ctx.actor(), "canvas") &&
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      const node = ctx.state().nodes.find((n) => n.id === el.dataset.listNode);
      if (!node) return;
      const id = uid();
      ctx.mutate(() => {
        const item = ensureList(node, el.dataset.listId!);
        if (item) item.text = el.innerText.slice(0, 2000);
        const index = node.checklist!.findIndex(
          (i) => i.id === el.dataset.listId,
        );
        node.checklist!.splice(index + 1, 0, { id, text: "", done: false });
      });
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-list-id="${id}"]`)?.focus(),
      );
    }
  });
  document.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.checkNode && canWrite(ctx.actor(), "canvas")) {
      ctx.mutate(() => {
        const node = ctx
          .state()
          .nodes.find((n) => n.id === input.dataset.checkNode);
        if (!node) return;
        const row = ensureList(node, input.dataset.checkId!);
        if (row) row.done = input.checked;
      });
      const updated=document.querySelector<HTMLInputElement>(`[data-check-node="${CSS.escape(input.dataset.checkNode)}"][data-check-id="${CSS.escape(input.dataset.checkId!)}"]`);
      updated?.focus({preventScroll:true});
      if (input.checked) updated?.closest(".node-check-row")?.classList.add("check-just-done");
    }
  });
  function transfer(id: string) {
    if (!canWrite(ctx.actor(), "tasks")) return;
    const node = ctx.state().nodes.find((n) => n.id === id);
    if (!node || node.spatial) return;
    const owner = ctx
      .state()
      .spaces.find((s) => s.id === node.space)?.privateOwner;
    const page = node.pageId
      ? ctx.state().pages.find((p) => p.id === node.pageId)
      : undefined;
    const richContent = page?.bodyHtml || node.bodyHtml;
    const items = node.kind === "tasks"
      ? (node.checklist || []).filter(item => item.text.trim())
      : Array.from(new DOMParser().parseFromString(richContent || "", "text/html").querySelectorAll("li")).flatMap(item => {
          const done = !!item.querySelector(":scope > input[type=checkbox][checked]");
          const label = item.cloneNode(true) as HTMLElement;
          label.querySelectorAll("ul,ol").forEach(nested => nested.remove());
          const text = label.textContent.trim();
          return text ? [{ text, done }] : [];
        });
    const content = node.kind === "tasks" ? items.map(item => item.text).join("\n") : page?.body || node.body;
    const descriptionHtml = richContent ? sanitizeRichText(richContent) : undefined;
    if (!content.trim()) {
      ctx.notify("Escribe algo en la tarjeta antes de enviarlo a tareas.");
      return;
    }
    const tasks = ctx
      .state()
      .tasks.filter((t) => (t.privateOwner || "") === (owner || ""));
    const destinationBoards = (ctx.state().boards || []).filter(
      (b) => (b.privateOwner || "") === (owner || ""),
    );
    ctx.modal(
      `<h2>Enviar a tareas</h2><p>El contenido original se conserva en el espacio.</p><form id="transfer-task"><label>Cómo quieres organizarlo<select name="mode" id="transfer-mode"><option value="single">Crear una tarea con todo el contenido</option>${items.length ? '<option value="items">Crear una tarea por elemento de la lista</option>' : ""}<option value="existing">Vincular una tarea existente</option></select></label><label>Tarea de destino<select name="task">${tasks.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}</select></label><label>Tablero<select name="board">${destinationBoards.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}<option value="new">Crear un tablero nuevo</option></select></label><label>Título para la nueva tarea<input name="title" maxlength="140" value="${esc(page?.title || node.title)}"/></label><p id="transfer-error" class="form-error"></p><button class="button primary">Enviar a tareas</button></form>`,
    );
    const modeSelect =
      document.querySelector<HTMLSelectElement>("#transfer-mode")!;
    function drawDestination() {
      const form = document.querySelector<HTMLFormElement>("#transfer-task")!;
      for (const [name, visible] of [
        ["task", modeSelect.value === "existing"],
        ["board", modeSelect.value !== "existing"],
        ["title", modeSelect.value === "single"],
      ] as const) {
        const field = form.elements.namedItem(name) as HTMLElement | null;
        field?.closest("label")?.toggleAttribute("hidden", !visible);
      }
    }
    modeSelect.onchange = drawDestination;
    drawDestination();
    document.querySelector<HTMLFormElement>("#transfer-task")!.onsubmit = (
      e,
    ) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        mode = String(f.get("mode"));
      if (mode === "existing" && !tasks.some((t) => t.id === f.get("task"))) {
        document.querySelector("#transfer-error")!.textContent =
          "Elige una tarea de destino.";
        return;
      }
      const form=e.target as HTMLFormElement;if(form.dataset.sent)return;form.dataset.sent="1";
      const createdIds:string[]=[];
      ctx.mutate(() => {
        if (mode === "existing") {
          const task = ctx.state().tasks.find((t) => t.id === f.get("task"))!;
          task.links=[...(task.links||[]).filter(l=>!(l.kind==="nodes"&&l.id===node.id)),{kind:"nodes",id:node.id}];
          createdIds.push(task.id);

        } else {
          let destination = String(f.get("board") || "new");
          if (!destinationBoards.some((b) => b.id === destination)) {
            destination = uid();
            ctx.state().boards ??= [];
            ctx.state().boards!.push({
              id: destination,
              name:
                ctx.state().spaces.find((s) => s.id === node.space)?.name ||
                "Tareas del espacio",
              description: "Contenido del espacio",
              privateOwner: owner,
              color: "green",
              createdAt: new Date().toISOString(),
            });
          }
          const entries =
            mode === "items"
              ? items
              : [{text: String(f.get("title") || node.title), done: false}];
          for (const entry of entries){
            const taskId=uid();createdIds.push(taskId);
            ctx.state().tasks.push({
              id: taskId,
              links:[{kind:"nodes",id:node.id}],
              title: entry.text.trim().slice(0, 140) || "Nueva tarea",
              description: mode === "items" ? "" : content.slice(0, 5000),
              descriptionHtml: mode === "single" ? descriptionHtml : undefined,
              project:
                ctx.state().spaces.find((s) => s.id === node.space)?.name ||
                "Mi negocio",
              boardId: destination,
              privateOwner: owner,
              status: entry.done ? "done" : "todo",
              priority: "normal",
              due: "",
            });
        }
          }
      });
      ctx.close();
      ctx.modal(`<h2>${mode==="existing"?"Tarea actualizada":"Tareas creadas"}</h2><p>El contenido original sigue en el espacio. La tarea se conserva si eliminas la tarjeta original.</p>${createdIds.map(id=>`<button class="button primary" data-resource-kind="tasks" data-resource-id="${id}">Abrir tarea ↗</button>`).join("")}`);
      ctx.notify(
        mode === "existing"
          ? "Tarea vinculada al elemento original."
          : "Tareas creadas.",
      );
    };
  }
  function transferAll(spaceId: string) {
    if (!canWrite(ctx.actor(), "tasks")) return;
    const space = ctx.state().spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const blocks = ctx
      .state()
      .nodes.filter(
        (n) => n.space === spaceId && !["sales", "image"].includes(n.kind),
      )
      .map((n) => {
        const page = n.pageId
          ? ctx.state().pages.find((p) => p.id === n.pageId)
          : undefined;
        return {
          title: page?.title || n.title,
          text:
            n.kind === "tasks"
              ? (n.checklist || [])
                  .filter((i) => i.text.trim())
                  .map((i) => (i.done ? "✓ " : "☐ ") + i.text)
                  .join("\n")
              : page?.body || n.body,
        };
      })
      .filter((b) => b.text.trim() && b.text.trim() !== "Escribe aquí…");
    if (!blocks.length) {
      ctx.notify(
        "Primero escribe contenido en las tarjetas o listas del espacio.",
      );
      return;
    }
    const boards = (ctx.state().boards || []).filter(
      (b) => (b.privateOwner || "") === (space.privateOwner || ""),
    );
    ctx.modal(
      `<h2>Agregar todo a tareas</h2><p>Crearemos una tarea por tarjeta con contenido. Las listas se guardarán en su descripción. El espacio se conserva.</p><div class="bulk-task-preview">${blocks.map((b) => `<div><strong>${esc(b.title)}</strong><small>${esc(b.text.slice(0, 100))}</small></div>`).join("")}</div><form id="bulk-tasks"><label>Tablero de destino<select name="board">${boards.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}<option value="new">Crear un tablero nuevo…</option></select></label><label id="bulk-board-name">Nombre del nuevo tablero<input name="name" maxlength="80" value="${esc(space.name)}"/></label><p>${blocks.length} ${blocks.length === 1 ? "tarea" : "tareas"} · ${space.privateOwner ? "Solo tú podrás verlas." : "Compartidas con el equipo."}</p><button class="button primary">Crear ${blocks.length} ${blocks.length === 1 ? "tarea" : "tareas"}</button></form>`,
    );
    const form = document.querySelector<HTMLFormElement>("#bulk-tasks")!,
      select = form.elements.namedItem("board") as HTMLSelectElement;
    const draw = () =>
      document
        .querySelector("#bulk-board-name")!
        .toggleAttribute("hidden", select.value !== "new");
    select.onchange = draw;
    draw();
    form.onsubmit = (e) => {
      e.preventDefault();
      let boardId = select.value;
      if (ctx.state().tasks.length + blocks.length > 1000) {
        ctx.notify("Este espacio de trabajo alcanzó el límite de tareas.");
        return;
      }
      ctx.mutate(() => {
        if (boardId === "new") {
          boardId = uid();
          ctx.state().boards ??= [];
          ctx.state().boards!.push({
            id: boardId,
            name: String(new FormData(form).get("name") || space.name).slice(
              0,
              80,
            ),
            description: "Contenido de " + space.name,
            color: "green",
            createdAt: new Date().toISOString(),
            privateOwner: space.privateOwner,
          });
        }
        for (const block of blocks)
          ctx.state().tasks.push({
            id: uid(),
            title: block.title.slice(0, 140),
            description: block.text.slice(0, 5000),
            project: space.name.slice(0, 60),
            boardId,
            privateOwner: space.privateOwner,
            status: "todo",
            priority: "normal",
            due: "",
          });
      });
      ctx.close();
      ctx.notify(
        `${blocks.length} tareas creadas. Las encontrarás en el tablero elegido.`,
      );
    };
  }
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-node-to-task]",
    );
    if (b) transfer(b.dataset.nodeToTask!);
  });
  return { newTask, taskContent, renderList, focus, transferAll };
}
