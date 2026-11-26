import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { A as renderTemplate, V as createComponent, w as renderComponent } from "./sequence_7Wraq-g2.mjs";
import "./compiler_DoKlo7tQ.mjs";
import { t as $$Auth } from "./Auth_Cag6kD67.mjs";
//#region src/pages/acceso/registro.astro
var registro_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Registro,
	file: () => $$file,
	url: () => $$url
});
var $$Registro = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${renderComponent($$result, "Auth", $$Auth, { "register": true })}`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/pages/acceso/registro.astro", void 0);
var $$file = "/Users/cristiandinamarca/Desktop/orbital/src/pages/acceso/registro.astro";
var $$url = "/acceso/registro";
//#endregion
//#region \0virtual:astro:page:src/pages/acceso/registro@_@astro
var page = () => registro_exports;
//#endregion
export { page };
