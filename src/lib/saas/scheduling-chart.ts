import { smoothLine } from "./chart-path.ts";
/** Uses the same interpolation as overview; every point remains an observed daily count. */
export function schedulingChart(samples: { day: string; count: number }[]) {
  const width = 610, height = 210, left = 32, right = 594, top = 18, baseline = 178;
  const values = samples.map((sample) => Math.max(0, Number.isFinite(sample.count) ? sample.count : 0));
  const maximum = Math.ceil(Math.max(2, ...values) / 2) * 2;
  const points = values.map((value, index) => [
    samples.length === 1 ? (left + right) / 2 : left + index / Math.max(1, samples.length - 1) * (right - left),
    baseline - value / maximum * (baseline - top),
  ]);
  const path = smoothLine(points);
  const area = points.length > 1 ? `${path} L${points.at(-1)![0]},${baseline} L${points[0][0]},${baseline} Z` : "";
  return { width, height, left, right, top, baseline, maximum, points, path, area };
}
