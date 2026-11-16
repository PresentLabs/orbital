export function rotationAngle(degrees: number, snap = false) {
  let angle = ((((degrees + 180) % 360) + 360) % 360) - 180;
  if (snap) angle = Math.round(angle / 15) * 15;
  return Math.round(angle * 10) / 10;
}
export function rotationFromPointer(
  x: number,
  y: number,
  cx: number,
  cy: number,
) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}
