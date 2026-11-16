export interface Rect {
  rotation?: number;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export const GRID = 24;
export function overlaps(a: Rect, b: Rect, gap = 24) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}
export function freePosition(
  wanted: Rect,
  others: Rect[],
  gap = 24,
): { x: number; y: number } {
  const x = Math.round(wanted.x / GRID) * GRID,
    y = Math.round(wanted.y / GRID) * GRID;
  const fits = (px: number, py: number) =>
    others.every((o) => !overlaps({ ...wanted, x: px, y: py }, o, gap));
  if (fits(x, y)) return { x, y };
  for (let radius = 1; radius < 80; radius++) {
    for (let i = -radius; i <= radius; i++) {
      for (const [dx, dy] of [
        [i, radius],
        [radius, i],
        [i, -radius],
        [-radius, i],
      ]) {
        const px = x + dx * GRID,
          py = y + dy * GRID;
        if (fits(px, py)) return { x: px, y: py };
      }
    }
  }
  return { x: Math.max(x, ...others.map((o) => o.x + o.width)) + gap, y };
}
export function arrangeRects(rects: Rect[]) {
  const placed: Rect[] = [];
  for (const rect of rects) {
    const position = freePosition(rect, placed);
    placed.push({ ...rect, ...position });
  }
  return placed;
}
export type PortSide = "top" | "bottom" | "left" | "right";
export function portPoint(rect: Rect, side: PortSide) {
  const point = {
    x:
      side === "left"
        ? rect.x
        : side === "right"
          ? rect.x + rect.width
          : rect.x + rect.width / 2,
    y:
      side === "top"
        ? rect.y
        : side === "bottom"
          ? rect.y + rect.height
          : rect.y + rect.height / 2,
  };
  const angle = ((rect.rotation || 0) * Math.PI) / 180,
    cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  return {
    x: cx + (point.x - cx) * Math.cos(angle) - (point.y - cy) * Math.sin(angle),
    y: cy + (point.x - cx) * Math.sin(angle) + (point.y - cy) * Math.cos(angle),
  };
}
export function connector(
  a: Rect,
  b: Rect,
  fromSide?: PortSide,
  toSide?: PortSide,
) {
  const dx = b.x + b.width / 2 - a.x - a.width / 2,
    dy = b.y + b.height / 2 - a.y - a.height / 2;
  const vertical = Math.abs(dy) > Math.abs(dx);
  const source =
    fromSide ||
    (vertical ? (dy >= 0 ? "bottom" : "top") : dx >= 0 ? "right" : "left");
  const dest =
    toSide ||
    (vertical ? (dy >= 0 ? "top" : "bottom") : dx >= 0 ? "left" : "right");
  const start = portPoint(a, source),
    end = portPoint(b, dest);
  const vectors = {
    top: [0, -1],
    bottom: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const v = vectors[source],
    w = vectors[dest],
    bend = Math.max(55, Math.hypot(end.x - start.x, end.y - start.y) / 2);
  return {
    source,
    dest,
    start,
    end,
    path: `M${start.x},${start.y} C${start.x + v[0] * bend},${start.y + v[1] * bend} ${end.x + w[0] * bend},${end.y + w[1] * bend} ${end.x},${end.y}`,
  };
}
