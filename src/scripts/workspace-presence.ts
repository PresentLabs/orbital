import { validAvatar } from "../../services/payload/src/formats.ts";
import type { WorkspaceState, WorkspaceMember } from "@/lib/saas/model";
export type Presence = {
  id: string;
  userId?: string;
  name: string;
  space: string;
  x: number;
  y: number;
  action?: string;
  nodeId?: string;
};
const palette = [
  "#7350c5",
  "#098767",
  "#b85718",
  "#2266bd",
  "#b12d72",
  "#7c7920",
  "#bd3938",
  "#287d91",
  "#704d37",
  "#526dca",
];
export function presenceColor(id: string, used: string[] = []) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[(hash + i) % palette.length];
    if (!used.includes(c)) return c;
  }
  for (let i = 0; i < 360; i++) {
    const c = `hsl(${(hash + i * 137) % 360} 64% 38%)`;
    if (!used.includes(c)) return c;
  }
  return "#29382d";
}
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  id: string;
  directory: (ids: string[]) => Promise<{ id: string; avatarData?: string }[]>;
  space: () => string;
  visible: () => boolean;
  camera: () => { x: number; y: number; z: number };
  center: (x: number, y: number, nodeId?: string) => void;
};
export function installPresence(ctx: Ctx) {
  const people = new Map<string, Presence & { color: string; seen: number }>(),
    colors = new Map<string, string>();
  const photos = new Map<string, string>(),
    photoRequests = new Map<string, number>();
  let photoBusy = false;
  function picture(id: string, name: string) {
    const local =
      String(ctx.actor().id) === id
        ? ctx.actor().avatarData
        : ctx.state().demoMembers?.find((m) => String(m.id) === id)?.avatarData;
    const photo = local || photos.get(id);
    return validAvatar(photo)
      ? `<img src="${esc(photo)}" alt="${esc(name)}"/>`
      : esc(
          name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join(""),
        );
  }
  async function loadPhotos() {
    if (photoBusy || !ctx.visible()) return;
    const ids = [...new Set(active().map((p) => p.userId || p.id))]
      .filter((id) => Date.now() - (photoRequests.get(id) || 0) > 30000)
      .slice(0, 50);
    if (!ids.length) return;
    ids.forEach((id) => photoRequests.set(id, Date.now()));
    photoBusy = true;
    try {
      for (const member of await ctx.directory(ids))
        if (validAvatar(member.avatarData))
          photos.set(member.id, member.avatarData!);
      render();
    } catch {
    } finally {
      photoBusy = false;
    }
  }
  function color(id: string) {
    if (!colors.has(id))
      colors.set(id, presenceColor(id, [...colors.values()]));
    return colors.get(id)!;
  }
  function active() {
    return [...people.values()].filter(
      (p) => p.space === ctx.space() && Date.now() - p.seen < 6000,
    );
  }
  function label(p: Presence) {
    return p.action === "editing"
      ? "Editando"
      : p.action === "moving"
        ? "Moviendo"
        : "Explorando";
  }
  function cursorName(name:string) {
    const [first,...rest]=name.trim().split(/\s+/);
    return first + (rest[0] ? " " + [...rest[0]][0].toLocaleUpperCase("es") + "." : "");
  }
  function render() {
    const host = document.querySelector<HTMLElement>("#canvas-members"),
      cursorHost = document.querySelector<HTMLElement>("#presence-cursors");
    if (!host || !cursorHost) return;
    const visible = ctx.visible(),
      members = visible ? active() : [];
    const own = ctx.actor();
    host.innerHTML = `<span class="presence-caption">En este espacio</span><span class="member-avatar own-member" title="${esc(own.name)} · Tú" aria-label="${esc(own.name)} · Tú">${picture(String(own.id), own.name)}</span>${members.map((p) => `<button class="member-avatar tooltip-control" style="--person-color:${p.color}" data-follow-person="${p.id}" aria-label="Centrar en ${esc(p.name)} · ${label(p)}" data-tooltip="${esc(p.name)} · ${label(p)}">${picture(p.userId || p.id, p.name)}</button>`).join("")}`;
    host.querySelectorAll<HTMLElement>("[data-follow-person]").forEach(
      (b) =>
        (b.onclick = () => {
          const person = people.get(b.dataset.followPerson!);
          if (person) ctx.center(person.x, person.y, person.nodeId);
        }),
    );
    cursorHost.innerHTML = members
      .map(
        (p) =>
          `<div class="presence-cursor" id="cursor-${p.id}" style="--person-color:${p.color}"><svg width="25" height="30" viewBox="0 0 25 30" aria-hidden="true"><path d="M2 2 22 17l-10 1-5 9Z" fill="${p.color}" stroke="white" stroke-width="2"/></svg><span><b>${esc(cursorName(p.name))}</b></span></div>`,
      )
      .join("");
    document
      .querySelectorAll("[data-presence-id]")
      .forEach((el) => el.remove());
    document.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => {
      const editors = members.filter(
        (p) =>
          p.nodeId === el.dataset.node &&
          ["editing", "moving"].includes(p.action || ""),
      );
      el.classList.toggle("has-remote-editor", !!editors.length);
      if (editors.length)
        el.style.setProperty("--person-color", editors[0].color);
      for (const [index, p] of editors.entries()) {
        const badge = document.createElement("span");
        badge.className = "node-presence";
        badge.dataset.presenceId = p.id;
        badge.style.bottom = `calc(100% + ${6 + index * 22}px)`;
        badge.style.setProperty("--person-color", p.color);
        badge.textContent = p.name + " · " + label(p).toLowerCase();
        el.append(badge);
      }
    });
    position();
    void loadPhotos();
  }
  function position() {
    const c = ctx.camera();
    for (const p of active()) {
      const el = document.getElementById("cursor-" + p.id);
      if (el) {
        el.style.left = c.x + p.x * c.z + "px";
        el.style.top = c.y + p.y * c.z + "px";
      }
    }
  }
  function receive(p: Presence) {
    if (
      !p ||
      p.id === ctx.id ||
      !ctx.visible() ||
      !/^[-\w]{1,100}$/.test(p.id) ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      typeof p.name !== "string"
    )
      return;
    const key = p.userId || p.id;
    for (const [id, person] of people)
      if (person.userId === key && id !== p.id) people.delete(id);
    people.set(p.id, {
      ...p,
      userId: key,
      name: p.name.slice(0, 80),
      color: color(key),
      seen: Date.now(),
    });
    render();
  }
  setInterval(() => {
    let changed = false;
    for (const [id, p] of people)
      if (Date.now() - p.seen >= 6000) {
        people.delete(id);
        changed = true;
      }
    if (changed) render();
  }, 1500);
  return { receive, render, position };
}
