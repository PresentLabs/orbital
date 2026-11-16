import {
  uid,
  type WorkspaceState,
  type WorkspaceMember,
} from "@/lib/saas/model";
import { canView, canWrite, isAdmin, type Section } from "@/lib/saas/permissions";
import { expired, trashDaysLeft } from "../../services/payload/src/retention";
type Row = {
  id: string;
  title: string;
  section: string;
  privateOwner?: string;
  deletedAt: string;
  collection?: string;
  key?: string;
};
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  cloud: () => boolean;
  api: (s: string, i?: RequestInit) => Promise<any>;
  mutate: (f: () => void) => void;
  save: () => void;
  forget: () => void;
  show: (s: string) => void;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
  external: () => Promise<Row[]>;
  removeExternal: (row: Row) => Promise<void>;
  restoreExternal: (row: Row) => Promise<void>;
};
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const groupSection: Record<string, string> = {
  spaces: "canvas",
  nodes: "canvas",
  edges: "canvas",
  boards: "tasks",
  tasks: "tasks",
  pages: "pages",
  goals: "overview",
  demoMembers: "team",
};
export function installTrash(ctx: Ctx) {
  let section = "all",
    privateOnly = false,
    emptying = false;
  function capture(before: WorkspaceState) {
    let items: { group: string; value: any }[] = [];
    for (const group of Object.keys(groupSection)) {
      const old = (before as any)[group] || [],
        current = (ctx.state() as any)[group] || [];
      for (const value of old) {
        const next = current.find((v: any) => v.id === value.id);
        if (
          !next ||
          (group === "demoMembers" && next.deletedAt && !value.deletedAt)
        )
          items.push({ group, value });
      }
    }
    if (!items.some(i => i.group === "spaces" || i.group === "pages"))
      items = items.filter(i => i.group !== "nodes" && i.group !== "edges");
    if (!items.length) return;
    const primary =
      items.find((i) =>
        ["spaces", "pages", "tasks", "boards", "goals", "demoMembers"].includes(
          i.group,
        ),
      ) || items[0];
    ctx.state().trash ??= [];
    ctx.state().trash!.push({
      id: uid(),
      section: groupSection[primary.group],
      title: primary.value.name || primary.value.title || "Tarjeta del lienzo",
      privateOwner: primary.value.privateOwner,
      deletedAt: new Date().toISOString(),
      items,
    });
  }
  function expire() {
    const state = ctx.state(),
      old = state.trash || [];
    const removed = old.filter((t) => expired(t.deletedAt));
    if (!removed.length) return;
    state.trash = old.filter((t) => !expired(t.deletedAt));
    for (const t of removed)
      for (const i of t.items)
        if (i.group === "demoMembers")
          state.demoMembers = state.demoMembers?.filter(
            (m) => m.id !== i.value.id,
          );
    const removedTaskIds = new Set(
      removed.flatMap((t) =>
        t.items.filter((i) => i.group === "tasks").map((i) => i.value.id),
      ),
    );
    state.comments = state.comments?.filter(
      (c) => !removedTaskIds.has(c.taskId),
    );
    state.notifications = state.notifications?.filter(
      (n) => !n.taskId || !removedTaskIds.has(n.taskId),
    );
    ctx.forget();
    ctx.save();
  }
  function open(s = "all", p = false) {
    section = s;
    privateOnly = p;
    ctx.show("trash");
  }
  async function restoreRow(row: Row) {
    if (!canWrite(ctx.actor(), row.section as Section)) throw Error("No puedes restaurar este elemento.");
    if (ctx.cloud()) await ctx.api("trash", {method:"PATCH", body:JSON.stringify({collection:row.collection,id:row.id})});
    else if (row.collection === "demo") ctx.mutate(() => {
      const item = ctx.state().trash?.find(t => t.id === row.id);
      if (!item) return;
      for (const record of item.items) {
        const array = ((ctx.state() as any)[record.group] ??= []), index = array.findIndex((v:any) => v.id === record.value.id);
        if (index >= 0) array[index] = record.value; else array.push(record.value);
      }
      ctx.state().trash = ctx.state().trash?.filter(t => t.id !== row.id);
    });
    else await ctx.restoreExternal(row);
  }
  async function removeRow(row: Row) {
    if (!canWrite(ctx.actor(), row.section as Section)) throw Error("No puedes eliminar este elemento.");
    if (ctx.cloud()) {
      await ctx.api("trash", { method: "DELETE", body: JSON.stringify({ collection: row.collection, id: row.id }) });
    } else if (row.collection === "demo") {
      const entry = ctx.state().trash?.find(t => t.id === row.id);
      const taskIds = new Set(entry?.items.filter(i => i.group === "tasks").map(i => i.value.id));
      const memberIds = new Set(entry?.items.filter(i => i.group === "demoMembers").map(i => i.value.id));
      const state = ctx.state();
      state.trash = state.trash?.filter(t => t.id !== row.id);
      state.demoMembers = state.demoMembers?.filter(m => !memberIds.has(m.id));
      state.comments = state.comments?.filter(c => !taskIds.has(c.taskId));
      state.notifications = state.notifications?.filter(n => !n.taskId || !taskIds.has(n.taskId));
      ctx.forget();
      ctx.save();
    } else await ctx.removeExternal(row);
  }
  async function render() {
    const host = document.querySelector<HTMLElement>("#trash-content");
    if (!host) return;
    host.innerHTML = '<p class="empty-state">Abriendo la papelera…</p>';
    try {
      expire();
      const all: Row[] = ctx.cloud()
        ? (await ctx.api("trash")).docs
        : [
            ...(ctx.state().trash || []).map((t) => ({
              ...t,
              collection: "demo",
            })),
            ...(await ctx.external()),
          ];
      const rows = all.filter(
        (r) =>
          !expired(r.deletedAt) &&
          canView(ctx.actor(), r.section as Section) &&
          (section === "all" || r.section === section) &&
          (!privateOnly || r.privateOwner === String(ctx.actor().id)) &&
          (!r.privateOwner || r.privateOwner === String(ctx.actor().id)),
      );
      host.innerHTML = `<div class="page-heading compact"><div><h1>Papelera${privateOnly ? " privada" : ""}</h1><p>Puedes restaurar estos elementos. Se eliminan definitivamente al cumplir 30 días.</p></div><div class="heading-actions"><button class="button secondary" data-trash-all>Ver toda la papelera</button><button class="button primary" data-restore-selected disabled>Restaurar</button><button class="button secondary" data-empty-trash>Vaciar papelera</button></div></div><div class="panel" tabindex="0" role="region" aria-label="Elementos de la papelera"><table class="business-table"><thead><tr><th><input id="trash-select-all" type="checkbox" aria-label="Seleccionar todos los elementos restaurables"/></th><th>Elemento</th><th>Sección</th><th>Eliminado</th><th>Tiempo restante</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><input type="checkbox" data-select-trash="${i}" aria-label="Seleccionar ${esc(r.title)}" ${!canWrite(ctx.actor(), r.section as Section) ? "disabled" : ""}/></td><td>${esc(r.title)}${r.privateOwner ? "<small>Privado</small>" : ""}</td><td>${esc(({ canvas: "Espacios", tasks: "Tareas", pages: "Notas", documents: "Documentos", vault: "Accesos", team: "Equipo", overview: "Objetivos" } as any)[r.section] || r.section)}</td><td>${esc(new Date(r.deletedAt).toLocaleDateString("es-CL"))}</td><td>${trashDaysLeft(r.deletedAt)} días</td><td><button class="button secondary small-button" data-restore-trash="${i}" ${!canWrite(ctx.actor(), r.section as Section) ? "disabled" : ""}>Restaurar</button></td></tr>`).join("") || '<tr><td colspan="6">La papelera está vacía.</td></tr>'}</tbody></table></div>`;
      const selected = new Set<number>();
      const selectAll = host.querySelector<HTMLInputElement>("#trash-select-all")!;
      const bulkButton = host.querySelector<HTMLButtonElement>("[data-restore-selected]")!;
      const boxes = [...host.querySelectorAll<HTMLInputElement>("[data-select-trash]")];
      const eligible = boxes.filter(b => !b.disabled);
      const update = () => {
        bulkButton.disabled = !selected.size;
        bulkButton.textContent = `Restaurar${selected.size ? ` (${selected.size})` : ""}`;
        selectAll.checked = eligible.length > 0 && selected.size === eligible.length;
        selectAll.indeterminate = selected.size > 0 && selected.size < eligible.length;
        selectAll.disabled = !eligible.length;
      };
      for (const box of boxes) box.onchange = () => {
        const index = Number(box.dataset.selectTrash);
        if (box.checked) selected.add(index); else selected.delete(index); update();
      };
      selectAll.onchange = () => {
        for (const box of eligible) { box.checked = selectAll.checked; const index = Number(box.dataset.selectTrash); if (box.checked) selected.add(index); else selected.delete(index); }
        update();
      };
      async function restore(indices: number[]) {
        host!.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button,input").forEach(b => b.disabled = true);
        let restored = 0, failed = 0;
        for (const index of indices) {
          try { await restoreRow(rows[index]); restored++; } catch { failed++; }
        }
        if (ctx.cloud()) {
          try { await ctx.refresh(); } catch { await render(); ctx.notify("La restauración terminó, pero no pudimos actualizar la vista. Recarga para ver los cambios."); return; }
        }
        await render();
        ctx.notify(failed ? `${restored} restaurados. ${failed} no se pudieron restaurar; puedes volver a intentarlo.` : `${restored === 1 ? "Elemento restaurado" : `${restored} elementos restaurados`}.`);
      }
      bulkButton.onclick = () => void restore([...selected]);
      host.querySelectorAll<HTMLButtonElement>("[data-restore-trash]").forEach(b => b.onclick = () => void restore([Number(b.dataset.restoreTrash)]));
      const empty = host.querySelector<HTMLButtonElement>("[data-empty-trash]")!;
      const deletable = rows.filter(row =>
        canWrite(ctx.actor(), row.section as Section) &&
        (!ctx.cloud() || !["files", "users", "vault"].includes(row.collection || "") || isAdmin(ctx.actor())),
      );
      empty.disabled = emptying || !deletable.length;
      empty.onclick = async () => {
        if (emptying || !deletable.length || !window.confirm(`¿Vaciar esta papelera? Se eliminarán definitivamente ${deletable.length} elementos.`)) return;
        emptying = true;
        host.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button,input").forEach(b => b.disabled = true);
        let removed = 0;
        for (const row of deletable) {
          try { await removeRow(row); removed++; } catch {}
        }
        emptying = false;
        await render();
        const failed = deletable.length - removed;
        ctx.notify(failed ? `${removed} eliminados. ${failed} siguen en la papelera.` : "Papelera vaciada.");
      };
      update();
    } catch {
      host.innerHTML =
        '<p class="empty-state">No pudimos abrir la papelera.</p>';
    }
  }
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (b?.dataset.trashSection)
      open(b.dataset.trashSection, b.dataset.trashPrivate === "true");
    if (b?.hasAttribute("data-trash-all")) {
      section = "all";
      privateOnly = false;
      void render();
    }
  });
  return {
    capture,
    expire,
    open,
    render,
    current: () => ({ section, privateOnly }),
  };
}
