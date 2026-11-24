type FiscalDocument = {
  id: number;
  type: number;
  folio: number | null;
  amount: number;
  state: string;
  parent_id: number;
  environment: string;
  provider: string;
  order_id: string;
  store_key: string;
};
export function installBilling(options: {
  cloud: () => boolean;
  identity: () => string;
}) {
  const root = document.querySelector<HTMLElement>('[data-billing-panel]')!;
  const element = <T extends HTMLElement>(id: string) =>
    root.querySelector<T>("#" + id)!;
  const message = (text: string) => {
    element("billing-message").textContent = text;
  };
  const form = (id: string) => element<HTMLFormElement>(id);
  const input = (id: string, name: string) =>
    form(id).elements.namedItem(name) as HTMLInputElement;
  let expectedStoreKey = "";
  let loaded = false,
    busy = false,
    orderId = "",
    documents: FiscalDocument[] = [];
  async function api(data?: Record<string, unknown>) {
    if (!options.cloud())
      throw new Error(
        "Inicia sesión en un negocio conectado para configurar la facturación.",
      );
    const response = await fetch(
      "/api/saas/billing",
      data
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              moduleId: "billing-cl",
              expectedStoreKey,
              ...data,
            }),
          }
        : {},
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "No se pudo completar la solicitud.");
    return result;
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    root.setAttribute("aria-busy", "true");
    message("Consultando…");
    root
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
    try {
      await fn();
    } catch (error) {
      message(
        error instanceof Error
          ? error.message
          : "Error de conexión. Conserva la clave y consulta el pedido antes de reintentar.",
      );
    } finally {
      busy = false;
      root.removeAttribute("aria-busy");
      root
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = b.dataset.billingGranted === "false"));
    }
  }
  async function catalog() {
    const result = await api();
    element("billing-summary").replaceChildren();
    for (const item of result.modules) {
      if (expectedStoreKey !== item.store?.key) {
        sourceCursor = null;
        orderId = "";
        documents = [];
        element("dte-documents").replaceChildren();
        element("dte-source-orders").replaceChildren();
      }
      expectedStoreKey = item.store?.key || "";
      const storeText = item.store
        ? `Tienda activa: ${item.store.provider} · ${item.store.origin}`
        : "Conecta Shopify, WooCommerce o Payload para comenzar.";
      element("dte-store").textContent = storeText;
      const configure = document.createElement("button");
      configure.className = "button secondary";
      configure.dataset.billingGranted = String(item.granted);
      configure.disabled = !item.granted;
      configure.textContent = item.installed
        ? "Configurar / renovar credenciales"
        : "Configurar facturación";
      configure.onclick = () => {
        element("dte-config").hidden = false;
        element("dte-config").scrollIntoView({ behavior: "smooth" });
        if (item.installed)
          void run(async () => {
            const status = await api({ action: "status" });
            for (const [key, value] of Object.entries(status.issuer)) {
              const field = form("dte-install").elements.namedItem(
                key,
              ) as HTMLInputElement | null;
              if (field) field.value = String(value);
            }
            for (const key of ["automaticIssue", "automaticRefunds"])
              input("dte-install", key).checked = !!status[key];
            message("Configuración cargada.");
          });
      };
      if (item.granted) element("billing-summary").append(configure);
      element("dte-workspace").hidden = !item.installed || !item.granted;
      if (!item.granted) {
        element("dte-config").hidden = true;
        message("El dueño del SaaS debe activar Facturación para este negocio.");
      }
      element("dte-payload-extension").hidden =
        item.store?.provider !== "payload";
    }
    loaded = true;
    message(
      !result.modules[0]?.granted
        ? "El dueño del SaaS debe activar Facturación para este negocio."
        : result.legacyInstalled
        ? "Existe un historial antiguo en WordPress. Debe conciliarse antes de migrar esa tienda al motor nativo."
        : "Catálogo actualizado.",
    );
  }
  function requireOrder() {
    if (!orderId) throw new Error("Consulta primero el pedido.");
    return orderId;
  }
  async function queryDocuments(history = false) {
    documents = [];
    element("dte-documents").replaceChildren();
    documents = await api(
      history
        ? { action: "history" }
        : { action: "documents", orderId: requireOrder() },
    );
    const host = element("dte-documents");
    host.replaceChildren();
    if (!documents.length) {
      host.textContent = "El pedido no tiene documentos tributarios.";
      return;
    }
    const table = document.createElement("table");
    table.className = "data-table";
    const header = table.createTHead().insertRow();
    for (const text of [
      "ID · tipo / folio",
      "Tienda / pedido",
      "Referencia",
      "Ambiente",
      "Monto CLP",
      "Estado",
      "Acciones",
    ]) {
      const th = document.createElement("th");
      th.textContent = text;
      header.append(th);
    }
    const tbody = table.createTBody();
    for (const doc of documents) {
      const row = tbody.insertRow();
      for (const text of [
        `${doc.id} · ${doc.type} / ${doc.folio || "pendiente"}`,
        `${doc.provider} · ${doc.order_id}`,
        doc.parent_id ? `DTE interno ${doc.parent_id}` : "Original",
        doc.environment,
        Number(doc.amount).toLocaleString("es-CL"),
        doc.state,
      ])
        row.insertCell().textContent = text;
      const actions = row.insertCell();
      const button = (label: string, fn: () => void) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "subtle-button";
        b.textContent = label;
        b.onclick = fn;
        actions.append(b);
      };
      for (const format of ["pdf", "xml"])
        button(
          format.toUpperCase(),
          () =>
            void run(async () => {
              const file = await api({
                action: "file",
                documentId: doc.id,
                format,
              });
              const bytes = Uint8Array.from(atob(file.base64), (c) =>
                c.charCodeAt(0),
              );
              const url = URL.createObjectURL(
                new Blob([bytes], {
                  type:
                    format === "pdf" ? "application/pdf" : "application/xml",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `DTE-${doc.type}-${doc.folio}.${format}`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              message("Archivo descargado.");
            }),
        );
      button("Enviar email", () => {
        if (
          confirm(
            "Enviar este documento al correo del cliente registrado en la tienda.",
          )
        )
          void run(async () => {
            await api({ action: "email", documentId: doc.id });
            message("Solicitud de correo registrada en Orbital.");
          });
      });
      button("Ajustar", () => prepare(doc, false));
      if ([33, 39, 56].includes(Number(doc.type)))
        button("Anular con NC", () => prepare(doc, true));
      button(
        "Reintentar / consultar SII",
        () =>
          void run(async () => {
            await api({ action: "retry", documentId: doc.id });
            await queryDocuments();
            message("Revisión encolada en Orbital.");
          }),
      );
    }
    host.append(table);
  }
  function keyName(id: string) {
    return `orbita:dte:operation:${options.identity()}:${id}`;
  }
  function operationKey(id: string, fresh = false) {
    const name = keyName(id);
    const key = (!fresh && (sessionStorage.getItem(name) || sessionStorage.getItem(name.replace(/^orbita:/,"orbital:")))) || crypto.randomUUID();
    sessionStorage.setItem(name, key);
    return key;
  }
  function prepare(doc: FiscalDocument, cancel: boolean) {
    input("dte-adjust", "documentId").value = String(doc.id);
    input("dte-adjust", "type").value = "61";
    input("dte-adjust", "amount").value = cancel ? String(doc.amount) : "";
    input("dte-adjust", "cancel").checked = cancel;
    input("dte-adjust", "reason").value = cancel
      ? "Anulación del documento"
      : "";
    input("dte-adjust", "operationKey").value = operationKey(String(doc.id));
    element<HTMLDetailsElement>("dte-adjust-details").open = true;
    element("dte-adjust-details").scrollIntoView({ behavior: "smooth" });
  }
  function onSubmit(id: string, handler: () => Promise<void>) {
    form(id).addEventListener("submit", (e) => {
      e.preventDefault();
      void run(handler);
    });
  }
  onSubmit("dte-install", async () => {
    const issuer = Object.fromEntries(
      [
        "environment",
        "rut",
        "sender",
        "name",
        "giro",
        "activity",
        "address",
        "commune",
        "sii_office",
        "resolution_date",
        "resolution_number",
        "production_confirmation",
        "evidence",
      ].map((key) => [key, input("dte-install", key).value]),
    );
    const certificateFile = input("dte-install", "certificate").files?.[0];
    let certificate = "";
    if (certificateFile) {
      if (certificateFile.size > 5000000)
        throw new Error("Certificado demasiado grande.");
      const bytes = new Uint8Array(await certificateFile.arrayBuffer());
      let text = "";
      for (const b of bytes) text += String.fromCharCode(b);
      certificate = btoa(text);
    }
    try {
      await api({
        action: "install",
        issuer,
        certificate,
        password: input("dte-install", "password").value,
        automaticIssue: input("dte-install", "automaticIssue").checked,
        automaticRefunds: input("dte-install", "automaticRefunds").checked,
        confirmSoleEmitter: input("dte-install", "confirmSoleEmitter").checked,
      });
      element("dte-config").hidden = true;
      await catalog();
      message(
        "Facturación activada para la tienda conectada. Importa sus CAF antes de emitir.",
      );
    } finally {
      input("dte-install", "password").value = "";
      input("dte-install", "certificate").value = "";
    }
  });
  onSubmit("dte-caf", async () => {
    const file = input("dte-caf", "caf").files?.[0];
    if (!file || file.size > 2000000)
      throw new Error("CAF no seleccionado o demasiado grande.");
    await api({ action: "caf", xml: await file.text() });
    input("dte-caf", "caf").value = "";
    message("CAF verificado e importado.");
  });
  onSubmit("dte-order", async () => {
    orderId = input("dte-order", "orderId").value.trim();
    await queryDocuments();
    message(`Documentos del pedido ${orderId}.`);
  });
  onSubmit("dte-issue", async () => {
    await api({
      action: "issue",
      orderId: requireOrder(),
      type: Number(input("dte-issue", "type").value),
    });
    await queryDocuments();
    message("Solicitud de emisión registrada en Orbital.");
  });
  onSubmit("dte-fiscal", async () => {
    const receiver = Object.fromEntries(
      ["rut", "name", "giro", "address", "commune"].map((k) => [
        k,
        input("dte-fiscal", k).value,
      ]),
    );
    await api({
      action: "fiscal",
      orderId: requireOrder(),
      type: Number(input("dte-fiscal", "type").value),
      receiver,
    });
    message("Receptor guardado en Orbital.");
  });
  onSubmit("dte-adjust", async () => {
    const documentId = Number(input("dte-adjust", "documentId").value);
    if (!documents.some((d) => Number(d.id) === documentId))
      throw new Error("Selecciona un documento del pedido consultado.");
    const body: Record<string, unknown> = {
      action: "adjust",
      documentId,
      type: Number(input("dte-adjust", "type").value),
      amount: Number(input("dte-adjust", "amount").value),
      reason: input("dte-adjust", "reason").value,
      kind: input("dte-adjust", "kind").value,
      cancel: input("dte-adjust", "cancel").checked,
      no_vat_reduction: input("dte-adjust", "no_vat_reduction").checked,
      operationKey: input("dte-adjust", "operationKey").value,
    };
    const lines = Array.from(
      element("dte-lines").querySelectorAll<HTMLElement>(".dte-line"),
    ).map((row) => ({
      name: row.querySelector<HTMLInputElement>("[data-line-name]")!.value,
      amount: Number(
        row.querySelector<HTMLInputElement>("[data-line-amount]")!.value,
      ),
      exempt:
        row.querySelector<HTMLInputElement>("[data-line-exempt]")!.checked,
    }));
    if (lines.length) body.lines = lines;
    if (
      !confirm(
        `Solicitar DTE ${body.type} por $${body.amount} CLP sobre el documento ${documentId}. Esta operación crea un documento tributario.`,
      )
    ) {
      message("Solicitud cancelada.");
      return;
    }
    await api(body);
    await queryDocuments();
    message(
      "Ajuste registrado. La clave se conserva para reintentos; usa “Preparar otra operación” para un ajuste distinto.",
    );
  });
  element("dte-new-operation").onclick = () => {
    const id = input("dte-adjust", "documentId").value;
    if (
      id &&
      confirm(
        "Usar una clave nueva permite crear OTRO ajuste. Verifica primero que la operación anterior no haya sido registrada.",
      )
    )
      input("dte-adjust", "operationKey").value = operationKey(id, true);
  };
  element("dte-add-line").onclick = () => {
    const host = element("dte-lines");
    if (host.children.length >= 60) return;
    const row = document.createElement("div");
    row.className = "dte-line";
    for (const [labelText, field, type] of [
      ["Producto", "name", "text"],
      ["Monto CLP", "amount", "number"],
      ["Exento de IVA", "exempt", "checkbox"],
    ]) {
      const label = document.createElement("label");
      label.textContent = labelText;
      const fieldInput = document.createElement("input");
      fieldInput.type = type;
      fieldInput.setAttribute("data-line-" + field, "");
      if (type !== "checkbox") fieldInput.required = true;
      if (type === "number") {
        fieldInput.min = "1";
        fieldInput.step = "1";
      }
      if (type === "text") fieldInput.maxLength = 80;
      label.append(fieldInput);
      row.append(label);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "subtle-button";
    remove.textContent = "Quitar producto";
    remove.onclick = () => row.remove();
    row.append(remove);
    host.append(row);
  };
  element("billing-refresh").onclick = () => {if(!options.cloud()){message("El dueño del SaaS debe activar Facturación para este negocio.");return;}void run(catalog);};
  let sourceCursor: string | null = null;
  element("dte-load-orders").onclick = () =>
    void run(async () => {
      const page = await api({ action: "orders", cursor: sourceCursor });
      sourceCursor = page.next;
      const host = element("dte-source-orders");
      host.replaceChildren();
      for (const id of page.ids) {
        const button = document.createElement("button");
        button.className = "subtle-button";
        button.textContent = "Pedido " + id;
        button.onclick = () => {
          orderId = String(id);
          input("dte-order", "orderId").value = orderId;
          void run(async () => {
            await queryDocuments();
            message("Pedido seleccionado.");
          });
        };
        host.append(button);
      }
      element("dte-load-orders").textContent = sourceCursor
        ? "Ver siguientes pedidos"
        : "Volver al inicio de pedidos";
      message(
        page.ids.length ? "Selecciona un pedido." : "Sin pedidos disponibles.",
      );
    });
  element("dte-history").onclick = () =>
    void run(async () => {
      await queryDocuments(true);
      message(
        "Últimos 100 documentos del negocio, conservando su tienda de origen.",
      );
    });
  element("dte-status").onclick = () =>
    void run(async () => {
      const status = await api({ action: "status" });
      element("dte-environment").textContent =
        `Tienda: ${status.provider} · ${status.origin} · ambiente: ${status.environment} · emisión automática: ${status.automaticIssue ? "sí" : "no"} · NC por reembolso: ${status.automaticRefunds ? "sí" : "no"}.`;
      element("dte-cafs").textContent = status.cafs.length
        ? status.cafs
            .map(
              (c: any) =>
                `DTE ${c.type} · ${c.environment} · siguiente folio ${c.next_folio} de ${c.last_folio} · vence ${String(c.expires).slice(0, 10)}`,
            )
            .join(" / ")
        : "No hay CAF importados.";
      message(
        status.sync?.error
          ? `Sincronización requiere revisión: ${status.sync.error}`
          : "Estado actualizado. La conexión no acredita aceptación de documentos por SII.",
      );
    });
  return {
    render: () => {
      if(!options.cloud()){
        root.dataset.state='demo';element('billing-refresh').hidden=false;
        message('El dueño del SaaS debe activar Facturación para este negocio.');
        element('billing-summary').replaceChildren();
        element('dte-config').hidden=true;element('dte-workspace').hidden=true;
        loaded=true;return;
      }
      if (!loaded && !busy) void run(catalog);
    },
  };
}
