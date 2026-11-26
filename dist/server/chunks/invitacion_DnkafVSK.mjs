import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { A as renderTemplate, B as createAstro, N as addAttribute, V as createComponent, j as maybeRenderHead, w as renderComponent } from "./sequence_7Wraq-g2.mjs";
import { n as renderScript } from "./fonts_CsmcIbhS.mjs";
import "./compiler_DoKlo7tQ.mjs";
import { t as $$Auth } from "./Auth_Cag6kD67.mjs";
//#region src/pages/acceso/invitacion.astro
var invitacion_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Invitacion,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Invitacion = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Invitacion;
	Astro.response.headers.set("Referrer-Policy", "no-referrer");
	Astro.response.headers.set("Cache-Control", "no-store");
	const business = Astro.url.searchParams.get("negocio") || "";
	const login = "/acceso" + (/^\d+$/.test(business) ? "?negocio=" + business : "");
	return renderTemplate`${renderComponent($$result, "Auth", $$Auth, { "invitation": true }, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<h2>Crea tu contraseña</h2><p>Elige una contraseña para unirte a tu equipo.</p><form id="invitation-form" method="post" action="/api/saas/accept-invitation"><label>Nueva contraseña<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><small>Al menos 12 caracteres.</small></label><label>Repite la contraseña<input name="confirm" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><p id="invitation-status" role="status"></p><button type="submit" class="button primary">Crear mi contraseña</button></form><a class="auth-back"${addAttribute(login, "href")} id="invitation-login">← Ir a iniciar sesión</a>` })}${renderScript($$result, "/Users/cristiandinamarca/Desktop/orbital/src/pages/acceso/invitacion.astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/pages/acceso/invitacion.astro", void 0);
var $$file = "/Users/cristiandinamarca/Desktop/orbital/src/pages/acceso/invitacion.astro";
var $$url = "/acceso/invitacion";
//#endregion
//#region \0virtual:astro:page:src/pages/acceso/invitacion@_@astro
var page = () => invitacion_exports;
//#endregion
export { page };
