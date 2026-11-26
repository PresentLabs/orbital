import { A as renderTemplate, V as createComponent } from "./sequence_7Wraq-g2.mjs";
import "./compiler_DoKlo7tQ.mjs";
//#region src/components/saas/ThemeInit.astro
var $$ThemeInit = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`<script>
  try {
    const demo = new URLSearchParams(location.search).get('demo') === '1';
    const id = demo ? 'demo-me' : localStorage.getItem('orbita:theme-user');
    const mode = id && localStorage.getItem('orbita:theme:' + id) === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.add('theme-' + mode);
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  } catch {}
<\/script>`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/components/saas/ThemeInit.astro", void 0);
//#endregion
export { $$ThemeInit as t };
