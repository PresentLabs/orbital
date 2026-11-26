import { A as renderTemplate, B as createAstro, D as renderSlot, M as renderHead, N as addAttribute, T as Fragment, V as createComponent, w as renderComponent } from "./sequence_7Wraq-g2.mjs";
import { n as renderScript, t as $$Icon } from "./fonts_CsmcIbhS.mjs";
import { a as payload } from "./server_Bo7bLI-7.mjs";
import "./compiler_DoKlo7tQ.mjs";
import { t as $$ThemeInit } from "./workspace_DkZIfNHx.mjs";
import { r as validLogo } from "./formats_Dx7iOSDS.mjs";
//#region src/components/saas/Auth.astro
createAstro("https://astro.build");
var $$Auth = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Auth;
	const { register = false, invitation = false } = Astro.props;
	Astro.response.headers.set("Cache-Control", "private, no-store");
	const workspace = Astro.url.searchParams.get("negocio") || "";
	const businessQuery = /^\d+$/.test(workspace) ? "?negocio=" + workspace : "";
	const brandingPath = "branding" + (businessQuery ? "?workspace=" + workspace : "");
	const branding = await payload(Astro, brandingPath).catch(() => null);
	const logo = branding?.logoData && validLogo(branding.logoData) ? branding.logoData : "";
	const business = branding?.name || "Orbital";
	const error = Astro.url.searchParams.get("error");
	const messages = {
		business: "Esta cuenta pertenece a otro negocio. Usa el enlace de acceso de tu equipo.",
		credentials: "El correo o la contraseña no son correctos. Intenta nuevamente.",
		unavailable: "El servicio de acceso no está disponible. Revisa la configuración de Payload.",
		registration: "No pudimos crear la cuenta. Revisa el código de registro y tus datos.",
		validation: "Revisa tus datos. La contraseña debe tener al menos 12 caracteres.",
		origin: "La solicitud no es válida. Recarga la página."
	};
	return renderTemplate`<html lang="es"><head>${renderComponent($$result, "ThemeInit", $$ThemeInit, {})}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>
      ${invitation ? "Crea tu contraseña" : register ? "Crear negocio" : "Bienvenido"} · ${business}
    </title>${renderHead($$result)}</head><body class="orbita auth-page"><aside class="auth-story"><a class="brand" href="/app"${addAttribute(business, "aria-label")}>${logo ? renderTemplate`<img class="business-logo auth-logo"${addAttribute(logo, "src")}${addAttribute(business, "alt")}>` : renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<span class="brand-symbol">✳</span>orbital<span class="brand-period">®</span>` })}`}</a><div class="auth-story-copy"><div class="eyebrow">UN ESPACIO. TODO CONECTADO.</div><h1>Tu próxima<br>gran idea<br>tiene espacio.</h1><p>Tu negocio, tus proyectos y las personas que lo hacen posible. En un mismo lugar.</p><div class="auth-art" aria-hidden="true"><div class="orbit-art"><div class="orbita-orbit o1"></div><div class="orbita-orbit o2"></div><div class="orbita-orbit o3"></div><div class="orbit-center">✳</div><div class="floating-tile tile-b">↗</div><span class="art-spark spark-a">✧</span></div></div></div><span class="auth-story-footer">Hecho para conectar ideas y hacerlas crecer.</span></aside><main class="auth-form-side"><div class="auth-form-wrap">${invitation ? renderTemplate`${renderSlot($$result, $$slots["default"])}` : renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<div class="eyebrow">${register ? "EMPIEZA ALGO GRANDE" : "QUÉ BUENO TENERTE AQUÍ"}</div><h2>${register ? "Un nuevo comienzo." : `Vuelve a ${business}.`}</h2><p>${register ? "Crea un espacio para tu negocio." : "Tu próximo gran paso te está esperando."}</p><form action="/api/saas/auth" method="post"><input type="hidden" name="workspace"${addAttribute(businessQuery ? workspace : "", "value")}><input type="hidden" name="action"${addAttribute(register ? "register" : "login", "value")}>${register && renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<label>Tu nombre<input name="name" autocomplete="name" required maxlength="80" placeholder="¿Cómo te llamas?"></label><label>Nombre del negocio<input name="business" autocomplete="organization" required maxlength="80" placeholder="El nombre de tu próximo gran proyecto"></label>` })}` })}`}<label>Correo electrónico<input type="email" name="email" required autocomplete="email" placeholder="hola@tunegocio.cl"></label><label>Contraseña<input type="password" name="password" required${addAttribute(register ? 12 : 1, "minlength")} maxlength="128"${addAttribute(register ? "new-password" : "current-password", "autocomplete")}${addAttribute(register ? "Al menos 12 caracteres" : "Tu contraseña", "placeholder")}></label>${register && renderTemplate`<label>Código de registro<input name="code" required autocomplete="off" placeholder="Código proporcionado por tu administrador"></label>`}${error && renderTemplate`<p class="auth-error" role="alert">${messages[error] || messages.unavailable}</p>`}<button class="button primary" type="submit">${register ? "Crear mi espacio" : "Entrar a mi espacio"}${renderComponent($$result, "Icon", $$Icon, {
		"name": "arrow",
		"size": 16
	})}</button></form>${!register && renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<div class="auth-separator">¿Quieres conocer el espacio?</div><a class="demo-link" href="/app?demo=1">Explorar la demo <span style="margin-left:8px">↗</span></a>` })}` })}`}${register && renderTemplate`<a class="auth-back"${addAttribute("/acceso" + businessQuery, "href")}>← Volver al acceso</a>`}` })}`}<div class="auth-trust">${renderComponent($$result, "Icon", $$Icon, {
		"name": "shield",
		"size": 13
	})}<span>Un espacio seguro para lo que estás construyendo.</span></div></div></main>${renderScript($$result, "/Users/cristiandinamarca/Desktop/orbital/src/components/saas/Auth.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/components/saas/Auth.astro", void 0);
//#endregion
export { $$Auth as t };
