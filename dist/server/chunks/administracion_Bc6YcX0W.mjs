import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { A as renderTemplate, B as createAstro, M as renderHead, N as addAttribute, V as createComponent, w as renderComponent } from "./sequence_7Wraq-g2.mjs";
import { n as renderScript, t as $$Icon } from "./fonts_CsmcIbhS.mjs";
import { l as setting, r as currentUser } from "./server_Bo7bLI-7.mjs";
import "./compiler_DoKlo7tQ.mjs";
//#region src/pages/administracion.astro
var administracion_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Administracion,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Administracion = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Administracion;
	const user = await currentUser(Astro);
	if (!user) return Astro.redirect("/acceso", 302);
	if (!setting(Astro, "SAAS_ADMIN_USER_IDS").split(",").map((id) => id.trim()).filter(Boolean).includes(String(user.id))) return Astro.redirect("/app", 302);
	Astro.response.headers.set("Cache-Control", "private, no-store");
	return renderTemplate`<html lang="es" class="theme-dark" data-theme="dark" style="color-scheme:dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Administración SaaS · Orbital</title>${renderHead($$result)}</head><body><a class="skip-link" href="#platform-main">Ir al contenido</a><aside class="platform-sidebar" aria-label="Navegación de Administración"><a href="/administracion" class="platform-brand"><span aria-hidden="true">✳</span>orbital</a><span class="platform-sidebar-label">Administración SaaS</span><nav aria-label="Administración"><a href="/administracion" aria-current="page">${renderComponent($$result, "Icon", $$Icon, {
		"name": "grid",
		"size": 18
	})}Negocios</a></nav><a class="platform-sidebar-workspace" href="/app">${renderComponent($$result, "Icon", $$Icon, {
		"name": "arrow",
		"size": 18
	})}Volver a mi espacio</a></aside><header class="platform-header"><div class="header-brand"><h1>Administración</h1></div><nav aria-label="Cuenta" class="header-account"><button id="toggle-businesses" class="business-picker-trigger" type="button" aria-expanded="false" aria-haspopup="dialog" aria-controls="business-directory">${renderComponent($$result, "Icon", $$Icon, {
		"name": "grid",
		"size": 18
	})}<span id="selected-business-label">Cambiar negocio</span>${renderComponent($$result, "Icon", $$Icon, {
		"name": "down",
		"size": 14
	})}</button><a href="/app" class="workspace-link">Mi espacio ${renderComponent($$result, "Icon", $$Icon, {
		"name": "arrow",
		"size": 16
	})}</a><details class="account-menu"><summary${addAttribute("Cuenta de " + user.name, "aria-label")}><span class="account-avatar">${user.name?.trim().charAt(0).toUpperCase() || "A"}</span><span class="account-name">${user.name}</span>${renderComponent($$result, "Icon", $$Icon, {
		"name": "down",
		"size": 14
	})}</summary><div class="account-dropdown"><strong>${user.name}</strong><span>${user.email}</span><form action="/api/saas/auth" method="post"><input type="hidden" name="action" value="logout"><button>${renderComponent($$result, "Icon", $$Icon, {
		"name": "arrow",
		"size": 16
	})}Cerrar sesión</button></form></div></details></nav></header><main class="platform-layout" id="platform-main" tabindex="-1"><section class="business-list" id="business-directory" popover="auto" role="dialog" aria-label="Cambiar negocio"><div class="directory-heading"><h2>Negocios <span id="business-total" class="count"></span></h2><button id="refresh-platform" class="icon-button" type="button" aria-label="Actualizar negocios" title="Actualizar">${renderComponent($$result, "Icon", $$Icon, {
		"name": "rotate",
		"size": 17
	})}</button></div><form id="business-search" role="search" aria-label="Buscar negocio"><label class="sr-only" for="business-query">Buscar negocio</label><div class="search-field">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 17
	})}<input id="business-query" name="q" type="search" maxlength="160" placeholder="Buscar negocio…" autocomplete="off"><button type="button" class="search-clear" data-clear-search="business-query" aria-label="Limpiar búsqueda de negocios">${renderComponent($$result, "Icon", $$Icon, {
		"name": "close",
		"size": 14
	})}</button></div></form><div id="businesses" class="businesses"><div class="loading-state"><span class="spinner"></span>Cargando negocios…</div></div><div id="business-pages" class="pagination"></div></section><section id="business-detail" class="business-detail" aria-label="Detalle del negocio" tabindex="-1" aria-busy="true"><div class="detail-loading"><span class="spinner"></span><p>Cargando tu administración…</p></div></section></main><div id="platform-status" class="platform-status" role="status" aria-live="polite" hidden></div><div id="person-actions" class="person-actions-popover" popover="auto"></div><dialog id="platform-dialog" aria-labelledby="platform-dialog-title"><div class="dialog-header"><h2 id="platform-dialog-title"></h2><button id="close-platform-dialog" class="icon-button" type="button" aria-label="Cerrar">${renderComponent($$result, "Icon", $$Icon, {
		"name": "close",
		"size": 20
	})}</button></div><div id="platform-dialog-content"></div></dialog>${renderScript($$result, "/Users/cristiandinamarca/Desktop/orbital/src/pages/administracion.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/pages/administracion.astro", void 0);
var $$file = "/Users/cristiandinamarca/Desktop/orbital/src/pages/administracion.astro";
var $$url = "/administracion";
//#endregion
//#region \0virtual:astro:page:src/pages/administracion@_@astro
var page = () => administracion_exports;
//#endregion
export { page };
