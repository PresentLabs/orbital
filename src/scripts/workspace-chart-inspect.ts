/** Inspect the actual samples, without changing chart data or poll charts. */
export function chartSamples(
  points: number[][],
  labels: string[],
  values: string[],
  monetary = false,
) {
  return points
    .map(
      ([x, y], i) =>
        `<circle class="chart-sample" cx="${x}" cy="${y}" r="9" tabindex="0" role="button" aria-label="${monetary ? "Consultar monto" : escape(labels[i] + ": " + values[i])}" data-chart-label="${escape(labels[i] || "")}" data-chart-value="${escape(values[i] || "")}" ${monetary ? 'data-chart-money="true"' : ""}><title>${escape(labels[i] || "")}</title></circle><circle class="chart-sample-dot" cx="${x}" cy="${y}" r="2.5" aria-hidden="true"/>`,
    )
    .join("");
}
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function installChartInspection() {
  const tip = document.createElement("div");
  tip.className = "chart-data-tooltip";
  tip.id = "chart-data-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let active: Element | null = null;
  function hide() {
    active?.classList.remove("chart-sample-active");
    active?.removeAttribute("aria-describedby");
    active = null;
    tip.hidden = true;
  }
  function show(point: Element) {
    clearPlot();
    hide();
    active = point;
    point.classList.add("chart-sample-active");
    point.setAttribute("aria-describedby", tip.id);
    const masked =
      point.hasAttribute("data-chart-money") &&
      document
        .querySelector("[data-money-toggle]")
        ?.getAttribute("data-mode") !== "values";
    tip.replaceChildren();
    const label = document.createElement("strong"),
      value = document.createElement("span");
    label.textContent = point.getAttribute("data-chart-label");
    value.textContent = masked
      ? "Montos ocultos"
      : point.getAttribute("data-chart-value");
    tip.append(label, value);
    tip.hidden = false;
    const r = point.getBoundingClientRect();
    tip.style.left =
      Math.max(
        8,
        Math.min(
          r.x + r.width / 2 - tip.offsetWidth / 2,
          innerWidth - tip.offsetWidth - 8,
        ),
      ) + "px";
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 12) + "px";
    tip.style.setProperty("--tip-arrow-x", "50%");
  }
  let plot: SVGSVGElement | null = null;
  let marker: SVGCircleElement | null = null,
    guide: SVGLineElement | null = null;
  const ns = "http://www.w3.org/2000/svg";
  function clearPlot() {
    marker?.remove();
    guide?.remove();
    plot = null;
    marker = null;
    guide = null;
  }
  const baseHide = hide;
  function follow(svg: SVGSVGElement, clientX: number, clientY: number) {
    const path = svg.querySelector<SVGPathElement>(
      'path[stroke="var(--chart-color)"],.burndown-actual',
    );
    const points = Array.from(
      svg.querySelectorAll<SVGCircleElement>(".chart-sample,.burndown-point"),
    );
    if (!path || !points.length) return;
    if (plot !== svg) {
      baseHide();
      clearPlot();
      plot = svg;
      guide = document.createElementNS(ns, "line");
      guide.classList.add("chart-follow-guide");
      guide.setAttribute("aria-hidden", "true");
      marker = document.createElementNS(ns, "circle");
      marker.classList.add("chart-follow-dot");
      marker.setAttribute("r", "4");
      marker.setAttribute("aria-hidden", "true");
      svg.append(guide, marker);
    }
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const cursor = svg.createSVGPoint();
    cursor.x = clientX;
    cursor.y = clientY;
    const local = cursor.matrixTransform(matrix.inverse());
    const xs = points.map((p) => Number(p.getAttribute("cx"))),
      x = Math.max(Math.min(...xs), Math.min(Math.max(...xs), local.x));
    let low = 0,
      high = path.getTotalLength();
    for (let i = 0; i < 20; i++) {
      const middle = (low + high) / 2;
      if (path.getPointAtLength(middle).x < x) low = middle;
      else high = middle;
    }
    const point = path.getPointAtLength((low + high) / 2),
      screen = point.matrixTransform(matrix);
    marker!.setAttribute("cx", String(point.x));
    marker!.setAttribute("cy", String(point.y));
    guide!.setAttribute("x1", String(point.x));
    guide!.setAttribute("x2", String(point.x));
    guide!.setAttribute(
      "y1",
      String(Math.min(...points.map((p) => Number(p.getAttribute("cy")))) - 12),
    );
    guide!.setAttribute(
      "y2",
      svg.classList.contains("burndown-chart") ? "215" : "143",
    );
    const nearest = points.reduce((a, b) =>
      Math.abs(Number(a.getAttribute("cx")) - x) <=
      Math.abs(Number(b.getAttribute("cx")) - x)
        ? a
        : b,
    );
    // The marker follows the real curve; the tooltip reports the nearest recorded sample.
    const masked =
      nearest.hasAttribute("data-chart-money") &&
      document
        .querySelector("[data-money-toggle]")
        ?.getAttribute("data-mode") !== "values";
    const title = document.createElement("strong"),
      value = document.createElement("span");
    title.textContent =
      nearest.getAttribute("data-chart-label") ||
      nearest.querySelector("title")?.textContent ||
      "";
    value.textContent = masked
      ? "Montos ocultos"
      : nearest.getAttribute("data-chart-value") || "";
    tip.replaceChildren(title, value);
    tip.hidden = false;
    const left = Math.max(
      8,
      Math.min(
        screen.x - tip.offsetWidth / 2,
        innerWidth - tip.offsetWidth - 8,
      ),
    );
    tip.style.left = left + "px";
    tip.style.top = Math.max(8, screen.y - tip.offsetHeight - 16) + "px";
    tip.style.setProperty(
      "--tip-arrow-x",
      Math.max(10, Math.min(tip.offsetWidth - 10, screen.x - left)) + "px",
    );
  }
  document.addEventListener(
    "pointermove",
    (e) => {
      const svg = (e.target as Element).closest<SVGSVGElement>(
        ".sales-chart,.burndown-chart",
      );
      if (svg) follow(svg, e.clientX, e.clientY);
      else if (plot) {
        clearPlot();
        hide();
      }
    },
    { passive: true },
  );
  document.addEventListener("pointerout", (e) => {
    if (
      plot &&
      (!(e.relatedTarget instanceof Node) || !plot.contains(e.relatedTarget))
    ) {
      clearPlot();
      hide();
    }
  });
  document.addEventListener("orbita:view-change", clearPlot);
  window.addEventListener("resize", clearPlot);
  window.addEventListener("scroll", clearPlot, {
    capture: true,
    passive: true,
  });
  document.addEventListener("focusin", (e) => {
    const p = (e.target as Element).closest(".chart-sample");
    if (p) show(p);
    else {
      clearPlot();
      hide();
    }
  });
  document.addEventListener("click", (e) => {
    const p = (e.target as Element).closest(".chart-sample");
    if (p) show(p);
    else {
      const svg = (e.target as Element).closest<SVGSVGElement>(
        ".sales-chart,.burndown-chart",
      );
      if (svg) follow(svg, e.clientX, e.clientY);
      else {
        clearPlot();
        hide();
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearPlot();
      hide();
    }
    const p = (e.target as Element).closest(".chart-sample");
    if (!p) return;
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const points = Array.from(
          p.parentElement!.querySelectorAll<SVGElement>(".chart-sample"),
        ),
        i = points.indexOf(p as SVGElement),
        next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? points.length - 1
              : Math.max(
                  0,
                  Math.min(
                    points.length - 1,
                    i + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                );
      points[next]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      show(p);
    }
  });
  window.addEventListener("scroll", hide, { capture: true, passive: true });
  window.addEventListener("resize", hide);
  document.addEventListener("orbita:view-change", hide);
}
