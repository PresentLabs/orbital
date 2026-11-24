import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
async function loadPdf(blob: Blob) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorkerRendering: true,
  });
}

export async function firstPageThumbnail(blob: Blob) {
  const loading = await loadPdf(blob);
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 320 / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas.toDataURL("image/png");
  } finally {
    await loading.destroy();
  }
}

export async function mountPdf(host: HTMLElement, blob: Blob) {
  const loading = await loadPdf(blob);
  const pdf = await loading.promise;
  if (!host.isConnected) {
    await loading.destroy();
    return;
  }
  host.innerHTML = `<div class="pdf-controls"><button class="icon-btn" data-pdf="prev" aria-label="Página anterior">←</button><span aria-live="polite"></span><button class="icon-btn" data-pdf="next" aria-label="Página siguiente">→</button><button class="icon-btn" data-pdf="out" aria-label="Reducir documento">−</button><button class="icon-btn" data-pdf="in" aria-label="Ampliar documento">+</button><button class="subtle-button" data-pdf="fit">Ajustar al ancho</button></div><div class="pdf-sheet"><canvas aria-label="Página del documento PDF"></canvas><div class="pdf-text" aria-label="Texto de la página"></div></div>`;
  let pageNumber = 1,
    zoom = 1,
    serial = Promise.resolve();
  async function paint() {
    if (!host.isConnected) return;
    const page = await pdf.getPage(pageNumber),
      canvas = host.querySelector("canvas")!;
    const base = page.getViewport({ scale: 1 });
    const scale =
      Math.min(2, Math.max(0.3, (host.clientWidth - 64) / base.width)) * zoom;
    const viewport = page.getViewport({ scale }),
      ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = viewport.width * ratio;
    canvas.height = viewport.height * ratio;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    host.querySelector(".pdf-controls span")!.textContent =
      `Página ${pageNumber} de ${pdf.numPages} · ${Math.round(zoom * 100)} %`;
    (host.querySelector('[data-pdf="prev"]') as HTMLButtonElement).disabled =
      pageNumber === 1;
    (host.querySelector('[data-pdf="next"]') as HTMLButtonElement).disabled =
      pageNumber === pdf.numPages;
    await page.render({
      canvas,
      viewport,
      transform: [ratio, 0, 0, ratio, 0, 0],
    }).promise;
    const text = await page.getTextContent();
    host.querySelector(".pdf-text")!.textContent = text.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
  }
  host.onclick = (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>("[data-pdf]")
      ?.dataset.pdf;
    if (!action) return;
    serial = serial
      .then(async () => {
        if (action === "prev") pageNumber = Math.max(1, pageNumber - 1);
        if (action === "next")
          pageNumber = Math.min(pdf.numPages, pageNumber + 1);
        if (action === "in") zoom = Math.min(3, zoom + 0.25);
        if (action === "out") zoom = Math.max(0.5, zoom - 0.25);
        if (action === "fit") zoom = 1;
        await paint();
      })
      .catch(() => {
        host.querySelector(".pdf-controls span")!.textContent =
          "No pudimos mostrar esta página.";
      });
  };
  await paint();
}
