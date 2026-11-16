// The GIF loop count lives in an application extension before the first frame.
async function loopingGif(source: string): Promise<Blob | undefined> {
  const response = await fetch(source);
  if (!response.ok) return;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 14 || String.fromCharCode(...bytes.subarray(0, 3)) !== "GIF") return;
  const start = 13 + (bytes[10] & 128 ? 3 * (2 << (bytes[10] & 7)) : 0);
  let offset = start;
  while (bytes[offset] === 0x21 && offset + 3 < bytes.length) {
    const label = bytes[offset + 1];
    const name = String.fromCharCode(...bytes.subarray(offset + 3, offset + 14));
    if (label === 0xff && bytes[offset + 2] === 11 &&
        (name === "NETSCAPE2.0" || name === "ANIMEXTS1.0") &&
        bytes[offset + 14] === 3 && bytes[offset + 15] === 1 &&
        offset + 18 < bytes.length) {
      bytes[offset + 16] = bytes[offset + 17] = 0;
      return new Blob([bytes], { type: "image/gif" });
    }
    offset += 2;
    while (offset < bytes.length && bytes[offset]) offset += bytes[offset] + 1;
    offset++;
  }
  if (start >= bytes.length) return;
  const loop = Uint8Array.of(0x21, 0xff, 11, ...new TextEncoder().encode("NETSCAPE2.0"), 3, 1, 0, 0, 0);
  return new Blob([bytes.subarray(0, 3), "89a", bytes.subarray(6, start), loop, bytes.subarray(start)], { type: "image/gif" });
}

/** Attach playback to the real canvas viewport. GIFs display a still frame until activated. */
export function installCanvasMedia(frame: HTMLElement) {
  let videoObserver: IntersectionObserver | undefined;
  let gifObserver: IntersectionObserver | undefined;
  const gifPlayback = new WeakMap<HTMLElement, object>();
  const posters = new Map<string, HTMLCanvasElement>();

  function gifMarkup(
    id: string,
    source: string,
    title: string,
    esc: (value: unknown) => string,
  ) {
    return `<div class="canvas-gif" data-canvas-gif="${esc(id)}" data-src="${esc(source)}"><canvas role="img" aria-label="${esc(title)}"></canvas><img alt="${esc(title)}" draggable="false" hidden/><button type="button" data-gif-toggle aria-pressed="false">▶ Reproducir GIF</button></div>`;
  }
  function stop(host: HTMLElement) {
    const image = host.querySelector("img"),
      still = host.querySelector("canvas"),
      b = host.querySelector("button");
    if (!image || !still || !b || image.hidden) return;
    gifPlayback.delete(host);
    if (image.dataset.loopUrl) {
      URL.revokeObjectURL(image.dataset.loopUrl);
      delete image.dataset.loopUrl;
    }
    image.hidden = true;
    image.removeAttribute("src");
    still.hidden = false;
    b.setAttribute("aria-pressed", "false");
    b.textContent = "▶ Reproducir GIF";
  }
  function poster(host: HTMLElement) {
    const id = host.dataset.canvasGif!,
      src = host.dataset.src!,
      output = host.querySelector("canvas");
    if (!output || !src) return;
    const draw = (
      source: HTMLCanvasElement | HTMLImageElement,
      w: number,
      h: number,
    ) => {
      if (!host.isConnected || !w || !h) return;
      const factor = Math.min(1, 360 / Math.max(w, h));
      output.width = Math.max(1, Math.round(w * factor));
      output.height = Math.max(1, Math.round(h * factor));
      output
        .getContext("2d")
        ?.drawImage(source, 0, 0, output.width, output.height);
    };
    const cached = posters.get(id);
    if (cached) {
      draw(cached, cached.width, cached.height);
      return;
    }
    const image = new Image();
    image.onload = () => {
      draw(image, image.naturalWidth, image.naturalHeight);
      if (!host.isConnected) return;
      if (posters.size >= 36) posters.delete(posters.keys().next().value!);
      const copy = document.createElement("canvas");
      copy.width = output.width;
      copy.height = output.height;
      copy.getContext("2d")?.drawImage(output, 0, 0);
      posters.set(id, copy);
    };
    image.src = src;
  }
  frame.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>(
      "[data-gif-toggle]",
    );
    const host = b?.closest<HTMLElement>("[data-canvas-gif]");
    if (!b || !host) return;
    const image = host.querySelector("img")!,
      still = host.querySelector("canvas")!;
    if (!image.hidden) {
      stop(host);
      return;
    }
    const source = host.dataset.src!;
    const playback = {};
    gifPlayback.set(host, playback);
    image.src = source;
    void loopingGif(source).then(blob => {
      if (!blob || !host.isConnected || gifPlayback.get(host) !== playback) return;
      const url = URL.createObjectURL(blob);
      image.dataset.loopUrl = url;
      image.src = url;
    }).catch(() => {});
    image.hidden = false;
    still.hidden = true;
    b.setAttribute("aria-pressed", "true");
    b.textContent = "Pausar GIF";
  });
  function decorateVideo(video: HTMLVideoElement) {
    video.loop = true;
    if (video.parentElement?.classList.contains("canvas-video")) return;
    const host = document.createElement("div");
    host.className = "canvas-video";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "▶ Reproducir video";
    button.setAttribute("aria-label", "Reproducir video");
    button.addEventListener("click", () => {
      void video.play().catch(() => {
        button.textContent = "Volver a intentar";
      });
    });
    video.addEventListener("play", () => {
      if (document.activeElement === button)
        video.focus({ preventScroll: true });
      button.hidden = true;
    });
    video.addEventListener("pause", () => {
      button.hidden = false;
    });
    video.setAttribute("playsinline", "");
    video.tabIndex = 0;
    video.replaceWith(host);
    host.append(video, button);
  }
  function observe() {
    videoObserver?.disconnect();
    gifObserver?.disconnect();
    videoObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (!entry.isIntersecting) (entry.target as HTMLVideoElement).pause();
      },
      { root: frame, threshold: 0.01 },
    );
    gifObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const host = entry.target as HTMLElement;
          if (!entry.isIntersecting) stop(host);
          else if (!host.dataset.posterLoaded) {
            host.dataset.posterLoaded = "true";
            poster(host);
          }
        }
      },
      { root: frame, threshold: 0.01 },
    );
    frame.querySelectorAll("video").forEach((video) => {
      decorateVideo(video);
      videoObserver!.observe(video);
    });
    frame
      .querySelectorAll<HTMLElement>("[data-canvas-gif]")
      .forEach((gif) => gifObserver!.observe(gif));
  }
  function pause() {
    videoObserver?.disconnect();
    gifObserver?.disconnect();
    frame.querySelectorAll("video").forEach((video) => video.pause());
    frame.querySelectorAll<HTMLElement>("[data-canvas-gif]").forEach(stop);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else if (frame.getClientRects().length) observe();
  });
  return { gifMarkup, observe, pause };
}
