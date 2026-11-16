import { pollSlices } from "@/lib/saas/poll-chart";
import { awaitingPollVote } from "@/lib/saas/poll-notifications";
import { uiIcon } from "@/lib/saas/icons";
import {
  uid,
  type WorkspaceState,
  type WorkspaceMember,
} from "@/lib/saas/model";
import { isAdmin, canView } from "@/lib/saas/permissions";
import {
  validPollInput,
  pollResults,
} from "../../services/payload/src/poll-policy";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  cloud: () => boolean;
  api: (path: string, init?: RequestInit) => Promise<any>;
  mutate: (f: () => void) => void;
  modal: (html: string) => void;
  close: () => void;
  notify: (s: string) => void;
  refreshNotifications?: () => Promise<void>;
};
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
type Poll = {
  id: string;
  question: string;
  options: string[];
  recipients: string[];
  authorId: string;
  createdAt: string;
  counts: number[];
  total: number;
  myVote?: number;
  canVote: boolean;
};
export function installPolls(ctx: Ctx) {
  let rows: Poll[] = [],
    loading = false;
  const me = () => String(ctx.actor().id);
  async function load() {
    if (ctx.cloud()) rows = (await ctx.api("polls")).docs;
    else
      rows = (ctx.state().polls || [])
        .filter((p) => isAdmin(ctx.actor()) || p.recipients.includes(me()))
        .map((p) => ({
          ...pollResults(p, p.votes, me()),
          canVote: p.recipients.includes(me()),
        }));
  }
  function results(p: Poll, columns = false) {
    if (columns) {
      if (!p.total)
        return '<p class="poll-no-votes">Los resultados aparecerán con el primer voto.</p>';
      const slices = pollSlices(p.options.map((_, i) => p.counts[i] ?? 0));
      return `<div class="poll-column-results" role="group" aria-label="Resultados de la votación">
        <div class="poll-column-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
        <div class="poll-columns" style="--columns:${p.options.length}">${p.options
          .map((option, i) => {
            const { percent, count } = slices[i];
            const label = `${option}: ${percent}% · ${count} ${count === 1 ? "voto" : "votos"}`;
            return `<div class="poll-column" role="img" aria-label="${esc(label)}" title="${esc(label)}">
            <div class="poll-column-track" aria-hidden="true"><span class="poll-column-bar" style="--value:${percent}%;--index:${i}"></span></div>
            <div class="poll-column-label" aria-hidden="true"><strong>${percent}%</strong><span>${esc(option)}</span></div>
          </div>`;
          })
          .join("")}</div></div>`;
    }
    return `<div class="poll-results" role="group" aria-label="Resultados de la votación">${p.options
      .map((o, i) => {
        const percent = p.total ? Math.round((p.counts[i] / p.total) * 100) : 0;
        return `<div class="poll-result"><div><span>${esc(o)}</span><strong>${percent}% · ${p.counts[i]}</strong></div><div class="poll-result-track" aria-hidden="true"><span style="width:${percent}%"></span></div></div>`;
      })
      .join("")}</div>`;
  }
  function summaryCard(p: Poll) {
    const finished = p.total >= p.recipients.length,
      pending = awaitingPollVote(p);
    return `<article class="poll-card poll-summary ${finished ? "poll-finished" : "poll-in-progress"}"><div class="poll-summary-top"><span class="poll-stage">${finished ? "Finalizada" : "En curso"}</span>${p.myVote !== undefined ? '<span class="poll-participated">Ya votaste</span>' : ""}</div><h3>${esc(p.question)}</h3><p class="poll-summary-meta">${p.total} de ${p.recipients.length} ${p.recipients.length === 1 ? "persona ha votado" : "personas han votado"}</p>${finished || p.myVote !== undefined ? results(p) : `<p class="poll-summary-prompt">${pending ? "Tu opinión cuenta. Elige una opción." : "Abre la votación para consultar sus resultados."}</p>`}<footer><button class="button ${finished ? "secondary" : "primary"} poll-enter" data-open-poll="${esc(p.id)}">${pending ? "Votar" : "Ver resultados"}${uiIcon("arrowRight", 16)}</button></footer></article>`;
  }
  function card(p: Poll) {
    return `<article class="poll-card"><div class="poll-card-heading">${uiIcon("list", 20)}<h3>${esc(p.question)}</h3></div><p class="field-hint">${p.total} ${p.total === 1 ? "voto" : "votos"} · ${p.recipients.length} ${p.recipients.length === 1 ? "persona invitada" : "personas invitadas"}</p>${p.canVote && p.myVote === undefined ? `<form data-vote-poll="${esc(p.id)}"><fieldset><legend>Elige una opción</legend>${p.options.map((o, i) => `<label class="poll-option"><input type="radio" name="option" value="${i}" required/><span>${esc(o)}</span></label>`).join("")}</fieldset><button class="button primary" type="submit">Enviar mi voto</button><p class="poll-error" role="alert"></p></form>` : `<p class="poll-vote-confirmation">${p.myVote === undefined ? "Vista de resultados. No estás entre los participantes." : `Tu voto: ${esc(p.options[p.myVote])}`}</p>`}${results(p, true)}</article>`;
  }
  function bind(host: HTMLElement, after: () => void) {
    const charts = host.querySelectorAll(".poll-column-results");
    if (
      charts.length &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting || !entry.target.isConnected) {
              if (entry.isIntersecting)
                entry.target.classList.add("poll-column-visible");
              observer.unobserve(entry.target);
            }
        },
        { threshold: 0.15 },
      );
      charts.forEach((chart) => observer.observe(chart));
    }
    host.querySelectorAll<HTMLFormElement>("[data-vote-poll]").forEach(
      (form) =>
        (form.onsubmit = async (e) => {
          e.preventDefault();
          const p = rows.find((p) => p.id === form.dataset.votePoll),
            choice = new FormData(form).get("option"),
            option = Number(choice);
          if (
            choice === null ||
            !p?.canVote ||
            p.myVote !== undefined ||
            !Number.isInteger(option) ||
            option < 0 ||
            option >= p.options.length
          )
            return;
          const b = form.querySelector<HTMLButtonElement>("button")!;
          if (b.disabled) return;
          b.disabled = true;
          try {
            if (ctx.cloud())
              await ctx.api("polls", {
                method: "POST",
                body: JSON.stringify({ action: "vote", pollId: p.id, option }),
              });
            else
              ctx.mutate(() => {
                const poll = ctx.state().polls?.find((x) => x.id === p.id);
                if (
                  poll?.recipients.includes(me()) &&
                  !poll.votes.some((v) => v.userId === me())
                )
                  poll.votes.push({ userId: me(), option });
              });
            await load();
            paint();
            if (ctx.refreshNotifications)
              await ctx.refreshNotifications().catch(() => {});
            after();
            ctx.notify("Tu voto quedó registrado.");
          } catch (err) {
            form.querySelector(".poll-error")!.textContent =
              err instanceof Error
                ? err.message
                : "No pudimos registrar tu voto.";
            b.disabled = false;
          }
        }),
    );
  }
  function paint() {
    const host = $("#polls-list");
    host.innerHTML =
      rows.map(summaryCard).join("") ||
      '<p class="empty-state">Todavía no hay votaciones. Cuando te inviten, aparecerán aquí y en la campanita.</p>';
    $("#new-poll").hidden = !isAdmin(ctx.actor());
    $("#new-poll").onclick = () => void create();
    host.querySelectorAll<HTMLButtonElement>("[data-open-poll]").forEach(
      (button) =>
        (button.onclick = () =>
          void open(
            button.dataset.openPoll!,
            () => {
              ctx.close();
              void render();
            },
            "Volver a votaciones",
          )),
    );
  }
  async function render() {
    if (loading) return;
    loading = true;
    try {
      await load();
      paint();
    } catch {
      $("#polls-list").innerHTML =
        '<p class="section-note" role="alert">No pudimos cargar las votaciones. Vuelve a entrar para intentarlo otra vez.</p>';
    } finally {
      loading = false;
    }
  }
  async function open(
    id: string,
    back: () => void,
    backLabel = "Volver a notificaciones",
  ) {
    try {
      await load();
      const poll = rows.find((p) => p.id === id);
      const fromBell = backLabel === "Volver a notificaciones";
      if (fromBell && poll && !awaitingPollVote(poll)) {
        back();
        return;
      }
      ctx.modal(
        `<h2>Votación del equipo</h2>${poll ? card(poll) : "<p>Esta votación ya no está disponible o no tienes acceso.</p>"}<button class="subtle-button" id="poll-back">${esc(backLabel)}</button>`,
      );
      $("#poll-back").onclick = back;
      if (poll)
        bind($("#poll-back").parentElement!, () =>
          fromBell ? void back() : void open(id, back, backLabel),
        );
    } catch {
      ctx.notify("No pudimos abrir la votación.");
    }
  }
  async function create() {
    if (!isAdmin(ctx.actor())) return;
    let people: { id: string; name: string }[];
    try {
      people = ctx.cloud()
        ? (await ctx.api("team?directory=notifications")).docs
        : (ctx.state().demoMembers || []).filter(
            (m) => !m.disabled && canView(m, "profile"),
          );
    } catch {
      ctx.notify("No pudimos cargar al equipo.");
      return;
    }
    ctx.modal(
      `<h2>Nueva votación</h2><p>El equipo recibirá un aviso en la campanita. Cada persona puede votar una vez.</p><form id="poll-create"><label>Pregunta<input name="question" required maxlength="180" placeholder="¿Qué vamos a decidir?"/></label><label>Opciones<textarea name="options" required rows="4" placeholder="Una opción por línea (entre 2 y 6)"></textarea></label><label>Participantes<select name="audience"><option value="all">Todo el equipo</option><option value="selected">Elegir personas</option></select></label><fieldset id="poll-people" hidden><legend>¿A quiénes invitas?</legend>${people.map((p) => `<label class="poll-option"><input type="checkbox" name="recipient" value="${esc(p.id)}"/><span>${esc(p.name)}${p.id === me() ? " (tú)" : ""}</span></label>`).join("")}</fieldset><p id="poll-create-error" role="alert"></p><button class="button primary" type="submit">Crear votación</button></form>`,
    );
    $("#poll-create").querySelector<HTMLSelectElement>(
      "[name=audience]",
    )!.onchange = (e) => {
      $("#poll-people").hidden =
        (e.target as HTMLSelectElement).value === "all";
    };
    $<HTMLFormElement>("#poll-create").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement,
        f = new FormData(form),
        body = {
          question: String(f.get("question") || "").trim(),
          options: String(f.get("options") || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          all: f.get("audience") === "all",
          recipients: f.getAll("recipient").map(String),
        };
      if (!validPollInput(body)) {
        $("#poll-create-error").textContent =
          "Escribe una pregunta, de 2 a 6 opciones distintas y elige al menos una persona.";
        return;
      }
      const b = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
      b.disabled = true;
      try {
        if (ctx.cloud())
          await ctx.api("polls", {
            method: "POST",
            body: JSON.stringify(body),
          });
        else
          ctx.mutate(() => {
            const recipients = body.all
                ? people.map((p) => p.id)
                : body.recipients,
              id = uid(),
              createdAt = new Date().toISOString();
            ctx.state().polls ??= [];
            ctx.state().polls!.unshift({
              id,
              question: body.question,
              options: body.options,
              recipients,
              authorId: me(),
              createdAt,
              votes: [],
            });
            ctx.state().notifications ??= [];
            for (const recipientId of recipients)
              ctx.state().notifications!.push({
                id: uid(),
                kind: "poll",
                pollId: id,
                recipientId,
                text: `Nueva votación: ${body.question}`,
                createdAt,
              });
          });
        ctx.close();
        await render();
        await ctx.refreshNotifications?.();
        ctx.notify(
          "Votación creada. Los participantes tienen un aviso en la campanita.",
        );
      } catch (err) {
        $("#poll-create-error").textContent =
          err instanceof Error ? err.message : "No pudimos crear la votación.";
        b.disabled = false;
      }
    };
  }
  function inlineMarkup(id: string) {
    const p = rows.find((p) => p.id === id);
    return p ? card(p) : "";
  }
  function bindInline(host: HTMLElement, after: () => void) {
    bind(host, () => {
      if (!host.isConnected) return;
      const id = host.dataset.inlinePoll!;
      host.innerHTML = inlineMarkup(id);
      after();
    });
  }
  function pendingIds() {
    const candidates = ctx.cloud()
      ? rows
      : (ctx.state().polls || []).map((p) => ({
          ...p,
          canVote: p.recipients.includes(me()),
          total: p.votes.length,
          myVote: p.votes.find((v) => v.userId === me())?.option,
        }));
    return new Set(candidates.filter(awaitingPollVote).map((p) => p.id));
  }
  return { render, open, refresh: load, pendingIds, inlineMarkup, bindInline };
}
