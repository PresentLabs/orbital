import { GFM, parser } from "@lezer/markdown";
import { Marked } from "marked";
import type { Page } from "./model.ts";
import { sanitizeRichText } from "./rich-text.ts";

export const wikiPattern = /^\[\[([^\[\]\n|]{1,140})(?:\|([^\[\]\n]{1,140}))?\]\]/;
export const noteMarkdownLimit = 30000;
export const wikiKey = (title: string) => title.normalize("NFC").trim().toLocaleLowerCase("es");
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export const noteSyntax = parser.configure([GFM, {
  defineNodes: ["WikiLink"],
  parseInline: [{
    name: "WikiLink",
    before: "Link",
    parse(context, next, pos) {
      if (next !== 91 || context.char(pos + 1) !== 91 || context.hasOpenLink) return -1;
      const link = wikiPattern.exec(context.slice(pos, Math.min(context.end, pos + 285)));
      return link ? context.addElement(context.elt("WikiLink", pos, pos + link[0].length)) : -1;
    },
  }],
}]);

const markdown = new Marked({
  breaks: true,
  renderer: { html: ({text}) => escape(text), image: ({text}) => escape(text) },
});
export const sameScope = (a: Page, b: Page) => (a.privateOwner || "") === (b.privateOwner || "");

export function wikiReferences(source: string) {
  const references: {from:number;to:number;title:string;label:string}[] = [];
  noteSyntax.parse(source).iterate({enter(node) {
    if (node.name !== "WikiLink") return;
    const [,title,label] = wikiPattern.exec(source.slice(node.from,node.to))!;
    if (title.trim()) references.push({from:node.from,to:node.to,title:title.trim(),label:label?.trim() || title.trim()});
  }});
  return references;
}

export function wikiDestination(page: Page, title: string, pages: Page[]) {
  const remembered = page.wikiTargets?.find(target => wikiKey(target.title) === wikiKey(title));
  if (remembered) return pages.find(target => sameScope(page,target) && target.id === remembered.id);
  const matches = pages.filter(target => sameScope(page,target) && wikiKey(target.title) === wikiKey(title));
  return matches.length === 1 ? matches[0] : undefined;
}

export function wikiTargets(page: Page, source: string, pages: Page[]) {
  const targets = new Map<string, NonNullable<Page["wikiTargets"]>[number]>();
  for (const {title} of wikiReferences(source)) {
    const old = page.wikiTargets?.find(target => wikiKey(target.title) === wikiKey(title));
    const id = old?.id || wikiDestination(page,title,pages)?.id;
    if (id) targets.set(wikiKey(title),{title,id});
  }
  return [...targets.values()];
}

export function renderNoteMarkdown(source: string, reading = false) {
  const references = reading ? wikiReferences(source) : [];
  // Replace only parsed wikilinks. Tokens in code spans and fenced code stay literal.
  let expanded = source;
  let token = "orbitalwikireference";
  while (source.includes(token)) token += "x";
  for (const [index, ref] of [...references.entries()].reverse()) {
    expanded = expanded.slice(0,ref.from) + token + index + "end" + expanded.slice(ref.to);
  }
  const html = sanitizeRichText(markdown.parse(expanded,{async:false}), Infinity);
  return html.replace(new RegExp(token + "(\\d+)end","g"), (_match, index: string) => {
    const ref = references[Number(index)];
    return `<button type="button" class="note-wikilink" data-wiki-title="${escape(ref.title)}">${escape(ref.label)}</button>`;
  });
}

export function noteText(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g," ").trim() || "";
}

const literal = (text: string) => text.replace(/[\\`*_\[\]{}<>~]/g,"\\$&")
  .replace(/^(\s*)([#>+-]|\d+[.)])(?=\s)/gm,"$1\\$2");

export function noteSource(note: Page) {
  if (note.markdown !== undefined) return note.markdown;
  if (!note.bodyHtml) return note.body;
  const root = document.createElement("div");
  root.innerHTML = sanitizeRichText(note.bodyHtml, Infinity);
  function children(node: Node): string { return Array.from(node.childNodes,convert).join(""); }
  function convert(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return literal(node.textContent || "");
    if (!(node instanceof HTMLElement)) return "";
    const name = node.tagName;
    const inside = () => children(node);
    if (/^H[1-6]$/.test(name)) return "#".repeat(Number(name[1])) + " " + inside().trim() + "\n\n";
    if (name === "P") return inside().trim() + "\n\n";
    if (name === "BR") return "\n";
    if (name === "HR") return "\n---\n\n";
    if (name === "STRONG") return "**" + inside() + "**";
    if (name === "EM") return "*" + inside() + "*";
    if (name === "DEL") return "~~" + inside() + "~~";
    if (name === "CODE") {
      const text = node.textContent || "";
      const fence = "`".repeat(Math.max(0,...Array.from(text.matchAll(/`+/g), match => match[0].length)) + 1);
      return fence + " " + text + " " + fence;
    }
    if (name === "PRE") {
      const text = node.textContent || "";
      const fence = "`".repeat(Math.max(2,...Array.from(text.matchAll(/`+/g), match => match[0].length)) + 1);
      return fence + "\n" + text.replace(/\n$/,"") + "\n" + fence + "\n\n";
    }
    if (name === "BLOCKQUOTE") return inside().trim().split("\n").map(line => "> " + line).join("\n") + "\n\n";
    if (name === "A") {
      const url = node.getAttribute("href");
      return url ? "[" + inside() + "](<" + url.replaceAll(">","%3E") + ">)" : inside();
    }
    if (name === "OL" || name === "UL") {
      const start = node instanceof HTMLOListElement ? node.start : 1;
      return Array.from(node.children,(item,index) => {
        const prefix = name === "OL" ? (start + index) + ". " : "- ";
        const checkbox = item.querySelector(":scope > input[type=checkbox]");
        const task = checkbox ? (checkbox.hasAttribute("checked") ? "[x] " : "[ ] ") : "";
        return prefix + task + children(item).trim().replace(/\n/g,"\n" + " ".repeat(prefix.length));
      }).join("\n") + "\n\n";
    }
    if (name === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr"),row => Array.from(row.children,cell => children(cell).trim().replace(/\n/g," ").replaceAll("|","\\|")));
      if (!rows.length) return "";
      rows.splice(1,0,rows[0].map(() => "---"));
      return rows.map(cells => "| " + cells.join(" | ") + " |").join("\n") + "\n\n";
    }
    return inside();
  }
  return children(root).trim();
}
