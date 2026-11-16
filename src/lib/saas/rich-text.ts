const colors = new Set([
  "#29382d",
  "#426249",
  "#a54938",
  "#a47527",
  "#3c6b9c",
  "#805aa1",
]);
export function sanitizeRichText(html: string) {
  const source = new DOMParser().parseFromString(html, "text/html");
  const out = document.createElement("div");
  function copy(node: Node, parent: HTMLElement) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.textContent || ""));
      return;
    }
    if (!(node instanceof Element)) return;
    if (
      ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(
        node.tagName,
      )
    )
      return;
    if (node.tagName === "INPUT" && node.getAttribute("type") === "checkbox") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.contentEditable = "false";
      checkbox.setAttribute("aria-label", "Tarea completada");
      checkbox.toggleAttribute("checked", node.hasAttribute("checked"));
      parent.append(checkbox);
      return;
    }
    const tag =
      ({ B: "strong", I: "em", DIV: "p" } as Record<string, string>)[
        node.tagName
      ] || node.tagName.toLowerCase();
    if (!["p", "br", "strong", "em", "h1", "h2", "h3", "span", "ul", "ol", "li", "pre", "code"].includes(tag)) {
      node.childNodes.forEach((n) => copy(n, parent));
      return;
    }
    const el = document.createElement(tag);
    if (tag === "ul" && node.hasAttribute("data-canvas-checklist")) el.setAttribute("data-canvas-checklist", "");
    const color = (node.getAttribute("data-color") || "").toLowerCase();
    if (tag === "span" && colors.has(color)) {
      el.setAttribute("data-color", color);
      el.style.color = color;
    }
    node.childNodes.forEach((n) => copy(n, el));
    parent.append(el);
  }
  source.body.childNodes.forEach((n) => copy(n, out));
  return out.innerHTML.slice(0, 30000);
}
/** Split visual lines into independent blocks, preserving inline formatting. */
export function normalizeEditorBlocks(
  editor: HTMLElement,
  marker?: HTMLElement,
) {
  const out: HTMLElement[] = [];
  let block: HTMLElement | undefined;
  function next(tag = "p") {
    block = document.createElement(tag);
    out.push(block);
  }
  function parent(path: Element[]) {
    let el = block!;
    for (const original of path) {
      const clone = original.cloneNode(false) as HTMLElement;
      el.append(clone);
      el = clone;
    }
    return el;
  }
  function inline(node: Node, path: Element[] = []) {
    if (node === marker) {
      parent(path).append(marker!);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = (node.textContent || "").split("\n");
      parts.forEach((text, i) => {
        if (i) next();
        if (text) parent(path).append(document.createTextNode(text));
      });
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === "BR") {
      next();
      return;
    }
    if (node instanceof HTMLInputElement && node.type === "checkbox") {
      parent(path).append(node);
      return;
    }
    for (const child of Array.from(node.childNodes))
      inline(child, [...path, node]);
  }
  for (const node of Array.from(editor.childNodes)) {
    if (node instanceof HTMLElement && ["UL", "OL", "PRE"].includes(node.tagName)) {
      out.push(node); block = undefined; continue;
    }
    if (
      node instanceof Element &&
      ["P", "DIV", "H1", "H2", "H3"].includes(node.tagName)
    ) {
      next(node.tagName === "DIV" ? "p" : node.tagName.toLowerCase());
      for (const child of Array.from(node.childNodes)) inline(child);
      block = undefined;
    } else {
      if (!block) next();
      inline(node);
    }
  }
  if (!out.length) next();
  for (const paragraph of out)
    if (!paragraph.childNodes.length)
      paragraph.append(document.createElement("br"));
  editor.replaceChildren(...out);
}
export function installRichToolbar() {
  const selector =
    '[data-inline-body][contenteditable="true"],[data-rich-editor][contenteditable="true"]';
  const bar = document.createElement("div");
  bar.id = "rich-toolbar";
  bar.className = "rich-toolbar";
  bar.hidden = true;
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Formato del contenido");
  bar.innerHTML =
    '<select aria-label="Formato del texto"><option value="p">Párrafo</option><option value="h1">Título grande</option><option value="h2">Título</option><option value="h3">Subtítulo</option></select><button type="button" data-rich="strong" aria-label="Negrita"><b>B</b></button><button type="button" data-rich="em" aria-label="Cursiva"><i>I</i></button><button type="button" data-rich="ul" aria-label="Lista con viñetas">• ≡</button><button type="button" data-rich="ol" aria-label="Lista numerada">1. ≡</button><span></span>' +
    [...colors]
      .map(
        (c) =>
          `<button type="button" data-color="${c}" aria-label="Color ${c}" style="--color:${c}" class="rich-color"></button>`,
      )
      .join("");
  document.body.append(bar);
  let editor: HTMLElement | undefined, range: Range | undefined;
  function position() {
    if (!editor || !document.contains(editor) ||
        (editor.closest("#canvas-detail") && (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)))) {
      bar.hidden = true;
      return;
    }
    const rect = range?.getBoundingClientRect(),
      fallback = editor.getBoundingClientRect(),
      point = rect && rect.height ? rect : fallback;
    bar.hidden = false;
    bar.style.left =
      Math.max(10, Math.min(innerWidth - bar.offsetWidth - 10, point.left)) +
      "px";
    bar.style.top = Math.max(12, point.top - bar.offsetHeight - 10) + "px";
  }
  document.addEventListener("selectionchange", () => {
    const selection = getSelection(),
      anchor = selection?.anchorNode,
      el = (
        anchor instanceof Element ? anchor : anchor?.parentElement
      )?.closest<HTMLElement>(selector);
    if (el && selection?.rangeCount) {
      editor = el;
      range = selection.getRangeAt(0).cloneRange();
      position();
    } else if (!bar.contains(document.activeElement)) bar.hidden = true;
  });
  document.addEventListener("focusin", (e) => {
    if ((e.target as HTMLElement).matches(selector)) {
      editor = e.target as HTMLElement;
      range = undefined;
      const selection = getSelection();
      if (selection?.rangeCount && editor.contains(selection.anchorNode))
        range = selection.getRangeAt(0).cloneRange();
      position();
    }
  });
  function notify() {
    editor?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function bookmark() {
    if (!editor || !range) return;
    const marker = document.createElement("span");
    marker.dataset.caret = "true";
    const caret = range.cloneRange();
    caret.collapse(true);
    caret.insertNode(marker);
    normalizeEditorBlocks(editor, marker);
    const block = marker.closest("p,h1,h2,h3,li") as HTMLElement;
    const restored = document.createRange();
    restored.setStartBefore(marker);
    marker.remove();
    restored.collapse(true);
    return { block, restored };
  }
  function apply(tag: string, color?: string) {
    if (!editor || !range || !editor.contains(range.commonAncestorContainer))
      return;
    editor.focus();
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (["ul", "ol"].includes(tag)) {
      const saved = bookmark();
      if (!saved) return;
      let item: HTMLElement;
      if (saved.block.tagName === "LI") {
        item = saved.block;
        const previous = item.parentElement!;
        if (previous.tagName.toLowerCase() !== tag) {
          const replacement = document.createElement(tag);
          replacement.append(...Array.from(previous.childNodes)); previous.replaceWith(replacement);
        }
      } else {
        const list = document.createElement(tag); item = document.createElement("li");
        item.append(...Array.from(saved.block.childNodes)); list.append(item); saved.block.replaceWith(list);
      }
      range = document.createRange(); range.selectNodeContents(item); range.collapse(false);
    } else if (["h1", "h2", "h3", "p"].includes(tag)) {
      const saved = bookmark();
      if (!saved) return;
      const replacement = document.createElement(tag);
      replacement.append(...Array.from(saved.block.childNodes));
      if (saved.block.tagName === "LI") {
        const list = saved.block.parentElement!, after = list.cloneNode(false) as HTMLElement;
        while (saved.block.nextSibling) after.append(saved.block.nextSibling);
        saved.block.remove(); list.after(replacement);
        if (after.childNodes.length) replacement.after(after);
        if (!list.childNodes.length) list.remove();
      } else saved.block.replaceWith(replacement);
      range = document.createRange();
      range.selectNodeContents(replacement);
      range.collapse(false);
    } else {
      const wrapper = document.createElement(color ? "span" : tag);
      if (color) {
        wrapper.dataset.color = color;
        wrapper.style.color = color;
      }
      wrapper.append(range.extractContents());
      if (!wrapper.textContent) wrapper.textContent = "Texto";
      range.insertNode(wrapper);
      range = document.createRange();
      range.selectNodeContents(wrapper);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
    notify();
    position();
  }
  bar.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof HTMLSelectElement)) e.preventDefault();
  });
  bar
    .querySelector("select")!
    .addEventListener("change", (e) =>
      apply((e.target as HTMLSelectElement).value),
    );
  bar
    .querySelectorAll<HTMLElement>("[data-rich],[data-color]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          apply(button.dataset.rich || "span", button.dataset.color)),
    );
  document.addEventListener("keydown", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(selector);
    if (!target || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const selection = getSelection();
    if (!selection?.rangeCount) return;
    editor = target;
    range = selection.getRangeAt(0).cloneRange();
    if (!target.contains(range.commonAncestorContainer)) return;
    e.preventDefault();
    range.deleteContents();
    const saved = bookmark();
    if (!saved) return;
    const tail = saved.restored.cloneRange();
    tail.setEnd(saved.block, saved.block.childNodes.length);
    const inList = saved.block.tagName === "LI";
    if (inList && !saved.block.textContent?.trim()) {
      const list = saved.block.parentElement!, paragraph = document.createElement("p"), after = list.cloneNode(false) as HTMLElement;
      while (saved.block.nextSibling) after.append(saved.block.nextSibling);
      saved.block.remove(); paragraph.append(document.createElement("br")); list.after(paragraph);
      if (after.childNodes.length) paragraph.after(after);
      if (!list.childNodes.length) list.remove();
      range = document.createRange(); range.setStart(paragraph, 0); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range); notify(); position(); return;
    }
    const paragraph = document.createElement(inList ? "li" : "p");
    paragraph.append(tail.extractContents());
    if (!paragraph.textContent && !paragraph.querySelector("br"))
      paragraph.append(document.createElement("br"));
    saved.block.after(paragraph);
    range = document.createRange();
    range.setStart(paragraph, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    notify();
    position();
  });
  document.addEventListener("paste", (e) => {
    const target = (e.target as HTMLElement).closest(selector);
    if (!target) return;
    const selection = getSelection();
    if (!selection?.rangeCount) return;
    const selected = selection.getRangeAt(0);
    if (!target.contains(selected.commonAncestorContainer)) return;
    e.preventDefault();
    selected.deleteContents();
    const text = document.createTextNode(
      e.clipboardData?.getData("text/plain") || "",
    );
    selected.insertNode(text);
    selected.setStartAfter(text);
    selected.collapse(true);
    selection.removeAllRanges();
    selection.addRange(selected);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.addEventListener("pointerdown", (e) => {
    if (
      !bar.contains(e.target as Node) &&
      !(e.target as HTMLElement).closest(selector)
    )
      bar.hidden = true;
  });
  return { hide: () => (bar.hidden = true) };
}
