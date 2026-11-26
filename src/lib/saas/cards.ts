import {modeOf,workModes,activeCycle} from "./work-management";
import type { WorkspaceState, Space, TaskBoard, Page } from "./model";
import { uiIcon } from "./icons";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function favoriteItem(key: string, title: string, favorite: boolean, content: string) {
  return `<div class="directory-item" data-directory-item="${esc(key)}">${content}<button class="directory-favorite ${favorite ? "is-favorite" : ""}" data-favorite-key="${esc(key)}" aria-pressed="${favorite}" aria-label="${favorite ? "Quitar " + esc(title) + " de favoritos" : "Marcar " + esc(title) + " como favorito"}">${uiIcon("heart", 18)}</button></div>`;
}
export function spaceCard(state: WorkspaceState, s: Space, favorite = false) {
  return favoriteItem("spaces:" + s.id,s.name,favorite,`<article class="space-directory-card"><button class="space-preview ${s.color === "orange" ? "warm" : ""}" data-space="${esc(s.id)}" aria-label="Abrir ${esc(s.name)}"><span class="preview-mini"><i></i><i></i><i></i></span><span class="preview-mini"><i></i><i></i><i></i></span></button><div class="space-card-summary"><div class="space-title-copy"><div class="space-name-row"><h2>${esc(s.name)}</h2></div><span class="space-card-count">${state.nodes.filter(n=>n.space===s.id).length} tarjetas</span></div><button class="button primary directory-action-button space-edit-action" data-space="${esc(s.id)}">Editar espacio</button></div></article>`);
}
export function boardCard(state: WorkspaceState, b: TaskBoard, favorite = false) {
  const tasks = state.tasks.filter(
    (t) =>
      (t.boardId || "general") === b.id &&
      (t.privateOwner || "") === (b.privateOwner || ""),
  );
  return favoriteItem("boards:" + b.id, b.name, favorite, `<article class="task-project-card"><span class="board-icon"><span class="sidebar-section-icon sidebar-section-tareas" aria-hidden="true"></span></span><button class="task-project-open" data-open-board="${esc(b.id)}"><h2>${esc(b.name)}</h2><p>${esc(b.description || "Organiza las tareas de este proyecto.")}</p></button><footer class="directory-entry-footer access-actions"><div class="directory-entry-meta"><span>${tasks.filter(t=>t.status!=="done").length} pendientes</span><span>${workModes[modeOf(b)]}${activeCycle(b)?" · Ciclo: "+esc(activeCycle(b)!.name):""}</span></div><button class="button primary directory-action-button" data-open-board="${esc(b.id)}">Ver tarea</button></footer></article>`);
}
export function noteCard(state: WorkspaceState, p: Page, connect: boolean, favorite = false, writable = false) {
  const links = state.nodes.filter((n) => n.pageId === p.id).length;
  return favoriteItem("pages:" + p.id, p.title, favorite, `<article class="page-card"><button class="page-open" data-detail-type="page" data-detail-id="${esc(p.id)}"><span class="page-emoji"><span class="sidebar-section-icon sidebar-section-notas" aria-hidden="true"></span></span><h2>${esc(p.title)}</h2><p>${esc(p.body)}</p></button><div class="page-card-footer access-actions"><small>${links ? links + " espacio" + (links === 1 ? "" : "s") + " conectado" + (links === 1 ? "" : "s") : "Sin conectar a espacios"}</small>${connect ? `<button class="button primary" data-connect-page="${esc(p.id)}">Conectar a un espacio</button>` : ""}${writable ? `<button type="button" class="icon-btn note-trash" data-delete-note="${esc(p.id)}" aria-label="Enviar ${esc(p.title)} a la papelera" title="Enviar a la papelera">${uiIcon("trash",16)}</button>` : ""}</div></article>`);
}
