import {ordered,moveRelative,pageNumbers} from '@/lib/saas/file-order';
import {fileDragMotion} from './workspace-file-motion';
import { libraryFiles, fileFormat, fileMime } from "@/lib/saas/files-library";
import { canView, canWrite } from "@/lib/saas/permissions";
import type { WorkspaceMember } from "@/lib/saas/model";
import { uiIcon } from "@/lib/saas/icons";
import { fileThumbnail } from "@/lib/saas/file-thumbnail";
import { documentZip } from "@/lib/saas/zip";
import {
  workspaceFileCategory,
  validWorkspaceFile,
} from "../../services/payload/src/workspace-file-policy";
import { expired } from "../../services/payload/src/retention";
type Row = {
  id: string;
  title: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  folderId?: string;
  blob?: Blob;
};
type Folder = { id: string; name: string; createdAt: string };
type Ctx = {
  actor: () => WorkspaceMember;
  cloud: () => boolean;
  api: (path: string, init?: RequestInit) => Promise<any>;
  notify: (s: string) => void;
  modal: (s: string) => void;
  close: () => void;
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
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("orbita-workspace-files", 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("files"))
        r.result.createObjectStore("files", { keyPath: "id" });
      if (!r.result.objectStoreNames.contains("thumbs"))
        r.result.createObjectStore("thumbs");
      if (!r.result.objectStoreNames.contains("folders"))
        r.result.createObjectStore("folders", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function storage(
  store: string,
  action: "getAll" | "get" | "put" | "delete",
  value?: any,
  key?: string,
): Promise<any> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
          store,
          action === "getAll" || action === "get" ? "readonly" : "readwrite",
        ),
        s = tx.objectStore(store);
      const r =
        action === "getAll"
          ? s.getAll()
          : action === "get"
            ? s.get(value)
            : action === "delete"
              ? s.delete(value)
              : key
                ? s.put(value, key)
                : s.put(value);
      let result: any;
      r.onsuccess = () => {
        result = r.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function installWorkspaceFiles(ctx: Ctx) {
  let rows: Row[] = [],
    trash = false,
    busy = false,
    loaded = false,
    epoch = 0;
  let observer: IntersectionObserver | undefined;
  let thumbnailQueue = Promise.resolve();
  const selected = new Set<string>(),
    urls = new Map<string, string>();
  const scope = () =>
    String(
      (ctx.actor() as any).workspace?.id ||
        (ctx.actor() as any).workspace ||
        "demo",
    );
  const localKey = (r: Row) => r.id.startsWith(scope() + ":");
  const writable = () => canWrite(ctx.actor(), "files");
  let page = 1,
    folderId = "",
    recent = false,
    folders: Folder[] = [],
    uploadFolder = "";
  let fallbackView: "grid" | "list" | undefined,
    fallbackSize: number | undefined;
  function display() {
    let view = fallbackView || "grid",
      size = fallbackSize || 12;
    try {
      if (!fallbackView)
        view =
          localStorage.getItem("orbita:assets-view:" + ctx.actor().id) ===
          "list"
            ? "list"
            : "grid";
      if (!fallbackSize) {
        const saved = Number(
          localStorage.getItem("orbita:assets-size:" + ctx.actor().id),
        );
        if ([8, 12, 24, 48].includes(saved)) size = saved;
      }
    } catch {}
    return { view, size };
  }
  const layoutKey=()=>`orbita:file-layout:${scope()}:${ctx.actor().id}`;
  let layout:{files:string[];folders:string[]}={files:[],folders:[]};
  function readLayout(){try{const data=JSON.parse(localStorage.getItem(layoutKey())||'{}');layout={files:Array.isArray(data.files)?data.files.filter((id:unknown)=>typeof id==='string'):[],folders:Array.isArray(data.folders)?data.folders.filter((id:unknown)=>typeof id==='string'):[]};}catch{layout={files:[],folders:[]};}}
  function reorder(kind:'files'|'folders',ids:string[],before:string,after=false){if(!writable()||busy||trash)return;const all=kind==='files'?ordered(rows,layout.files):ordered(folders,layout.folders);layout[kind]=moveRelative(all.map(r=>r.id),ids,before,after);try{localStorage.setItem(layoutKey(),JSON.stringify(layout));}catch{ctx.notify('El orden se mantendrá durante esta sesión.');}draw();}
  function visible() {
    const { size } = display();
    return filtered().slice((page - 1) * size, page * size);
  }
  function filtered() {
    return ordered(libraryFiles(rows, {
      trash,
      folderId,
      recent,
      query: $<HTMLInputElement>("#workspace-file-search").value,
      type: $<HTMLSelectElement>("#workspace-file-filter").value,
    }),layout.files);
  }
  async function blob(row: Row) {
    if (!ctx.cloud()) return row.blob!;
    const r = await fetch(
      "/api/saas/workspace-files?id=" + encodeURIComponent(row.id),
    );
    if (!r.ok) throw Error("No pudimos abrir el archivo.");
    return r.blob();
  }
  function revoke() {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }
  async function thumbs(list: Row[], version: number) {
    let index = 0;
    await Promise.all(
      [0, 1].map(async () => {
        while (index < list.length && version === epoch) {
          const row = list[index++],
            key =
              "white-v4:" +
              String(ctx.actor().id) +
              ":" +
              scope() +
              ":" +
              row.id +
              ":" +
              (row.updatedAt || row.createdAt);
          try {
            let thumb: Blob = await storage("thumbs", "get", key);
            if (!thumb) {
              const category = workspaceFileCategory(row.mime);
              thumb = await fileThumbnail(
                ["image", "pdf"].includes(category)
                  ? await blob(row)
                  : new Blob([], { type: row.mime }),
                row.filename,
              );
              await storage("thumbs", "put", thumb, key);
            }
            if (version !== epoch) return;
            const image = document.querySelector<HTMLImageElement>(
              `[data-asset-thumbnail="${CSS.escape(row.id)}"]`,
            );
            if (image) {
              const url = URL.createObjectURL(thumb);
              urls.set(row.id, url);
              image.src = url;
              image.dataset.previewBytes = String(thumb.size);
              image.classList.add("ready");
            }
          } catch {
            /* The file-type cover remains visible if a preview cannot be decoded. */
          }
        }
      }),
    );
  }
  function selection() {
    for (const checkbox of document.querySelectorAll<HTMLInputElement>(
      "[data-asset-select]",
    ))
      checkbox.disabled = busy;
    $<HTMLButtonElement>("#workspace-files-upload").disabled = busy;
    $<HTMLButtonElement>("#workspace-files-empty-trash").disabled =
      busy || !rows.some(row => row.deletedAt && !expired(row.deletedAt));
    const list = visible(),
      all = $<HTMLInputElement>("#workspace-files-all");
    all.checked = list.length > 0 && list.every((r) => selected.has(r.id));
    all.indeterminate = !all.checked && list.some((r) => selected.has(r.id));
    all.disabled = busy || !list.length;
    $("#workspace-files-count").textContent =
      selected.size +
      (selected.size === 1 ? " seleccionado" : " seleccionados");
    for (const b of document.querySelectorAll<HTMLButtonElement>(
      "[data-assets-bulk]",
    ))
      b.disabled = busy || !selected.size;
  }
  function draw() {
    const { view, size } = display(),
      total = filtered().length,
      pages = Math.max(1, Math.ceil(total / size));
    page = Math.max(1, Math.min(page, pages));
    $<HTMLSelectElement>("#workspace-files-page-size").value = String(size);
    $("#workspace-files-grid").classList.toggle("assets-list", view === "list");
    document
      .querySelectorAll<HTMLButtonElement>("[data-assets-view]")
      .forEach((b) => {
        b.classList.toggle("active", b.dataset.assetsView === view);
        b.setAttribute("aria-pressed", String(b.dataset.assetsView === view));
      });
    $('#workspace-files-pagination').innerHTML=`<span>${total} ${total===1?'archivo':'archivos'}</span><nav aria-label="Páginas de archivos">${pageNumbers(page,pages).map(n=>n==='…'?'<span aria-hidden="true">…</span>':`<button class="button ${n===page?'primary':'secondary'}" data-assets-page="${n}" ${n===page?'aria-current="page"':''} aria-label="Página ${n}">${n}</button>`).join('')}</nav>`;
    const list = visible(),
      version = ++epoch;
    observer?.disconnect();
    revoke();
    $("#workspace-files-pagination").hidden=pages<=1;
    $("#workspace-files-grid").innerHTML =
      list
        .map(
          (r) =>
            `<article class="asset-card" data-asset-card="${esc(r.id)}" style="--file-hue:${fileFormat(r.filename,r.mime).hue}"><label class="document-selection asset-selection"><input type="checkbox" data-asset-select="${esc(r.id)}" aria-label="Seleccionar ${esc(r.title)}" ${selected.has(r.id)?'checked':''} ${busy?'disabled':''}/><span>Seleccionar</span></label>${!trash&&writable()?`<button class="icon-btn asset-grip" data-asset-grip="${esc(r.id)}" aria-label="Mover ${esc(r.title)}">${uiIcon('grip',16)}</button>`:''}<button class="asset-preview" data-asset-open="${esc(r.id)}" aria-label="Ver ${esc(r.title)}" title="${esc(r.title)}"><span class="asset-format">${uiIcon(workspaceFileCategory(r.mime)==='image'?'image':'note',32)}<strong>${esc(fileFormat(r.filename,r.mime).extension)}</strong></span>${['image','pdf'].includes(workspaceFileCategory(r.mime))?`<img draggable="false" data-asset-thumbnail="${esc(r.id)}" alt="${esc(r.title)}" width="480" height="480" loading="lazy" decoding="async"/>`:''}<span class="asset-name">${esc(r.title)}</span></button>${trash?`<button class="asset-corner-action icon-btn" data-asset-restore="${esc(r.id)}" aria-label="Restaurar ${esc(r.title)}" ${!writable()?'disabled':''}>${uiIcon('undo',16)}</button>`:`<button class="asset-corner-action icon-btn" data-asset-download="${esc(r.id)}" aria-label="Descargar ${esc(r.title)}">${uiIcon('export',16)}</button>`}</article>`,
        )
        .join("") ||
      '<div class="empty-state">' +
        (trash
          ? "No hay archivos en la papelera."
          : $<HTMLInputElement>("#workspace-file-search").value.trim() ||
              $<HTMLSelectElement>("#workspace-file-filter").value !== "all"
            ? "No hay archivos que coincidan. Prueba otros filtros."
            : folderId
              ? "Esta carpeta está vacía. Añade archivos o arrástralos aquí."
              : folders.length && !recent
                ? "Los archivos sin carpeta aparecen aquí. También puedes abrir una carpeta."
                : "Todavía no hay archivos aquí. Sube uno para empezar.") +
        "</div>";
    drawLibrary();
    $("#workspace-files-trash-note").hidden = !trash;
    $("#workspace-files-upload").hidden = trash || !writable();
    $("#workspace-files-delete").hidden = trash || !writable();
    $("#workspace-files-download").hidden = trash;
    $("#workspace-files-restore").hidden = !trash || !writable();
    $("#workspace-files-empty-trash").hidden = !trash || !writable();
    $("#workspace-files-trash").innerHTML = trash
      ? "← Volver a archivos"
      : uiIcon("trash", 16) + "Papelera";
    selection();
    observer = new IntersectionObserver(
      (entries) => {
        const pending: Row[] = [];
        for (const entry of entries)
          if (entry.isIntersecting) {
            observer?.unobserve(entry.target);
            const id = (entry.target as HTMLElement).dataset.assetThumbnail,
              row = list.find((r) => r.id === id);
            if (row) pending.push(row);
          }
        if (pending.length)
          thumbnailQueue = thumbnailQueue
            .then(() => thumbs(pending, version))
            .catch(() => {});
      },
      { rootMargin: "200px" },
    );
    for (const img of document.querySelectorAll("[data-asset-thumbnail]"))
      observer.observe(img);
  }
  async function load() {
    if (!canView(ctx.actor(), "files")) return;
    try {
      if (ctx.cloud()) {
        const data = await Promise.all([
          ctx.api("workspace-files" + (trash ? "?trash=1" : "")),
          ctx.api("file-folders"),
        ]);
        rows = data[0].docs;
        folders = data[1].docs;
      } else {
        rows = (await storage("files", "getAll")).filter(localKey);
        folders = (await storage("folders", "getAll")).filter((f: Folder) =>
          f.id.startsWith(scope() + ":"),
        );
        for(const [slug,name] of [['marca','Marca'],['campanas','Campañas'],['administracion','Administración']]){
          const id=scope()+':example-folder-'+slug;
          if(!folders.some(f=>f.id===id||f.name===name)){const folder={id,name,createdAt:new Date().toISOString()};await storage('folders','put',folder);folders.push(folder);}
        }
        for (const row of rows)
          if (row.deletedAt && expired(row.deletedAt))
            await storage("files", "delete", row.id);
        rows = rows.filter((r) => !r.deletedAt || !expired(r.deletedAt));
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      for (const id of selected)
        if (!rows.some((r) => r.id === id && !!r.deletedAt === trash))
          selected.delete(id);
      readLayout();
      loaded = true;
      draw();
    } catch (e) {
      $("#workspace-files-grid").textContent =
        e instanceof Error ? e.message : "No pudimos cargar los archivos.";
    }
  }
  async function emptyFilesTrash() {
    const deleted = rows.filter(row => row.deletedAt && !expired(row.deletedAt));
    if (!trash || busy || !writable() || !deleted.length ||
        !window.confirm(`¿Eliminar definitivamente los ${deleted.length} archivos de la papelera?`)) return;
    busy = true;
    selection();
    let removed = 0;
    for (const { id } of deleted) {
      try {
        if (ctx.cloud())
          await ctx.api("trash", { method: "DELETE", body: JSON.stringify({ collection: "workspace-files", id }) });
        else await storage("files", "delete", id);
        selected.delete(id);
        removed++;
      } catch {}
    }
    busy = false;
    await load();
    const failed = deleted.length - removed;
    ctx.notify(failed ? `${removed} eliminados. ${failed} archivos siguen en la papelera.` : "Papelera de archivos vaciada.");
  }
  async function change(row: Row, restore = false) {
    if (!writable()) throw Error("No puedes modificar archivos.");
    if (ctx.cloud())
      await ctx.api("workspace-files", {
        method: restore ? "PATCH" : "DELETE",
        body: JSON.stringify({ id: row.id }),
      });
    else {
      if (restore && row.deletedAt && expired(row.deletedAt))
        throw Error("El plazo de recuperación terminó.");
      if (restore) delete row.deletedAt;
      else row.deletedAt ||= new Date().toISOString();
      await storage("files", "put", row);
    }
  }
  async function bulk(action: string) {
    if (action === "move") {
      movePicker();
      return;
    }
    if (busy || !selected.size) return;
    const list = rows.filter((r) => selected.has(r.id));
    busy = true;
    selection();
    try {
      if (action === "download") {
        if (list.reduce((sum, r) => sum + r.size, 0) > 100 * 1024 * 1024)
          throw Error("Descarga en grupos de hasta 100 MB.");
        const files = [];
        for (const row of list)
          files.push({ name: row.filename, blob: await blob(row) });
        download(await documentZip(files), "archivos-del-equipo.zip");
        ctx.notify("Tu ZIP está listo.");
      } else {
        let done = 0;
        for (const row of list) {
          try {
            await change(row, action === "restore");
            selected.delete(row.id);
            done++;
          } catch {}
        }
        ctx.notify(
          done +
            " de " +
            list.length +
            " archivos " +
            (action === "restore"
              ? "restaurados."
              : "enviados a la papelera por 30 días."),
        );
        await load();
      }
    } catch (e) {
      ctx.notify(
        e instanceof Error ? e.message : "No pudimos completar la acción.",
      );
    } finally {
      busy = false;
      selection();
    }
  }
  function download(data: Blob, name: string) {
    const url = URL.createObjectURL(data),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function preview(row: Row) {
    if (trash) return;
    ctx.modal(
      `<h2>${esc(row.title)}</h2><div id="workspace-asset-viewer" class="asset-viewer">Preparando vista previa…</div><div class="dialog-actions"><button class="button primary" data-asset-download="${esc(row.id)}">Descargar archivo</button></div>`,
    );
    const host = $("#workspace-asset-viewer");
    try {
      const data = await blob(row);
      if (!host.isConnected) return;
      const kind = workspaceFileCategory(row.mime);
      // Keep SVG documents out of navigable same-origin object URLs.
      if (row.mime === "image/svg+xml") {
        const source = new FileReader();
        source.onload = () => {
          if (host.isConnected)
            host.innerHTML = `<img src="${esc(String(source.result))}" alt="${esc(row.title)}"/>`;
        };
        source.onerror = () => {
          host.textContent = "No pudimos mostrar la vista previa.";
        };
        source.readAsDataURL(data);
        return;
      }
      const url = URL.createObjectURL(data);
      setTimeout(() => URL.revokeObjectURL(url), 300000);
      if (kind === "image")
        host.innerHTML = `<img src="${url}" alt="${esc(row.title)}"/>`;
      else if (kind === "pdf") {
        const { mountPdf } = await import("@/lib/saas/pdf-viewer");
        await mountPdf(host, data);
      } else if (kind === "video" || kind === "audio")
        host.innerHTML = `<${kind} controls src="${url}" preload="metadata"></${kind}>`;
      else if (kind === "text")
        host.innerHTML =
          "<pre>" + esc(await data.slice(0, 200000).text()) + "</pre>";
      else
        host.innerHTML = `<p>La vista previa de este formato no está disponible. Descárgalo para abrirlo en tu aplicación.</p>`;
    } catch {
      if (host.isConnected)
        host.textContent =
          "No pudimos abrir la vista previa. Puedes descargar el archivo.";
    }
  }
  $("#workspace-file-search").addEventListener("input", () => {
    page = 1;
    draw();
  });
  $("#workspace-file-filter").addEventListener("change", () => {
    page = 1;
    draw();
  });
  $("#workspace-files-all").addEventListener("change", (e) => {
    for (const row of visible())
      if ((e.target as HTMLInputElement).checked) selected.add(row.id);
      else selected.delete(row.id);
    draw();
  });
  $("#workspace-files-upload").onclick = () => {
    uploadFolder = folderId;
    $<HTMLInputElement>("#workspace-files-input").click();
  };
  $("#workspace-files-empty-trash").onclick = () => void emptyFilesTrash();
  $("#workspace-files-trash").onclick = () => {
    if (busy) return;
    trash = !trash;
    page = 1;
    selected.clear();
    void load();
  };
  async function upload(files: File[], destination = folderId) {
    if (!files.length || busy || trash || !writable()) return;
    busy = true;
    draw();
    const progress = $<HTMLProgressElement>("#workspace-upload-progress");
    progress.hidden = false;
    progress.max = files.length;
    progress.value = 0;
    let done = 0;
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const original = files[i],
        mime = fileMime(original.name, original.type),
        file =
          original.type === mime
            ? original
            : new File([original], original.name, { type: mime });
      $("#workspace-files-status").textContent =
        `Subiendo ${i + 1} de ${files.length}…`;
      if (!validWorkspaceFile(file.type, file.size)) {
        failed.push(file.name);
        progress.value = i + 1;
        continue;
      }
      try {
        if (ctx.cloud()) {
          const body = new FormData();
          body.set("file", file);
          body.set("title", file.name);
          if (destination) body.set("folderId", destination);
          const r = await fetch("/api/saas/workspace-files", {
            method: "POST",
            body,
          });
          if (!r.ok) throw Error();
        } else {
          let optimized: Blob = file,
            mime = file.type,
            filename = file.name;
          if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
            const body = new FormData();
            body.set("file", file);
            const response = await fetch("/api/saas/optimize-image?demo=1", {
              method: "POST",
              body,
            });
            if (!response.ok) throw Error();
            optimized = await response.blob();
            mime = optimized.type;
            if (mime === "image/webp")
              filename = file.name.replace(/\.[^.]+$/, "") + ".webp";
          }
          await storage("files", "put", {
            id: scope() + ":" + crypto.randomUUID(),
            title: file.name,
            filename,
            mime,
            size: optimized.size,
            folderId: destination || undefined,
            createdAt: new Date().toISOString(),
            blob: optimized,
          });
        }
        done++;
      } catch {
        failed.push(file.name);
      }
      progress.value = i + 1;
    }
    busy = false;
    progress.hidden = true;
    $("#workspace-files-status").textContent =
      `${done} ${done === 1 ? "archivo añadido" : "archivos añadidos"}${destination ? " a " + (folders.find((f) => f.id === destination)?.name || "la carpeta") : ""}.` +
      (failed.length
        ? ` No se pudieron añadir ${failed.length}: ${failed.slice(0, 4).join(", ")}${failed.length > 4 ? "…" : ""}. Revisa el formato y el límite de 20 MB.`
        : "");
    await load();
  }
  $<HTMLInputElement>("#workspace-files-input").onchange = (e) => {
    const input = e.target as HTMLInputElement,
      files = Array.from(input.files || []);
    input.value = "";
    void upload(files, uploadFolder);
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-assets-view]")
    .forEach((b) => {
      b.onclick = () => {
        fallbackView = b.dataset.assetsView === "list" ? "list" : "grid";
        try {
          localStorage.setItem(
            "orbita:assets-view:" + ctx.actor().id,
            fallbackView,
          );
        } catch {}
        draw();
      };
    });
  $("#workspace-files-page-size").addEventListener("change", (e) => {
    const value = Number((e.target as HTMLSelectElement).value);
    if (![8, 12, 24, 48].includes(value)) return;
    fallbackSize = value;
    page = 1;
    try {
      localStorage.setItem(
        "orbita:assets-size:" + ctx.actor().id,
        String(value),
      );
    } catch {}
    draw();
  });
  $("#workspace-files-pagination").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-assets-page]",
    );
    if (!b || b.disabled) return;
    page = Number(b.dataset.assetsPage);
    draw();
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    const action = b.dataset.assetsBulk;
    if (action) {
      void bulk(action);
      return;
    }
    const id =
      b.dataset.assetOpen || b.dataset.assetDownload || b.dataset.assetRestore;
    if (!id) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (b.dataset.assetOpen) void preview(row);
    if (b.dataset.assetDownload)
      void blob(row)
        .then((data) => download(data, row.filename))
        .catch(() => ctx.notify("No pudimos descargar el archivo."));
    if (b.dataset.assetRestore)
      void change(row, true)
        .then(load)
        .catch(() => ctx.notify("No pudimos restaurar el archivo."));
  });
  $("#workspace-files-grid").addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.assetSelect) {
      if (el.checked) selected.add(el.dataset.assetSelect);
      else selected.delete(el.dataset.assetSelect);
      selection();
    }
  });
  function navigate(destination: string, mode = false) {
    if (busy) return;
    folderId = destination;
    recent = mode;
    trash = false;
    page = 1;
    selected.clear();
    $<HTMLInputElement>("#workspace-file-search").value = "";
    $<HTMLSelectElement>("#workspace-file-filter").value = "all";
    draw();
  }
  function drawLibrary() {
    const current = folders.find((f) => f.id === folderId),
      q = $<HTMLInputElement>("#workspace-file-search")
        .value.trim()
        .toLocaleLowerCase("es");
    $('#workspace-folder-context').hidden=!current&&!trash;
    const heading=panel.querySelector("h1")!;
    heading.textContent=current?.name || "Archivos";
    const caption=heading.nextElementSibling as HTMLElement;
    caption.textContent=current ? "Carpeta del equipo" : "Los recursos de tu equipo, en un solo lugar.";
    const count=current ? rows.filter(r=>r.folderId===current.id&&!r.deletedAt).length : 0;
    $('#workspace-current-folder').textContent=trash?'Papelera':current?`${count} ${count===1?"archivo":"archivos"}`:"";
    const back=$<HTMLButtonElement>('#workspace-folder-context [data-library-root]');
    back.disabled=busy;
    const shownFolders=folders.filter(f=>f.name.toLocaleLowerCase('es').includes(q));
    $('#workspace-folder-section').hidden=trash||!!folderId||recent||(!shownFolders.length&&!writable());
    $('#workspace-folder-total').textContent=String(shownFolders.length);
    $('#workspace-file-section-title').textContent=trash?'Papelera':recent?'Últimos archivos':current?'Archivos de la carpeta':'Archivos sin carpeta';
    $("#workspace-file-folders").hidden = trash || !!folderId || recent;
    $("#workspace-file-folders").innerHTML = ordered(folders,layout.folders)
      .filter((f) => f.name.toLocaleLowerCase("es").includes(q))
      .map((f) => {
        const count = rows.filter(
          (r) => !r.deletedAt && r.folderId === f.id,
        ).length;
        return `<article class="file-folder" data-folder-card="${esc(f.id)}" data-folder-drop="${esc(f.id)}"><button class="file-folder-open" data-open-folder="${esc(f.id)}" ${busy ? "disabled" : ""}>${uiIcon("folder", 28)}<span><strong>${esc(f.name)}</strong><small>${count} ${count === 1 ? "archivo" : "archivos"}</small></span></button><button class="icon-btn" data-folder-zip="${esc(f.id)}" aria-label="Descargar carpeta ${esc(f.name)}" ${busy || !count ? "disabled" : ""}>${uiIcon("export", 16)}</button></article>`;
      })
      .join("");
    if(writable()&&!trash&&!folderId)$('#workspace-file-folders').insertAdjacentHTML('beforeend',`<button class="file-folder-new" data-new-folder ${busy?'disabled':''}>${uiIcon('plus',24)}<span>Nueva carpeta</span></button>`);
    panel.classList.toggle('inside-folder',!!current&&!trash);
    const sidebar = $("#workspace-folder-sidebar");
    sidebar.hidden = !current || trash;
    sidebar.innerHTML = sidebar.hidden ? "" : ordered(folders, layout.folders).map(folder =>
      `<button type="button" data-open-folder="${esc(folder.id)}" ${folder.id === current?.id ? 'aria-current="page"' : ""} ${busy ? "disabled" : ""}>${uiIcon("folder", 16)}<span>${esc(folder.name)}</span></button>`,
    ).join("");
    $("#workspace-folder-actions").hidden = trash || !current;
    $("#workspace-folder-add").hidden = !writable() || !current || trash;
    $<HTMLButtonElement>("#workspace-folder-zip").disabled =
      busy || !rows.some((r) => !r.deletedAt && r.folderId === folderId);
    $<HTMLButtonElement>("#workspace-folder-add").disabled = busy;
    $("#workspace-file-dropzone").hidden = trash || !writable();
    $<HTMLButtonElement>("#workspace-drop-choose").disabled = busy;
    $("#workspace-file-drop-target").textContent = current
      ? "Se guardarán en " + current.name + "."
      : "Se guardarán en la biblioteca.";
    $("#workspace-files-move").hidden = trash || !writable();
    $("#workspace-files-upload").innerHTML =
      uiIcon("plus", 17) + (current ? "Subir a la carpeta" : "Subir archivos");
  }
  async function newFolder() {
    if (busy || folderId || !writable()) return;
    ctx.modal(
      '<h2>Nueva carpeta</h2><p>Organiza los archivos compartidos de tu equipo.</p><form id="workspace-folder-form"><label>Nombre<input name="name" required maxlength="80" placeholder="Por ejemplo, Campañas"/></label><p id="workspace-folder-error" role="alert"></p><button class="button primary" type="submit">Crear carpeta</button></form>',
    );
    $("#workspace-folder-form").onsubmit = async (e) => {
      e.preventDefault();
      if (!writable()) return;
      const form = e.target as HTMLFormElement,
        name = String(new FormData(form).get("name") || "")
          .trim()
          .replace(/\s+/g, " "),
        submit = form.querySelector<HTMLButtonElement>("button")!;
      if (!name) return;
      if (
        folders.some(
          (f) =>
            f.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"),
        )
      ) {
        $("#workspace-folder-error").textContent =
          "Ya tienes una carpeta con ese nombre.";
        return;
      }
      submit.disabled = true;
      try {
        let folder: Folder;
        if (ctx.cloud())
          folder = (
            await ctx.api("file-folders", {
              method: "POST",
              body: JSON.stringify({ name }),
            })
          ).doc;
        else {
          folder = {
            id: scope() + ":" + crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString(),
          };
          await storage("folders", "put", folder);
        }
        folders.push(folder);
        ctx.close();
        navigate(folder.id);
        ctx.notify("Carpeta creada. Ya puedes añadir archivos.");
      } catch (error) {
        $("#workspace-folder-error").textContent =
          error instanceof Error
            ? error.message
            : "No pudimos crear la carpeta.";
        submit.disabled = false;
      }
    };
  }
  async function moveFiles(ids: string[], destination: string) {
    if (busy || !writable() || trash) return;
    if (destination && !folders.some((f) => f.id === destination)) {
      ctx.notify("La carpeta ya no está disponible.");
      return;
    }
    const moving = rows.filter(
      (r) =>
        ids.includes(r.id) &&
        !r.deletedAt &&
        (r.folderId || "") !== destination,
    );
    if (!moving.length) {
      ctx.notify("Estos archivos ya están en esa ubicación.");
      return;
    }
    busy = true;
    draw();
    let done = 0;
    for (const row of moving) {
      try {
        if (ctx.cloud())
          await ctx.api("workspace-files", {
            method: "PATCH",
            body: JSON.stringify({ id: row.id, folderId: destination || null }),
          });
        else {
          await storage("files", "put", {
            ...row,
            folderId: destination || undefined,
            updatedAt: new Date().toISOString(),
          });
        }
        selected.delete(row.id);
        done++;
      } catch {}
    }
    busy = false;
    await load();
    ctx.notify(
      `${done} de ${moving.length} ${moving.length === 1 ? "archivo movido" : "archivos movidos"}.`,
    );
  }
  function movePicker() {
    if (!selected.size || !writable() || busy) return;
    const ids = [...selected];
    ctx.modal(
      `<h2>Mover ${ids.length === 1 ? "archivo" : "archivos"}</h2><form id="workspace-move-form"><label>Destino<select name="folder"><option value="">Biblioteca, sin carpeta</option>${folders.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></label><button class="button primary" type="submit">Mover aquí</button></form>`,
    );
    $("#workspace-move-form").onsubmit = (e) => {
      e.preventDefault();
      const dest = String(
        new FormData(e.target as HTMLFormElement).get("folder") || "",
      );
      ctx.close();
      void moveFiles(ids, dest);
    };
  }
  function addExisting() {
    if (!folderId || busy || !writable()) return;
    const candidates = rows.filter(
      (r) => !r.deletedAt && r.folderId !== folderId,
    );
    ctx.modal(
      `<h2>Añadir archivos a la carpeta</h2><p>Se moverán desde su ubicación actual, sin duplicarlos.</p><div class="heading-actions"><button class="button primary" id="folder-upload-new">Subir nuevos</button></div><form id="workspace-add-existing"><div class="folder-file-picker">${candidates.map((r) => `<label><input type="checkbox" name="file" value="${esc(r.id)}"/><span>${esc(r.title)}<small>${esc(folders.find((f) => f.id === r.folderId)?.name || "Biblioteca")}</small></span></label>`).join("") || '<p class="empty-state">No hay otros archivos para añadir. Puedes subir nuevos.</p>'}</div><button class="button primary" ${candidates.length ? "" : "disabled"}>Añadir a la carpeta</button></form>`,
    );
    $("#folder-upload-new").onclick = () => {
      uploadFolder = folderId;
      ctx.close();
      $<HTMLInputElement>("#workspace-files-input").click();
    };
    $("#workspace-add-existing").onsubmit = (e) => {
      e.preventDefault();
      const ids = new FormData(e.target as HTMLFormElement)
        .getAll("file")
        .map(String);
      if (!ids.length) return;
      ctx.close();
      void moveFiles(ids, folderId);
    };
  }
  async function downloadFolder(id: string) {
    if (busy || trash) return;
    const folder = folders.find((f) => f.id === id),
      files = rows.filter((r) => r.folderId === id && !r.deletedAt);
    if (!folder || !files.length) {
      ctx.notify("La carpeta está vacía.");
      return;
    }
    busy = true;
    draw();
    $("#workspace-files-status").textContent =
      "Preparando ZIP de " + folder.name + "…";
    try {
      if (
        files.length > 1000 ||
        files.reduce((sum, r) => sum + r.size, 0) > 100 * 1024 * 1024
      )
        throw Error(
          "La carpeta supera el límite de 100 MB o 1000 archivos. Descarga en grupos más pequeños.",
        );
      const contents = [];
      for (const row of files)
        contents.push({ name: row.filename, blob: await blob(row) });
      download(
        await documentZip(contents),
        folder.name.replace(/[\\/\x00-\x1f]/g, "_") + ".zip",
      );
      $("#workspace-files-status").textContent =
        "ZIP de " + folder.name + " listo.";
    } catch (error) {
      $("#workspace-files-status").textContent =
        error instanceof Error
          ? error.message
          : "No pudimos descargar la carpeta.";
    } finally {
      busy = false;
      draw();
    }
  }

  $("#workspace-folder-add").onclick = addExisting;
  $("#workspace-folder-zip").onclick = () => void downloadFolder(folderId);
  $("#workspace-drop-choose").onclick = () => {
    uploadFolder = folderId;
    $<HTMLInputElement>("#workspace-files-input").click();
  };
  const panel = $("[data-panel=files]");
  panel.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b || b.disabled) return;
    if(b.hasAttribute('data-new-folder'))void newFolder();
    if (b.hasAttribute("data-library-root")) navigate("");
    if (b.dataset.libraryMode) navigate("", b.dataset.libraryMode === "recent");
    if (b.dataset.openFolder) navigate(b.dataset.openFolder);
    if (b.dataset.folderZip) void downloadFolder(b.dataset.folderZip);
  });
  const dragMotion=fileDragMotion();
  panel.addEventListener("dragend",()=>{dragMotion.stop();clearDrop();});
  panel.addEventListener('dragstart',e=>{if((e.target as Element).closest('[data-asset-card],[data-folder-card]'))e.preventDefault();});
  function clearDrop() {
    panel.classList.remove("file-drag-over");
    panel
      .querySelectorAll(".folder-drop-over")
      .forEach((el) => el.classList.remove("folder-drop-over"));
  }
  panel.addEventListener("dragover", (e) => {
    if (!writable() || busy || trash || !e.dataTransfer) return;
    if (
      !Array.from(e.dataTransfer.types).some((t) =>
        ["Files", "application/x-orbita-files"].includes(t),
      )
    )
      return;
    e.preventDefault();
    panel.classList.toggle("file-drag-over",e.dataTransfer.types.includes("Files"));
    dragMotion.move(e.clientX,e.clientY);
    panel
      .querySelectorAll(".folder-drop-over")
      .forEach((el) => el.classList.remove("folder-drop-over"));
    (e.target as HTMLElement)
      .closest("[data-folder-drop]")
      ?.classList.add("folder-drop-over");
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files")
      ? "copy"
      : "move";
  });
  panel.addEventListener("dragleave", (e) => {
    if (!panel.contains(e.relatedTarget as Node)) clearDrop();
  });
  panel.addEventListener("drop", (e) => {
    if (!writable() || busy || trash || !e.dataTransfer) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-folder-drop]",
      ),
      destination = target?.dataset.folderDrop ?? folderId;
    const files = Array.from(e.dataTransfer.files),
      internal = e.dataTransfer.getData("application/x-orbita-files");
    if (!files.length && !internal) return;
    e.preventDefault();
    e.stopPropagation();
    clearDrop();
    dragMotion.stop();
    if (files.length) {
      void upload(files, destination);
      return;
    }
    try {
      const ids = JSON.parse(internal);
      if (
        Array.isArray(ids) &&
        ids.length <= 1000 &&
        ids.every((id) => typeof id === "string")
      )
        void moveFiles(ids, destination);
    } catch {
      ctx.notify("No pudimos mover esos archivos.");
    }
  });

  const kindIsList=(kind:string)=>kind==='files'&&display().view==='list';
  let fileDrag:{pointer:number;kind:'files'|'folders';node:HTMLElement;id:string;ids:string[];x:number;y:number;moved:boolean;before?:string;after?:boolean;destination?:string}|undefined,suppressFileClick=0;
  panel.addEventListener('click',e=>{if(Date.now()<suppressFileClick){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
  panel.addEventListener('pointerdown',e=>{
    const target=e.target as HTMLElement,node=target.closest<HTMLElement>('[data-asset-card],[data-folder-card]');
    if(!node||!writable()||busy||trash||e.button!==0||target.closest('input,[data-asset-download],[data-asset-restore],[data-folder-zip]'))return;
    const kind=node.dataset.folderCard?'folders':'files',id=node.dataset.folderCard||node.dataset.assetCard!;
    fileDrag={pointer:e.pointerId,kind,node,id,ids:kind==='files'&&selected.has(id)?[...selected]:[id],x:e.clientX,y:e.clientY,moved:false};
    if(target.closest('[data-asset-grip]')){e.preventDefault();node.setPointerCapture(e.pointerId);}
  });
  document.addEventListener('pointermove',e=>{
    const drag=fileDrag;if(!drag||drag.pointer!==e.pointerId)return;
    if(!drag.moved){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;drag.moved=true;dragMotion.start(drag.node,e.clientX,e.clientY);}
    e.preventDefault();dragMotion.move(e.clientX,e.clientY);drag.before=undefined;drag.destination=undefined;
    panel.querySelectorAll('.folder-drop-over,.file-sort-before').forEach(el=>el.classList.remove('folder-drop-over','file-sort-before'));
    const hit=document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null,folder=hit?.closest<HTMLElement>('[data-folder-drop]');
    if(drag.kind==='files'&&folder){drag.destination=folder.dataset.folderDrop!;folder.classList.add('folder-drop-over');}
    else{const other=hit?.closest<HTMLElement>(drag.kind==='files'?'[data-asset-card]':'[data-folder-card]'),id=other?.dataset.assetCard||other?.dataset.folderCard;if(other&&id&&id!==drag.id){drag.before=id;const r=other.getBoundingClientRect();drag.after=kindIsList(drag.kind)?e.clientY>r.y+r.height/2:e.clientX>r.x+r.width/2;other.classList.add('file-sort-before');}}
    if(e.clientY<95)window.scrollBy(0,-10);else if(e.clientY>innerHeight-45)window.scrollBy(0,10);
  },{passive:false});
  function endFileDrag(cancel=false){const drag=fileDrag;if(!drag)return;fileDrag=undefined;dragMotion.stop();clearDrop();panel.querySelectorAll('.file-sort-before').forEach(el=>el.classList.remove('file-sort-before'));if(drag.moved){suppressFileClick=Date.now()+400;if(!cancel){if(drag.destination!==undefined)void moveFiles(drag.ids,drag.destination);else if(drag.before)reorder(drag.kind,drag.ids,drag.before,drag.after);}}}
  document.addEventListener('pointerup',()=>endFileDrag());document.addEventListener('pointercancel',()=>endFileDrag(true));window.addEventListener('blur',()=>endFileDrag(true));
  document.addEventListener('orbita:view-change',()=>{endFileDrag(true);dragMotion.stop();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')endFileDrag(true);const node=(e.target as HTMLElement).closest<HTMLElement>('[data-asset-card],[data-folder-card]');if(!node||!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key)||!writable()||busy||trash)return;const kind=node.dataset.folderCard?'folders':'files',id=node.dataset.folderCard||node.dataset.assetCard!,all=ordered<{id:string}>(kind==='files'?rows:folders,layout[kind]).map(r=>r.id),i=all.indexOf(id),target=all[i+(e.key==='ArrowLeft'?-1:1)];if(target){e.preventDefault();reorder(kind,e.key==='ArrowLeft'?[id]:[target],e.key==='ArrowLeft'?target:id);panel.querySelector<HTMLButtonElement>(`[data-asset-card="${CSS.escape(id)}"] .asset-preview,[data-folder-card="${CSS.escape(id)}"] .file-folder-open`)?.focus();}});
  panel.addEventListener('click',e=>{const grip=(e.target as HTMLElement).closest<HTMLElement>('[data-asset-grip]');if(!grip||Date.now()<suppressFileClick||busy||!writable())return;selected.clear();selected.add(grip.dataset.assetGrip!);selection();movePicker();});
  async function choose(pick: (id: string) => void) {
    if (!canView(ctx.actor(), "files")) {
      ctx.notify("Necesitas permiso para ver Archivos.");
      return;
    }
    await load();
    ctx.modal(
      `<h2>Adjuntar archivo existente</h2><p>Selecciona un recurso compartido de Archivos. Se crea un vínculo, sin duplicarlo. Para subir uno nuevo usa Archivos.</p><div class="work-task-picker">${
        rows
          .filter((r) => !r.deletedAt)
          .map(
            (r) =>
              `<button class="button secondary" data-pick-file="${esc(r.id)}">${esc(r.title)}</button>`,
          )
          .join("") || "<p>Todavía no hay archivos disponibles.</p>"
      }</div>`,
    );
    document
      .querySelectorAll<HTMLElement>("[data-pick-file]")
      .forEach(
        (button) => (button.onclick = () => pick(button.dataset.pickFile!)),
      );
  }
  async function openLinked(id: string) {
    if (!canView(ctx.actor(), "files")) return;
    if (!loaded) await load();
    const row = rows.find((r) => r.id === id && !r.deletedAt);
    if (row) await preview(row);
    else ctx.notify("El archivo ya no está disponible o no tienes acceso.");
  }
  async function resource(id:string){if(!canView(ctx.actor(),'files'))throw Error('Necesitas permiso para ver Archivos.');if(!loaded)await load();const row=rows.find(r=>r.id===id&&!r.deletedAt);if(!row)throw Error('Archivo no disponible.');return {blob:await blob(row),mime:row.mime,title:row.title,filename:row.filename};}
  async function ingest(files:File[]){if(!writable()||busy||trash)throw Error('No puedes subir archivos ahora.');if(!loaded)await load();const previous=new Set(rows.map(r=>r.id));await upload(files,'');return rows.filter(r=>!previous.has(r.id)).map(r=>({id:r.id,mime:r.mime,title:r.title}));}
  return {
    resource,ingest,
    choose,
    openLinked,
    render: (view: string) => {
      if (view === "files") {
        if (!loaded) void load();
        else draw();
      } else {
        epoch++;
        observer?.disconnect();
        revoke();
      }
    },
    refresh: load,
  };
}
