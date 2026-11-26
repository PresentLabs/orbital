import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { A as renderTemplate, B as createAstro, V as createComponent, w as renderComponent } from "./sequence_7Wraq-g2.mjs";
import "./compiler_DoKlo7tQ.mjs";
import { t as $$Index } from "./app_Bl8uDdm-.mjs";
//#region src/pages/app/[...ruta].astro
var ____ruta__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Component,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Component = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Component;
	if (Astro.params.ruta === "modulos") return Astro.redirect("/app/tienda/facturas-y-boletas" + (Astro.url.searchParams.get("demo") === "1" ? "?demo=1" : ""), 302);
	return renderTemplate`${renderComponent($$result, "App", $$Index, {})}`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/pages/app/[...ruta].astro", void 0);
var $$file = "/Users/cristiandinamarca/Desktop/orbital/src/pages/app/[...ruta].astro";
var $$url = "/app/[...ruta]";
//#endregion
//#region \0virtual:astro:page:src/pages/app/[...ruta]@_@astro
var page = () => ____ruta__exports;
//#endregion
export { page };
