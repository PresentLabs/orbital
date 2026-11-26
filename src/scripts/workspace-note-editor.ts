import { EditorState, Compartment, Prec, type Range } from "@codemirror/state";
import { EditorView, Decoration, keymap, placeholder, WidgetType } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, completionStatus, type Completion } from "@codemirror/autocomplete";
import type { Page } from "@/lib/saas/model";
import { matchesSearch, searchRelevance } from "@/lib/saas/search";
import { sanitizeRichText } from "@/lib/saas/rich-text";
import { noteSource, noteSyntax, noteMarkdownLimit, renderNoteMarkdown, wikiDestination, wikiKey, wikiPattern, sameScope } from "@/lib/saas/note-markdown";

type Mode = "live" | "source" | "reading";
type EditorOptions = {
  note: Page;
  pages: () => Page[];
  editable: boolean;
  save: (source: string) => void;
  open: (id: string) => void;
  create: (title: string) => Page | undefined;
};
const styles: Record<string,string> = {
  StrongEmphasis:"note-md-strong", Emphasis:"note-md-emphasis", Strikethrough:"note-md-strike",
  InlineCode:"note-md-code", CodeText:"note-md-code", Link:"note-md-link", Blockquote:"note-md-quote",
};
const punctuation = new Set(["EmphasisMark","StrikethroughMark","CodeMark","HeaderMark","QuoteMark"]);

class InlineWidget extends WidgetType {
  constructor(readonly text: string, readonly style: string) { super(); }
  eq(other: InlineWidget) { return this.text === other.text && this.style === other.style; }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.style;
    span.textContent = this.text;
    return span;
  }
}

function livePreview(state: EditorState) {
  const active = state.selection.ranges.map(range => ({
    from:state.doc.lineAt(range.from).from, to:state.doc.lineAt(range.to).to,
  }));
  const decorations: Range<Decoration>[] = [];
  const hidden = (from: number, to: number) => !active.some(range => from <= range.to && to >= range.from);
  noteSyntax.parse(state.doc.toString()).iterate({enter(node) {
    const {name,from,to} = node;
    const heading = /^ATXHeading([1-6])$/.exec(name);
    if (heading) {
      decorations.push(Decoration.line({class:"note-md-heading note-md-h" + heading[1]}).range(state.doc.lineAt(from).from));
    } else if (styles[name] && to > from) {
      decorations.push(Decoration.mark({class:styles[name]}).range(from,to));
    }
    if (!hidden(from,to)) return;
    if (punctuation.has(name) && node.node.parent?.name !== "FencedCode") {
      const end = name === "HeaderMark" && state.sliceDoc(to,to+1) === " " ? to + 1 : to;
      decorations.push(Decoration.replace({}).range(from,end));
    } else if (name === "WikiLink") {
      const [,title,label] = wikiPattern.exec(state.sliceDoc(from,to))!;
      decorations.push(Decoration.replace({widget:new InlineWidget(label || title,"note-md-link")}).range(from,to));
      return false;
    } else if (name === "ListMark" && /^[-*+]$/.test(state.sliceDoc(from,to))) {
      decorations.push(Decoration.replace({widget:new InlineWidget("•","note-md-marker")}).range(from,to));
    } else if (name === "TaskMarker") {
      decorations.push(Decoration.replace({widget:new InlineWidget(state.sliceDoc(from,to).includes(" ") ? "☐" : "☑","note-md-marker")}).range(from,to));
    }
  }});
  return Decoration.set(decorations, true);
}

export function mountNoteEditor(host: HTMLElement, options: EditorOptions) {
  const {note} = options;
  let source = noteSource(note);
  let mode: Mode = options.editable ? "live" : "reading";
  let editing: EditorView | undefined;
  const presentation = new Compartment();
  const preview = host.querySelector<HTMLElement>(".note-reading")!;
  const surface = host.querySelector<HTMLElement>(".note-editing")!;
  const buttons = [...host.querySelectorAll<HTMLButtonElement>("[data-note-mode]")];
  const scoped = () => options.pages().filter(page => page.id !== note.id && sameScope(note,page));
  const follow = (title: string) => {
    const existing = wikiDestination(note,title,options.pages());
    if (existing) { options.open(existing.id); return; }
    if (scoped().some(page => wikiKey(page.title) === wikiKey(title))) return;
    const created = options.create(title);
    if (created) options.open(created.id);
  };
  const read = () => {
    const legacy = note.markdown === undefined && note.bodyHtml && source === noteSource(note);
    preview.innerHTML = legacy ? sanitizeRichText(note.bodyHtml || "") : renderNoteMarkdown(source,true);
    for (const link of preview.querySelectorAll<HTMLButtonElement>("[data-wiki-title]")) {
      const title = link.dataset.wikiTitle!;
      const exists = wikiDestination(note,title,options.pages());
      link.classList.toggle("is-unresolved",!exists);
      if (!exists) {
        link.disabled = !options.editable || scoped().some(page => wikiKey(page.title) === wikiKey(title));
        link.title = link.disabled ? "Nota no disponible" : "Crear " + title;
      }
      link.onclick = () => follow(title);
    }
    const marks: number[] = [];
    noteSyntax.parse(source).iterate({enter(node) { if (node.name === "TaskMarker") marks.push(node.from + 1); }});
    preview.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input,index) => {
      const pos = marks[index];
      input.disabled = pos === undefined || !editing || note.markdown === undefined && Boolean(legacy);
      input.onchange = () => {
        editing?.dispatch({changes:{from:pos,to:pos+1,insert:input.checked ? "x" : " "}});
        preview.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index]?.focus();
      };
    });
  };
  const changeMode = (next: Mode, focus = true) => {
    mode = next;
    buttons.forEach(button => button.setAttribute("aria-pressed",String(button.dataset.noteMode === mode)));
    preview.hidden = mode !== "reading";
    surface.hidden = mode === "reading";
    editing?.dispatch({effects:presentation.reconfigure(mode === "live" ? EditorView.decorations.compute(["doc","selection"],livePreview) : [])});
    if (mode === "reading") read();
    else if (focus) editing?.focus();
  };

  if (options.editable) {
    editing = new EditorView({
      parent:surface,
      doc:source,
      extensions:[
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({"aria-label":"Contenido","data-entity-field":"body","data-note-editor-content":""}),
        placeholder("Escribe en Markdown. Usa [[ para enlazar una nota."),
        presentation.of([]),
        EditorState.phrases.of({Completions:"Sugerencias de notas"}),
        history(),
        EditorState.changeFilter.of(transaction => transaction.newDoc.length <= noteMarkdownLimit || transaction.newDoc.length < transaction.startState.doc.length),
        autocompletion({
          override:[context => {
            const token = context.matchBefore(/\[\[[^\[\]\n|]{0,140}/);
            if (!token || context.state.sliceDoc(token.from-1,token.from) === "\\") return null;
            const syntax = noteSyntax.parse(context.state.doc.toString()).resolveInner(context.pos,-1);
            for (let parent: typeof syntax | null = syntax; parent; parent = parent.parent)
              if (["InlineCode","FencedCode","CodeBlock","Link"].includes(parent.name)) return null;
            const query = token.text.slice(2).trim();
            const eligible = scoped().filter(page => !/[[\]|\n]/.test(page.title));
            const candidates: Completion[] = eligible.filter(page => matchesSearch(query,page.title))
              .sort((a,b) => searchRelevance(query,b.title)-searchRelevance(query,a.title))
              .slice(0,12).map(page => ({label:page.title,apply:"[[" + page.title + "]]"}));
            if (query && !eligible.some(page => wikiKey(page.title) === wikiKey(query))) {
              candidates.push({label:query,detail:" · Crear nota",apply(view,_option,from,to) {
                const created = options.create(query);
                if (created) view.dispatch({changes:{from,to,insert:"[[" + created.title + "]]"},selection:{anchor:from+created.title.length+4}});
              }});
            }
            return candidates.length ? {from:token.from,to:token.to,options:candidates,filter:false} : null;
          }],
          maxRenderedOptions:8,
          interactionDelay:0,
        }),
        Prec.high(keymap.of([
          ...[["Mod-b","**"],["Mod-i","*"]].map(([key,marker]) => ({key,run(view: EditorView) {
            const selection = view.state.selection.main;
            const text = view.state.sliceDoc(selection.from,selection.to);
            const insert = marker + text + marker;
            view.dispatch({
              changes:{from:selection.from,to:selection.to,insert},
              selection:{anchor:selection.from+marker.length,head:selection.to+marker.length},
            });
            return true;
          }})),
          ...["Backspace","Delete"].map(key => ({key,run(view: EditorView) {
            const selection = view.state.selection.main;
            if (!selection.empty) return false;
            const line = view.state.doc.lineAt(selection.head);
            const marker = /^\s*(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/.exec(line.text);
            if (!marker || selection.head !== line.from + marker[0].length) return false;
            const syntax = noteSyntax.parse(view.state.doc.toString()).resolveInner(selection.head,-1);
            for (let parent: typeof syntax | null = syntax; parent; parent = parent.parent)
              if (["FencedCode","CodeBlock"].includes(parent.name)) return false;
            view.dispatch({changes:{from:line.from,to:selection.head}});
            return true;
          }})),
          {key:"Enter",run(view) {
            if (completionStatus(view.state) === "active") return false;
            const selection = view.state.selection.main;
            if (!selection.empty) return false;
            const line = view.state.doc.lineAt(selection.head);
            const match = /^(\s*)([-+*]|(\d+)[.)])([ \t]+)(\[[ xX]\][ \t]+)?(.*)$/.exec(line.text);
            if (!match || selection.head !== line.to) return false;
            let syntax = noteSyntax.parse(view.state.doc.toString()).resolveInner(line.from + match[1].length + 1,-1);
            while (syntax.parent && syntax.name !== "ListItem") syntax = syntax.parent;
            if (syntax.name !== "ListItem") return false;
            if (!match[6].trim()) view.dispatch({changes:{from:line.from,to:line.to}});
            else {
              const prefix = match[3] ? Number(match[3]) + 1 + match[2].at(-1)! : match[2];
              const insert = "\n" + match[1] + prefix + match[4] + (match[5] ? "[ ] " : "");
              view.dispatch({changes:{from:line.to,insert},selection:{anchor:line.to+insert.length}});
            }
            return true;
          }},
        ])),
        keymap.of([...defaultKeymap,...historyKeymap]),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          source = update.state.doc.toString();
          options.save(source);
          if (mode === "reading") read();
        }),
        EditorView.domEventHandlers({
          click(event,view) {
            if (!(event.metaKey || event.ctrlKey)) return false;
            const pos = view.posAtCoords({x:event.clientX,y:event.clientY});
            if (pos === null) return false;
            const ref = noteSyntax.parse(source).resolveInner(pos,1);
            if (ref.name !== "WikiLink") return false;
            follow(wikiPattern.exec(source.slice(ref.from,ref.to))![1].trim());
            return true;
          },
        }),
      ],
    });
  }
  host.addEventListener("keydown",event => {
    if (event.defaultPrevented || !options.editable || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "e") return;
    event.preventDefault();
    const next = mode === "reading" ? "live" : "reading";
    changeMode(next);
    if (next === "reading") buttons.find(button => button.dataset.noteMode === next)?.focus();
  });
  buttons.forEach(button => button.onclick = () => changeMode(button.dataset.noteMode as Mode));
  changeMode(mode,false);
  return {destroy:() => editing?.destroy(),focus:() => editing?.focus()};
}
