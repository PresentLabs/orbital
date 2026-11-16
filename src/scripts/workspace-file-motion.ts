/** A damped spring: drag velocity tilts the lifted card, then settles at rest. */
export function fileDragMotion() {
  let ghost: HTMLElement | undefined,
    source: HTMLElement | undefined,
    frame = 0,
    x = 0,
    y = 0,
    lastX = 0,
    lastTime = 0,
    force = 0,
    angle = 0,
    velocity = 0,
    previous = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function stop() {
    cancelAnimationFrame(frame);
    ghost?.remove();
    source?.classList.remove("asset-lifted");
    ghost = undefined;
    source = undefined;
    angle = velocity = force = 0;
  }
  function tick(time: number) {
    if (!ghost) return;
    const dt = Math.min((time - (previous || time)) / 1000, 0.032);
    previous = time;
    force *= Math.exp(-dt * 8);
    velocity += (force - angle) * 180 * dt;
    velocity *= Math.exp(-dt * 13);
    angle += velocity * dt;
    ghost.style.transform = `translate3d(${x + 14}px,${y + 14}px,0) rotate(${reduced.matches ? 0 : angle}deg)`;
    frame = requestAnimationFrame(tick);
  }
  function move(px: number, py: number) {
    const now = performance.now();
    force = Math.max(
      -9,
      Math.min(9, ((px - lastX) / Math.max(8, now - lastTime)) * 4),
    );
    lastX = px;
    lastTime = now;
    x = px;
    y = py;
  }
  function start(card: HTMLElement, px: number, py: number) {
    stop();
    source = card;
    card.classList.add("asset-lifted");
    ghost = card.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("draggable");
    ghost.removeAttribute("data-asset-card");
    ghost.classList.remove("asset-lifted");
    ghost.classList.add("asset-physics-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.style.width =
      Math.min(card.getBoundingClientRect().width, 180) + "px";
    document.body.append(ghost);
    lastX = px;
    lastTime = performance.now();
    previous = 0;
    move(px, py);
    frame = requestAnimationFrame(tick);
  }
  return { start, move, stop };
}
