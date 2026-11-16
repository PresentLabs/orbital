import { rotationAngle, rotationFromPointer } from "@/lib/saas/vision-transform";
import { isSelectionDelete } from "@/lib/saas/selection-keyboard";
import {
  uid,
  type WorkspaceState,
  type WorkspaceMember,
  type PersonalFocus,
} from "@/lib/saas/model";
import {
  clipboardImageFiles,
  prepareCanvasScreenshot,
} from "@/lib/saas/canvas-image";
import { uiIcon } from "@/lib/saas/icons";
type Ctx = {
  state: () => WorkspaceState;
  actor: () => WorkspaceMember;
  mutate: (f: () => void) => void;
  modal: (html: string) => void;
  close: () => void;
  notify: (s: string) => void;
};
const $ = <T extends HTMLElement = HTMLElement>(q: string) =>
  document.querySelector<T>(q)!;
export function installPlanning(ctx: Ctx) {
  let uploading = false;
  const pref = () =>
    ctx.state().focus?.find((f) => f.id === String(ctx.actor().id));
  function own(): PersonalFocus {
    ctx.state().focus ??= [];
    let p = pref();
    if (!p) {
      p = {
        id: String(ctx.actor().id),
        privateOwner: String(ctx.actor().id),
        selections: [],
      };
      ctx.state().focus!.push(p);
    }
    return p;
  }
  const images = () => pref()?.visionBoard?.images || [];
  const active = () =>
    !$("#vision-board-pane").closest("[hidden]") ||
    !!document.querySelector(".vision-expanded");
  function stage() {
    return `<div class="vision-stage" data-vision-stage tabindex="0" aria-label="Vision board privado. Pega o arrastra imágenes.">${images()
      .map(
        (i, n) =>
          `<div class="vision-image" data-vision-image="${i.id}" tabindex="0" aria-label="Imagen ${n + 1}. Arrastra o usa las flechas para mover. Delete para eliminar." style="left:${i.x / 10}%;top:${i.y / 6.5}%;width:${i.width / 10}%;--vision-rotation:${i.rotation || 0}deg;transform:rotate(${i.rotation || 0}deg)"><div class="vision-image-surface"><img src="${i.image}" alt="Imagen ${n + 1} de mi vision board" draggable="false"/></div><button type="button" class="vision-rotate-handle" data-vision-rotate="${i.id}" role="slider" aria-label="Rotar imagen ${n + 1}" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="${i.rotation || 0}" title="Arrastra para rotar">${uiIcon("rotate", 15)}</button><button type="button" class="vision-resize-handle" data-vision-scale="${i.id}" aria-label="Cambiar tamaño de imagen ${n + 1}" title="Arrastra para cambiar el tamaño"></button></div>`,
      )
      .join(
        "",
      )}${!images().length ? '<div class="vision-empty">Tu futuro, a tu manera.</div>' : ""}<div class="vision-stage-controls"><div class="vision-primary-actions"><button class="button secondary small-button" type="button" data-vision-expand>Ampliar</button><button class="button primary small-button" type="button" data-vision-upload>Añadir imágenes</button></div></div><span class="vision-paste-hint">Pega o arrastra imágenes</span></div>`;
  }
  function drawStages() {
    for (const host of document.querySelectorAll("[data-vision-host]"))
      host.innerHTML = stage();
  }
  function boardGeometry(card: HTMLElement) {
    const stage = card.closest<HTMLElement>("[data-vision-stage]")!;
    const scale = 1000 / (stage.clientWidth || 1000);
    const scaleY = 650 / (stage.clientHeight || 650);
    const expanded = !!stage.closest(".vision-expanded");
    const edge = 8 * scaleY;
    return { scale, scaleY, top: edge, bottom: 650 - edge, side: 28, heightLimit: expanded ? 490 : 310 };
  }

  document.addEventListener("load", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.naturalHeight) return;
    const card = image.closest<HTMLElement>("[data-vision-image]");
    if (!card) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const board = boardGeometry(card);
    const heightPerWidth = board.scaleY / board.scale / ratio;
    const width = Math.min(parseFloat(card.style.width) * 10, board.heightLimit / heightPerWidth);
    card.style.setProperty("--vision-photo-ratio", String(ratio));
    card.style.width = width / 10 + "%";
    card.style.left = Math.max(board.side, Math.min(parseFloat(card.style.left) * 10, 1000 - board.side - width)) / 10 + "%";
    card.style.top = Math.max(board.top, Math.min(parseFloat(card.style.top) * 6.5, board.bottom - width * heightPerWidth)) / 6.5 + "%";
  }, true);
  function renderOverview() {
    const vision = pref()?.overviewMode === "vision";
    $("#monthly-goals-pane").hidden = vision;
    $("#vision-board-pane").hidden = !vision;
    document
      .querySelectorAll<HTMLButtonElement>("[data-overview-mode]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String((b.dataset.overviewMode === "vision") === vision),
        ),
      );
    if (vision || document.querySelector(".vision-expanded")) drawStages();
  }
  const defaultTilts = [-3, 2, -4, 3, -2, 4, -1.5, 2.5, -3.5, 1.5, -2.5, 3.5];
  const visionImageOptions = { maxSide: 1600, maxLength: 125000, vision: true };

  async function add(files: File[], point?: { x: number; y: number }) {
    if (uploading || !files.length) return;
    const person = String(ctx.actor().id),
      room = 12 - images().length;
    if (room <= 0) {
      ctx.notify("Puedes guardar hasta 12 imágenes en tu vision board.");
      return;
    }
    uploading = true;
    ctx.notify("Preparando imágenes para tu vision board…");
    const prepared: string[] = [];
    for (const file of files.slice(0, room)) {
      try {
        prepared.push(await prepareCanvasScreenshot(file, visionImageOptions));
      } catch (e) {
        ctx.notify(
          e instanceof Error ? e.message : "No pudimos preparar esta imagen.",
        );
      }
    }
    uploading = false;
    if (String(ctx.actor().id) !== person || !prepared.length) return;
    ctx.mutate(() => {
      const p = own();
      const board = p.visionBoard ??= { images: [] };
      for (const image of prepared) {
        const n = board.images.length;
        if (n >= 12) break;
        board.images.push({
          id: uid(),
          image,
          x: Math.min(770, Math.max(0, point?.x ?? 60 + (n % 3) * 290)),
          y: Math.min(
            490,
            Math.max(0, point?.y ?? 50 + Math.floor(n / 3) * 140),
          ),
          width: 230,
          rotation: defaultTilts.find(angle => !board.images.some(item => item.rotation === angle)) ?? defaultTilts[n],
        });
      }
    });
    ctx.notify("Imágenes guardadas en tu vision board.");
  }
  document.addEventListener("paste", (e) => {
    if (
      e.defaultPrevented ||
      !active() ||
      (e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")
    )
      return;
    const dialog = document.querySelector<HTMLDialogElement>("#editor-dialog");
    if (dialog?.open && !document.querySelector(".vision-expanded")) return;
    const files = clipboardImageFiles(e.clipboardData);
    if (files.length) {
      e.preventDefault();
      void add(files);
    }
  });
  document.addEventListener("dragover", (e) => {
    if (
      (e.target as HTMLElement).closest("[data-vision-stage]") &&
      Array.from(e.dataTransfer?.types || []).includes("Files")
    ) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    }
  });
  document.addEventListener("drop", (e) => {
    const root = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-vision-stage]",
    );
    if (!root || !e.dataTransfer?.files.length) return;
    e.preventDefault();
    const r = root.getBoundingClientRect();
    void add(Array.from(e.dataTransfer.files), {
      x: ((e.clientX - r.left) * 1000) / r.width - 115,
      y: ((e.clientY - r.top) * 650) / r.height - 76,
    });
  });
  let drag:
    | {
        element: HTMLElement;
        id: string;
        user: string;
        pointer: number;
        x: number;
        y: number;
        startX: number;
        startY: number;
        board: ReturnType<typeof boardGeometry>;
        width: number;
        ratio: number;
        rotation: number;
        mode: "move" | "resize" | "rotate";
        centerX: number;
        centerY: number;
        startAngle: number;
      }
    | undefined;
  function photoRatio(element: HTMLElement) {
    return Number(element.style.getPropertyValue("--vision-photo-ratio")) || 1.5;
  }
  function focusImage(id: string, expanded: boolean, control?: string) {
    document
      .querySelector<HTMLElement>(
        `${expanded ? ".vision-expanded" : "#vision-board-pane"} [${control || "data-vision-image"}="${id}"]`,
      )
      ?.focus({ preventScroll: true });
  }
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement,
      element = target.closest<HTMLElement>("[data-vision-image]"),
      root = element?.closest<HTMLElement>("[data-vision-stage]");
    if (!element || !root || e.button !== 0) return;
    const handle = target.closest<HTMLElement>("[data-vision-scale],[data-vision-rotate]");
    const mode = handle?.hasAttribute("data-vision-rotate") ? "rotate" : handle ? "resize" : "move";
    if (mode === "move" && target.closest("button")) return;
    const i = images().find((i) => i.id === element.dataset.visionImage);
    if (!i) return;
    e.preventDefault();
    (handle ?? element).setPointerCapture(e.pointerId);
    (handle ?? element).focus();
    const bounds = element.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    drag = {
      element,
      id: i.id,
      user: String(ctx.actor().id),
      pointer: e.pointerId,
      x: parseFloat(element.style.left) * 10,
      y: parseFloat(element.style.top) * 6.5,
      startX: e.clientX,
      startY: e.clientY,
      board: boardGeometry(element),
      width: parseFloat(element.style.width) * 10,
      ratio: photoRatio(element),
      rotation: i.rotation || 0,
      mode,
      centerX,
      centerY,
      startAngle: rotationFromPointer(e.clientX, e.clientY, centerX, centerY),
    };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const d = drag;
    if (d.mode === "rotate") {
      const angle = rotationAngle(d.rotation + rotationFromPointer(e.clientX, e.clientY, d.centerX, d.centerY) - d.startAngle, e.shiftKey);
      d.element.style.transform = `rotate(${angle}deg)`;
      d.element.style.setProperty("--vision-rotation", `${angle}deg`);
      d.element.querySelector("[data-vision-rotate]")?.setAttribute("aria-valuenow", String(angle));
      return;
    }
    if (d.mode === "resize") {
      const rad = (d.rotation * Math.PI) / 180,
        dx = (e.clientX - d.startX) * d.board.scale,
        dy = (e.clientY - d.startY) * d.board.scale,
        localX = dx * Math.cos(rad) + dy * Math.sin(rad),
        localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
      const inverseRatio = 1 / d.ratio;
      const availableHeight = Math.min(d.board.heightLimit, d.board.bottom - d.y);
      const limit = Math.min(600, 1000 - d.board.side - d.x, availableHeight * d.ratio * d.board.scale / d.board.scaleY);
      const width = Math.min(limit, Math.max(100,
        d.width + (localX + localY * inverseRatio) / (1 + inverseRatio ** 2),
      ));
      d.element.style.width = width / 10 + "%";
      return;
    }
    d.element.style.left =
      Math.max(
        d.board.side,
        Math.min(1000 - d.board.side - d.width, d.x + (e.clientX - d.startX) * d.board.scale),
      ) /
        10 +
      "%";
    d.element.style.top =
      Math.max(
        d.board.top,
        Math.min(
          d.board.bottom - d.width / d.ratio * d.board.scaleY / d.board.scale,
          d.y + (e.clientY - d.startY) * d.board.scaleY,
        ),
      ) /
        6.5 +
      "%";
  });
  document.addEventListener("pointerup", (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const d = drag;
    drag = undefined;
    if (d.user !== String(ctx.actor().id) || !d.element.isConnected) return;
    const x = parseFloat(d.element.style.left) * 10,
      y = parseFloat(d.element.style.top) * 6.5,
      width = parseFloat(d.element.style.width) * 10,
      rotation = parseFloat(d.element.style.getPropertyValue("--vision-rotation")),
      expanded = !!d.element.closest(".vision-expanded");
    if (
      Math.abs(x - d.x) +
        Math.abs(y - d.y) +
        Math.abs(width - d.width) + Math.abs(rotation - d.rotation) <
      0.01
    )
      return;
    ctx.mutate(() => {
      const i = own().visionBoard?.images.find((i) => i.id === d.id);
      if (i) {
        Object.assign(i, { x, y, rotation });
        if (d.mode === "resize") i.width = width;
      }
    });
    focusImage(d.id, expanded, d.mode === "rotate" ? "data-vision-rotate" : undefined);
  });
  document.addEventListener("pointercancel", () => {
    drag = undefined;
    drawStages();
  });
  document.addEventListener("keydown", (e) => {
    const element = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-vision-image]",
    );
    const rotate = (e.target as HTMLElement).closest<HTMLElement>("[data-vision-rotate]");
    if (rotate && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) {
      e.preventDefault();
      const id = rotate.dataset.visionRotate!;
      const expanded = !!rotate.closest(".vision-expanded");
      const direction = ["ArrowRight", "ArrowUp"].includes(e.key) ? 1 : -1;
      ctx.mutate(() => {
        const image = images().find(item => item.id === id);
        if (image) image.rotation = e.key === "Home" ? 0 : rotationAngle((image.rotation ?? 0) + direction * (e.shiftKey ? 15 : 1));
      });
      focusImage(id, expanded, "data-vision-rotate");
      return;
    }
    const control = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-vision-scale]",
    );
    if (
      control &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
        e.key,
      )
    ) {
      e.preventDefault();
      const id = control.dataset.visionScale!,
        expanded = !!control.closest(".vision-expanded");
      ctx.mutate(() => {
        const i = own().visionBoard?.images.find((i) => i.id === id);
        if (!i) return;
        const direction = ["ArrowRight", "ArrowUp"].includes(e.key) ? 1 : -1;
        if (!element) return;
        const board = boardGeometry(element);
        const heightPerWidth = board.scaleY / board.scale / photoRatio(element);
        const width = parseFloat(element.style.width) * 10;
        i.width = Math.min(600, board.heightLimit / heightPerWidth, Math.max(100, width + direction * (e.shiftKey ? 40 : 10)));
        i.x = Math.max(board.side, Math.min(i.x, 1000 - board.side - i.width));
        i.y = Math.max(board.top, Math.min(i.y, board.bottom - i.width * heightPerWidth));
      });
      focusImage(id, expanded, "data-vision-scale");
      return;
    }

    if (element && active() && isSelectionDelete(e, rotate || control ? element : e.target as HTMLElement)) {
      e.preventDefault();
      e.stopPropagation();
      const expanded = !!element.closest(".vision-expanded");
      ctx.mutate(() => {
        const board = own().visionBoard;
        if (board)
          board.images = board.images.filter(
            (i) => i.id !== element.dataset.visionImage,
          );
      });
      document
        .querySelector<HTMLElement>(
          expanded
            ? ".vision-expanded [data-vision-stage]"
            : "#vision-board-pane [data-vision-stage]",
        )
        ?.focus({ preventScroll: true });
      ctx.notify("Imagen eliminada del vision board.");
      return;
    }
    if (
      !element ||
      (e.target as HTMLElement).closest("button") ||
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    )
      return;
    e.preventDefault();
    ctx.mutate(() => {
      const i = own().visionBoard?.images.find(
        (i) => i.id === element.dataset.visionImage,
      );
      if (!i) return;
      const board = boardGeometry(element);
      const step = e.shiftKey ? 1 : 10;
      const width = parseFloat(element.style.width) * 10;
      const x = parseFloat(element.style.left) * 10;
      const y = parseFloat(element.style.top) * 6.5;
      i.x = Math.max(
        board.side,
        Math.min(
          1000 - board.side - width,
          x +
            (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
        ),
      );
      i.y = Math.max(
        board.top,
        Math.min(
          board.bottom - width / photoRatio(element) * board.scaleY / board.scale,
          y +
            (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
        ),
      );
    });
    document
      .querySelector<HTMLElement>(
        `[data-vision-image="${element.dataset.visionImage}"]`,
      )
      ?.focus();
  });
  $("#vision-image-input").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    void add(Array.from(input.files || []));
    input.value = "";
  });
  $("#editor-dialog").addEventListener("close", (event) => {
    const dialog = event.currentTarget as HTMLDialogElement;
    if (!dialog.open) dialog.querySelector(".vision-expanded")?.remove();
  });
  $("#editor-dialog").addEventListener("click", (event) => {
    const dialog = event.currentTarget as HTMLDialogElement;
    if (event.target === dialog && dialog.querySelector(".vision-expanded")) dialog.close();
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.overviewMode) {
      ctx.mutate(
        () =>
          (own().overviewMode =
            b.dataset.overviewMode === "vision" ? "vision" : "goals"),
      );
    }
    if (b.dataset.taskDirectoryMode) {
      ctx.mutate(
        () =>
          (own().taskDirectoryMode =
            b.dataset.taskDirectoryMode === "scrum" ? "scrum" : "boards"),
      );
    }
    if (b.hasAttribute("data-vision-upload"))
      $<HTMLInputElement>("#vision-image-input").click();
    if (b.hasAttribute("data-vision-expand")) {
      ctx.modal(
        `<div class="vision-expanded"><div data-vision-host>${stage()}</div></div>`,
      );
    }
  });
  return { renderOverview, renderTasks: () => {} };
}
