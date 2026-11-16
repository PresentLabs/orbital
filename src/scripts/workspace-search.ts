import type { WorkspaceState, WorkspaceMember } from "@/lib/saas/model";
import { canView, type Section } from "@/lib/saas/permissions";
import {
  matchesSearch,
  searchLabels,
  type SearchEntry,
} from "@/lib/saas/search";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  modal: (html: string) => void;
  close: () => void;
  show: (view: string) => void;
  remote: (
    query: string,
  ) => Promise<{ results: SearchEntry[]; warnings: string[] }>;
  navigate: (entry: SearchEntry) => void;
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
export function installSearch(ctx: Ctx) {
  let searchOpened = false;
  let pageSnapshot:
    | { term: string; results: SearchEntry[]; warnings: string[]; page: number }
    | undefined;
  let term = "",
    results: SearchEntry[] = [],
    warnings: string[] = [],
    serial = 0,
    timer: ReturnType<typeof setTimeout>,
    loading = false,
    page = 1;
  const isMine = (owner?: string) => !owner || owner === String(ctx.actor().id);
  function local(query: string) {
    const state = ctx.state(),
      me = ctx.actor(),
      entries: SearchEntry[] = [];
    if (canView(me, "tasks"))
      entries.push(
        ...state.tasks
          .filter(
            (t) =>
              isMine(t.privateOwner) &&
              matchesSearch(
                query,
                t.title,
                t.description,
                t.project,
                state.boards?.find((b) => b.id === (t.boardId || "general"))
                  ?.name,
              ),
          )
          .map((t) => ({
            id: t.id,
            kind: "task" as const,
            title: t.title,
            subtitle:
              (t.privateOwner ? "Privada" : "Compartida") +
              " · " +
              (state.boards?.find((b) => b.id === (t.boardId || "general"))
                ?.name || t.project),
          })),
      );
    if (canView(me, "canvas"))
      entries.push(
        ...state.spaces
          .filter((s) => isMine(s.privateOwner) && matchesSearch(query, s.name))
          .map((s) => ({
            id: s.id,
            kind: "space" as const,
            title: s.name,
            subtitle: s.privateOwner ? "Espacio privado" : "Espacio del equipo",
          })),
      );
    if (canView(me, "pages"))
      entries.push(
        ...state.pages
          .filter(
            (p) =>
              isMine(p.privateOwner) && matchesSearch(query, p.title, p.body),
          )
          .map((p) => ({
            id: p.id,
            kind: "page" as const,
            title: p.title,
            subtitle: p.privateOwner ? "Nota privada" : "Nota del equipo",
          })),
      );
    if (canView(me, "calendar"))
      entries.push(
        ...state.events
          .filter((e) => matchesSearch(query, e.title, e.description, e.date))
          .map((e) => ({
            id: e.id,
            kind: "event" as const,
            title: e.title,
            subtitle: "Calendario · " + e.date + " · " + e.time,
          })),
      );
    const sections = [
      ["orders", "Tienda"],
      ["canvas", "Espacios"],
      ["tasks", "Tareas"],
      ["calendar", "Calendario"],
      ["pages", "Notas"],
      ["documents", "Documentos"],
    ] as const;
    entries.push(
      ...sections
        .filter(
          ([view, title]) =>
            canView(me, view as Section) && matchesSearch(query, title),
        )
        .map(([view, title]) => ({
          id: view,
          kind: "section" as const,
          title,
          subtitle: "Ir a la sección",
          view,
        })),
    );
    return entries;
  }
  async function search(query: string) {
    const ticket = ++serial;
    term = query.trim().slice(0, 120);
    page = 1;
    warnings = [];
    results = term ? local(term) : [];
    loading = !!term;
    paint();
    if (!term) return;
    try {
      const external = await ctx.remote(term);
      if (ticket !== serial) return;
      results = [...results, ...external.results];
      warnings = external.warnings || [];
    } catch {
      if (ticket !== serial) return;
      warnings = [
        "No pudimos consultar los resultados de tienda y documentos.",
      ];
    }
    if (ticket !== serial) return;
    loading = false;
    paint();
  }
  function row(entry: SearchEntry, index: number) {
    return `<button class="search-result-row" data-search-hit="${index}"><span class="search-type">${searchLabels[entry.kind]}</span><span><strong>${esc(entry.title)}</strong><small>${esc(entry.subtitle)}</small></span><span aria-hidden="true">↗</span></button>`;
  }
  function paint() {
    const suggestions = document.querySelector<HTMLElement>("#search-results");
    if (suggestions) {
      suggestions.innerHTML = !term
        ? '<p class="section-note">Escribe para buscar en tienda, espacios, tareas, calendario, notas y documentos.</p>'
        : results.slice(0, 5).map(row).join("") +
          (loading
            ? '<p class="section-note" role="status">Buscando en tienda y documentos…</p>'
            : "") +
          (!results.length && !loading
            ? '<p class="empty-state">No encontramos resultados.</p>'
            : "") +
          (results.length > 5
            ? '<button class="button secondary search-all" data-search-all>Ver resultados</button>'
            : "") +
          (warnings.length
            ? `<p class="section-note">${esc(warnings.join(" "))}</p>`
            : "");
    }
    if (
      document
        .querySelector('[data-panel="search"]')
        ?.hasAttribute("hidden") === false &&
      !document.querySelector("#global-search")
    ) {
      const pages = Math.max(1, Math.ceil(results.length / 20));
      page = Math.min(page, pages);
      $("#all-search-results").innerHTML =
        `<div class="page-heading compact"><div><h1>Resultados de búsqueda</h1><p>${term ? `«${esc(term)}» · ${results.length} resultados` : "Escribe lo que quieres encontrar."}</p></div><button class="button secondary" data-search-again>Cambiar búsqueda</button></div>${warnings.length ? `<p class="section-note">${esc(warnings.join(" "))}</p>` : ""}<div class="panel search-result-list">${
          results
            .slice((page - 1) * 20, page * 20)
            .map((r, i) => row(r, (page - 1) * 20 + i))
            .join("") ||
          `<p class="empty-state">${loading ? "Buscando…" : "No encontramos resultados."}</p>`
        }</div>${pages > 1 ? `<div class="pagination"><span>Nota ${page} de ${pages}</span><div><button class="button secondary" data-search-page="${page - 1}" ${page === 1 ? "disabled" : ""}>← Anterior</button><button class="button secondary" data-search-page="${page + 1}" ${page === pages ? "disabled" : ""}>Siguiente →</button></div></div>` : ""}`;
    }
  }
  function open() {
    pageSnapshot =
      document
        .querySelector('[data-panel="search"]')
        ?.hasAttribute("hidden") === false
        ? { term, results, warnings, page }
        : undefined;
    searchOpened = true;
    ctx.modal(
      '<h2>Buscar en el negocio</h2><label>Buscar en este negocio<input id="global-search" type="search" maxlength="120" placeholder="Pedidos, tareas, documentos…" autocomplete="off"/></label><div id="search-results" class="search-results"></div>',
    );
    term = "";
    results = [];
    warnings = [];
    serial++;
    paint();
    $("#global-search").oninput = (e) => {
      clearTimeout(timer);
      const value = (e.target as HTMLInputElement).value;
      serial++;
      term = value.trim().slice(0, 120);
      results = term ? local(term) : [];
      warnings = [];
      loading = !!term;
      paint();
      if (!value.trim()) {
        void search("");
        return;
      }
      timer = setTimeout(() => void search(value), 220);
    };
  }
  document.querySelector("#editor-dialog")?.addEventListener("close", () => {
    if (!searchOpened) return;
    searchOpened = false;
    clearTimeout(timer);
    serial++;
    loading = false;
    if (pageSnapshot) {
      ({ term, results, warnings, page } = pageSnapshot);
      pageSnapshot = undefined;
      paint();
    }
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b) return;
    if (b.dataset.searchHit !== undefined) {
      const entry = results[Number(b.dataset.searchHit)];
      if (!entry) return;
      pageSnapshot = undefined;
      searchOpened = false;
      serial++;
      clearTimeout(timer);
      ctx.close();
      ctx.navigate(entry);
    }
    if (b.hasAttribute("data-search-all")) {
      pageSnapshot = undefined;
      searchOpened = false;
      ctx.close();
      ctx.show("search");
      paint();
    }
    if (b.hasAttribute("data-search-again")) open();
    if (b.dataset.searchPage) {
      page = Number(b.dataset.searchPage);
      paint();
    }
  });
  return {
    open,
    render: paint,
    currentTerm: () => term,
    setQuery: (q: string) => {
      if (q !== term || !results.length) void search(q);
      else paint();
    },
  };
}
