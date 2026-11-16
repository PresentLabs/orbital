/** Monotone cubic interpolation: passes through every sample without inventing peaks. */
export function smoothLine(points: ReadonlyArray<readonly number[]>): string {
  const p = points.filter(
    (v) => v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]),
  );
  if (!p.length) return "";
  if (p.length === 1) return `M${p[0][0]},${p[0][1]}`;
  if (p.some((v, i) => i > 0 && v[0] <= p[i - 1][0]))
    return "M" + p.map((v) => v[0] + "," + v[1]).join(" L");
  const h = p.slice(1).map((v, i) => v[0] - p[i][0]),
    d = h.map((step, i) => (p[i + 1][1] - p[i][1]) / step);
  const m = p.map((_, i) =>
    i === 0
      ? d[0]
      : i === p.length - 1
        ? d[d.length - 1]
        : d[i - 1] * d[i] <= 0
          ? 0
          : (h[i - 1] + h[i]) / (h[i - 1] / d[i - 1] + h[i] / d[i]),
  );
  for (let i = 0; i < d.length; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      norm = Math.hypot(a, b);
    if (norm > 3) {
      const scale = 3 / norm;
      m[i] = scale * a * d[i];
      m[i + 1] = scale * b * d[i];
    }
  }
  const n = (v: number) => Math.round(v * 1000) / 1000;
  return (
    `M${p[0][0]},${p[0][1]}` +
    h
      .map(
        (step, i) =>
          ` C${n(p[i][0] + step / 3)},${n(p[i][1] + (m[i] * step) / 3)} ${n(p[i + 1][0] - step / 3)},${n(p[i + 1][1] - (m[i + 1] * step) / 3)} ${p[i + 1][0]},${p[i + 1][1]}`,
      )
      .join("")
  );
}
