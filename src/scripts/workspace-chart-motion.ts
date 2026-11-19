/** One gentle entrance per data series, without replaying on unrelated dashboard renders. */
export function installChartMotion() {
  const selector =
    ".sales-chart,.sparkline,.burndown-chart,.poll-results,.mini-progress";
  const observed = new WeakSet<Element>();
  const pending = new Set<Element>();
  const series = new Map<string, string>();
  const active = new Set<Animation>();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function animate(
    element: Element,
    frames: Keyframe[],
    duration = 750,
    delay = 0,
  ) {
    const animation = element.animate(frames, {
      duration,
      delay,
      easing: "cubic-bezier(.22,1,.36,1)",
    });
    active.add(animation);
    animation.finished.then(
      () => active.delete(animation),
      () => active.delete(animation),
    );
  }
  function reveal(element: Element) {
    if (reduced.matches || element.closest("[hidden]")) return;
    const all = Array.from(document.querySelectorAll(selector)),
      index = all.indexOf(element);
    const key =
      location.pathname +
      ":" +
      index +
      ":" +
      (element.closest(".poll-card")?.querySelector("h3")?.textContent || "");
    const signature =
      Array.from(element.querySelectorAll("path"))
        .map((p) => p.getAttribute("d"))
        .join("|") +
      "|" +
      Array.from(
        element.querySelectorAll(".poll-result-track>span,:scope>span"),
      )
        .map((p) => p.getAttribute("style"))
        .join("|") +
      (element.matches(".poll-results") ? element.textContent : "");
    if (series.get(key) === signature) return;
    if (series.size > 500) series.clear();
    series.set(key, signature);
    element.classList.add("chart-scroll-revealed");
    if (element.matches(".poll-results,.mini-progress")) {
      element
        .querySelectorAll<HTMLElement>(".poll-result-track>span,:scope>span")
        .forEach((bar, i) => {
          bar.style.transformOrigin = "left center";
          animate(
            bar,
            [
              { transform: "scaleX(0)", opacity: 0.55 },
              { transform: "scaleX(1)", opacity: 1 },
            ],
            700,
            Math.min(i * 45, 180),
          );
        });
      return;
    }
    element.querySelectorAll<SVGPathElement>("path").forEach((path) => {
      const stroke = path.getAttribute("stroke") || "";
      const line =
        element.matches(".sparkline") ||
        path.matches(".burndown-actual") ||
        stroke.includes("--chart-color");
      if (line) {
        const length = path.getTotalLength();
        if (length > 0)
          animate(
            path,
            [
              {
                strokeDasharray: `${length} ${length}`,
                strokeDashoffset: length,
                opacity: 0.5,
              },
              {
                strokeDasharray: `${length} ${length}`,
                strokeDashoffset: 0,
                opacity: 1,
              },
            ],
            850,
          );
      } else if (
        path.getAttribute("fill")?.startsWith("url(") ||
        path.matches(".burndown-ideal")
      )
        animate(path, [{ opacity: 0 }, { opacity: 1 }], 650);
    });

  }
  function scan() {
    for (const element of pending)
      if (!element.isConnected) pending.delete(element);
    document.querySelectorAll(selector).forEach((element) => {
      if (!observed.has(element)) {
        observed.add(element);
        pending.add(element);
      }
    });
  }
  // Loading or redrawing a view never starts its charts. A scroll event does.
  let scrollQueued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        scan();
        for (const element of pending) {
          if (!element.isConnected) {
            pending.delete(element);
            continue;
          }
          if (element.closest("[hidden]")) continue;
          const r = element.getBoundingClientRect(),
            visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
          if (
            r.width > 0 &&
            r.height > 0 &&
            visible >= Math.min(r.height, innerHeight) * 0.15
          ) {
            reveal(element);
            pending.delete(element);
          }
        }
      });
    },
    { capture: true, passive: true },
  );
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  });
  observer.observe(document.body, { subtree: true, childList: true });
  reduced.addEventListener("change", () => {
    if (reduced.matches) for (const animation of active) animation.cancel();
  });
  scan();
}

const entrances = new WeakMap<HTMLElement, Animation[]>();
export function enterWorkspaceView(view: HTMLElement | null) {
  document.dispatchEvent(new Event("orbita:view-change"));
  if (!view) return;
  entrances.get(view)?.forEach(animation => animation.cancel());
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if(document.body.classList.contains('canvas-fullscreen')) {
    entrances.set(view,[view.animate([{opacity:.8},{opacity:1}],{duration:140,easing:"ease"})]);
    return;
  }
  const groups=[...view.children].filter((node):node is HTMLElement=>node instanceof HTMLElement && !node.hidden);
  const targets=groups.flatMap(node=>node.matches('.overview-grid,.overview-kpis,.scheduling-priority-grid,.scheduling-kpis')?[...node.children].filter((child):child is HTMLElement=>child instanceof HTMLElement):[node]);
  entrances.set(view,(targets.length?targets:[view]).map((node,index)=>node.animate([
    {opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}
  ],{duration:450,delay:Math.min(index,8)*45,easing:'cubic-bezier(.4,0,.2,1)',fill:'backwards'})));
}
