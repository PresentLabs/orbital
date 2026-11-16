import { documentZip } from "@/lib/saas/zip";
import { prepareAvatar } from "@/lib/saas/avatar";
import { expired } from "../../services/payload/src/retention";
import { roleOptions, roleLabel } from "../../services/payload/src/roles";
import { validAvatar } from "@/lib/saas/formats";
import { matchesSearch, type SearchEntry } from "@/lib/saas/search";
import { validSocialLinks } from "../../services/payload/src/ecommerce";
import { demoPath, settingRoutes } from "@/lib/saas/routes";
import { orderDetails } from "@/lib/saas/order-details";
import { mountPdf } from "@/lib/saas/pdf-viewer";
import {
  uid,
  type WorkspaceState,
  type WorkspaceMember,
} from "@/lib/saas/model";
import { isAdmin } from "@/lib/saas/permissions";
import {
  formatRut,
  validRut,
  formatPhone,
  validPhone,
  validLogo,
} from "@/lib/saas/formats";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  cloud: () => boolean;
  api: (path: string, init?: RequestInit) => Promise<any>;
  mutate: (fn: () => void) => void;
  render: () => void;
  show: (view: string) => void;
  modal: (html: string) => void;
  close: () => void;
  notify: (text: string) => void;
  setActor: (member: WorkspaceMember) => void;
  integrations: () => void;
};
type FileDoc = {
  id: string;
  title: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
  kind: string;
  orderId?: number;
  folio?: string;
  blob?: Blob;
  deletedAt?: string;
};
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function samplePdf(title: string) {
  const stream = `BT /F1 22 Tf 60 760 Td (${title}) Tj 0 -45 Td /F1 12 Tf (Demo - documento de ejemplo. Sin validez tributaria.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
async function localFiles() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("orbita-documentos-demo", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    all: () =>
      new Promise<FileDoc[]>((resolve, reject) => {
        const r = db.transaction("files").objectStore("files").getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
    remove: (id: string) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
    put: (doc: FileDoc) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(doc);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  };
}
export function installBusiness(ctx: Ctx) {
  let settingsTab = "company",
    pendingLogo: string | undefined;
  let pendingAvatar: string | undefined;
  let customerOrderPage = 1;
  let customerId = "",
    customerPage = 1,
    customerQuery = "";
  let fileRows: FileDoc[] = [];
  const selectedDocuments = new Set<string>();
  let deletingDocuments = false;
  let zipBusy = false;
  let selectedFile = sessionStorage.getItem("orbita:selected-document") || "";
  let viewerFile = "";
  let fileOrigin =
    sessionStorage.getItem("orbita:document-origin") === "invoices"
      ? "invoices"
      : "documents";
  let objectUrl = "";
  let zoom = 1;
  let receiptUpload = false;
  let ordersPage = Math.max(
    1,
    Number(
      new URLSearchParams(location.search).get("pagina") ||
        new URLSearchParams(location.search).get("ordersPage"),
    ) || 1,
  );
  let ordersResult: any = null;
  let ordersLoadedAt = 0;
  let commerceEpoch = 0;
  let selectedOrder = "";
  let fromOrder = "orders";
  let fromPage = 1;
  const demoOrders = Array.from({ length: 23 }, (_, index) => ({
    id: 1001 + index,
    number: String(1001 + index),
    status: ["processing", "completed", "on-hold"][index % 3],
    date_created: new Date(Date.now() - index * 86400000).toISOString(),
    total: String(24990 + index * 1350),
    currency: "CLP",
    billing: {
      first_name: "Cliente",
      last_name: "de ejemplo " + (index + 1),
      email: "cliente" + (index + 1) + "@example.com",
      phone: "",
      address_1: "Dirección de ejemplo",
      city: "Santiago",
      country: "CL",
    },
    shipping: { address_1: "Dirección de ejemplo", city: "Santiago" },
    line_items: [
      {
        id: 1,
        name: "Producto de ejemplo",
        sku: "DEMO-001",
        quantity: 1,
        total: String(24990 + index * 1350),
      },
    ],
    shipping_lines: [],
    fee_lines: [],
    discount_total: "0",
    shipping_total: "0",
    total_tax: "0",
    payment_method_title: "Pago de ejemplo",
    customer_note: "",
  }));
  function brand() {
    const logo = pendingLogo ?? ctx.state().settings.logoData;
    const element = $<HTMLAnchorElement>(".brand");
    if (logo && validLogo(logo)) {
      element.innerHTML = `<img src="${esc(logo)}" alt="${esc(ctx.state().settings.name)}" class="business-logo"/>`;
      element.setAttribute("aria-label", ctx.state().settings.name);
    } else {
      element.innerHTML =
        '<span class="brand-symbol">✳</span> orbital<span class="brand-period">®</span>';
      element.setAttribute("aria-label", "Orbital");
    }
    $("#profile-name").textContent =
      "Hola, " + (ctx.actor().firstName || ctx.actor().name.split(" ")[0]);
    $("#overview-greeting").textContent =
      "Hola, " +
      (ctx.actor().firstName || ctx.actor().name.split(" ")[0]) +
      ".";
    const preview = $("#logo-preview");
    preview.innerHTML =
      logo && validLogo(logo)
        ? `<img src="${esc(logo)}" alt="Vista previa del logo"/>`
        : "✳";
    $("#store-navigation").hidden = !isAdmin(ctx.actor());
  }
  function tab(value: string, navigate = false) {
    settingsTab = [
      "company",
      "brand",
      "preferences",
      "social",
      "integrations",
    ].includes(value)
      ? value
      : "company";
    document
      .querySelectorAll<HTMLElement>("[data-settings-panel]")
      .forEach((el) => (el.hidden = el.dataset.settingsPanel !== settingsTab));
    document
      .querySelectorAll<HTMLElement>("[data-settings-tab]")
      .forEach((el) =>
        el.setAttribute(
          "aria-selected",
          String(el.dataset.settingsTab === settingsTab),
        ),
      );
    $("#settings-form").hidden = settingsTab === "integrations";
    if (settingsTab === "integrations") ctx.integrations();
    if (
      navigate &&
      location.pathname.startsWith("/app/configuracion") &&
      location.pathname !== "/app/configuracion/" + settingRoutes[settingsTab]
    )
      window.history.pushState(
        null,
        "",
        demoPath("/app/configuracion/" + settingRoutes[settingsTab]),
      );
  }
  document
    .querySelectorAll<HTMLElement>("[data-settings-tab]")
    .forEach((b) => (b.onclick = () => tab(b.dataset.settingsTab!, true)));
  document.querySelector<HTMLElement>(".settings-tabs")?.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"));
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    tab(tabs[next].dataset.settingsTab!, true);
  });
  $<HTMLInputElement>("#settings-form [name=rut]").oninput = (e) => {
    const i = e.target as HTMLInputElement;
    i.value = formatRut(i.value);
  };
  $<HTMLInputElement>("#settings-form [name=phone]").oninput = (e) => {
    const input = e.target as HTMLInputElement;
    input.value = formatPhone(input.value);
  };
  $("#settings-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement),
      rut = formatRut(String(f.get("rut") || ""));
    if (rut && !validRut(rut)) {
      $("#settings-error").textContent =
        "Revisa el RUT y su dígito verificador.";
      tab("company");
      return;
    }
    const socialLinks = Object.fromEntries(
      [...f.entries()]
        .filter(([key]) => key.startsWith("social-"))
        .map(([key, value]) => [key.slice(7), String(value).trim()]),
    );
    if (
      !validPhone(String(f.get("phone") || "")) ||
      !validSocialLinks(socialLinks)
    ) {
      $("#settings-error").textContent =
        "Revisa el teléfono y los enlaces de redes sociales (https://).";
      return;
    }
    const logo = pendingLogo ?? ctx.state().settings.logoData;
    if (!validLogo(logo)) {
      $("#settings-error").textContent = "El logo no es válido.";
      return;
    }
    $("#settings-error").textContent = "";
    ctx.mutate(() => {
      ctx.state().settings = {
        ...ctx.state().settings,
        name: String(f.get("name")).trim(),
        email: String(f.get("email")),
        rut,
        giro: String(f.get("giro") || ""),
        phone: formatPhone(String(f.get("phone") || "")),
        socialLinks,
        logoData: logo,
        currency: String(f.get("currency")),
        timezone: String(f.get("timezone")),
      };
    });
    pendingLogo = undefined;
    brand();
    ctx.notify("Configuración guardada.");
  };
  $<HTMLInputElement>("#logo-upload").onchange = (e) => {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    if (
      file.size > 250000 ||
      !["image/png", "image/svg+xml"].includes(file.type)
    ) {
      ctx.notify("Elige un logo PNG o SVG de hasta 250 KB.");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      if (!validLogo(value)) {
        ctx.notify(
          "Este SVG contiene elementos que no se pueden usar en un logo.",
        );
        return;
      }
      pendingLogo = value;
      brand();
      ctx.notify("Vista previa lista. Guarda los cambios para usar el logo.");
    };
    reader.readAsDataURL(file);
    input.value = "";
  };
  $("#remove-logo").onclick = () => {
    pendingLogo = "";
    brand();
  };
  function renderSettings() {
    for (const [key, value] of Object.entries(
      ctx.state().settings.socialLinks || {},
    )) {
      const input = document.querySelector<HTMLInputElement>(
        `[name="social-${key}"]`,
      );
      if (input && document.activeElement !== input) input.value = value;
    }
    brand();
    tab(settingsTab);
  }
  const passwordForm = $<HTMLFormElement>("#profile-password");
  passwordForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!ctx.cloud()) return;
    const form = new FormData(passwordForm);
    const status = passwordForm.querySelector<HTMLElement>('[role="status"]')!;
    const submit = passwordForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    if (submit.disabled) return;
    const password = form.get("password");
    if (password !== form.get("confirm")) {
      status.textContent = "Las contraseñas no coinciden.";
      return;
    }
    submit.disabled = true;
    status.textContent = "";
    try {
      await ctx.api("profile/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.get("currentPassword"), password }),
      });
      passwordForm.reset();
      status.textContent = "Contraseña actualizada.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "No pudimos cambiar tu contraseña.";
    } finally {
      submit.disabled = false;
    }
  };
  function renderProfile() {
    passwordForm.hidden = !ctx.cloud();
    const workspace = $<HTMLSelectElement>("#profile-workspace");
    workspace.replaceChildren(new Option(ctx.state().settings.name));
    const member = ctx.actor();
    $("#person-display-name").textContent = member.name;
    $("#person-avatar").textContent = member.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("");
    $("#person-access-role").textContent = roleLabel(member.role);
    const roleSelect = $<HTMLSelectElement>("#profile-form [name=accessRole]");
    roleSelect.innerHTML = roleOptions
      .map((r) => `<option value="${r.value}">${r.label}</option>`)
      .join("");
    roleSelect.value = member.role === "owner" ? "admin" : member.role;
    const avatar = pendingAvatar ?? member.avatarData;
    if (avatar && validAvatar(avatar))
      $("#person-avatar").innerHTML =
        `<img src="${esc(avatar)}" alt="Tu foto de perfil"/>`;
    const data = {
      firstName: member.firstName || member.name.split(" ")[0],
      lastName: member.lastName ?? member.name.split(" ").slice(1).join(" "),
      phone: member.phone || "",
    };
    for (const [key, value] of Object.entries(data)) {
      const input = $<HTMLInputElement>("#profile-form [name=" + key + "]");
      if (document.activeElement !== input) input.value = value;
    }
  }
  $("#avatar-upload-trigger").onclick = () =>
    $<HTMLInputElement>("#avatar-upload").click();
  $("#avatar-upload").onchange = async (e) => {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const trigger = $<HTMLButtonElement>("#avatar-upload-trigger");
    trigger.disabled = true;
    trigger.setAttribute("aria-busy", "true");
    try {
      const value = await prepareAvatar(file);
      if (!validAvatar(value)) throw Error("La imagen no es válida.");
      pendingAvatar = value;
      $("#person-avatar").innerHTML =
        `<img src="${esc(value)}" alt="Tu foto de perfil"/>`;
      ctx.notify("Foto ajustada. Guarda tu perfil para usarla.");
    } catch (error) {
      ctx.notify(
        error instanceof Error
          ? error.message
          : "No pudimos preparar esa foto.",
      );
    } finally {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
    }
  };
  $<HTMLInputElement>("#profile-form [name=phone]").oninput = (e) => {
    const input = e.target as HTMLInputElement;
    input.value = formatPhone(input.value);
  };
  $("#profile-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(
      new FormData(e.target as HTMLFormElement),
    ) as Record<string, string>;
    data.jobTitle = ctx.actor().jobTitle || "";
    if (pendingAvatar !== undefined) data.avatarData = pendingAvatar;
    if (!validPhone(data.phone)) {
      $("#profile-error").textContent =
        "Revisa el teléfono. Debe incluir 9 dígitos después de +56.";
      return;
    }
    $("#profile-error").textContent = "";
    try {
      if (ctx.cloud()) {
        ctx.setActor(
          (
            await ctx.api("profile", {
              method: "PATCH",
              body: JSON.stringify(data),
            })
          ).user,
        );
      } else {
        ctx.mutate(() => {
          const me = ctx
            .state()
            .demoMembers!.find((m) => m.id === ctx.actor().id)!;
          Object.assign(me, data, {
            name: (data.firstName + " " + data.lastName).trim(),
          });
        });
      }
      ctx.render();
      brand();
      pendingAvatar = undefined;
      ctx.notify("Tu perfil quedó actualizado.");
    } catch (e) {
      $("#profile-error").textContent =
        e instanceof Error ? e.message : "No pudimos guardar tu perfil.";
    }
  };
  async function listFiles() {
    if (ctx.cloud()) {
      fileRows = (await ctx.api("files")).docs;
      return;
    }
    const store = await localFiles();
    fileRows = await store.all();
    for (const file of fileRows)
      if (file.deletedAt && expired(file.deletedAt))
        await store.remove(file.id);
    fileRows = fileRows.filter((f) => !f.deletedAt || !expired(f.deletedAt));
    if (!fileRows.length && !localStorage.getItem("orbita:files-seeded")) {
      for (const [id, title, kind, orderId] of [
        ["demo-doc", "Guía de bienvenida", "documento", undefined],
        ["demo-boleta", "Boleta de ejemplo", "boleta", 1001],
        ["demo-factura", "Factura de ejemplo", "factura", 1002],
      ] as const) {
        const blob = samplePdf(
          title === "Guía de bienvenida" ? "Guia de bienvenida" : title,
        );
        await store.put({
          id,
          title,
          kind,
          orderId,
          folio: kind === "documento" ? "" : "DEMO-" + orderId,
          filename: id + ".pdf",
          mime: "application/pdf",
          size: blob.size,
          createdAt: new Date().toISOString(),
          blob,
        });
      }
      fileRows = await store.all();
      localStorage.setItem("orbita:files-seeded", "1");
    }
  }
  function filteredDocuments() {
    const term = $<HTMLInputElement>("#document-search").value.toLowerCase(), type = $<HTMLSelectElement>("#document-filter").value;
    return fileRows.filter(f => !f.deletedAt && (f.title + " " + f.filename).toLowerCase().includes(term) && (type === "all" || f.mime.startsWith(type)));
  }
  let documentPage = 1;
  let temporaryDocumentPageSize: number | undefined;
  function documentPageSize() {
    if (temporaryDocumentPageSize) return temporaryDocumentPageSize;
    try {
      const value = Number(localStorage.getItem("orbita:documents-page-size:" + ctx.actor().id));
      return [8, 12, 24, 48].includes(value) ? value : 12;
    } catch { return 12; }
  }
  function visibleDocuments() {
    const size = documentPageSize();
    return filteredDocuments().slice((documentPage - 1) * size, documentPage * size);
  }
  function updateDocumentSelection() {
    const visible = visibleDocuments(), box = $<HTMLInputElement>("#document-select-all");
    box.checked = visible.length > 0 && visible.every(f => selectedDocuments.has(f.id));
    box.indeterminate = !box.checked && visible.some(f => selectedDocuments.has(f.id));
    box.disabled = !visible.length || zipBusy;
    const button = $<HTMLButtonElement>("#download-document-zip");
    button.disabled = !selectedDocuments.size || zipBusy;
    const deleteButton = $<HTMLButtonElement>("#delete-selected-documents");
    deleteButton.disabled = !selectedDocuments.size || zipBusy || !isAdmin(ctx.actor());
    deleteButton.setAttribute("aria-busy", String(deletingDocuments));
    button.textContent = zipBusy && !deletingDocuments ? "Preparando ZIP…" : `Descargar ZIP${selectedDocuments.size ? ` (${selectedDocuments.size})` : ""}`;
    $("#document-selection-count").textContent = `${selectedDocuments.size} seleccionado${selectedDocuments.size === 1 ? "" : "s"}`;
  }
  function documentView(): "grid" | "list" {
    try { return localStorage.getItem("orbita:documents-view:" + ctx.actor().id) === "list" ? "list" : "grid"; }
    catch { return "grid"; }
  }
  let temporaryDocumentView: "grid" | "list" | undefined;
  function drawDocuments() {
    const total = filteredDocuments().length, size = documentPageSize(), pages = Math.max(1, Math.ceil(total / size));
    documentPage = Math.max(1, Math.min(documentPage, pages));
    $<HTMLSelectElement>("#document-page-size").value = String(size);
    $("#documents-pagination").innerHTML = `<span>${total} ${total === 1 ? "documento" : "documentos"} · Página ${documentPage} de ${pages}</span><div><button class="button secondary" data-documents-page="${documentPage - 1}" ${documentPage === 1 ? "disabled" : ""}>← Anterior</button><button class="button secondary" data-documents-page="${documentPage + 1}" ${documentPage === pages ? "disabled" : ""}>Siguiente →</button></div>`;
    const view = temporaryDocumentView || documentView();
    $("#document-grid").classList.toggle("documents-list", view === "list");
    document.querySelectorAll<HTMLButtonElement>("[data-document-view]").forEach(button => {
      const selected = button.dataset.documentView === view;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("#document-grid").innerHTML =
      visibleDocuments()
        .map(
          (f) =>
            `<article class="file-card"><label class="document-selection"><input type="checkbox" data-select-document="${esc(f.id)}" aria-label="Seleccionar ${esc(f.title)}" ${selectedDocuments.has(f.id) ? "checked" : ""} ${zipBusy ? "disabled" : ""}/><span>Seleccionar</span></label><button class="file-preview" data-open-document="${esc(f.id)}"><span class="file-type ${f.mime.startsWith("image/") ? "image" : ""}">${f.mime === "application/pdf" ? "PDF" : f.mime.startsWith("image/") ? "IMG" : "TXT"}</span><span class="file-lines"></span></button><div class="file-card-info"><h2>${esc(f.title)}</h2><p>${esc(f.filename)} · ${Math.max(1, Math.round(f.size / 1024))} KB</p><div><button class="button primary directory-action-button" data-open-document="${esc(f.id)}">Ver documento</button><button class="icon-btn" data-download-document="${esc(f.id)}" aria-label="Descargar ${esc(f.title)}">↓</button></div></div></article>`,
        )
        .join("") ||
      '<div class="empty-state">No encontramos documentos con ese nombre.</div>';
    updateDocumentSelection();
  }
  document.querySelectorAll<HTMLButtonElement>("[data-document-view]").forEach(button => {
    button.onclick = () => {
      const view = button.dataset.documentView === "list" ? "list" : "grid";
      temporaryDocumentView = view;
      try { localStorage.setItem("orbita:documents-view:" + ctx.actor().id, view); } catch { /* Keep the selected view for this session. */ }
      drawDocuments();
    };
  });
  $("#document-page-size").addEventListener("change", e => {
    const size = Number((e.target as HTMLSelectElement).value);
    if (![8, 12, 24, 48].includes(size)) return;
    temporaryDocumentPageSize = size;
    documentPage = 1;
    try { localStorage.setItem("orbita:documents-page-size:" + ctx.actor().id, String(size)); } catch { /* Retain the size in memory. */ }
    drawDocuments();
  });
  $("#documents-pagination").addEventListener("click", e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-documents-page]");
    if (!button || button.disabled) return;
    documentPage = Number(button.dataset.documentsPage);
    drawDocuments();
  });
  $("#document-grid").addEventListener("change", e => {
    const input = e.target as HTMLInputElement;
    if (!input.dataset.selectDocument) return;
    if (input.checked) selectedDocuments.add(input.dataset.selectDocument); else selectedDocuments.delete(input.dataset.selectDocument);
    updateDocumentSelection();
  });
  $("#document-select-all").addEventListener("change", e => {
    const checked = (e.target as HTMLInputElement).checked;
    for (const file of visibleDocuments()) if (checked) selectedDocuments.add(file.id); else selectedDocuments.delete(file.id);
    drawDocuments();
  });
  $("#download-document-zip").onclick = async () => {
    if (zipBusy || !selectedDocuments.size || !isAdmin(ctx.actor())) return;
    zipBusy = true; drawDocuments();
    try {
      const selected = fileRows.filter(f => !f.deletedAt && selectedDocuments.has(f.id));
      if (selected.reduce((total, f) => total + f.size, 0) > 100 * 1024 * 1024) throw Error("La selección supera los 100 MB. Descarga los documentos en grupos más pequeños.");
      const files = [];
      for (const file of selected) files.push({name: file.filename, blob: (await fileBlob(file.id)).blob});
      const blob = await documentZip(files), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "documentos-" + new Date().toISOString().slice(0, 10) + ".zip"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      ctx.notify("Tu ZIP está listo.");
    } catch (error) { ctx.notify(error instanceof Error ? error.message : "No pudimos preparar el ZIP. Inténtalo de nuevo."); }
    finally { zipBusy = false; drawDocuments(); }
  };
  $("#delete-selected-documents").onclick = async () => {
    if (zipBusy || !selectedDocuments.size || !isAdmin(ctx.actor())) return;
    const ids = fileRows.filter(file => !file.deletedAt && selectedDocuments.has(file.id)).map(file => file.id);
    zipBusy = true;
    deletingDocuments = true;
    drawDocuments();
    let deleted = 0;
    try {
      for (const id of ids) {
        try { await moveDocumentToTrash(id); selectedDocuments.delete(id); deleted++; }
        catch { /* Keep unsuccessful items selected so the user can retry. */ }
      }
      await listFiles();
      ctx.notify(`${deleted} de ${ids.length} documentos enviados a la papelera por 30 días.`);
    } catch { ctx.notify("No pudimos actualizar el listado. Vuelve a intentarlo."); }
    finally { zipBusy = false; deletingDocuments = false; drawDocuments(); }
  };
  async function renderDocuments() {
    if (!isAdmin(ctx.actor())) return;
    $("#documents-note").textContent = ctx.cloud()
      ? "Documentos compartidos con los administradores y el propietario del negocio."
      : "Documentos de ejemplo. Los archivos que subas en la demo se guardan en este navegador.";
    try {
      await listFiles();
      for (const id of selectedDocuments) if (!fileRows.some(f => f.id === id && !f.deletedAt)) selectedDocuments.delete(id);
      drawDocuments();
    } catch (e) {
      $("#document-grid").innerHTML =
        `<p class="empty-state">${esc(e instanceof Error ? e.message : "No pudimos cargar los documentos.")}</p>`;
    }
  }
  $("#document-search").addEventListener("input", () => { documentPage = 1; drawDocuments(); });
  $("#document-filter").addEventListener("change", () => { documentPage = 1; drawDocuments(); });
  async function fileBlob(id: string) {
    if (!fileRows.length) await listFiles();
    const doc = fileRows.find((f) => f.id === id);
    if (!doc) throw Error("No encontramos ese documento.");
    if (ctx.cloud()) {
      const response = await fetch(
        "/api/saas/files?id=" + encodeURIComponent(id),
      );
      if (!response.ok) throw Error("No pudimos abrir el archivo.");
      return { doc, blob: await response.blob() };
    }
    return { doc, blob: doc.blob! };
  }
  async function downloadFile(id: string) {
    try {
      const { doc, blob } = await fileBlob(id);
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) {
      ctx.notify(
        e instanceof Error ? e.message : "No pudimos descargar el archivo.",
      );
    }
  }
  function openFile(id: string, origin?: "invoices" | "documents") {
    fileOrigin =
      origin ||
      (!document.querySelector<HTMLElement>('[data-panel="invoices"]')?.hidden
        ? "invoices"
        : "documents");
    sessionStorage.setItem("orbita:document-origin", fileOrigin);
    viewerFile = "";
    selectedFile = id;
    sessionStorage.setItem("orbita:selected-document", id);
    ctx.show("document");
    window.history.replaceState(
      null,
      "",
      demoPath("/app/documentos/ver/" +
        encodeURIComponent(id) +
        (fileOrigin === "invoices" ? "?origen=facturas-y-boletas" : "")),
    );
  }
  async function renderViewer() {
    if (viewerFile === selectedFile && $("#document-viewer").childElementCount)
      return;
    try {
      const { doc, blob } = await fileBlob(selectedFile);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      viewerFile = selectedFile;
      zoom = 1;
      $("#document-viewer").innerHTML =
        `<div class="viewer-heading"><div><button class="back-link" data-action="back-documents">← Volver a ${fileOrigin === "invoices" ? "facturas y boletas" : "documentos"}</button><h1>${esc(doc.title)}</h1><p>${esc(doc.filename)} · ${Math.max(1, Math.round(doc.size / 1024))} KB</p></div><div class="heading-actions">${doc.mime.startsWith("image/") ? '<button class="icon-btn" data-viewer-zoom="out" aria-label="Reducir imagen">−</button><button class="icon-btn" data-viewer-zoom="in" aria-label="Ampliar imagen">+</button>' : ""}<button class="button secondary" data-delete-file="${esc(doc.id)}">Enviar a papelera</button><button class="button primary" data-download-document="${esc(doc.id)}">↓ Descargar</button></div></div><div class="file-viewer-surface">${doc.mime === "application/pdf" ? `<div id="pdf-document" aria-label="Visor de PDF">Cargando documento…</div>` : doc.mime.startsWith("image/") ? `<img id="viewer-image" alt="${esc(doc.title)}" src="${objectUrl}"/>` : `<pre>${esc(await blob.text())}</pre>`}</div>`;
      if (doc.mime === "application/pdf") {
        const host = $("#pdf-document");
        const pdfUrl = objectUrl;
        try {
          await mountPdf(host, blob);
        } catch {
          if (host.isConnected && objectUrl === pdfUrl) {
            host.closest(".file-viewer-surface")!.innerHTML =
              `<iframe src="${esc(pdfUrl)}" title="${esc(doc.title)}"></iframe>`;
          }
        }
      }
    } catch (e) {
      $("#document-viewer").innerHTML =
        `<button class="back-link" data-action="back-documents">← Volver</button><p class="empty-state">${esc(e instanceof Error ? e.message : "No pudimos abrir el documento.")}</p>`;
    }
  }
  function upload(receipt = false) {
    receiptUpload = receipt;
    $<HTMLInputElement>("#document-upload").click();
  }
  $<HTMLInputElement>("#document-upload").onchange = (e) => {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    input.value = "";
    if (file.size > 20 * 1024 * 1024) {
      ctx.notify("El archivo debe pesar menos de 20 MB.");
      return;
    }
    ctx.modal(
      `<h2>${receiptUpload ? "Subir comprobante" : "Subir documento"}</h2><p>${esc(file.name)} · ${Math.max(1, Math.round(file.size / 1024))} KB</p><form id="upload-file-form"><label>Título<input name="title" required maxlength="160" value="${esc(file.name.replace(/\.[^.]+$/, ""))}"/></label><label>Tipo<select name="kind" id="upload-file-kind"><option value="documento" ${!receiptUpload ? "selected" : ""}>Documento</option><option value="factura">Factura</option><option value="boleta" ${receiptUpload ? "selected" : ""}>Boleta</option></select></label><div id="receipt-fields"><label>Pedido asociado<input name="orderId" type="number" min="1" placeholder="Número de pedido"/></label><label>Folio<input name="folio" maxlength="80" placeholder="Folio del comprobante emitido"/></label></div><p class="field-hint">Sube un comprobante emitido por tu facturador. Orbital lo guarda, no lo emite.</p><p id="upload-error" class="form-error" role="alert"></p><button class="button primary">Guardar archivo</button></form>`,
    );
    const kind = $<HTMLSelectElement>("#upload-file-kind");
    const syncKind = () => {
      const receipt = kind.value !== "documento";
      $("#receipt-fields").hidden = !receipt;
      $<HTMLInputElement>("#receipt-fields [name=orderId]").required = receipt;
    };
    kind.onchange = syncKind;
    syncKind();
    $("#upload-file-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement,
        body = new FormData(form);
      try {
        if (ctx.cloud()) {
          body.set("file", file);
          const response = await fetch("/api/saas/files", {
            method: "POST",
            body,
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error);
        } else {
          const supported = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "text/plain",
            "text/markdown",
            "text/csv",
          ];
          if (!supported.includes(file.type))
            throw Error("Elige un PDF, imagen o archivo de texto.");
          const store = await localFiles();
          await store.put({
            id: uid(),
            title: String(body.get("title")),
            filename: file.name,
            mime: file.type,
            size: file.size,
            kind: String(body.get("kind")),
            orderId: Number(body.get("orderId")) || undefined,
            folio: String(body.get("folio") || ""),
            createdAt: new Date().toISOString(),
            blob: file,
          });
        }
        ctx.close();
        ctx.notify("Archivo guardado.");
        ctx.render();
      } catch (e) {
        $("#upload-error").textContent =
          e instanceof Error ? e.message : "No pudimos subir el archivo.";
      }
    };
  };
  const money = (value: unknown, currency = "CLP") =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(Number(value) || 0);
  const status = (value: string) =>
    (
      ({
        processing: "En preparación",
        completed: "Completado",
        "on-hold": "En espera",
        pending: "Pendiente",
        cancelled: "Cancelado",
        refunded: "Reembolsado",
        failed: "Fallido",
      }) as Record<string, string>
    )[value] || value;
  function orderHref(id: number, from = "orders") {
    return demoPath(
      "/app/tienda/pedidos/" +
      id +
      "?origen=" +
      (from === "invoices" ? "facturas-y-boletas" : "pedidos") +
      "&pagina=" +
      ordersPage
    );
  }
  async function renderOrders(force = false) {
    if (!isAdmin(ctx.actor())) return;
    if (!force && ordersResult && Date.now() - ordersLoadedAt < 8000) {
      drawOrders();
      return;
    }
    $("#orders-table").innerHTML =
      '<p class="empty-state">Cargando pedidos…</p>';
    const epoch = commerceEpoch;
    try {
      const result = ctx.cloud()
        ? await ctx.api("orders?page=" + ordersPage)
        : {
            connected: true,
            docs: demoOrders.slice((ordersPage - 1) * 10, ordersPage * 10),
            total: demoOrders.length,
            pages: Math.ceil(demoOrders.length / 10),
            page: ordersPage,
          };
      if (epoch !== commerceEpoch) return;
      ordersResult = result;
      ordersLoadedAt = Date.now();
      drawOrders();
    } catch (e) {
      $("#orders-table").innerHTML =
        `<p class="empty-state">${esc(e instanceof Error ? e.message : "No pudimos cargar los pedidos.")}</p>`;
    }
  }
  function drawOrders() {
    $("#orders-note").textContent = ctx.cloud()
      ? ordersResult.connected
        ? "Pedidos consultados desde WooCommerce."
        : "Conecta WooCommerce en Configuración → Integraciones para consultar tus pedidos."
      : "Pedidos de ejemplo para explorar la navegación y sus detalles.";
    $("#orders-table").innerHTML =
      `<table class="business-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${ordersResult.docs.map((order: any) => `<tr><td><strong>#${esc(order.number)}</strong></td><td>${esc(order.billing?.first_name)} ${esc(order.billing?.last_name)}</td><td>${esc(new Date(order.date_created).toLocaleDateString("es-CL"))}</td><td><span class="commerce-pill order-status-${["pending","processing","on-hold","completed","cancelled","refunded","failed","checkout-draft"].includes(order.status) ? order.status : "other"}">${esc(status(order.status))}</span></td><td>${esc(money(order.total, order.currency))}</td><td><a class="button primary compact-table-action" href="${orderHref(order.id)}">Ver pedido ↗</a></td></tr>`).join("") || '<tr><td colspan="6">No hay pedidos para mostrar.</td></tr>'}</tbody></table>`;
    $("#orders-pagination").innerHTML =
      `<span>${ordersResult.total || 0} pedidos · Página ${ordersPage} de ${Math.max(1, ordersResult.pages || 1)}</span><div><button class="button secondary" data-order-page="${ordersPage - 1}" ${ordersPage <= 1 ? "disabled" : ""}>← Anterior</button><button class="button secondary" data-order-page="${ordersPage + 1}" ${ordersPage >= ordersResult.pages ? "disabled" : ""}>Siguiente →</button></div>`;
  }
  async function renderReceipts(reload = true) {
    if (!isAdmin(ctx.actor())) return;
    $("#receipts-note").textContent = ctx.cloud()
      ? "Comprobantes subidos por tu equipo y vinculados a pedidos. Puedes incorporar los archivos emitidos por tu facturador."
      : "Facturas y boletas de ejemplo, sin validez tributaria.";
    try {
      if (reload) await listFiles();
      const kind = $<HTMLSelectElement>("#receipt-kind-filter").value,
        order = $<HTMLInputElement>("#receipt-order-search")
          .value.trim()
          .replace(/^#/, "");
      const receipts = fileRows.filter(
        (f) =>
          !f.deletedAt &&
          f.kind !== "documento" &&
          (kind === "all" || f.kind === kind) &&
          (!order || String(f.orderId || "").includes(order)),
      );
      $("#receipts-table").innerHTML =
        `<table class="business-table"><thead><tr><th>Tipo</th><th>Documento / folio</th><th>Pedido</th><th>Archivo</th><th>Descargar</th><th>Ver pedido</th></tr></thead><tbody>${receipts.map((f) => `<tr><td><span class="commerce-pill receipt-${f.kind === "factura" ? "factura" : "boleta"}">${f.kind === "factura" ? "Factura" : "Boleta"}</span></td><td>${esc(f.title)}<small>${esc(f.folio || "Sin folio indicado")}</small></td><td>#${esc(f.orderId)}</td><td><button class="button primary compact-table-action" data-open-document="${esc(f.id)}">Ver documento</button></td><td><button class="button secondary small-button" data-download-document="${esc(f.id)}">Descargar</button></td><td><a class="button primary compact-table-action" href="${orderHref(f.orderId!, "invoices")}">Ver pedido ↗</a></td></tr>`).join("") || `<tr><td colspan="6">${kind !== "all" || order ? "No hay comprobantes que coincidan con estos filtros." : "Todavía no hay comprobantes asociados."}</td></tr>`}</tbody></table>`;
    } catch (e) {
      $("#receipts-table").innerHTML =
        `<p class="empty-state">${esc(e instanceof Error ? e.message : "No pudimos cargar los comprobantes.")}</p>`;
    }
  }
  $("#receipt-kind-filter").onchange = () => void renderReceipts(false);
  let receiptTimer: ReturnType<typeof setTimeout>;
  $("#receipt-order-search").oninput = () => {
    clearTimeout(receiptTimer);
    receiptTimer = setTimeout(() => void renderReceipts(false), 160);
  };
  function setOrder(id: string, from = "orders", page = 1) {
    selectedOrder = id;
    fromOrder = ["invoices", "facturas-y-boletas"].includes(from)
      ? "invoices"
      : "orders";
    fromPage = page;
  }
  async function renderOrder() {
    $("#order-detail").innerHTML =
      '<p class="empty-state">Cargando el pedido…</p>';
    try {
      const order = ctx.cloud()
        ? (await ctx.api("orders?id=" + selectedOrder)).doc
        : demoOrders.find((o) => String(o.id) === selectedOrder);
      if (!order) throw Error("No encontramos ese pedido.");
      const billing = order.billing || {},
        shipping = order.shipping || {};
      $("#order-detail").innerHTML =
        `<a class="back-link" href="${demoPath(`/app/tienda/${fromOrder === "invoices" ? "facturas-y-boletas" : "pedidos"}?pagina=${fromPage}`)}">← Volver a ${fromOrder === "invoices" ? "facturas y boletas" : "pedidos"}</a><div class="page-heading compact"><div><h1>Pedido #${esc(order.number)}</h1><p>${esc(new Date(order.date_created).toLocaleString("es-CL"))}${ctx.cloud() ? "" : " · Pedido de ejemplo"}</p></div><span class="commerce-pill order-status-${["pending","processing","on-hold","completed","cancelled","refunded","failed","checkout-draft"].includes(order.status) ? order.status : "other"}">${esc(status(order.status))}</span></div><div class="order-detail-grid"><article class="panel order-lines"><h2>Productos</h2><table class="business-table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>${(order.line_items || []).map((line: any) => `<tr><td>${esc(line.name)}<small>SKU: ${esc(line.sku || "—")}</small></td><td>${esc(line.quantity)}</td><td>${esc(money(line.total, order.currency))}</td></tr>`).join("")}</tbody></table><div class="order-totals"><p>Descuento <strong>${esc(money(order.discount_total, order.currency))}</strong></p><p>Envío <strong>${esc(money(order.shipping_total, order.currency))}</strong></p><p>Impuestos <strong>${esc(money(order.total_tax, order.currency))}</strong></p><p>Total <strong>${esc(money(order.total, order.currency))}</strong></p></div></article><div><article class="panel order-info"><h2>Cliente y facturación</h2><p>${esc(billing.first_name)} ${esc(billing.last_name)}</p><p>${esc(billing.email || "")}</p><p>${esc(billing.phone || "")}</p><p>${esc([billing.address_1, billing.address_2, billing.city, billing.state, billing.postcode, billing.country].filter(Boolean).join(", "))}</p></article><article class="panel order-info"><h2>Entrega y pago</h2><p>${esc([shipping.address_1, shipping.address_2, shipping.city, shipping.state, shipping.postcode, shipping.country].filter(Boolean).join(", ") || "Sin dirección de entrega")}</p><p>${esc(order.payment_method_title || "Sin método indicado")}</p>${(order.shipping_lines || []).map((line: any) => `<p>${esc(line.method_title)} · ${esc(money(line.total, order.currency))}</p>`).join("")}${order.customer_note ? `<h3>Nota del cliente</h3><p>${esc(order.customer_note)}</p>` : ""}</article>${orderDetails(order)}</div></div>`;
    } catch (e) {
      $("#order-detail").innerHTML =
        `<a class="back-link" href="${demoPath(`/app/tienda/${fromOrder === "invoices" ? "facturas-y-boletas" : "pedidos"}?pagina=${fromPage}`)}">← Volver</a><p class="empty-state">${esc(e instanceof Error ? e.message : "No pudimos abrir el pedido.")}</p>`;
    }
  }
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button,a");
    if (!b) return;
    if (b.dataset.deleteFile) {
      void deleteFile(b.dataset.deleteFile);
      return;
    }
    if (b.dataset.openCustomer) {
      openCustomer(b.dataset.openCustomer);
      return;
    }
    if (b.dataset.customerOrderPage) {
      customerOrderPage = Number(b.dataset.customerOrderPage);
      void renderCustomer();
      return;
    }
    if (b.dataset.customerPage) {
      customerPage = Number(b.dataset.customerPage);
      void renderCustomers();
      return;
    }
    if (b.dataset.openDocument) {
      openFile(b.dataset.openDocument);
      return;
    }
    if (b.dataset.downloadDocument) {
      void downloadFile(b.dataset.downloadDocument);
      return;
    }
    if (b.dataset.orderPage) {
      ordersPage = Number(b.dataset.orderPage);
      ordersLoadedAt = 0;
      void renderOrders(true);
      return;
    }
    if (b.dataset.viewerZoom) {
      zoom = Math.max(
        0.3,
        Math.min(4, zoom * (b.dataset.viewerZoom === "in" ? 1.2 : 1 / 1.2)),
      );
      const image = document.querySelector<HTMLElement>("#viewer-image");
      if (image) image.style.width = zoom * 100 + "%";
      return;
    }
    const action = b.dataset.action;
    if (action === "upload-document") upload();
    if (action === "upload-receipt") upload(true);
    if (action === "back-documents") {
      viewerFile = "";
      ctx.show(fileOrigin);
    }
    if (action === "refresh-orders") void renderOrders(true);
    if (action === "logout-person") {
      if (!ctx.cloud()) {
        location.href = "/acceso";
        return;
      }
      const form = document.createElement("form");
      form.action = "/api/saas/auth";
      form.method = "POST";
      form.innerHTML = '<input name="action" value="logout"/>';
      document.body.append(form);
      form.submit();
    }
  });
  function render(view: string) {
    brand();
    if (
      [
        "orders",
        "invoices",
        "analytics",
        "order",
        "customers",
        "customer",
      ].includes(view)
    ) {
      $("#store-submenu").hidden = false;
      document
        .querySelector("[data-action=toggle-store]")
        ?.setAttribute("aria-expanded", "true");
    }
    if (view === "settings") renderSettings();
    if (view === "profile") renderProfile();
    if (view === "documents") void renderDocuments();
    if (view === "document") void renderViewer();
    if (view === "orders") void renderOrders();
    if (view === "invoices") void renderReceipts();
    if (view === "order") void renderOrder();
    if (view === "customers") void renderCustomers();
    if (view === "customer") void renderCustomer();
  }
  async function listTrash() {
    if (ctx.cloud()) return [];
    const store = await localFiles();
    for (const f of await store.all())
      if (f.deletedAt && expired(f.deletedAt)) await store.remove(f.id);
    return (await store.all())
      .filter((f) => f.deletedAt)
      .map((f) => ({
        id: f.id,
        title: f.title,
        section: "documents",
        deletedAt: f.deletedAt!,
        collection: "local-files",
      }));
  }
  async function removeTrashedFile(id: string) {
    const store = await localFiles();
    if ((await store.all()).some(file => file.id === id && file.deletedAt))
      await store.remove(id);
  }
  async function restoreFile(id: string) {
    const store = await localFiles(),
      file = (await store.all()).find((f) => f.id === id);
    if (file) {
      delete file.deletedAt;
      await store.put(file);
    }
    ctx.render();
  }
  async function moveDocumentToTrash(id: string) {
    if (!isAdmin(ctx.actor())) throw Error("Necesitas permisos de administrador.");
    if (ctx.cloud()) await ctx.api("files", { method: "DELETE", body: JSON.stringify({ id }) });
    else {
      const store = await localFiles(), file = (await store.all()).find(f => f.id === id);
      if (!file) throw Error("Documento no disponible.");
      file.deletedAt = new Date().toISOString();
      await store.put(file);
    }
  }
  async function deleteFile(id: string) {
    if (!isAdmin(ctx.actor())) return;
    try {
      await moveDocumentToTrash(id);
      selectedDocuments.delete(id);
      ctx.notify("Documento enviado a la papelera por 30 días.");
      ctx.show("documents");
    } catch { ctx.notify("No pudimos enviar el archivo a la papelera."); }
  }
  async function customerData(detail = false) {
    if (ctx.cloud())
      return ctx.api(
        "customers?page=" +
          (detail ? customerOrderPage : customerPage) +
          "&q=" +
          encodeURIComponent(customerQuery) +
          (detail ? "&id=" + customerId : ""),
      );
    const all = demoOrders.map((o, index) => ({
      id: String(index + 1),
      name: o.billing.first_name + " " + o.billing.last_name,
      email: o.billing.email,
      phone: o.billing.phone,
      billing: o.billing,
    }));
    if (detail) {
      const doc = all.find((c) => c.id === customerId);
      return {
        connected: true,
        doc,
        orders: demoOrders.filter(
          (_, index) => String(index + 1) === customerId,
        ),
        total: 1,
        pages: 1,
      };
    }
    const docs = all.filter((c) =>
      (c.name + " " + c.email)
        .toLowerCase()
        .includes(customerQuery.toLowerCase()),
    );
    return {
      connected: true,
      docs: docs.slice((customerPage - 1) * 10, customerPage * 10),
      total: docs.length,
      pages: Math.ceil(docs.length / 10),
    };
  }
  async function renderCustomers() {
    if (!isAdmin(ctx.actor())) return;
    const host = $("#customers-content");
    if (!host.querySelector("#customer-search"))
      host.innerHTML =
        '<div class="page-heading compact"><div><h1>Clientes de la tienda</h1><p>Clientes registrados en WooCommerce y sus pedidos asociados.</p></div></div><label class="customer-search">Buscar cliente<input id="customer-search" type="search" placeholder="Nombre o correo"/></label><div class="panel" id="customer-table" tabindex="0" role="region" aria-label="Listado de clientes"></div><div class="pagination" id="customer-pagination"></div>';
    $("#customer-search").oninput = (e) => {
      customerQuery = (e.target as HTMLInputElement).value;
      customerPage = 1;
      clearTimeout(customerTimer);
      customerTimer = setTimeout(() => void renderCustomers(), 220);
    };
    try {
      const data = await customerData();
      let note = host.querySelector(".customer-data-note");
      if (!note) {
        note = document.createElement("p");
        note.className = "section-note customer-data-note";
        host.querySelector(".page-heading")!.append(note);
      }
      note.textContent = !ctx.cloud()
        ? "Datos de ejemplo"
        : !data.connected
          ? "Conecta WooCommerce en Configuración → Integraciones."
          : "Clientes registrados; las compras como invitado aparecen en Pedidos.";
      $("#customer-table").innerHTML =
        `<table class="business-table"><thead><tr><th>Cliente</th><th>Correo</th><th>Teléfono</th><th></th></tr></thead><tbody>${data.docs.map((c: any) => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone || "—")}</td><td><button class="button primary compact-table-action" data-open-customer="${c.id}">Ver pedidos ↗</button></td></tr>`).join("") || '<tr><td colspan="4">No encontramos clientes.</td></tr>'}</tbody></table>`;
      $("#customer-pagination").innerHTML =
        `<span>${data.total} clientes · Página ${customerPage} de ${Math.max(1, data.pages)}</span><div><button class="button secondary" data-customer-page="${customerPage - 1}" ${customerPage <= 1 ? "disabled" : ""}>← Anterior</button><button class="button secondary" data-customer-page="${customerPage + 1}" ${customerPage >= data.pages ? "disabled" : ""}>Siguiente →</button></div>`;
    } catch {
      $("#customer-table").textContent = "No pudimos cargar los clientes.";
    }
  }
  let customerTimer: ReturnType<typeof setTimeout>;
  function openCustomer(id: string) {
    customerId = id;
    customerOrderPage = 1;
    ctx.show("customer");
    window.history.replaceState(null, "", demoPath("/app/tienda/clientes/ver/" + id));
  }
  async function renderCustomer() {
    if (!isAdmin(ctx.actor())) return;
    const host = $("#customer-content");
    host.textContent = "Cargando cliente…";
    try {
      const data = await customerData(true),
        c = data.doc;
      if (!c) throw Error();
      host.innerHTML = `<button class="back-link" data-view="customers">← Volver a clientes</button><div class="page-heading compact"><div><h1>${esc(c.name)}</h1><p>${esc(c.email)} · ${esc(c.phone || "Sin teléfono")}</p></div></div><div class="panel"><table class="business-table"><thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${data.orders.map((o: any) => `<tr><td>#${esc(o.number)}</td><td>${esc(new Date(o.date_created).toLocaleDateString("es-CL"))}</td><td>${esc(status(o.status))}</td><td>${esc(money(o.total, o.currency))}</td><td><a class="button primary compact-table-action" href="${orderHref(o.id)}">Ver pedido ↗</a></td></tr>`).join("") || '<tr><td colspan="5">Este cliente no tiene pedidos.</td></tr>'}</tbody></table></div><div class="pagination"><span>${data.total} ${data.total === 1 ? "pedido" : "pedidos"} · Página ${customerOrderPage} de ${Math.max(1, data.pages)}</span><div><button class="button secondary" data-customer-order-page="${customerOrderPage - 1}" ${customerOrderPage <= 1 ? "disabled" : ""}>← Anterior</button><button class="button secondary" data-customer-order-page="${customerOrderPage + 1}" ${customerOrderPage >= data.pages ? "disabled" : ""}>Siguiente →</button></div></div>`;
    } catch {
      host.textContent = "No pudimos cargar el cliente.";
    }
  }
  async function searchRecords(
    query: string,
  ): Promise<{ results: SearchEntry[]; warnings: string[] }> {
    if (!isAdmin(ctx.actor())) return { results: [], warnings: [] };
    if (ctx.cloud()) return ctx.api("search?q=" + encodeURIComponent(query));
    await listFiles();
    return {
      warnings: [],
      results: [
        ...demoOrders
          .filter((o) =>
            matchesSearch(
              query,
              o.number,
              o.billing.first_name,
              o.billing.last_name,
            ),
          )
          .map((o) => ({
            id: String(o.id),
            kind: "order" as const,
            title: "Pedido #" + o.number,
            subtitle: o.billing.first_name + " " + o.billing.last_name,
          })),
        ...fileRows
          .filter((f) => !f.deletedAt)
          .filter((f) => matchesSearch(query, f.title, f.filename, f.orderId))
          .map((f) => ({
            id: f.id,
            kind: "document" as const,
            title: f.title,
            subtitle: f.filename + (f.orderId ? " · Pedido #" + f.orderId : ""),
          })),
      ],
    };
  }
  return {
    invalidateCommerce: () => { commerceEpoch++; ordersResult = null; ordersLoadedAt = 0; },
    render,
    tab,
    setOrder,
    openFile,
    currentTab: () => settingsTab,
    listTrash,
    restoreFile,
    removeTrashedFile,
    deleteFile,
    openCustomer,
    searchRecords,
  };
}
