import {uiIcon} from '@/lib/saas/icons';
import type { DirectorySettings } from "../../services/payload/src/directory-preferences";
import { renderTheme } from "@/lib/saas/theme";
import type { WorkspaceState, WorkspaceMember } from "@/lib/saas/model";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  mutate: (f: () => void) => void;
  change: () => number | null;
};
export function installPreferences(ctx: Ctx) {
  const records = new Map<Text, { original: string; shown: string }>();
  let queued = false;
  function get() {
    return ctx.state().focus?.find((f) => f.id === String(ctx.actor().id));
  }
  function update(value: {
    favoriteKeys?: string[];
    directories?: DirectorySettings;
    theme?: "light" | "dark";
    showTaskComments?: boolean;
    showMoney?: boolean;
    taskMode?: "board" | "list";
    privateSections?: ("spaces" | "tasks" | "pages")[];
  }) {
    ctx.mutate(() => {
      ctx.state().focus ??= [];
      let pref = get();
      if (!pref) {
        pref = {
          id: String(ctx.actor().id),
          privateOwner: String(ctx.actor().id),
          selections: [],
        };
        ctx.state().focus!.push(pref);
      }
      Object.assign(pref, value);
    });
  }
  const expression =
    /(?:[$€£]\s?[\d.,]+(?:\s?(?:CLP|USD|EUR))?|[\d.,]+\s(?:CLP|USD|EUR))/g;
  function render() {
    renderTheme(get()?.theme, String(ctx.actor().id));
    const show = get()?.showMoney === true;
    const dark=document.documentElement.dataset.theme==='dark';
    const controls:[string,string,string,string,string][]=[
      ['[data-theme-toggle]',dark?'dark':'light',dark?'moon':'sun',dark?'Cambiar a modo claro':'Cambiar a modo oscuro',dark?'Cambiar a modo claro':'Cambiar a modo oscuro'],
      ['[data-money-toggle]',show?'values':'percent',show?'dollar':'percent',show?'Mostrar porcentajes':'Mostrar montos',show?'Mostrar porcentajes':'Mostrar montos']
    ];
    for(const [selector,mode,icon,label,tooltip] of controls){
      const button=document.querySelector<HTMLButtonElement>(selector);
      if(!button)continue;
      if(button.dataset.mode!==mode){button.innerHTML=uiIcon(icon,17);button.dataset.mode=mode;}
      button.setAttribute('aria-label',label);
      button.dataset.tooltip=tooltip;
    }
    for (const el of document.querySelectorAll("#workspace-main")) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.parentElement?.closest("[contenteditable],input,textarea"))
          continue;
        const text = node.nodeValue || "";
        expression.lastIndex = 0;
        if (expression.test(text)) {
          const previous = records.get(node);
          if (!previous || text !== previous.shown)
            records.set(node, { original: text, shown: text });
        }
      }
    }
    document
      .querySelectorAll<HTMLElement>(".metric-value small")
      .forEach((el) => {
        if (["CLP", "USD", "EUR"].includes(el.textContent?.trim() || ""))
          el.hidden = !show;
      });
    for (const [node, value] of records) {
      if (!node.isConnected) {
        records.delete(node);
        continue;
      }
      const parent = node.parentElement!,
        dashboard = !!parent.closest(
          ".metric-card:first-child,#chart-total,#analytics-content .analytics-stat:first-child,.node-metric",
        );
      const change = dashboard ? ctx.change() : null;
      const hidden = parent.closest("svg")
        ? "—"
        : change === null
          ? "Sin comparación"
          : `${change > 0 ? "+" : ""}${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(change)} %`;
      expression.lastIndex = 0;
      const text = show
        ? value.original
        : parent.closest("svg")
          ? "—"
          : value.original.replace(expression, hidden);
      if (node.nodeValue !== text) node.nodeValue = text;
      value.shown = text;
      parent.classList.toggle("money-masked", !show);
      if (!show)
        parent.title =
          change === null
            ? "Este importe no tiene una comparación con el periodo anterior. Usa el botón de montos del encabezado para verlo."
            : "Variación frente al periodo anterior";
    }
  }
  document.querySelector('[data-theme-toggle]')?.addEventListener('click',()=>update({theme:document.documentElement.dataset.theme==='dark'?'light':'dark'}));
  document.querySelector('[data-money-toggle]')?.addEventListener('click',()=>update({showMoney:get()?.showMoney!==true}));
  const observer = new MutationObserver((mutations) => {
    if (
      queued ||
      !mutations.some(
        (m) =>
          m.type === "childList" ||
          (m.type === "characterData" &&
            /[$€£]|CLP|USD|EUR/.test(m.target.textContent || "")),
      )
    )
      return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render();
    });
  });
  observer.observe(document.querySelector("#workspace-main") || document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return { get, update, render };
}
