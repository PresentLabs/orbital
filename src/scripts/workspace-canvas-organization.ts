import {
  bounds,
  motionProfiles,
  reorderMembers,
  stackLayout,
} from "@/lib/saas/canvas-organization";
import { freePosition, overlaps, type Rect } from "@/lib/saas/canvas-layout";
import { uid, type CanvasNode } from "@/lib/saas/model";
import { uiIcon } from "@/lib/saas/icons";

type Context = {
  current: () => CanvasNode[];
  preview: (node: CanvasNode) => string;
  space: () => string;
  zoom: () => number;
  rect: (node: CanvasNode) => Rect;
  writable: () => boolean;
  mutate: (fn: () => void) => void;
  remove: (id: string) => void;
  render: (groupTransition?: boolean) => void;
  notify: (text: string) => void;
  reveal: (rects: Rect[]) => void;
  add: (node: CanvasNode) => void;
  folders: () => (Rect & {groupId?: string; groupOffset?: { x: number; y: number }; title: string})[];
};

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const container = (n: CanvasNode) =>
  n.spatial?.type === "group" || n.spatial?.type === "stack";
const nodeEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
type Target = { id: string; kind: "stack" | "reorder" | "attach" };

export const canvasHoverRepulsion = 28;

export function canvasNeighborOffset(origin: DOMRect, card: DOMRect, strength: number) {
  const x = card.left + card.width / 2 - origin.left - origin.width / 2;
  const y = card.top + card.height / 2 - origin.top - origin.height / 2;
  const distance = Math.hypot(x, y);
  if (distance < 1 || distance >= 520) return;
  const shift = strength * (1 - distance / 520) ** 1.5;
  return { x: x / distance * shift, y: y / distance * shift };
}

export function canvasProfile(n: CanvasNode) {
  if (n.spatial?.type === "web") return "web";
  if (n.spatial?.type === "media" || n.image?.startsWith("data:image/gif"))
    return "media";
  if (n.kind === "image") return "image";
  if (n.kind === "note") return "note";
  if (n.kind === "tasks") return "checklist";
  return "document";
}

export function installCanvasOrganization(ctx: Context) {
  const selected = new Set<string>(),
    open = new Set<string>();
  const placed = new Map<string, Rect>(),
    widths = new Map<string, number>();
  const dimensions = new Map<string, { width: number; height: number }>();
  const animations = new WeakMap<Element, Animation>();
  let space = "",
    target: Target | undefined,
    suppressFan = "";
  const frame = document.querySelector<HTMLElement>("#canvas-frame")!;
  const toolbar = document.querySelector<HTMLElement>(
    "#canvas-selection-actions",
  )!;
  const active = () =>
    !frame.closest("[hidden]") && !frame.classList.contains("canvas-detail-open") &&
    document.body.classList.contains("canvas-fullscreen");
  const owner = (id: string) =>
    ctx.current().find((n) => container(n) && n.spatial?.members?.includes(id));
  const members = (n: CanvasNode) =>
    (n.spatial?.members ?? []).flatMap((id) => {
      const child = ctx.current().find((c) => c.id === id);
      return child && !container(child) && owner(id)?.id === n.id
        ? [child]
        : [];
    });
  const attachedNotes = (id: string, cards = ctx.current()) =>
    cards.filter(card => card.attachedTo === id);
  const supports = (cards: CanvasNode[]) => {
    const ids = new Set(cards.map(card => card.id));
    return cards.filter(card => !card.attachedTo || !ids.has(card.attachedTo));
  };
  const shown = (n: CanvasNode) => {
    if (container(n)) return true;
    const parent = owner(n.id);
    return !parent || open.has(parent.id);
  };
  const isDimmed = (id: string) => open.size > 0 && !open.has(id) && !open.has(owner(id)?.id ?? "");
  const activeGroup = () => open.values().next().value;
  const canSelect = (id: string) => !open.size || open.has(id) || open.has(owner(id)?.id ?? "");
  function insert(cards: CanvasNode[]) {
    const group = ctx.current().find(node => open.has(node.id));
    const ids = group?.spatial?.members ?? [];
    if (group?.spatial && ids.length + cards.length > 100) {
      ctx.notify("El grupo admite hasta 100 tarjetas.");
      return false;
    }
    ctx.mutate(() => {
      cards.forEach(ctx.add);
      if (group?.spatial) group.spatial.members = [...ids, ...cards.map(card => card.id)];
    });
    return true;
  }
  const controls = () => {
    for (const el of frame.querySelectorAll<HTMLElement>("[data-node]")) {
      const checked = selected.has(el.dataset.node!);
      el.classList.toggle("spatial-selected", checked);
      const dimmed = isDimmed(el.dataset.node!);
      el.classList.toggle("canvas-group-muted", dimmed);
      el.inert = dimmed;
      el.classList.toggle("canvas-group-member", placed.has(el.dataset.node!));
      el.classList.toggle("canvas-group-active", open.has(el.dataset.node!));
    }
    const count = selected.size;
    toolbar.hidden = !count || !ctx.writable();
    toolbar.querySelector("span")!.textContent =
      `${count} ${count === 1 ? "seleccionado" : "seleccionados"}`;
    frame
      .querySelector("[data-spatial-action=stack]")
      ?.classList.toggle("can-organize", eligibleSelection().length >= 2);
  };
  const groupable = (ids: string[]) => {
    const selection = new Set(ids);
    return ctx.current().filter(card =>
      !container(card) && (selection.has(card.id) || (card.attachedTo && selection.has(card.attachedTo))),
    );
  };
  const eligibleSelection = () => groupable([...selected]);
  function select(ids: string[], append = false) {
    if (!append) selected.clear();
    ids.filter(canSelect).forEach((id) => selected.add(id));
    controls();
  }
  function toggle(id: string) {
    if (!canSelect(id)) return;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    controls();
  }
  function prepare() {
    if (space !== ctx.space()) {
      space = ctx.space();
      open.clear();
      widths.clear();
      selected.clear();
      dimensions.clear();
      suppressFan = "";
    }
    const nodes = ctx.current();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of open)
      if (!byId.has(id) || !container(byId.get(id)!)) {
        open.delete(id);
        widths.delete(id);
      }
    for (const id of selected)
      if (!byId.has(id) || (!shown(byId.get(id)!) || !canSelect(id))) selected.delete(id);
    for (const el of frame.querySelectorAll<HTMLElement>("[data-node]")) {
      if (el.offsetWidth)
        dimensions.set(el.dataset.node!, {
          width: el.offsetWidth,
          height: el.offsetHeight,
        });
    }
    placed.clear();
    const size = (n: CanvasNode) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      width: n.width ?? dimensions.get(n.id)?.width ?? 255,
      height:
        n.height ??
        dimensions.get(n.id)?.height ??
        (n.kind === "image" ? 320 : 208),
    });
    for (const n of nodes.filter(n => container(n) && open.has(n.id))) {
      const cards = members(n);
      const units = supports(cards).map(card => ({
        ...bounds([card, ...attachedNotes(card.id, cards)].map(size)),
        id: card.id,
      }));
      const folders = ctx.folders().filter(folder => folder.groupId === n.id);
      const slots = stackLayout(size(n), [...units, ...folders], widths.get(n.id) ?? 830);
      slots.forEach((slot, index) => {
        const unit = units[index];
        if (!unit) {
          const offset = folders[index - units.length]?.groupOffset;
          placed.set(slot.id, offset ? { ...slot, x: slot.x + offset.x, y: slot.y + offset.y } : slot);
          return;
        }
        const host = size(byId.get(slot.id)!);
        placed.set(slot.id, { ...host, x: slot.x + host.x - unit.x, y: slot.y + host.y - unit.y });
      });
    }
    for (const n of nodes.filter(card=>card.attachedTo)) {
      const parent=byId.get(n.attachedTo!);
      const r=parent && placed.get(parent.id);
      if (parent && r && owner(parent.id)?.id === owner(n.id)?.id)
        placed.set(n.id,{...size(n),x:r.x+n.x-parent.x,y:r.y+n.y-parent.y});
    }
  }
  function refreshGeometry() {
    if (!open.size) return;
    prepare();
    for (const [id, r] of placed) {
      const el = nodeEl(id) || frame.querySelector<HTMLElement>(`[data-canvas-folder="${CSS.escape(id)}"]`);
      if (el) {
        el.style.left = r.x + "px";
        el.style.top = r.y + "px";
      }
    }
  }
  function visualize(
    el: Element,
    frames: Keyframe[],
    duration: number,
    delay = 0,
  ) {
    animations.get(el)?.cancel();
    if (reduced()) return undefined;
    const animation = el.animate(frames, {
      duration,
      delay,
      easing: "cubic-bezier(.2,.75,.25,1)",
      fill: "backwards",
    });
    animations.set(el, animation);
    return animation;
  }
  const face = (id: string) =>
    nodeEl(id)?.querySelector<HTMLElement>(".canvas-node-face");
  function fan(n: CanvasNode) {
    const cards = members(n);
    supports(cards).forEach((child, i) => {
      const r = placed.get(child.id);
      if (!r) return;
      const notes = attachedNotes(child.id, cards);
      const scale = notes.length ? "" : " scale(.88)";
      const folded = {
        transform: `translate(${n.x - r.x}px,${n.y - r.y}px)${scale}`,
        opacity: 0,
      };
      const flat = { transform: "none", opacity: 1 };
      for (const card of [child, ...notes]) {
        const visual = face(card.id);
        if (visual) visualize(visual, [folded, flat], 200, Math.min(i, 5) * 12);
      }
    });
  }
  function interrupt() {
    for (const el of frame.querySelectorAll(".canvas-node-face"))
      animations.get(el)?.cancel();
  }
  function toggleStack(n: CanvasNode, focus = true) {
    interrupt();

    const button = () =>
      nodeEl(n.id)?.querySelector<HTMLElement>("[data-spatial-toggle]");
    const resizePreview = (start: number, end: number) => {
      if (reduced()) return;
      button()?.parentElement?.querySelectorAll(".stack-preview-card").forEach(card => {
        card.animate([{scale:start},{scale:end}], {duration:220,easing:"ease-out"});
      });
    };
    if (!open.has(n.id)) {
      open.clear();
      widths.clear();
      open.add(n.id);
      widths.set(
        n.id,
        Math.min(1050, Math.max(255, (frame.clientWidth - 150) / ctx.zoom())),
      );
      ctx.render(true);
      if (focus) ctx.reveal([ctx.rect(n), ...members(n).map(ctx.rect)]);
      const deck = button();
      if (deck && !reduced()) shiftNeighbors(deck, 78, true);
      fan(n);
      resizePreview(1,1.055);
      if (focus) button()?.focus({ preventScroll: true });
      return;
    }
    open.delete(n.id);
    widths.delete(n.id);
    suppressFan = n.id;
    ctx.render(true);
    if (focus) button()?.focus({ preventScroll: true });
  }
  function closeGroup(focus = true) {
    const group = ctx.current().find(n => open.has(n.id));
    if (!group) return false;
    toggleStack(group, focus);
    return true;
  }
  function openFor(id: string) {
    const parent = owner(id);
    if (parent && !open.has(parent.id)) toggleStack(parent, false);
    else if (!parent && !open.has(id)) closeGroup(false);
  }
  function detach(id: string) {
    for (const n of ctx.current())
      if (container(n) && n.spatial?.members?.includes(id))
        n.spatial.members = n.spatial.members.filter((m) => m !== id);
  }
  function create(
    title?: string,
    ids = Array.from(selected),
    anchorId?: string,
  ) {
    if (!ctx.writable() || open.size) return;
    const all = ctx.current();
    const eligible = groupable(ids);
    if (eligible.length < 2 || eligible.length > 100)
      return ctx.notify("Selecciona entre 2 y 100 tarjetas sueltas.");
    const rects = eligible.map(ctx.rect);
    const box = bounds(rects),
      id = uid();
    const anchor = eligible.find(node => node.id === anchorId);
    const point = anchor ? { x: anchor.x, y: anchor.y }
      : freePosition({id,x:box.x,y:box.y,width:208,height:182}, all.filter(n=>shown(n)&&!eligible.includes(n)).map(ctx.rect));
    ctx.mutate(() => {
      eligible.forEach((n, i) => {
        detach(n.id);
        n.x = rects[i].x;
        n.y = rects[i].y;
      });
      ctx.add({
        id,
        space: ctx.space(),
        kind: "page",
        title: title || "Nuevo grupo",
        body: "",
        ...point,
        spatial: { type: "group", members: eligible.map((n) => n.id) },
      });
      selected.clear();
    });
    nodeEl(id)?.focus({ preventScroll: true });
    {
      const visual = face(id);
      if (visual)
        visualize(
          visual,
          [
            { transform: "translateY(-12px) scale(.96)", opacity: 0.4 },
            { transform: "none", opacity: 1 },
          ],
          240,
        );
    }
  }
  function release(id: string) {
    if (!ctx.writable()) return;
    const n = ctx.current().find((c) => c.id === id);
    if (!n) return;
    const cards = [n, ...attachedNotes(id)].map(card => ({ card, rect: ctx.rect(card) }));
    ctx.mutate(() => {
      for (const { card, rect } of cards) {
        detach(card.id);
        card.x = rect.x;
        card.y = rect.y;
      }
    });
    nodeEl(id)?.focus({ preventScroll: true });
  }
  function removeContainer(id: string) {
    if (!ctx.writable()) return;
    open.delete(id);
    widths.delete(id);
    selected.delete(id);
    ctx.remove(id);
    frame.focus({ preventScroll: true });
  }
  function render(n: CanvasNode, writable: boolean) {
    const list = members(n),
      expanded = open.has(n.id);
    const folders = ctx.folders().filter(folder => folder.groupId === n.id);
    const count = list.length + folders.length;
    const leaders = supports(list);
    const previews = leaders
      .slice(0, 8)
      .map((card, i) => {
        const angle = [3, -8, 9, -12, 13, -16, 17, -19][i];
        const host = ctx.rect(card);
        const overlays = attachedNotes(card.id, list).map(note => {
          const rect = ctx.rect(note);
          return `<div class="stack-preview-note canvas-preview-tile" style="left:${(note.x-card.x)/host.width*100}%;top:${(note.y-card.y)/host.height*100}%;width:${rect.width/host.width*100}%;height:${rect.height/host.height*100}%">${ctx.preview(note)}</div>`;
        }).join("");
        return `<div class="stack-preview-card canvas-preview-tile${overlays ? " stack-preview-composite" : ""}" style="--deck-i:${i};--deck-angle:${angle}deg;--deck-z:${8 - i}">${ctx.preview(card)}${overlays}</div>`;
      })
      .join("") + folders.slice(0, Math.max(0, 8 - leaders.length)).map((folder, index) =>
        `<span class="stack-preview-card" style="--deck-i:${leaders.length+index};--deck-angle:-7deg;--deck-z:${8-leaders.length-index}"><span class="stack-preview-title">${escape(folder.title)}</span><span class="stack-preview-copy">${uiIcon("folder", 24)}</span></span>`
      ).join("");
    return `<div class="stack-deck-shell ${expanded ? "stack-open" : ""} ${suppressFan === n.id ? "stack-no-fan" : ""}">
      <button class="stack-deck" type="button" data-spatial-toggle="${escape(n.id)}" ${writable ? `data-stack-drop="${escape(n.id)}"` : ""} aria-expanded="${expanded}" aria-label="${expanded ? "Cerrar grupo" : "Abrir grupo"}: ${escape(n.title)} · ${count} elementos">
      </button>
      <div class="stack-preview-cards" aria-hidden="true" inert>${previews || '<span class="stack-preview-card stack-preview-empty">Grupo vacío</span>'}</div>
      <div class="stack-title-line"><span class="stack-deck-count" aria-label="${count} elementos">${count}</span><span ${writable ? 'data-title-editable="true"' : ""} data-inline-title="${escape(n.id)}">${escape(n.title)}</span></div>
      ${writable ? `<button type="button" class="stack-disband" data-spatial-unstack="${escape(n.id)}">Desagrupar</button><span class="stack-drop-label" aria-hidden="true">Suelta para añadir</span>` : ""}
    </div>`;
  }
  function layoutDeck(deck: HTMLElement) {
    const r = deck.getBoundingClientRect(),
      limits = frame.getBoundingClientRect(),
      z = ctx.zoom();
    const cards = Array.from(
      deck.parentElement!.querySelectorAll<HTMLElement>(".stack-preview-card"),
    );
    const sizes = cards.map(card => ({
      width: Number(card.style.getPropertyValue("--natural-width")) || 174,
      height: Number(card.style.getPropertyValue("--natural-height")) || 120,
    }));
    if (!cards.length) return;
    const available = Math.max(1, limits.width - 100);
    const zoomScale = Math.min(Math.max(1, Math.min(1.5, 0.78 / z)), available / (190 * z));
    const columns = Math.max(1, Math.min(cards.length === 3 ? 2 : cards.length,
      Math.floor(available / (190 * z * zoomScale))));
    const rows = Math.ceil(cards.length / columns);
    const scale = Math.min(zoomScale, Math.max(1, limits.height - 90) / (rows * 140 * z));
    const cardsOnScreen = sizes.map(({ width, height }) => {
      const cardScale = scale * Math.min(174 / width, 120 / height, 1);
      return { width: width * cardScale * z, height: height * cardScale * z, scale: cardScale };
    });
    const gap = 12 * scale * z;
    const triangle = cards.length === 3 && columns === 2;
    const cardRows = triangle ? [cardsOnScreen.slice(0, 1), cardsOnScreen.slice(1)] :
      Array.from({ length: rows }, (_, index) => cardsOnScreen.slice(index * columns, (index + 1) * columns));
    const rowHeights = cardRows.map(row => Math.max(...row.map(card => card.height)));
    const height = rowHeights.reduce((sum, value) => sum + value, 0) + gap * (rows - 1);
    let top = Math.max(limits.top + 10, Math.min(r.top + 12, limits.bottom - height - 65));
    let index = 0;
    cardRows.forEach((row, rowIndex) => {
      const width = row.reduce((sum, card) => sum + card.width, 0) + gap * (row.length - 1);
      let left = Math.max(limits.left + 12,
        Math.min(Math.max(r.left + (r.width - width) / 2, limits.left + 78), limits.right - width - 12));
      for (const size of row) {
        const card = cards[index++];
        card.style.setProperty("--fan-scale", String(size.scale));
        card.style.setProperty("--fan-x", `${(left - r.left) / z - 12}px`);
        card.style.setProperty("--fan-y", `${(top + (rowHeights[rowIndex] - size.height) / 2 - r.top) / z - 12}px`);
        left += size.width + gap;
      }
      top += rowHeights[rowIndex] + gap;
    });
  }

  function clearHover() {
    frame.querySelectorAll<HTMLElement>(".canvas-stack-neighbor").forEach(el => el.classList.remove("canvas-stack-neighbor"));
  }
  frame.addEventListener("pointerover", event => {
    if (event.pointerType === "touch" || reduced() || !active() || open.size || frame.classList.contains("is-panning")) return;
    const shell = (event.target as Element).closest<HTMLElement>(".stack-deck-shell:not(.stack-no-fan)");
    if (!shell || (event.relatedTarget instanceof Node && shell.contains(event.relatedTarget))) return;
    const deck = shell.querySelector<HTMLElement>(".stack-deck")!;
    layoutDeck(deck);
    clearHover();
    shiftNeighbors(deck, canvasHoverRepulsion);
  });
  function shiftNeighbors(deck: HTMLElement, strength: number, onlyOutside = false) {
    const origin = deck.getBoundingClientRect();
    const group = deck.closest("[data-node]");
    const zoom = ctx.zoom();
    for (const card of frame.querySelectorAll<HTMLElement>("#canvas-nodes > :is([data-node],[data-canvas-folder])")) {
      if (card === group || onlyOutside && !card.classList.contains("canvas-group-muted")) continue;
      const offset = canvasNeighborOffset(origin, card.getBoundingClientRect(), strength);
      if (!offset) continue;
      card.style.setProperty("--neighbor-x", `${offset.x / zoom}px`);
      card.style.setProperty("--neighbor-y", `${offset.y / zoom}px`);
      card.classList.add("canvas-stack-neighbor");
    }
  }
  frame.addEventListener("pointerout", event => {
    const shell = (event.target as Element).closest(".stack-deck-shell");
    if (!open.size && shell && !(event.relatedTarget instanceof Node && shell.contains(event.relatedTarget))) clearHover();
  });
  frame.addEventListener("pointerdown", () => { if (!open.size) clearHover(); });
  frame.addEventListener("focusin", (e) => {
    if ((e.target as Element).matches(".stack-deck"))
      layoutDeck(e.target as HTMLElement);
  });

  frame.addEventListener("pointerout", (e) => {
    const shell = (e.target as Element).closest(".stack-no-fan");
    if (!shell || (e.relatedTarget instanceof Node && shell.contains(e.relatedTarget))) return;
    shell.classList.remove("stack-no-fan");
    suppressFan = "";
  });
  function memberActions(n: CanvasNode) {
    const parent = owner(n.id);
    if (!parent || !open.has(parent.id)) return "";
    return `<div class="canvas-stack-actions"><button type="button" data-stack-release="${escape(n.id)}">Sacar del grupo</button></div>`;
  }
  function moving(n: CanvasNode) {
    const result = new Set<string>(selected.has(n.id) ? selected : [n.id]);
    for (const c of ctx.current())
      if (result.has(c.id) && container(c))
        members(c).forEach((m) => result.add(m.id));
    for (const n of ctx.current()) if (n.attachedTo && result.has(n.attachedTo)) result.add(n.id);
    return ctx.current().filter((c) => result.has(c.id));
  }
  function dropAt(x: number, y: number, movingIds: Set<string>) {
    const hits = document.elementsFromPoint(x, y);
    let next: Target | undefined;
    const items = ctx.current().filter((n) => movingIds.has(n.id));
    const allowed = items.length > 0 && items.every((n) => !container(n));
    if (allowed) {
      for (const hit of hits) {
        const destination =
          hit.closest<HTMLElement>("[data-stack-drop]")?.dataset.stackDrop;
        if (!destination || movingIds.has(destination)) continue;
        const pile = ctx.current().find((n) => n.id === destination);
        const existing = pile
          ? members(pile).filter((n) => !movingIds.has(n.id)).length
          : 100;
        if (existing + items.length <= 100)
          next = { kind: "stack", id: destination };
        break;
      }
      const leaders = items.filter(n => !n.attachedTo || !movingIds.has(n.attachedTo));
      if (!next && leaders.length === 1) {
        const leader = leaders[0];
        const parent = owner(leader.id);
        if (leader.kind === "note") {
          const support = hits.map(el=>el.closest<HTMLElement>("[data-node]")?.dataset.node)
            .map(id=>ctx.current().find(n=>n.id===id))
            .find(n=>n && n.kind!=="note" && !container(n) && !movingIds.has(n.id) && owner(n.id)?.id===parent?.id);
          if(support) next={kind:"attach",id:support.id};
        }
        if (!next && parent && open.has(parent.id)) {
          const sibling = hits
            .map((el) => el.closest<HTMLElement>("[data-node]")?.dataset.node)
            .map(id => ctx.current().find(card => card.id === id)?.attachedTo || id)
            .find(
              (id) => id && !movingIds.has(id) && owner(id)?.id === parent.id,
            );
          if (sibling) next = { kind: "reorder", id: sibling };
        }
      }
    }
    if (target?.id !== next?.id || target?.kind !== next?.kind) {
      if (target)
        nodeEl(target.id)?.classList.remove(
          "canvas-drop-target",
          "canvas-reorder-target",
        );
      target = next;
      if (target)
        nodeEl(target.id)?.classList.add(
          target.kind !== "reorder"
            ? "canvas-drop-target"
            : "canvas-reorder-target",
        );
    }
    return target;
  }
  function clearDrop() {
    if (target)
      nodeEl(target.id)?.classList.remove(
        "canvas-drop-target",
        "canvas-reorder-target",
      );
    target = undefined;
  }
  function commit(
    items: { node: CanvasNode; start: Rect }[],
    dx: number,
    dy: number,
    drop?: Target,
    correctOverlap = true,
  ) {
    const ids = new Set(items.map((item) => item.node.id));
    const lead = items.find(({node}) => !node.attachedTo || !ids.has(node.attachedTo));
    if (drop?.kind === "attach" && lead?.node.kind === "note") {
      const host = ctx.current().find(n=>n.id===drop.id);
      if (!host) return;
      const r = ctx.rect(host);
      lead.node.attachedTo = host.id;
      lead.node.x = host.x + lead.start.x + dx - r.x;
      lead.node.y = host.y + lead.start.y + dy - r.y;
      return;
    }
    if (drop?.kind === "reorder" && lead) {
      const parent = owner(lead.node.id);
      if (parent?.spatial?.members)
        parent.spatial.members = reorderMembers(
          parent.spatial.members,
          lead.node.id,
          drop.id,
        );
      return;
    }
    const dest =
      drop?.kind === "stack"
        ? ctx.current().find((n) => n.id === drop.id)
        : undefined;
    const geometry = items
      .filter(({ node }) => shown(node))
      .map(({ start }) => ({ ...start, x: start.x + dx, y: start.y + dy }));
    const box = bounds(geometry);
    const occupied = ctx
      .current()
      .filter((n) => shown(n) && !ids.has(n.id))
      .map(ctx.rect);
    if (
      !dest &&
      correctOverlap &&
      geometry.some((r) => occupied.some((o) => overlaps(r, o, 0)))
    ) {
      const fitted = freePosition(box, occupied, 12);
      dx += fitted.x - box.x;
      dy += fitted.y - box.y;
    }
    for (const { node } of items) {
      const parent = owner(node.id);
      const extracted =
        parent && !ids.has(parent.id);
      if (dest?.spatial) {
        if (parent?.id !== dest.id) {
          detach(node.id);
          dest.spatial.members = [...(dest.spatial.members ?? []), node.id];
          // Retain the saved relative positions when transferring a card and its notes.
        }
      } else if (extracted) {
        if (node.attachedTo && !ids.has(node.attachedTo)) {
          // Keep the card in its group but release a note dragged away from its support.
          delete node.attachedTo;
        }
      } else {
        if (node.attachedTo && !ids.has(node.attachedTo)) delete node.attachedTo;
        node.x += dx;
        node.y += dy;
      }
    }
  }
  function arrive(id: string) {
    const visual = face(id);
    if (visual)
      visualize(
        visual,
        [
          { transform: "translateY(-10px) rotate(-1.4deg)", opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        180,
      );
  }
  function lift(id: string, node: CanvasNode, dx: number, movesWithNote: boolean) {
    const el = face(id);
    if (!el) return;
    animations.get(el)?.cancel();
    animations.delete(el);
    const profile = motionProfiles[canvasProfile(node)];
    el.style.setProperty(
      "--lift-angle",
      movesWithNote ? "0deg" : `${Math.max(-1, Math.min(1, dx / 25)) * profile.angle}deg`,
    );
    el.style.setProperty("--lift-scale", String(movesWithNote ? 1 : profile.scale));
    el.style.setProperty(
      "--lift-shadow",
      `0 ${profile.lift}px ${profile.lift * 2}px #11182738`,
    );
    el.style.setProperty("--lift-time", `${profile.time}ms`);
    nodeEl(id)?.classList.add("canvas-lifted");
  }
  function settle(id: string, from?: string) {
    const visual = face(id);
    const n = ctx.current().find((c) => c.id === id);
    if (visual && n && from && from !== "none")
      visualize(
        visual,
        [{ transform: from }, { transform: "none" }],
        motionProfiles[canvasProfile(n)].time,
      );
  }
  document.addEventListener("click", (e) => {
    if (!active()) return;
    const el = e.target as Element;
    const releaseButton = el.closest<HTMLElement>("[data-stack-release]");
    if (releaseButton) release(releaseButton.dataset.stackRelease!);
  });
  document.addEventListener("keydown", (e) => {
    if (!active() || !ctx.writable() || document.querySelector("dialog[open]"))
      return;
    const el = e.target as HTMLElement;
    if (
      (e.metaKey || e.ctrlKey) &&
      !e.altKey &&
      !e.shiftKey &&
      e.key.toLowerCase() === "g" &&
      !el.closest("input,textarea,select,[contenteditable]")
    ) {
      const eligible = eligibleSelection();
      if (eligible.length >= 2) {
        e.preventDefault();
        if (!e.repeat)
          create(
            undefined,
            eligible.map((n) => n.id),
          );
      }
      return;
    }
    if (e.key === "Escape" && selected.size) select([]);
    if (el.matches("[data-node]") && e.altKey && ["ArrowLeft","ArrowUp","ArrowRight","ArrowDown"].includes(e.key)) {
      const id=el.dataset.node!, parent=owner(id), ids=parent?.spatial?.members;
      if (!parent || !ids || !open.has(parent.id)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const previous = e.key === "ArrowLeft" || e.key === "ArrowUp";
      const toward = ids[ids.indexOf(id) + (previous ? -1 : 1)];
      if (toward) {
        ctx.mutate(()=>{parent.spatial!.members=reorderMembers(ids,id,toward);});
        nodeEl(id)?.focus({preventScroll:true});
      }
      return;
    }
    if (el.matches("[data-node]") && e.shiftKey && e.code === "Space") {
      e.preventDefault();
      toggle(el.dataset.node!);
    }
  });
  return {
    interrupt,
    isDimmed,
    activeGroup,
    canSelect,
    insert,
    groupOpen: () => open.size > 0,
    arrive,
    prepare,
    refreshGeometry,
    shown,
    placed,
    openFor,
    closeGroup,
    toggleStack,
    render,
    create,
    removeContainer,
    memberActions,
    controls,
    eligibleSelection,
    select,
    toggle,
    selected,
    moving,
    dropAt,
    clearDrop,
    commit,
    lift,
    settle,
    owner,
    container,
  };
}
