/** Keeps scroll cues in sync with content, viewport and keyboard/wheel scrolling. */
export function installOverflowHints() {
  const regions = new Map<HTMLElement, () => void>();
  let queued = false;
  const resize = new ResizeObserver(() => schedule());
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const [region, sync] of regions) {
        if (!region.isConnected) {resize.unobserve(region);region.removeEventListener('scroll',sync);regions.delete(region);}
      }
      document.querySelectorAll<HTMLElement>('.overflow-hint > [data-scroll-region]').forEach(region => {
        if (!regions.has(region)) {
          const sync = () => region.parentElement?.classList.toggle('has-more',region.scrollHeight-region.clientHeight-region.scrollTop>3);
          regions.set(region,sync);region.addEventListener('scroll',sync,{passive:true});resize.observe(region);
        }
      });
      document.querySelectorAll<HTMLElement>('#workspace-main .section-note').forEach(note=>note.classList.toggle('demo-notice',/demo|ejemplo/i.test(note.textContent||'')));
      regions.forEach(sync => sync());
    });
  }
  new MutationObserver(schedule).observe(document.querySelector('#workspace-main') || document.body,{childList:true,subtree:true});
  schedule();
}
