import { archiveExcerpt } from "@/lib/saas/archive-excerpt";
import { fileThumbnail } from "@/lib/saas/file-thumbnail";
import { installCanvasOrganization } from "./workspace-canvas-organization";
import {
  spatialUrl,
  markdownHtml,
  textBookmarks,
  type SpatialBlock,
} from "@/lib/saas/spatial";
import type {
  CanvasNode,
  WorkspaceState,
  WorkspaceMember,
} from "@/lib/saas/model";
import { uid } from "@/lib/saas/model";
import { canWrite, canView } from "@/lib/saas/permissions";
import { uiIcon } from "@/lib/saas/icons";
import { freePosition } from "@/lib/saas/canvas-layout";
import type { Rect } from "@/lib/saas/canvas-layout";
type Files = {
  choose: (pick: (id: string) => void) => Promise<void>;
  resource: (
    id: string,
  ) => Promise<{ blob: Blob; mime: string; title: string; filename: string }>;
  ingest: (
    files: File[],
  ) => Promise<{ id: string; mime: string; title: string }[]>;
  openLinked: (id: string) => Promise<void>;
};
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  space: () => string;
  active: () => boolean;
  zoom: () => number;
  point: (x?: number, y?: number) => { x: number; y: number };
  rect: (n: CanvasNode) => Rect;
  mutate: (fn: () => void) => void;
  save: () => void;
  removeNode: (id: string) => void;
  preview: (node: CanvasNode) => string;
  folders: Parameters<typeof installCanvasOrganization>[0]["folders"];
  gifMarkup: (
    id: string,
    source: string,
    title: string,
    escape: (value: unknown) => string,
  ) => string;
  render: (groupTransition?: boolean) => void;
  center: (id: string) => void;
  reveal: (rects: Rect[]) => void;
  modal: (html: string) => void;
  close: () => void;
  notify: (s: string) => void;
  files: Files;
  images: (files: File[], p?: { x: number; y: number }) => void;
};
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
export function installSpatial(ctx: Ctx) {
  type MediaPreview = {url: string; mime: string; title: string; text?: string; thumbnail?: string};
  const media = new Map<string, Promise<MediaPreview>>();
  let mediaScope = "";
  const writable = () => ctx.active() && canWrite(ctx.actor(), "canvas");
  const canDraw = (svg: SVGSVGElement) =>
    !!svg.closest("#canvas-detail:not([hidden])") && canWrite(ctx.actor(), "canvas");
  const current = () =>
    ctx.state().nodes.filter((n) => n.space === ctx.space());
  const organization = installCanvasOrganization({
    current,
    folders: ctx.folders,
    preview: ctx.preview,
    space: ctx.space,
    zoom: ctx.zoom,
    rect: ctx.rect,
    writable,
    mutate: ctx.mutate,
    render: ctx.render,
    notify: ctx.notify,
    reveal: ctx.reveal,
    remove: ctx.removeNode,
    add: (n) => ctx.state().nodes.push(n),
  });
  const visible = organization.shown;
  const previewFailures = new Map<string, number>();
  const previewFor = (url: string, block: SpatialBlock, space = ctx.space()) => {
    const site = new URL(url);
    const publicHost = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(site.hostname) &&
      !/\.(?:local|internal|localhost|test|invalid|example|home|lan)$/i.test(site.hostname);
    const privateSpace = ctx.state().spaces.find(s => s.id === space)?.privateOwner;
    if (privateSpace || !publicHost || site.port || site.search || site.hash ||
        !(block.autoPreview ?? site.pathname === "/")) return "";
    return "https://api.microlink.io/?" + new URLSearchParams({
      url, screenshot:"true", meta:"false", embed:"screenshot.url", "viewport.width":"1024", "viewport.height":"640"
    });
  };
  framePreviewErrors();
  function framePreviewErrors() {
    $("#canvas-frame").addEventListener("error", event => {
      const img = event.target as HTMLImageElement;
      if (!img.matches?.("[data-site-preview]")) return;
      previewFailures.set(img.getAttribute("src") || "", Date.now());
      img.parentElement?.classList.add("preview-unavailable");
      img.hidden = true;
    }, true);
  }
  function append(
    kind: CanvasNode["kind"],
    title: string,
    body: string,
    spatial?: SpatialBlock,
    p = ctx.point(),
    extra: Partial<CanvasNode> = {},
  ) {
    if (!writable()) return;
    const id = uid(),
      position = freePosition(
        { id, ...p, width: 255, height: 200 },
        current().filter(visible).map(ctx.rect),
      );
    const added = organization.insert([{
        id,
        space: ctx.space(),
        kind,
        title: title.slice(0, 120) || "Sin título",
        body: body.slice(0, 30000),
        spatial,
        ...position,
        ...extra,
      }]);
    if (!added) return;
    ctx.center(id);
    if (spatial?.type === "web") organization.arrive(id);
    return id;
  }
  function download(data: Blob, name: string) {
    const url = URL.createObjectURL(data),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function markdown(n: CanvasNode) {
    if (!n.bodyHtml) return `# ${n.title}\n\n${n.body}`;
    const doc = new DOMParser().parseFromString(n.bodyHtml, "text/html");
    doc
      .querySelectorAll("h1,h2,h3")
      .forEach((e) =>
        e.replaceWith(
          document.createTextNode(
            "\n" +
              "#".repeat(Number(e.tagName[1])) +
              " " +
              e.textContent +
              "\n",
          ),
        ),
      );
    doc
      .querySelectorAll("li")
      .forEach((e) =>
        e.replaceWith(document.createTextNode("\n- " + e.textContent)),
      );
    doc
      .querySelectorAll("p,div,br")
      .forEach((e) => e.append(document.createTextNode("\n")));
    return `# ${n.title}\n\n${doc.body.textContent?.trim() || n.body}`;
  }
  function render(n: CanvasNode, edit: boolean, previewOnly = false) {
    const s = n.spatial;
    if (!s) return null;
    if (s.type === "stack" || s.type === "group")
      return organization.render(n, edit);
    if (s.type === "web") {
      const url = spatialUrl(s.url || "");
      if (!url) return "";
      const preview = s.preview || previewFor(url, s, n.space);
      const available = preview && Date.now() - (previewFailures.get(preview) ?? 0) > 60_000;
      // Use the card ID so duplicate URLs can have different colors.
      let hash = 2166136261;
      for (const character of n.id) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
      }
      const hue = (hash >>> 0) % 360;
      return `<div class="spatial-web" style="--web-address-hue:${hue}"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="spatial-web-preview ${available ? "" : "preview-unavailable"}">${available ? `<img data-site-preview src="${esc(preview)}" alt="Vista previa de ${esc(n.title)}" referrerpolicy="no-referrer" draggable="false" loading="lazy"/>` : ""}<span>${uiIcon("link",24)} Vista previa no disponible</span></span><small class="spatial-web-address">${esc(new URL(url).host + new URL(url).pathname)}</small></a></div>`;
    }
    if (s.type === "sketch")
      return `<div class="spatial-drawing"><svg data-spatial-draw="${esc(n.id)}" viewBox="0 0 300 180" role="img" aria-label="Dibujo: ${esc(n.title)}">${(s.strokes || []).map((line) => `<polyline points="${line.map((p) => p.join(",")).join(" ")}"/>`).join("")}</svg></div>`;
    if (s.type === "media") {
      const source = s.data || spatialUrl(s.url || "") || "";
      const type = s.mime?.startsWith("audio/")
        ? "audio"
        : s.mime?.startsWith("image/")
          ? "img"
          : "video";
      return `<div class="spatial-media" ${s.fileId ? `data-spatial-file="${esc(s.fileId)}"` : ""}>${source ? `<${type} ${type === "img" ? `alt="${esc(n.title)}"` : 'controls loop preload="metadata"'} src="${esc(source)}" ${type === "img" ? 'draggable="false"' : ""}></${type}>` : "<p>Cargando recurso…</p>"}${s.fileId && !previewOnly ? `<button class="subtle-button" data-spatial-open-file="${esc(s.fileId)}">Abrir archivo</button>` : ""}</div>`;
    }
    return null;
  }
  function releaseMedia(value: Promise<MediaPreview>) {
    void value.then(item => {
      URL.revokeObjectURL(item.url);
      if (item.thumbnail) URL.revokeObjectURL(item.thumbnail);
    }, () => {});
  }
  async function hydrate() {
    const scope =
      String(ctx.actor().id) +
      ":" +
      String(
        (ctx.actor() as any).workspace?.id ||
          (ctx.actor() as any).workspace ||
          "demo",
      );
    if (scope !== mediaScope) {
      media.forEach(releaseMedia);
      media.clear();
      mediaScope = scope;
    }
    for (const host of document.querySelectorAll<HTMLElement>(
      "[data-spatial-file]",
    )) {
      const id = host.dataset.spatialFile!;
      try {
        if (!canView(ctx.actor(), "files"))
          throw Error("Necesitas permiso para ver Archivos.");
        let entry = media.get(id);
        if (!entry) {
          entry = (async () => {
            const resource = await ctx.files.resource(id);
            const {blob, mime, title, filename} = resource;
            const text = mime.startsWith("text/")
              ? await blob.slice(0, 6000).text()
              : (await archiveExcerpt(blob, filename).catch(() => undefined))?.slice(0, 6000);
            const thumbnail = mime === "application/pdf"
              ? await fileThumbnail(blob, filename).then(URL.createObjectURL, () => undefined)
              : undefined;
            return {url:URL.createObjectURL(blob), mime, title, text, thumbnail};
          })();
          media.set(id,entry);
          void entry.catch(() => { if (media.get(id) === entry) media.delete(id); });
        }
        const data = await entry;
        const placeholder = host.querySelector("p");
        if (scope !== mediaScope || !host.isConnected || !placeholder) continue;
        const inCanvas = !!host.closest("#canvas-nodes");
        if (data.text !== undefined || (inCanvas && data.thumbnail)) {
          const preview = document.createElement("div");
          preview.className = inCanvas ? "canvas-content-preview canvas-file-preview" : "canvas-file-preview";
          if (data.text !== undefined) {
            const text = document.createElement("pre");
            text.textContent = data.text || "Archivo vacío";
            preview.append(text);
          } else {
            const img = document.createElement("img");
            img.alt = "Primera página de " + data.title;
            img.src = data.thumbnail!;
            preview.append(img);
          }
          placeholder.replaceWith(preview);
          continue;
        }
        const type = data.mime.startsWith("audio/")
          ? "audio"
          : data.mime.startsWith("image/")
            ? "img"
            : data.mime === "application/pdf" && !inCanvas
              ? "iframe"
              : data.mime.startsWith("video/")
                ? "video"
                : "";
        if (!type) {
          placeholder.textContent = data.title;
          continue;
        }
        if (data.mime === "image/gif") {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = ctx.gifMarkup(
            id,
            data.url,
            "GIF del espacio",
            esc,
          );
          host.querySelector("p")?.replaceWith(wrapper.firstElementChild!);
          continue;
        }
        const el = document.createElement(type);
        el.setAttribute("src", data.url);
        if (type === "video" || type === "audio") {
          el.setAttribute("controls", "");
          el.setAttribute("preload", "metadata");
        }
        if (el instanceof HTMLVideoElement) el.loop = true;
        if (type === "iframe") {
          el.setAttribute("sandbox", "");
          el.setAttribute("title", "Vista previa del archivo");
        }
        el.setAttribute("draggable", "false");
        host.querySelector("p")?.replaceWith(el);
      } catch (error) {
        if (host.isConnected) {
          const p = host.querySelector("p");
          if (p)
            p.textContent =
              error instanceof Error ? error.message : "Recurso no disponible.";
        }
      }
    }
  }
  function scratch() {
    if (!writable()) return;
    const key = `orbita:scratch:${ctx.actor().id}:${ctx.space()}`;
    let draft = "";
    try {
      draft = sessionStorage.getItem(key) || "";
    } catch {}
    ctx.modal(
      `<h2>Captura rápida</h2><p>Guarda una idea en este espacio. Puedes usar Markdown.</p><form id="spatial-scratch"><label>Tu idea<textarea name="text" required maxlength="30000" rows="7" placeholder="¿Qué quieres recordar?">${esc(draft)}</textarea></label><button class="button primary">Añadir al espacio</button><small>Alt + espacio · Ctrl/⌘ + Enter para guardar</small></form>`,
    );
    const form = $<HTMLFormElement>("#spatial-scratch"),
      input = form.querySelector("textarea")!;
    input.oninput = () => {
      try {
        sessionStorage.setItem(key, input.value);
      } catch {}
    };
    form.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        form.requestSubmit();
      }
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      ctx.close();
      append(
        "note",
        text
          .split("\n")[0]
          .replace(/^#+\s*/, "")
          .slice(0, 120),
        text,
        undefined,
        ctx.point(),
        { bodyHtml: markdownHtml(text) },
      );
      try {
        sessionStorage.removeItem(key);
      } catch {}
    };
  }
  function web() {
    if (!writable()) return;
    ctx.modal(
      '<h2>Guardar un enlace</h2><p>Añade una web como referencia.</p><form id="spatial-web-form"><label>Enlace<input name="url" type="url" required placeholder="https://…" maxlength="2000"/></label><label>Título (opcional)<input name="title" maxlength="120"/></label><label><input type="checkbox" name="preview" checked/> Crear una vista previa con Microlink si el enlace es público</label><p role="alert" id="spatial-web-error"></p><button class="button primary">Guardar enlace</button></form>',
    );
    $("#spatial-web-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        url = spatialUrl(String(f.get("url")));
      if (!url) {
        $("#spatial-web-error").textContent =
          "Usa un enlace http o https sin credenciales.";
        return;
      }
      ctx.close();
      append("page", String(f.get("title") || new URL(url).hostname), url, {
        type: "web",
        url,
        autoPreview: f.has("preview"),
      });
    };
  }
  function stack() {
    if (!writable()) return;
    const selection = organization.eligibleSelection();
    if (selection.length >= 2) {
      organization.create(
        undefined,
        selection.map((n) => n.id),
      );
      return;
    }
    const candidates = current().filter((n) => !organization.container(n));
    ctx.modal(
      `<h2>Agrupar tarjetas</h2><p>Agrupa tarjetas sin duplicarlas. Las conexiones se conservan.</p><form id="spatial-stack-form"><label>Nombre<input name="title" value="Nuevo grupo" required maxlength="120"/></label><fieldset class="spatial-stack-picker"><legend>Elige al menos dos tarjetas</legend>${candidates.map((n) => `<label><input type="checkbox" name="member" value="${esc(n.id)}" ${organization.selected.has(n.id) ? "checked" : ""}/><span>${esc(n.title)}</span></label>`).join("")}</fieldset><p id="spatial-stack-error" role="alert"></p><button class="button primary">Agrupar</button></form>`,
    );
    $("#spatial-stack-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement),
        members = f
          .getAll("member")
          .map(String)
          .filter((id) => candidates.some((n) => n.id === id));
      if (members.length < 2 || members.length > 100) {
        $("#spatial-stack-error").textContent = "Elige entre 2 y 100 tarjetas.";
        return;
      }
      ctx.close();
      organization.create(String(f.get("title")).trim(), members);
    };
  }
  function search() {
    if (!ctx.active()) return;
    ctx.modal(
      '<h2>Buscar en este espacio</h2><label>Buscar<input id="spatial-search" type="search" placeholder="Título o contenido…"/></label><div id="spatial-search-results" class="spatial-search-results"></div>',
    );
    const input = $<HTMLInputElement>("#spatial-search");
    input.oninput = () => {
      const q = input.value.toLocaleLowerCase("es").trim(),
        hits = q
          ? current()
              .filter((n) =>
                (n.title + " " + n.body).toLocaleLowerCase("es").includes(q),
              )
              .slice(0, 30)
          : [];
      $("#spatial-search-results").innerHTML =
        hits
          .map(
            (n) =>
              `<button class="button secondary" data-spatial-found="${esc(n.id)}">${esc(n.title)}</button>`,
          )
          .join("") ||
        (q ? "<p>No encontramos coincidencias en este espacio.</p>" : "");
    };
  }
  function exportNotes() {
    const notes = current().filter(
      (n) => ["note", "page", "tasks"].includes(n.kind) && !n.spatial,
    );
    if (!notes.length) {
      ctx.notify("Este espacio no tiene notas para exportar.");
      return;
    }
    const content = notes.map(markdown).join("\n\n---\n\n");
    download(
      new Blob([content], { type: "text/markdown;charset=utf-8" }),
      "notas-del-espacio.md",
    );
  }
  function picker() {
    if (!writable()) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept =
      ".md,.markdown,.txt,.rtf,.json,.html,.htm,.png,.jpg,.jpeg,.webp,.bmp,.gif,.mp4,.webm,.mov,.mp3,.wav,.ogg,.pdf";
    input.hidden = true;
    input.oncancel = () => input.remove();
    input.onchange = () => {
      const files = Array.from(input.files || []);
      input.remove();
      void importFiles(files);
    };
    document.body.append(input);
    input.click();
  }
  async function bookmarks(file: File, stillCurrent: () => boolean) {
    const text = await file.text();
    if (!stillCurrent()) return;
    let links = textBookmarks(text);
    if (/\.html?$/i.test(file.name)) {
      const doc = new DOMParser().parseFromString(text, "text/html");
      links = Array.from(doc.querySelectorAll("a[href]"))
        .slice(0, 100)
        .flatMap((a) => {
          const url = spatialUrl(a.getAttribute("href") || "");
          return url
            ? [
                {
                  url,
                  title: (a.textContent || new URL(url).hostname).slice(0, 120),
                },
              ]
            : [];
        });
    }
    if (!links.length)
      return ctx.notify("No encontramos enlaces http o https en ese archivo.");
    const base = ctx.point(),
      occupied = current().filter(visible).map(ctx.rect);
    const space = ctx.space();
    const cards = links.map((item, i): CanvasNode => {
      const id = uid();
      const pos = freePosition(
        {
          id,
          x: base.x + (i % 6) * 288,
          y: base.y + Math.floor(i / 6) * 224,
          width: 255,
          height: 200,
        },
        occupied,
      );
      occupied.push({ id, ...pos, width: 255, height: 200 });
      return {
        id,
        space,
        kind: "page",
        title: item.title,
        body: item.url,
        ...pos,
        spatial: { type: "web", url: item.url },
      };
    });
    if (organization.insert(cards)) ctx.center(cards[0].id);
  }
  async function importFiles(files: File[], position = ctx.point()) {
    const space = ctx.space(),
      actor = String(ctx.actor().id),
      group = organization.activeGroup(),
      privateSpace = !!ctx.state().spaces.find((s) => s.id === space)
        ?.privateOwner;
    const stillCurrent = () =>
      writable() &&
      ctx.space() === space &&
      String(ctx.actor().id) === actor &&
      organization.activeGroup() === group;
    for (const file of files.slice(0, 20)) {
      if (!stillCurrent()) return;
      try {
        if (file.size > 20 * 1024 * 1024)
          throw Error(`${file.name}: el máximo es 20 MB.`);
        if (/\.(md|markdown|txt|rtf)$/i.test(file.name)) {
          let text = (await file.text()).slice(0, 30000);
          if (!stillCurrent()) return;
          if (/\.rtf$/i.test(file.name))
            text = text
              .replace(/\\par\b/g, "\n")
              .replace(/\\'[0-9a-f]{2}/gi, "")
              .replace(/\\[a-z]+-?\d* ?/gi, "")
              .replace(/[{}]/g, "");
          append(
            "page",
            file.name.replace(/\.[^.]+$/, ""),
            text,
            undefined,
            position,
            { bodyHtml: markdownHtml(text) },
          );
        } else if (/\.(json|html|htm)$/i.test(file.name))
          await bookmarks(file, stillCurrent);
        else if (file.type === "image/gif" && file.size <= 1500000) {
          const data = await dataUrl(file);
          if (!stillCurrent()) return;
          append("image", file.name, "", undefined, position, { image: data });
        } else if (file.type.startsWith("image/") && file.type !== "image/gif")
          ctx.images([file], position);
        else if (privateSpace) {
          if (
            file.size > 1500000 ||
            ![
              "video/mp4",
              "video/webm",
              "video/quicktime",
              "audio/mpeg",
              "audio/mp3",
              "audio/wav",
              "audio/ogg",
              "audio/webm",
            ].includes(file.type)
          )
            throw Error(
              "En espacios privados usa un enlace o un medio de hasta 1,5 MB. No se subirá a Archivos del equipo.",
            );
          const data = await dataUrl(file);
          if (!stillCurrent()) return;
          append(
            "page",
            file.name,
            "",
            { type: "media", mime: file.type, data },
            position,
          );
        } else {
          if (!canWrite(ctx.actor(), "files"))
            throw Error(
              "Necesitas permiso de Archivos para subir este recurso. También puedes añadir un enlace.",
            );
          const saved = await ctx.files.ingest([file]);
          if (!stillCurrent()) return;
          for (const row of saved)
            append(
              "page",
              row.title,
              "",
              { type: "media", fileId: row.id, mime: row.mime },
              position,
            );
        }
      } catch (error) {
        ctx.notify(
          error instanceof Error
            ? error.message
            : "No pudimos importar el recurso.",
        );
      }
    }
  }
  const dataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(Error("No pudimos leer el archivo."));
      r.readAsDataURL(file);
    });
  const actions: Record<string, () => void> = {
    scratch,
    web,
    stack,
    search,
    import: picker,
    export: exportNotes,
    sketch: () => {
      append("page", "Nuevo dibujo", "", { type: "sketch", strokes: [] });
    },
    media: () => {
      const space = ctx.space(),
        actorId = String(ctx.actor().id),
        group = organization.activeGroup();
      void ctx.files.choose((id) => {
        if (
          !writable() ||
          ctx.space() !== space ||
          organization.activeGroup() !== group ||
          String(ctx.actor().id) !== actorId
        )
          return;
        ctx.close();
        append("page", "Recurso de Archivos", "", {
          type: "media",
          fileId: id,
        });
      });
    },
  };
  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement,
      action = el.closest<HTMLElement>("[data-spatial-action]")?.dataset
        .spatialAction;
    if (action && ctx.active()) {
      if (["search", "export"].includes(action) || writable())
        actions[action]?.();
      return;
    }
    const found = el.closest<HTMLElement>("[data-spatial-found]")?.dataset
      .spatialFound;
    if (found) {
      ctx.close();
      organization.openFor(found);
      ctx.center(found);
    }
    const toggle = el.closest<HTMLElement>("[data-spatial-toggle]")?.dataset
      .spatialToggle;
    if (toggle && ctx.active()) {
      const n = current().find((n) => n.id === toggle);
      if (n && e.shiftKey) organization.toggle(n.id);
      else if (n) organization.toggleStack(n);
    }
    const unstack = el.closest<HTMLElement>("[data-spatial-unstack]")?.dataset
      .spatialUnstack;
    if (unstack) organization.removeContainer(unstack);
    const file = el.closest<HTMLElement>("[data-spatial-open-file]")?.dataset
      .spatialOpenFile;
    if (file && !el.closest("#canvas-nodes")) void ctx.files.openLinked(file);
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.altKey &&
      e.code === "Space" &&
      writable() &&
      !document.querySelector("dialog[open]")
    ) {
      e.preventDefault();
      scratch();
    }
  });
  document.addEventListener(
    "paste",
    (e) => {
      if (
        e.defaultPrevented ||
        !writable() ||
        document.querySelector("dialog[open]")
      )
        return;
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,[contenteditable]")) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) {
        const special = files.some(
          (f) => !f.type.startsWith("image/") || f.type === "image/gif",
        );
        if (special) {
          e.preventDefault();
          e.stopImmediatePropagation();
          void importFiles(files);
        }
        return;
      }
      const text = e.clipboardData?.getData("text/plain").trim();
      if (!text) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const url = spatialUrl(text);
      if (url) append("page", new URL(url).hostname, url, { type: "web", url });
      else
        append(
          "note",
          text.split("\n")[0].slice(0, 120),
          text,
          undefined,
          ctx.point(),
          { bodyHtml: markdownHtml(text) },
        );
    },
    true,
  );
  const frame = $("#canvas-frame");
  frame.addEventListener(
    "drop",
    (e) => {
      if (!writable() || document.querySelector("dialog[open]")) return;
      const files = Array.from(e.dataTransfer?.files || []),
        text =
          e.dataTransfer?.getData("text/uri-list") ||
          e.dataTransfer?.getData("text/plain") ||
          "",
        url = spatialUrl(text);
      if (
        files.some(
          (f) => !f.type.startsWith("image/") || f.type === "image/gif",
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void importFiles(files, ctx.point(e.clientX, e.clientY));
      } else if (!files.length && url) {
        e.preventDefault();
        e.stopImmediatePropagation();
        append(
          "page",
          new URL(url).hostname,
          url,
          { type: "web", url },
          ctx.point(e.clientX, e.clientY),
        );
      }
    },
    true,
  );
  frame.addEventListener(
    "dragover",
    (e) => {
      if (
        writable() &&
        (e.dataTransfer?.types.includes("Files") ||
          e.dataTransfer?.types.includes("text/uri-list"))
      ) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      }
    },
    true,
  );
  function resizeMode(n: CanvasNode, handle: HTMLElement) {
    if (handle.closest(".canvas-letter,.canvas-file-card")) return "vertical";
    if (n.kind === "sales" || n.kind === "image" || n.spatial?.type === "media" || n.spatial?.type === "web") return "proportional";
    return "free";
  }

  function resizeDimensions(
    w: number,
    h: number,
    dx: number,
    dy: number,
    mode: ReturnType<typeof resizeMode>,
  ) {
    if (mode === "vertical") {
      return { width: w, height: Math.round(Math.max(310, Math.min(1200, h + dy))) };
    }
    if (mode === "proportional") {
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy * w / h;
      const width = Math.max(180, Math.min(1000, w + delta));
      return { width: Math.round(width), height: Math.round(width * h / w) };
    }
    return {
      width: Math.round(Math.max(180, Math.min(1000, w + dx))),
      height: Math.round(Math.max(120, Math.min(1200, h + dy))),
    };
  }
  let resize:
      | {
          id: string;
          pointer: number;
          x: number;
          y: number;
          w: number;
          h: number;
          mode: ReturnType<typeof resizeMode>;
        }
      | undefined,
    stroke:
      | {
          id: string;
          pointer: number;
          points: number[][];
          svg: SVGSVGElement;
          line: SVGPolylineElement;
        }
      | undefined;
  frame.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target as Element,
        handle = target.closest<HTMLElement>("[data-spatial-resize]"),
        svg = target.closest<SVGSVGElement>("[data-spatial-draw]");
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        !(handle ? writable() : svg && canDraw(svg))
      )
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (handle) {
        const n = current().find((n) => n.id === handle.dataset.spatialResize)!;
        const r = ctx.rect(n);
        resize = {
          id: n.id,
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          w: r.width,
          h: r.height,
          mode: resizeMode(n, handle),
        };
        handle.setPointerCapture(e.pointerId);
      } else if (svg) {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polyline",
        );
        svg.append(line);
        stroke = {
          id: svg.dataset.spatialDraw!,
          pointer: e.pointerId,
          points: [],
          svg,
          line,
        };
        svg.setPointerCapture(e.pointerId);
      }
    },
    true,
  );
  document.addEventListener("pointermove", (e) => {
    if (resize && resize.pointer === e.pointerId) {
      const el = document.querySelector<HTMLElement>(
        `[data-node="${CSS.escape(resize.id)}"]`,
      );
      if (el) {
        const dx = (e.clientX - resize.x) / ctx.zoom(),
          dy = (e.clientY - resize.y) / ctx.zoom();
        const size = resizeDimensions(resize.w, resize.h, dx, dy, resize.mode);
        el.classList.add("spatial-resized");
        el.style.width = size.width + "px";
        if (el.classList.contains("note")) el.style.setProperty("--sticky-height", size.height + "px");
        else el.style.height = size.height + "px";
      }
    }
    if (
      stroke &&
      stroke.pointer === e.pointerId &&
      stroke.points.length < 2000
    ) {
      const p = stroke.svg.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      const matrix = stroke.svg.getScreenCTM();
      if (matrix) {
        const local = p.matrixTransform(matrix.inverse());
        stroke.points.push([
          Math.round(Math.max(0, Math.min(300, local.x))),
          Math.round(Math.max(0, Math.min(180, local.y))),
        ]);
        stroke.line.setAttribute(
          "points",
          stroke.points.map((p) => p.join(",")).join(" "),
        );
      }
    }
  });
  function finish(cancel = false) {
    if (resize) {
      const drag = resize;
      resize = undefined;
      const el = document.querySelector<HTMLElement>(
        `[data-node="${CSS.escape(drag.id)}"]`,
      );
      if (!cancel && el && writable())
        ctx.mutate(() => {
          const n = current().find((n) => n.id === drag.id);
          if (n) {
            n.width = Math.round(el.offsetWidth);
            n.height = n.kind === "note" ? parseFloat(el.style.getPropertyValue("--sticky-height")) || el.offsetHeight : Math.round(el.offsetHeight);
          }
        });
      else ctx.render();
    }
    if (stroke) {
      const draw = stroke;
      stroke = undefined;
      if (!cancel && canDraw(draw.svg) && draw.points.length > 1)
        ctx.mutate(() => {
          const n = current().find((n) => n.id === draw.id);
          if (n?.spatial) {
            n.spatial.strokes ||= [];
            if (n.spatial.strokes.length < 100)
              n.spatial.strokes.push(draw.points);
          }
        });
      else draw.line.remove();
    }
  }
  document.addEventListener("pointerup", () => finish());
  document.addEventListener("pointercancel", () => finish(true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") finish(true);
    const handle = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-spatial-resize]",
    );
    if (
      !handle ||
      !writable() ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    const id = handle.dataset.spatialResize!;
    ctx.mutate(() => {
      const n = current().find((n) => n.id === id);
      if (n) {
        const r = ctx.rect(n);
        const dx =
          e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0;
        const dy = e.key === "ArrowDown" ? 20 : e.key === "ArrowUp" ? -20 : 0;
        const mode = resizeMode(n, handle);
        if (mode !== "vertical" || dy) Object.assign(n, resizeDimensions(r.width, r.height, dx, dy, mode));
      }
    });
    frame.querySelector<HTMLElement>(`[data-spatial-resize="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  });
  window.addEventListener("pagehide", () =>
    media.forEach(releaseMedia),
  );
  return {
    organization,
    render,
    visible,
    hydrate,
    action: (name: string) => actions[name]?.(),
    resizeHandle: (n: CanvasNode) =>
      `<button class="spatial-resize" data-spatial-resize="${esc(n.id)}" aria-label="Cambiar tamaño de ${esc(n.title)}" title="Arrastra o usa las flechas">${uiIcon("scale", 13)}</button>`,
  };
}
