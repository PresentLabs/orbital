import type { Rect } from "./canvas-layout.ts";

export const motionProfiles = {
  note: { angle: 4, scale: 1.025, time: 160, lift: 12 },
  document: { angle: 0.8, scale: 1.008, time: 180, lift: 8 },
  image: { angle: 1.4, scale: 1.032, time: 150, lift: 18 },
  web: { angle: 2, scale: 1.015, time: 170, lift: 11 },
  checklist: { angle: 0.7, scale: 1.012, time: 140, lift: 9 },
  media: { angle: 0.6, scale: 1.018, time: 160, lift: 14 },
} as const;

export function bounds(rects: Rect[]): Rect {
  if (!rects.length) return { id: "", x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y));
  return {
    id: "",
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}

export function stackLayout(anchor: Rect, cards: Rect[], available: number) {
  const gap = 24;
  const width = Math.max(255, available);
  let x = anchor.x,
    y = anchor.y + anchor.height + gap,
    height = 0;
  return cards.map((card) => {
    if (x > anchor.x && x + card.width > anchor.x + width) {
      x = anchor.x;
      y += height + gap;
      height = 0;
    }
    const pos = { ...card, x, y };
    x += card.width + gap;
    height = Math.max(height, card.height);
    return pos;
  });
}

export function reorderMembers(ids: string[], id: string, target: string) {
  const from = ids.indexOf(id),
    to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
