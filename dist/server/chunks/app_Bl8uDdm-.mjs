import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { A as renderTemplate, B as createAstro, D as renderSlot, M as renderHead, N as addAttribute, T as Fragment, V as createComponent, j as maybeRenderHead, w as renderComponent } from "./sequence_7Wraq-g2.mjs";
import { n as renderScript, t as $$Icon } from "./fonts_CsmcIbhS.mjs";
import { a as payload, l as setting } from "./server_Bo7bLI-7.mjs";
import "./compiler_DoKlo7tQ.mjs";
import { t as $$ThemeInit } from "./workspace_DkZIfNHx.mjs";
import { r as validLogo } from "./formats_Dx7iOSDS.mjs";
import { i as isAdmin, t as canView } from "./permissions_BVhMm5T3.mjs";
//#region src/components/saas/ReservationsPanel.astro
var $$ReservationsPanel = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${maybeRenderHead($$result)}<section class="view" data-panel="reservations" hidden data-astro-cid-jk4vxrto><div class="page-heading compact" data-astro-cid-jk4vxrto><div data-astro-cid-jk4vxrto><h1 id="scheduling-title" data-astro-cid-jk4vxrto>Resumen</h1><p id="scheduling-description" data-astro-cid-jk4vxrto>Revisa el movimiento de tu agenda y las próximas horas de atención.</p></div><div class="heading-actions" data-astro-cid-jk4vxrto><button type="button" class="button secondary" id="reservations-refresh" data-astro-cid-jk4vxrto>${renderComponent($$result, "Icon", $$Icon, {
		"name": "rotate",
		"size": 16,
		"data-astro-cid-jk4vxrto": true
	})}Actualizar</button><button type="button" class="button primary" id="reservation-new" data-astro-cid-jk4vxrto>${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 16,
		"data-astro-cid-jk4vxrto": true
	})}Agendar hora</button></div></div><p id="reservations-message" hidden class="section-note" role="status" aria-live="polite" data-astro-cid-jk4vxrto></p><div id="reservations-content" aria-labelledby="scheduling-title" data-astro-cid-jk4vxrto></div></section>`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/components/saas/ReservationsPanel.astro", void 0);
//#endregion
//#region src/components/saas/BillingPanel.astro
var $$BillingPanel = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${maybeRenderHead($$result)}<section class="billing-panel panel" data-billing-panel data-astro-cid-net475rq><div class="billing-panel-heading" data-astro-cid-net475rq><span class="billing-symbol" data-astro-cid-net475rq>${renderComponent($$result, "Icon", $$Icon, {
		"name": "page",
		"size": 24,
		"data-astro-cid-net475rq": true
	})}</span><div data-astro-cid-net475rq><h2 data-astro-cid-net475rq>Facturación electrónica</h2><p data-astro-cid-net475rq>Configura la emisión y consulta los documentos tributarios de tu tienda.</p></div><button class="button secondary" id="billing-refresh" data-astro-cid-net475rq>Actualizar</button></div><p id="billing-message" role="status" aria-live="polite" data-astro-cid-net475rq></p><div id="billing-summary" class="module-catalog" data-astro-cid-net475rq></div><section id="dte-config" class="panel module-panel" hidden data-astro-cid-net475rq><h2 data-astro-cid-net475rq>Configurar Facturación propia</h2><p data-astro-cid-net475rq>Se usará automáticamente la tienda conectada en Configuración → Integraciones.</p><p id="dte-store" data-astro-cid-net475rq></p><p id="dte-payload-extension" hidden data-astro-cid-net475rq>Tu tienda usa el plugin ecommerce de Payload. <a href="/modules/orbital-payload-billing-cl-0.3.0.tgz" download data-astro-cid-net475rq>Descargar extensión tributaria Chile</a> para conservar el detalle del pago y sus devoluciones.</p><form id="dte-install" class="module-form" data-astro-cid-net475rq><label data-astro-cid-net475rq>Ambiente<select name="environment" data-astro-cid-net475rq><option value="certification" data-astro-cid-net475rq>Certificación SII</option><option value="production" data-astro-cid-net475rq>Producción (requiere autorización del servidor)</option></select></label><label data-astro-cid-net475rq>RUT emisor<input name="rut" required maxlength="12" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>RUT del firmante<input name="sender" required maxlength="12" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Razón social<input name="name" required maxlength="100" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Giro<input name="giro" required maxlength="80" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Código de actividad<input name="activity" required pattern="[0-9]{6}" maxlength="6" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Dirección<input name="address" required maxlength="70" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Comuna<input name="commune" required maxlength="20" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Oficina SII<input name="sii_office" required maxlength="40" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Fecha de resolución<input name="resolution_date" type="date" required data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Número de resolución<input name="resolution_number" type="number" min="0" step="1" required data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Certificado digital (.p12 / .pfx)<input name="certificate" type="file" accept=".p12,.pfx" data-astro-cid-net475rq></label><p data-astro-cid-net475rq>Obligatorio al instalar. Al editar, dejar vacío conserva el certificado cifrado.</p><label data-astro-cid-net475rq>Contraseña del certificado<input name="password" type="password" autocomplete="new-password" data-astro-cid-net475rq></label><label data-astro-cid-net475rq><input name="automaticIssue" type="checkbox" data-astro-cid-net475rq> Emitir boleta automáticamente al confirmar pago (factura si el receptor fue configurado como DTE 33)</label><label data-astro-cid-net475rq><input name="automaticRefunds" type="checkbox" data-astro-cid-net475rq> Generar NC por devoluciones confirmadas de la tienda</label><label data-astro-cid-net475rq><input name="confirmSoleEmitter" type="checkbox" data-astro-cid-net475rq> Confirmo que ningún otro sistema emite DTE para estos pedidos</label><details data-astro-cid-net475rq><summary data-astro-cid-net475rq>Autorización de producción</summary><label data-astro-cid-net475rq>Confirmación explícita<input name="production_confirmation" placeholder="ACTIVAR PRODUCCION RUT" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Evidencia de certificación<textarea name="evidence" rows="3" data-astro-cid-net475rq></textarea></label></details><button class="button primary" type="submit" data-astro-cid-net475rq>Verificar y guardar configuración</button></form><p data-astro-cid-net475rq>Certificado y contraseña quedan cifrados. No necesitas WordPress para facturar pedidos de Shopify o Payload.</p></section><section id="dte-workspace" class="panel module-panel" hidden data-astro-cid-net475rq><div class="panel-heading" data-astro-cid-net475rq><h2 data-astro-cid-net475rq>Facturación propia · Chile</h2><button class="button secondary" id="dte-status" data-astro-cid-net475rq>Consultar conexión</button></div><p id="dte-environment" data-astro-cid-net475rq>Consulta la conexión para conocer el ambiente activo.</p><p data-astro-cid-net475rq>Orbital consulta pagos y devoluciones de la tienda conectada. El motor tributario conserva los documentos originales y su tienda de origen.</p><button class="button secondary" id="dte-load-orders" data-astro-cid-net475rq>Buscar pedidos en la tienda</button><div id="dte-source-orders" data-astro-cid-net475rq></div><form id="dte-order" class="module-form" data-astro-cid-net475rq><label data-astro-cid-net475rq>ID del pedido en la tienda conectada<input name="orderId" type="text" maxlength="100" required data-astro-cid-net475rq><small data-astro-cid-net475rq>En Shopify usa el ID del pedido, no su número visible #1001.</small></label><button class="button secondary" data-astro-cid-net475rq>Consultar documentos</button></form><button class="button secondary" id="dte-history" data-astro-cid-net475rq>Historial de todas las tiendas</button><div id="dte-documents" data-astro-cid-net475rq></div><details data-astro-cid-net475rq><summary data-astro-cid-net475rq>CAF y folios autorizados</summary><p id="dte-cafs" data-astro-cid-net475rq>Consulta el estado para ver los folios.</p><form id="dte-caf" class="module-form" data-astro-cid-net475rq><label data-astro-cid-net475rq>CAF del ambiente activo (.xml)<input name="caf" type="file" accept=".xml" required data-astro-cid-net475rq></label><button class="button secondary" data-astro-cid-net475rq>Importar CAF</button></form></details><details data-astro-cid-net475rq><summary data-astro-cid-net475rq>Emitir documento del pedido</summary><form id="dte-issue" class="module-form" data-astro-cid-net475rq><p data-astro-cid-net475rq>El pedido debe tener el pago confirmado y sus datos tributarios guardados en Orbital.</p><label data-astro-cid-net475rq>Tipo<select name="type" data-astro-cid-net475rq><option value="39" data-astro-cid-net475rq>39 · Boleta electrónica</option><option value="33" data-astro-cid-net475rq>33 · Factura electrónica</option></select></label><button class="button primary" data-astro-cid-net475rq>Solicitar emisión del pedido consultado</button></form></details><details data-astro-cid-net475rq><summary data-astro-cid-net475rq>Guardar receptor antes de emitir</summary><form id="dte-fiscal" class="module-form" data-astro-cid-net475rq><label data-astro-cid-net475rq>Tipo<select name="type" data-astro-cid-net475rq><option value="39" data-astro-cid-net475rq>39 · Boleta</option><option value="33" data-astro-cid-net475rq>33 · Factura</option></select></label><label data-astro-cid-net475rq>RUT<input name="rut" required maxlength="20" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Razón social / nombre<input name="name" required maxlength="100" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Giro<input name="giro" maxlength="80" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Dirección<input name="address" maxlength="70" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Comuna<input name="commune" maxlength="20" data-astro-cid-net475rq></label><button class="button secondary" data-astro-cid-net475rq>Guardar receptor</button></form></details><details id="dte-adjust-details" data-astro-cid-net475rq><summary data-astro-cid-net475rq>Nota de crédito / débito</summary><form id="dte-adjust" class="module-form" data-astro-cid-net475rq><p data-astro-cid-net475rq>Selecciona el original desde la tabla. Un ajuste tributario no devuelve dinero. Las devoluciones de dinero se realizan en la tienda conectada.</p><label data-astro-cid-net475rq>ID del documento original<input name="documentId" type="number" min="1" required readonly data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Tipo<select name="type" data-astro-cid-net475rq><option value="61" data-astro-cid-net475rq>61 · Nota de crédito</option><option value="56" data-astro-cid-net475rq>56 · Nota de débito</option></select></label><label data-astro-cid-net475rq>Monto CLP<input name="amount" type="number" step="1" min="1" required data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Motivo<input name="reason" required maxlength="90" data-astro-cid-net475rq></label><label data-astro-cid-net475rq>Motivo tributario<select name="kind" data-astro-cid-net475rq><option value="return" data-astro-cid-net475rq>Devolución</option><option value="amount_correction" data-astro-cid-net475rq>Corrección de monto</option></select></label><label data-astro-cid-net475rq><input name="cancel" type="checkbox" data-astro-cid-net475rq> Anulación completa del documento referenciado</label><label data-astro-cid-net475rq><input name="no_vat_reduction" type="checkbox" data-astro-cid-net475rq> Sin rebaja de IVA (IndNoRebaja)</label><p data-astro-cid-net475rq>Si el ajuste combina productos afectos y exentos, agrega su detalle. Los montos deben sumar el total del ajuste.</p><div id="dte-lines" data-astro-cid-net475rq></div><button class="button secondary" id="dte-add-line" type="button" data-astro-cid-net475rq>Agregar producto al ajuste</button><label data-astro-cid-net475rq>Clave de operación<input name="operationKey" required readonly data-astro-cid-net475rq></label><p data-astro-cid-net475rq>Ante un error, conserva esta clave y reintenta la misma operación. Orbital controla el saldo disponible y la aceptación del original.</p><button class="button primary" data-astro-cid-net475rq>Solicitar ajuste</button><button class="button secondary" id="dte-new-operation" type="button" data-astro-cid-net475rq>Preparar otra operación</button></form></details></section></section>`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/components/saas/BillingPanel.astro", void 0);
//#endregion
//#region src/lib/saas/scheduling.ts
var schedulingSections = [
	{
		id: "dashboard",
		path: "",
		label: "Resumen",
		description: "Revisa el movimiento de tu agenda y las próximas horas de atención."
	},
	{
		id: "agenda",
		path: "agenda",
		label: "Agenda",
		description: "Consulta y administra las horas agendadas de tu negocio."
	},
	{
		id: "service",
		path: "servicios",
		label: "Servicios",
		description: "Define tus servicios, precios y tiempos de atención."
	},
	{
		id: "package",
		path: "paquetes",
		label: "Paquetes",
		description: "Organiza los servicios y las sesiones incluidas en cada paquete.",
		admin: true
	},
	{
		id: "extra",
		path: "extras",
		label: "Extras",
		description: "Define complementos, precios y tiempos adicionales para tus servicios.",
		admin: true
	},
	{
		id: "category",
		path: "categorias",
		label: "Categorías",
		description: "Agrupa tus servicios y organiza sus categorías.",
		admin: true
	},
	{
		id: "professional",
		path: "profesionales",
		label: "Profesionales",
		description: "Organiza tu equipo de atención y sus horarios."
	},
	{
		id: "location",
		path: "sucursales",
		label: "Sucursales",
		description: "Administra los lugares donde atiende tu negocio."
	},
	{
		id: "resource",
		path: "recursos",
		label: "Recursos",
		description: "Controla las salas y el equipamiento de tus atenciones."
	},
	{
		id: "customer",
		path: "clientes",
		label: "Clientes",
		description: "Mantén a mano los datos de contacto de tus clientes.",
		admin: true
	},
	{
		id: "settings",
		path: "configuracion",
		label: "Configuración",
		description: "Ajusta los horarios, días de atención y preferencias del negocio.",
		admin: true
	}
];
//#endregion
//#region src/layouts/WorkspaceLayout.astro
createAstro("https://astro.build");
var $$WorkspaceLayout = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$WorkspaceLayout;
	const user = Astro.locals.workspaceUser;
	const demo = Astro.url.searchParams.get("demo") === "1";
	const platformAdmin = user && setting(Astro, "SAAS_ADMIN_USER_IDS").split(",").map((id) => id.trim()).filter(Boolean).includes(String(user.id));
	const branding = user ? await payload(Astro, "branding").catch(() => null) : null;
	const enabledModules = user ? (await payload(Astro, "orbita-module-access").catch(() => ({ modules: [] }))).modules : demo ? ["reservations"] : [];
	const workspace = user?.workspace;
	const business = branding?.name || workspace?.name || (user ? "Mi negocio" : "Punto Pixel");
	const logo = branding?.logoData && validLogo(branding.logoData) ? branding.logoData : "";
	const session = user ? {
		id: user.id,
		name: user.name,
		firstName: user.firstName,
		lastName: user.lastName,
		email: user.email,
		phone: user.phone,
		jobTitle: user.jobTitle,
		avatarData: user.avatarData,
		role: user.role,
		permissions: user.permissions,
		workspace: {
			id: workspace?.id ?? user.workspace,
			name: business
		}
	} : null;
	const { title = "Vista general" } = Astro.props;
	return renderTemplate`<html lang="es"><head>${renderComponent($$result, "ThemeInit", $$ThemeInit, {})}<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#ffffff"><title>${title} · Orbital</title><meta name="description" content="Tu negocio, tus ideas y tu equipo. Un solo espacio para hacerlo crecer.">${renderHead($$result)}</head><body id="orbita-workspace" class="orbita"${addAttribute(JSON.stringify(enabledModules), "data-enabled-modules")}${addAttribute(session ? JSON.stringify(session) : void 0, "data-workspace-user")}${addAttribute(branding ? JSON.stringify({
		currency: branding.currency,
		timezone: branding.timezone,
		palette: branding.palette
	}) : void 0, "data-branding")}><a class="skip-workspace" href="#workspace-main">Ir al contenido</a><button class="sidebar-veil" aria-label="Cerrar navegación" tabindex="-1"></button><aside class="sidebar" id="sidebar" aria-label="Navegación del negocio"><div class="mobile-nav-heading"><a class="mobile-nav-brand"${addAttribute(demo ? "/app?demo=1" : "/app", "href")}${addAttribute(logo ? business : "Orbital", "aria-label")}>${logo ? renderTemplate`<img${addAttribute(logo, "src")}${addAttribute(business, "alt")}>` : renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<span class="header-orbit-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"></path></svg></span><strong>orbital</strong>` })}`}</a><button class="icon-btn" data-action="menu" aria-label="Cerrar navegación">×</button></div><a href="/app" class="brand"${addAttribute(logo ? business : "Orbital", "aria-label")}>${logo ? renderTemplate`<img${addAttribute(logo, "src")}${addAttribute(business, "alt")} class="business-logo">` : (!user || branding) && renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<span class="brand-symbol">✳</span> orbital<span class="brand-period">®</span>` })}`}</a><button class="sidebar-search" data-action="search" aria-label="Buscar en el negocio" title="Buscar (⌘ K)">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 17
	})}<span>Buscar</span><kbd>⌘ K</kbd></button><div class="sidebar-navigation"${addAttribute(!!user, "hidden")}><p class="nav-label">INICIO</p><nav aria-label="Navegación principal"><button class="nav-item" data-view="overview">${renderComponent($$result, "Icon", $$Icon, {
		"name": "home",
		"size": 19
	})}<span>Vista general</span></button><div id="store-navigation"><button type="button" class="nav-item navigation-parent module-heading" data-action="toggle-store" aria-controls="store-submenu" aria-expanded="false">Tienda<span class="nav-chevron" aria-hidden="true">⌄</span></button><div id="store-submenu" class="store-submenu" hidden><button data-view="analytics">Métricas</button><button data-view="orders">Pedidos</button><button data-view="invoices">Facturas y boletas</button><button data-view="customers">Clientes</button></div></div><div id="company-navigation"><button type="button" class="nav-item navigation-parent module-heading" data-action="toggle-company" aria-controls="company-submenu" aria-expanded="false">Empresa<span class="nav-chevron" aria-hidden="true">⌄</span></button><div id="company-submenu" class="store-submenu navigation-submenu" hidden><button class="nav-item" data-view="documents"><span>Documentos</span></button><button class="nav-item" data-view="vault"><span>Accesos</span></button><button class="nav-item" data-view="team"><span>Equipo</span></button><button class="nav-item" data-view="polls"><span>Votaciones</span></button></div></div><div id="creative-navigation"><button type="button" class="nav-item navigation-parent module-heading" data-action="toggle-creative" aria-controls="creative-submenu" aria-expanded="false">Proyecto<span class="nav-chevron" aria-hidden="true">⌄</span></button><div id="creative-submenu" class="store-submenu navigation-submenu" hidden><button class="nav-item" title="Conecta ideas en un lienzo" data-view="canvas"><span>Espacios</span></button><button class="nav-item" title="Organiza acciones y pendientes" data-view="tasks"><span>Tareas</span><span id="task-count" class="nav-count">5</span></button><button class="nav-item" data-view="pages"><span>Notas</span></button><button class="nav-item" data-view="calendar"><span>Calendario</span></button><button class="nav-item" data-view="files"><span>Archivos</span></button></div></div>${enabledModules.includes("reservations") && (demo || canView(user, "calendar")) && renderTemplate`<div id="scheduling-navigation"><button type="button" class="nav-item navigation-parent module-heading" data-action="toggle-scheduling" aria-controls="scheduling-submenu" aria-expanded="false">Agendamiento<span class="nav-chevron" aria-hidden="true">⌄</span></button><div id="scheduling-submenu" class="store-submenu navigation-submenu" hidden>${schedulingSections.filter((section) => !("admin" in section) || demo || isAdmin(user)).map((section) => renderTemplate`<button${addAttribute(section.id, "data-scheduling-section")}>${section.label}</button>`)}</div></div>`}<button class="nav-item mobile-accounting" data-view="accounting">Contabilidad</button></nav><div class="sidebar-divider"></div><div class="nav-label space-label"><button class="private-index-link" data-action="private-home">MI ÁREA PRIVADA</button><button aria-label="Agregar a mi área privada" data-action="private-create">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 14
	})}</button></div><div class="private-navigation" id="private-navigation"></div><div id="spaces-list" hidden></div></div><div class="sidebar-bottom"><button class="nav-item" data-view="settings">${renderComponent($$result, "Icon", $$Icon, {
		"name": "settings",
		"size": 19
	})}Configuración</button><div class="plan-card"><span class="plan-icon">✧</span><strong>Espacio para crecer</strong><p>Grandes ideas. Posibilidades infinitas.</p><button data-action="plan">Conoce Orbital Pro <span>↗</span></button></div><button class="profile" data-action="profile"><span class="avatar my-avatar" id="profile-avatar">CD</span><span><strong id="profile-name">Hola</strong><small id="profile-role">Explora a tu ritmo</small></span>${renderComponent($$result, "Icon", $$Icon, {
		"name": "more",
		"size": 18
	})}</button></div></aside><div class="app-shell"><header class="topbar"><a class="header-identity" href="/app"${addAttribute(logo ? business : "Orbital", "aria-label")}>${logo ? renderTemplate`<img${addAttribute(logo, "src")}${addAttribute(business, "alt")}>` : renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<span class="header-orbit-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"></path></svg></span><strong>orbital</strong>` })}`}</a><nav class="topbar-context" aria-label="Módulos"><button data-shell-module="general">Inicio</button><button data-shell-module="store">Tienda</button><button data-shell-module="company">Empresa</button><button data-shell-module="creative">Proyecto</button><button data-shell-module="scheduling">Agendamiento</button><button data-shell-module="accounting">Contabilidad</button></nav><div class="breadcrumbs"><button class="icon-btn mobile-toggle" aria-label="Abrir navegación" data-action="menu">${renderComponent($$result, "Icon", $$Icon, { "name": "menu" })}</button><span>${business}</span><span class="crumb-slash">/</span><strong id="breadcrumb">Vista general</strong></div><div class="topbar-right"><span class="save-state" id="save-state"><span></span>Guardado en este dispositivo</span>${platformAdmin && renderTemplate`<a class="icon-btn platform-admin-trigger" href="/administracion" aria-label="Administración SaaS">${renderComponent($$result, "Icon", $$Icon, {
		"name": "shield",
		"size": 19
	})}</a>`}<button class="icon-btn notification-trigger" aria-label="Notificaciones" data-action="notifications">${renderComponent($$result, "Icon", $$Icon, {
		"name": "bell",
		"size": 19
	})}<span class="notification-count" id="notification-count" hidden>0</span><span id="vote-notification" class="vote-notification" hidden aria-hidden="true">Vota</span></button><span class="top-divider"></span><button class="avatar my-avatar small" popovertarget="profile-menu" aria-label="Mi cuenta">CD</button></div><div id="profile-menu" class="profile-menu" popover="auto"><button data-view="profile"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 22v-2a8 8 0 0 1 16 0v2"></path></svg><span>Mi cuenta</span></button><button class="profile-preference" type="button" data-theme-toggle aria-label="Cambiar a modo oscuro">${renderComponent($$result, "Icon", $$Icon, {
		"name": "sun",
		"size": 17
	})}<span class="preference-label"></span></button><button class="profile-preference" id="money-visibility" type="button" data-money-toggle aria-label="Mostrar montos">${renderComponent($$result, "Icon", $$Icon, {
		"name": "percent",
		"size": 17
	})}<span class="preference-label"></span></button><button type="button" class="profile-logout" data-action="logout-person"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M10 4H4v16h6M9 12h12m-5-5 5 5-5 5"></path></svg><span>Cerrar sesión</span></button></div></header>${user && renderTemplate`<p id="workspace-loading" role="status">Cargando tu espacio de trabajo…</p>`}<main id="workspace-main" tabindex="-1"${addAttribute(!!user, "hidden")}>${renderSlot($$result, $$slots["default"])}</main><footer class="app-footer"><span><span class="status-dot"></span>Tu negocio, organizado a tu manera.</span><span>Orbital · Tu espacio de trabajo <span class="footer-star">✳</span></span></footer></div><dialog id="editor-dialog" class="editor-dialog"><button type="button" class="modal-x" data-close aria-label="Cerrar ventana">×</button><div id="dialog-content"></div></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>${renderScript($$result, "/Users/cristiandinamarca/Desktop/orbital/src/layouts/WorkspaceLayout.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/layouts/WorkspaceLayout.astro", void 0);
//#endregion
//#region src/lib/saas/chart-path.ts
/** Monotone cubic interpolation: passes through every sample without inventing peaks. */
function smoothLine(points) {
	const p = points.filter((v) => v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]));
	if (!p.length) return "";
	if (p.length === 1) return `M${p[0][0]},${p[0][1]}`;
	if (p.some((v, i) => i > 0 && v[0] <= p[i - 1][0])) return "M" + p.map((v) => v[0] + "," + v[1]).join(" L");
	const h = p.slice(1).map((v, i) => v[0] - p[i][0]), d = h.map((step, i) => (p[i + 1][1] - p[i][1]) / step);
	const m = p.map((_, i) => i === 0 ? d[0] : i === p.length - 1 ? d[d.length - 1] : d[i - 1] * d[i] <= 0 ? 0 : (h[i - 1] + h[i]) / (h[i - 1] / d[i - 1] + h[i] / d[i]));
	for (let i = 0; i < d.length; i++) {
		if (d[i] === 0) {
			m[i] = m[i + 1] = 0;
			continue;
		}
		const a = m[i] / d[i], b = m[i + 1] / d[i], norm = Math.hypot(a, b);
		if (norm > 3) {
			const scale = 3 / norm;
			m[i] = scale * a * d[i];
			m[i + 1] = scale * b * d[i];
		}
	}
	const n = (v) => Math.round(v * 1e3) / 1e3;
	return `M${p[0][0]},${p[0][1]}` + h.map((step, i) => ` C${n(p[i][0] + step / 3)},${n(p[i][1] + m[i] * step / 3)} ${n(p[i + 1][0] - step / 3)},${n(p[i + 1][1] - m[i + 1] * step / 3)} ${p[i + 1][0]},${p[i + 1][1]}`).join("");
}
//#endregion
//#region src/pages/app/index.astro
var app_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Index;
	const workspaceUser = Astro.locals.workspaceUser;
	const businessID = typeof workspaceUser?.workspace === "object" && workspaceUser.workspace ? workspaceUser.workspace.id : workspaceUser?.workspace;
	return renderTemplate`${renderComponent($$result, "WorkspaceLayout", $$WorkspaceLayout, {}, { "default": ($$result) => renderTemplate`${renderComponent($$result, "ReservationsPanel", $$ReservationsPanel, {})}${maybeRenderHead($$result)}<section class="view" data-panel="overview"><div class="page-heading"><div><div class="eyebrow"><span class="sun-glyph">☼</span><span id="greeting-date">DOMINGO, 1 DE NOVIEMBRE</span></div><h1 id="overview-greeting">Hola, ¿cómo va tu día?</h1><p>Revisa las ventas, organiza tus pendientes y sigue con lo importante.</p></div><button class="button primary" data-action="create">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Crear nuevo</button></div><div class="home-action-grid"><article class="panel month-goals-card"><div class="pill-switch planning-switch" role="group" aria-label="Planificación personal"><button type="button" data-overview-mode="goals" aria-pressed="true">Objetivos del mes</button><button type="button" data-overview-mode="vision" aria-pressed="false">Mi tablero de inspiración</button></div><div id="monthly-goals-pane"><div class="panel-heading"><div class="goals-heading-copy"><div class="goals-title-line"><h2>Objetivos del mes</h2><span id="goals-month" class="goals-month-pill"></span></div><p class="panel-subtitle">Compartidos con todo el equipo</p></div><button class="button outline small-button" data-home-action="new-goal">Agregar objetivo</button></div><div id="monthly-goals"></div><footer class="home-card-footer"><div id="goal-progress" class="goal-progress"></div><button class="subtle-button" data-trash-section="overview">Papelera de objetivos</button></footer></div><div id="vision-board-pane" hidden><div data-vision-host></div></div><input type="file" id="vision-image-input" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"></article><article class="panel today-panel" aria-labelledby="my-day-title"><div class="panel-heading"><div class="my-day-heading-title"><h2 id="my-day-title">Mi día</h2><span id="my-day-count" class="my-day-count" aria-label="Cantidad de prioridades">0</span></div><div class="my-day-heading-actions"><button class="button primary small-button" data-home-action="choose-today">Elegir prioridades</button><button class="icon-btn my-day-add" data-home-action="new-priority" aria-label="Crear tarea prioritaria" title="Crear tarea prioritaria">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 18
	})}</button></div></div><div class="overflow-hint my-day-scroll"><div id="today-tasks" data-scroll-region tabindex="0" aria-label="Tareas de mi día"></div></div><footer class="my-day-footer home-card-footer"><button class="text-link" data-home-action="my-tasks">Ver mis tareas →</button><button class="subtle-button" data-home-action="daily">Planificar mi día</button></footer></article></div><div class="section-heading" data-store-summary><h2>Cómo va el negocio <span class="demo-tag">Datos de ejemplo</span></h2><button class="subtle-button" data-view="analytics">Ver métricas ${renderComponent($$result, "Icon", $$Icon, {
		"name": "arrow",
		"size": 15
	})}</button></div><div class="metric-grid"><article class="metric-card" data-store-summary><div class="metric-top"><span>Ventas del mes</span><span class="metric-icon sage">${renderComponent($$result, "Icon", $$Icon, {
		"name": "chart",
		"size": 17
	})}</span></div><div class="metric-value">$2.845.900 <small>CLP</small></div><div class="metric-bottom"><span class="positive">↗ 18,6%</span><span>vs. mes anterior</span><svg class="sparkline" viewBox="0 0 100 32"><path${addAttribute(smoothLine([
		[1, 27],
		[10, 23],
		[20, 25],
		[30, 16],
		[40, 20],
		[50, 12],
		[60, 15],
		[70, 6],
		[80, 10],
		[90, 5],
		[99, 1]
	]), "d")}></path></svg></div></article><article class="metric-card" data-store-summary><div class="metric-top"><span>Pedidos recibidos</span><span class="metric-icon sand">${renderComponent($$result, "Icon", $$Icon, {
		"name": "cart",
		"size": 17
	})}</span></div><div class="metric-value">128 <small>pedidos</small></div><div class="metric-bottom"><span class="positive">↗ 12,3%</span><span>vs. mes anterior</span><svg class="sparkline brown" viewBox="0 0 100 32"><path${addAttribute(smoothLine([
		[1, 28],
		[15, 22],
		[26, 24],
		[37, 14],
		[48, 18],
		[59, 10],
		[70, 14],
		[81, 5],
		[99, 2]
	]), "d")}></path></svg></div></article><article class="metric-card"><div class="metric-top"><span>Tareas completadas</span><span class="metric-icon lavender">${renderComponent($$result, "Icon", $$Icon, {
		"name": "check",
		"size": 17
	})}</span></div><div class="metric-value" id="metric-tasks">8 <small>/ 13 tareas</small></div><div class="metric-bottom"><div class="mini-progress"><span></span></div><span id="metric-progress">61% de tu objetivo semanal</span></div></article><article class="metric-card"><div class="metric-top"><span>Próximo vencimiento</span><span class="metric-icon peach">${renderComponent($$result, "Icon", $$Icon, {
		"name": "clock",
		"size": 17
	})}</span></div><div class="metric-value deadline-value">05 nov <span class="days-pill">En 4 días</span></div><div class="metric-bottom"><span class="space-dot orange"></span><span>Lanzamiento de verano</span></div></article></div><div class="overview-grid"><article class="panel sales-panel" data-store-summary><div class="panel-heading"><h2>Ventas de tu tienda <span class="woo-badge">woo</span></h2><select id="sales-period" aria-label="Período de ventas"><option value="month">Este mes</option><option value="week">Últimos 7 días</option></select></div><div class="chart-tabs" role="tablist" aria-label="Métricas de tienda"><button role="tab" aria-selected="true" data-chart="sales">Ventas</button><button role="tab" aria-selected="false" data-chart="seo">SEO</button><button role="tab" aria-selected="false" data-chart="carts">Carros abandonados <span>12</span></button></div><div class="chart-summary"><strong id="chart-total">$2.845.900</strong><span class="positive" id="chart-delta">↗ 18,6% este mes</span></div><div class="chart-wrap" id="overview-chart"></div><div class="chart-legend"><span><i></i><span id="chart-legend-name">Este mes</span></span><span><i></i>Mes anterior</span><small>Vista previa · Conecta tu tienda para ver datos reales</small></div></article><article class="panel meet-card"><span class="meet-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="12" height="12" rx="3"></rect><path d="m15 10 6-3v10l-6-3z"></path></svg></span><h2>Conversa con tu equipo</h2><p>Organiza una reunión en Google Meet y elige a quién invitar.</p><div class="meet-actions"><button class="button primary" data-home-action="new-meeting">Crear reunión</button><button class="button secondary" data-home-action="schedule-meeting">Programar reunión</button></div><div id="meeting-result" aria-live="polite"></div><footer class="home-card-footer"><p id="meet-connection-note" class="section-note"></p></footer></article></div><div class="section-heading spaces-heading"><h2>Tus espacios <span class="muted-count" id="spaces-count">2</span></h2><div class="heading-actions"><button class="subtle-button" data-view="canvas">Ver todos</button><button class="subtle-button" data-action="new-space">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 15
	})}Nuevo espacio</button></div></div><div class="workspace-cards" id="workspace-cards"></div></section><section class="view" data-panel="canvas" hidden><div id="spaces-home"><div class="page-heading compact"><div><h1>Espacios del equipo</h1><p>Espacios compartidos con las personas de tu organización.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="canvas">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="new-space">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Nuevo espacio</button></div></div><div id="spaces-directory-toolbar"></div><div id="spaces-grid" class="space-directory"></div><div id="spaces-pagination" class="pagination"></div></div><div id="space-editor" hidden><div class="canvas-frame" id="canvas-frame" tabindex="0"><header class="canvas-heading"><button class="back-to-spaces" data-action="close-space">← Volver a mis espacios</button><h1 id="canvas-title">Mi negocio</h1><div class="heading-actions"><div id="canvas-members" class="canvas-members" aria-label="Personas activas"></div><button class="icon-btn tooltip-control" data-action="delete-space" aria-label="Enviar espacio a la papelera" data-tooltip="Enviar a la papelera">${renderComponent($$result, "Icon", $$Icon, { "name": "trash" })}</button></div></header><div id="canvas-tools-menu" tabindex="-1" class="canvas-tools-menu" role="group" aria-label="Opciones de herramienta" hidden></div><aside class="canvas-block-library" id="canvas-block-library" aria-label="Herramientas del espacio"><div class="canvas-library-group" role="group" aria-label="Crear" data-canvas-write>${[
		{
			id: "page",
			icon: "page",
			label: "Notas"
		},
		{
			id: "note",
			icon: "stickyNote",
			label: "Sticky notes"
		},
		{
			id: "calculation",
			icon: "calculator",
			label: "Cálculos"
		},
		{
			id: "frame",
			icon: "ideaCloud",
			label: "Ideas"
		}
	].map((block) => renderTemplate`<button type="button" class="tooltip-control"${addAttribute(block.label, "aria-label")}${addAttribute(block.label, "data-tooltip")}${addAttribute(block.id, "data-add-block")}>${renderComponent($$result, "Icon", $$Icon, {
		"name": block.icon,
		"size": 18
	})}</button>`)}<button type="button" class="tooltip-control" aria-label="Dibujo a mano" data-tooltip="Dibujo a mano" data-spatial-action="sketch">${renderComponent($$result, "Icon", $$Icon, {
		"name": "pencil",
		"size": 18
	})}</button></div><div class="canvas-library-group" role="group" aria-label="Recursos" data-canvas-write><button type="button" class="tooltip-control" aria-label="Imagen" data-tooltip="Imagen" data-add-block="image">${renderComponent($$result, "Icon", $$Icon, {
		"name": "image",
		"size": 18
	})}</button><button type="button" class="tooltip-control" aria-label="Enlace y recorte web" data-tooltip="Enlace y recorte web" data-spatial-action="web">${renderComponent($$result, "Icon", $$Icon, {
		"name": "link",
		"size": 18
	})}</button><button type="button" class="tooltip-control" aria-label="Recurso de Archivos" data-tooltip="Recurso de Archivos" data-spatial-action="media">${renderComponent($$result, "Icon", $$Icon, {
		"name": "paperclip",
		"size": 18
	})}</button><button type="button" class="tooltip-control" aria-label="Carpetas" data-tooltip="Carpetas" aria-expanded="false" aria-controls="canvas-tools-menu" data-action="new-canvas-folder">${renderComponent($$result, "Icon", $$Icon, {
		"name": "folderPlus",
		"size": 18
	})}</button><button type="button" class="tooltip-control" aria-label="Métricas" data-tooltip="Métricas" aria-expanded="false" aria-controls="canvas-tools-menu" data-action="canvas-metrics">${renderComponent($$result, "Icon", $$Icon, {
		"name": "sales",
		"size": 18
	})}</button></div></aside><div class="canvas-viewport" id="canvas-viewport"><svg id="connections" class="connections" width="10000" height="10000" aria-hidden="true"></svg><div id="canvas-nodes"></div><svg id="connection-handles" class="connection-handles" width="10000" height="10000" aria-hidden="true"></svg></div><div id="presence-cursors"></div><div id="canvas-selection-actions" role="status" hidden><span></span></div><div class="canvas-toolbar" role="toolbar" aria-label="Herramientas del lienzo"><button class="icon-btn selected tooltip-control" data-tooltip="Seleccionar" aria-label="Seleccionar" aria-pressed="true" data-tool="select">${renderComponent($$result, "Icon", $$Icon, { "name": "cursor" })}</button><button class="icon-btn tooltip-control" data-tooltip="Seleccionar área" aria-label="Seleccionar área" aria-pressed="false" data-tool="marquee">${renderComponent($$result, "Icon", $$Icon, { "name": "frame" })}</button><button class="icon-btn tooltip-control" data-tooltip="Mover lienzo" aria-label="Mover lienzo" aria-pressed="false" data-tool="hand">${renderComponent($$result, "Icon", $$Icon, { "name": "hand" })}</button><span class="toolbar-divider"></span>        <div class="canvas-toolbar-actions" role="group" aria-label="Acciones"><button type="button" class="icon-btn tooltip-control" aria-label="Agrupar" data-tooltip="Agrupar · ⌘ / Ctrl + G" data-spatial-action="stack" data-canvas-write><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M4.75 11C4.75 10.31 5.31 9.75 6 9.75H13C13.69 9.75 14.25 10.31 14.25 11V18C14.25 18.69 13.69 19.25 13 19.25H6C5.31 19.25 4.75 18.69 4.75 18V11Z"></path><path d="M9.75 6C9.75 5.31 10.31 4.75 11 4.75H18C18.69 4.75 19.25 5.31 19.25 6V13C19.25 13.69 18.69 14.25 18 14.25H11C10.31 14.25 9.75 13.69 9.75 13V6Z"></path></svg></button></div></div><div class="zoom-toolbar" role="toolbar" aria-label="Zoom del lienzo"><button class="tooltip-control" data-tooltip="Alejar" aria-label="Reducir zoom" data-action="zoom-out">${renderComponent($$result, "Icon", $$Icon, {
		"name": "minus",
		"size": 17
	})}</button><button id="zoom-value" data-action="zoom-reset" aria-label="Restablecer zoom">100%</button><button class="tooltip-control" data-tooltip="Acercar" aria-label="Aumentar zoom" data-action="zoom-in">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}</button><span class="toolbar-divider"></span><button class="tooltip-control" data-tooltip="Ver todas las tarjetas" aria-label="Centrar lienzo" data-action="fit">${renderComponent($$result, "Icon", $$Icon, {
		"name": "fit",
		"size": 18
	})}</button></div><div class="canvas-brand-tools"><button type="button" class="icon-btn tooltip-control" data-action="canvas-shortcuts" aria-controls="canvas-tools-menu" aria-expanded="false" aria-label="Atajos del lienzo" data-tooltip="Atajos del lienzo">${renderComponent($$result, "Icon", $$Icon, {
		"name": "keyboard",
		"size": 19
	})}</button><span class="canvas-watermark">✳ orbital</span></div><section id="canvas-detail" aria-label="Detalle del elemento" hidden></section></div></div></section><section class="view" data-panel="tasks" hidden><div id="personal-tasks-home" hidden></div><div id="task-projects-home"><div class="page-heading compact"><div><h1>Tableros del equipo</h1><p>Organiza el trabajo diario y los proyectos.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="tasks">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="new-board">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Nuevo tablero</button></div></div><div id="task-directory-content"><div id="tasks-directory-toolbar"></div><div id="task-project-grid" class="task-project-grid"></div><div id="tasks-pagination" class="pagination"></div></div></div><div id="task-board-editor" hidden><button class="back-link" data-action="back-boards">← Volver a mis tableros</button><div class="page-heading compact"><div><div class="board-title-line"><h1>Tablero</h1><span class="work-mode-badge" id="board-work-mode"></span></div><p id="board-description"></p></div><div class="heading-actions"><details class="board-menu"><summary aria-label="Acciones del tablero">···</summary><div id="board-secondary-menu"></div></details><button class="button primary" data-action="new-task">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Nueva tarea</button></div></div><div id="board-active-work"></div><div class="board-tabs-progress"><div class="work-tabs" role="tablist" aria-label="Contenido del tablero"><button role="tab" data-board-tab="board" aria-selected="true" aria-controls="board-main-pane">Tablero</button><button role="tab" data-board-tab="summary" aria-selected="false" aria-controls="board-summary-pane">Resumen</button><button role="tab" data-board-tab="progress" aria-selected="false" aria-controls="board-progress-pane">Avance</button></div><div id="task-board-progress" class="task-board-progress"></div></div><div id="board-main-pane" role="tabpanel"><div class="view-toolbar task-board-toolbar"><div class="task-board-filters"><label class="filter-search">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 17
	})}<input id="task-search" placeholder="Buscar tareas…" aria-label="Buscar tareas"></label><select id="task-filter" aria-label="Filtrar por prioridad"><option value="all">Todas las prioridades</option><option value="high">Prioridad alta</option><option value="normal">Prioridad normal</option></select><select id="cycle-task-filter" aria-label="Tareas del ciclo" hidden><option value="all">Todas las tareas</option><option value="current">Ciclo actual</option></select></div><div class="task-board-display"><div class="segmented task-mode-switch" role="group" aria-label="Vista de tareas"><button class="active" data-task-mode="board">Kanban</button><button data-task-mode="list">Lista</button><button data-task-mode="timeline">Timeline</button></div></div></div><div id="kanban-board" class="kanban-board"></div></div><div id="board-summary-pane" role="tabpanel" hidden></div><div id="board-progress-pane" role="tabpanel" hidden></div></div></section><section class="view" data-panel="calendar" hidden><div class="page-heading compact"><div><h1>Tu <span>calendario</span></h1><p>Reuniones, entregas y fechas que no quieres pasar por alto.</p></div><div class="heading-actions"><button class="button secondary" data-action="google"><span class="google-mark">G</span>Google Calendar</button><button class="button primary" data-action="new-event">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Nuevo evento</button></div></div><div class="panel calendar-panel" tabindex="0" role="region" aria-label="Calendario mensual. Desplaza horizontalmente para ver todos los días."><div class="panel-heading"><h2 id="calendar-month"></h2><div class="heading-actions"><div class="segmented calendar-view-switch" role="group" aria-label="Vista de calendario"><button data-calendar-mode="week" class="active">Semana</button><button data-calendar-mode="month">Mes</button></div><button class="button secondary small-button" data-action="calendar-today">Hoy</button><button class="icon-btn" aria-label="Período anterior" data-action="calendar-prev">‹</button><button class="icon-btn" aria-label="Período siguiente" data-action="calendar-next">›</button></div></div><div class="calendar-range-tools"><button type="button" class="button secondary" data-calendar-select-range aria-pressed="false" hidden>Elegir varios días</button><p id="calendar-range-instructions" role="status" hidden></p></div><div id="calendar-overflow" hidden></div><div id="calendar-drag-preview" aria-hidden="true" hidden></div><div class="calendar-content"><div class="calendar-weekdays">${[
		"LUN",
		"MAR",
		"MIÉ",
		"JUE",
		"VIE",
		"SÁB",
		"DOM"
	].map((d) => renderTemplate`<span>${d}</span>`)}</div><div class="calendar-grid" id="calendar-grid"></div></div></div></section><section class="view" data-panel="analytics" hidden><div class="page-heading compact"><div><h1>Los números de <span>tu negocio</span></h1><p>Ventas, posicionamiento y oportunidades de tu tienda.</p></div><button class="button secondary" data-action="export-csv">${renderComponent($$result, "Icon", $$Icon, {
		"name": "export",
		"size": 17
	})}Exportar CSV</button></div><div class="integration-notice"><span class="woo-badge">woo</span><div><strong>Tu tienda tiene mucho que contarte.</strong><p>Estás viendo datos de ejemplo. Conecta WooCommerce para consultar ventas reales.</p></div><button class="button secondary" data-view="integrations">Conectar tienda ${renderComponent($$result, "Icon", $$Icon, {
		"name": "arrow",
		"size": 15
	})}</button></div><article class="panel analytics-full"><div class="chart-tabs" role="tablist" aria-label="Métricas"><button role="tab" aria-selected="true" data-analytics="sales">Ventas</button><button role="tab" aria-selected="false" data-analytics="seo">Posicionamiento SEO</button><button role="tab" aria-selected="false" data-analytics="carts">Carros abandonados</button></div><div id="analytics-content"></div></article></section><section class="view" data-panel="pages" hidden><div class="page-heading compact"><div><h1>Notas</h1><p>Acuerdos, guías e ideas de tu equipo.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="pages">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="new-page">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Crear nota</button></div></div><div id="notes-directory-toolbar"></div><div id="pages-list" class="pages-grid"></div><div id="notes-pagination" class="pagination"></div></section><section class="view" data-panel="vault" hidden><div class="page-heading compact"><div><h1>Accesos del negocio</h1><p>Ten a mano las cuentas de tus plataformas, redes sociales y hosting.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="vault">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="new-access">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Nuevo acceso</button></div></div><div class="section-note" id="vault-note"></div><div class="view-toolbar"><label class="filter-search">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 17
	})}<input id="vault-search" aria-label="Buscar accesos" placeholder="Buscar una plataforma…"></label><select id="vault-category" aria-label="Filtrar accesos"><option value="all">Todas las categorías</option><option>Plataformas</option><option>Redes sociales</option><option>Hosting</option><option>Otros</option></select></div><div class="vault-grid" id="vault-grid"></div></section><section class="view" data-panel="polls" hidden><div class="page-heading compact"><div><h1>Votaciones del equipo</h1><p>Decidan juntos y vean los resultados en un solo lugar.</p></div><button class="button primary" id="new-poll">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Nueva votación</button></div><div id="polls-list" class="polls-grid" aria-live="polite"></div></section><section class="view" data-panel="team" hidden><div class="page-heading compact"><div><h1>Tu equipo</h1><p>Añade personas y decide qué puede ver cada una.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="team">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="new-member">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Añadir persona</button></div></div><div class="section-note" id="team-note"></div><div class="panel team-panel" tabindex="0" role="region" aria-label="Listado del equipo"><div id="team-list"></div></div></section><section class="view" data-panel="blocked" hidden><div class="empty-state"><h1>No tienes acceso a esta sección</h1><p>Pide a quien administra tu equipo que revise tus permisos.</p><button class="button secondary" data-action="profile">Ver mi cuenta</button></div></section><section class="view" data-panel="settings" hidden><div class="page-heading compact"><div><h1>Configuración del negocio</h1><p>Actualiza la información, la marca y las herramientas del equipo.</p></div></div><div class="settings-layout"><div class="settings-tabs" role="tablist" aria-label="Configuración" aria-orientation="vertical"><button type="button" role="tab" aria-selected="true" data-settings-tab="company">Empresa</button><button type="button" role="tab" aria-selected="false" data-settings-tab="brand">Logo y marca</button><button type="button" role="tab" aria-selected="false" data-settings-tab="appearance">Apariencia</button><button type="button" role="tab" aria-selected="false" data-settings-tab="preferences">Preferencias</button><button type="button" role="tab" aria-selected="false" data-settings-tab="social">Redes sociales</button><button type="button" role="tab" aria-selected="false" data-settings-tab="integrations">Integraciones</button></div><form id="settings-form" class="panel settings-panel"><div data-settings-panel="company"><h2>Información de la empresa</h2>${businessID && renderTemplate`<p>Comparte el <a${addAttribute(`/acceso?negocio=${businessID}`, "href")} target="_blank" rel="noopener noreferrer">enlace de acceso de tu negocio</a> para que tu equipo vea tu marca al iniciar sesión.</p>`}<div class="form-grid"><label>Nombre o razón social<input name="name" required maxlength="80"></label><label>RUT<input name="rut" placeholder="12.345.678-5" maxlength="14" inputmode="text"></label><label class="full-field">Giro principal<input name="giro" maxlength="160" placeholder="Por ejemplo, desarrollo de software"></label><label>Teléfono de contacto<input name="phone" type="tel" placeholder="(+56) 9 8268 0615" autocomplete="tel"></label><label>Correo de contacto<input name="email" type="email" placeholder="hola@tunegocio.cl"></label></div></div><div data-settings-panel="social" hidden><h2>Redes sociales</h2><p>Guarda los enlaces públicos de las redes de tu negocio.</p><div class="form-grid"><label>Instagram<input type="url" name="social-instagram" placeholder="https://" maxlength="500"></label><label>Facebook<input type="url" name="social-facebook" placeholder="https://" maxlength="500"></label><label>TikTok<input type="url" name="social-tiktok" placeholder="https://" maxlength="500"></label><label>LinkedIn<input type="url" name="social-linkedin" placeholder="https://" maxlength="500"></label><label>YouTube<input type="url" name="social-youtube" placeholder="https://" maxlength="500"></label><label>Pinterest<input type="url" name="social-pinterest" placeholder="https://" maxlength="500"></label><label>X<input type="url" name="social-x" placeholder="https://" maxlength="500"></label></div></div><div data-settings-panel="brand" hidden><h2>Logo del negocio</h2><p>Reemplaza la marca de Orbital por el logo de tu organización.</p><div id="logo-preview" class="logo-preview">✳</div><label class="file-label">Subir logo<input id="logo-upload" type="file" accept="image/png,image/svg+xml"></label><p class="field-hint">SVG o PNG · hasta 250 KB</p><button class="button secondary" type="button" id="remove-logo">Usar logo de Orbital</button></div><div data-settings-panel="appearance" hidden><h2>Colores del negocio</h2><p>Una paleta para todo el equipo. Solo propietarios y administradores pueden cambiarla.</p><label class="palette-mode-label">Tema<select id="palette-mode"><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><div id="business-palette-fields" class="palette-fields"></div><p id="palette-feedback" role="status" class="field-hint"></p><div class="heading-actions"><button type="button" class="button secondary" id="palette-reset">Restaurar colores</button><button type="button" class="button secondary" id="palette-discard">Descartar vista previa</button></div></div><div data-settings-panel="preferences" hidden><h2>Preferencias</h2><div class="form-grid"><label>Moneda<select name="currency"><option value="CLP">Peso chileno · CLP</option><option value="USD">Dólar · USD</option><option value="EUR">Euro · EUR</option></select></label><label>Zona horaria<select name="timezone"><option>America/Santiago</option><option>America/Mexico_City</option><option>Europe/Madrid</option></select></label></div><div class="settings-divider"></div><h2>Copias de tu información</h2><p>Exporta los tableros, las tareas, las notas y los espacios que puedes ver. Los accesos sensibles se guardan aparte.</p><div class="heading-actions"><button type="button" class="button secondary" data-action="export">Exportar JSON</button><button type="button" class="button secondary" data-action="import">Importar respaldo</button></div></div><p class="form-error" id="settings-error" role="alert"></p><button class="button primary" type="submit">Guardar cambios</button></form><div data-settings-panel="integrations" hidden><div id="integrations-grid" class="integrations-grid"></div></div></div></section><section class="view" data-panel="profile" hidden><div class="page-heading compact"><div><h1>Mi perfil</h1><p>Así te ve el resto del equipo.</p></div></div><form id="profile-form" class="panel settings-panel"><input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="profile-intro"><button type="button" id="avatar-upload-trigger" class="avatar-picker" aria-label="Cambiar foto de perfil"><span id="person-avatar" class="large-avatar">A</span><span class="avatar-camera">${renderComponent($$result, "Icon", $$Icon, {
		"name": "camera",
		"size": 15
	})}</span></button><div><strong id="person-display-name"></strong><small>Haz clic en tu foto para cambiarla. La ajustamos automáticamente.</small><span id="person-access-role" class="role-tag"></span></div></div><div class="form-grid"><label>Nombre<input name="firstName" required maxlength="80" autocomplete="given-name"></label><label>Apellido<input name="lastName" maxlength="80" autocomplete="family-name"></label><label>Negocio<select id="profile-workspace" aria-describedby="profile-workspace-hint"></select><small id="profile-workspace-hint">Tu cuenta tiene acceso a este negocio.</small></label><label>Rol de acceso<select name="accessRole" disabled></select><small>Los permisos se gestionan en Equipo.</small></label><label>Teléfono<input name="phone" type="tel" autocomplete="tel" placeholder="(+56) 9 8268 0615"></label></div><p id="profile-error" class="form-error" role="alert"></p><div class="heading-actions"><button class="button primary">Guardar mi perfil</button><button type="button" class="button secondary" data-action="logout-person">Cerrar sesión</button></div></form><form id="profile-password" method="post" action="/api/saas/profile/password" class="panel settings-panel" hidden><h2>Cambiar contraseña</h2><div class="form-grid"><label>Contraseña actual<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="128"></label><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label><label>Repite la nueva contraseña<input name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label></div><p role="status"></p><button class="button primary" type="submit">Cambiar contraseña</button></form></section><section class="view" data-panel="documents" hidden><div class="page-heading compact"><div><h1>Documentos del negocio</h1><p>Documentos legales y administrativos de tu empresa.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="documents">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="upload-document">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Subir documento</button></div></div><div id="documents-note" class="section-note"></div><div class="view-toolbar documents-toolbar"><div class="document-filters"><label class="filter-search">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 15
	})}<input id="document-search" placeholder="Buscar documento…" aria-label="Buscar documento"></label><div class="file-type-actions"><select id="document-filter" aria-label="Tipo de documento"><option value="all">Todos los documentos</option><option value="application/pdf">PDF</option><option value="image/">Imágenes</option><option value="text/">Texto</option></select></div></div><div class="document-display-controls"><details class="selection-menu document-bulk-toolbar"><summary><span id="document-selection-count" aria-live="polite">0 seleccionados</span><span aria-hidden="true">⌄</span></summary><div class="selection-menu-panel"><label><input id="document-select-all" type="checkbox">Seleccionar visibles</label><button id="download-document-zip" class="button primary" disabled>Descargar ZIP</button><button id="delete-selected-documents" class="button secondary" disabled>${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Eliminar</button></div></details><div class="segmented document-view-switch layout-page-switch" role="group" aria-label="Vista de documentos y cantidad por página"><button type="button" data-document-view="grid" aria-label="Ver documentos en grilla" aria-pressed="true">${renderComponent($$result, "Icon", $$Icon, {
		"name": "grid",
		"size": 17
	})}</button><button type="button" data-document-view="list" aria-label="Ver documentos en lista" aria-pressed="false">${renderComponent($$result, "Icon", $$Icon, {
		"name": "list",
		"size": 17
	})}</button><select id="document-page-size" aria-label="Documentos por página"><option value="8">8</option><option value="12" selected>12</option><option value="24">24</option><option value="48">48</option></select></div></div></div><div id="document-grid" class="document-grid"></div><div id="documents-pagination" class="pagination"></div></section><section class="view file-library-view" data-panel="files" hidden><div class="page-heading compact"><div><h1>Archivos</h1><p>Los recursos de tu equipo, en un solo lugar.</p></div><div class="heading-actions"><button class="button secondary trash-button" id="workspace-files-trash">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button type="button" class="button secondary" id="workspace-files-empty-trash" hidden>Vaciar papelera</button><button class="button primary" id="workspace-files-upload">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 17
	})}Subir archivos</button></div></div><div id="workspace-file-dropzone" class="workspace-file-dropzone">${renderComponent($$result, "Icon", $$Icon, {
		"name": "folder",
		"size": 28
	})}<div><strong>Suelta tus archivos aquí</strong><p id="workspace-file-drop-target">Se guardarán en la biblioteca.</p></div><button id="workspace-drop-choose" hidden>Elegir archivos</button></div><input type="file" id="workspace-files-input" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.txt,.md,.csv,.zip,.docx,.xlsx,.pptx,.mp3,.wav,.ogg,.mp4,.webm"><p id="workspace-files-trash-note" class="section-note" hidden>Los archivos de la papelera se conservan durante 30 días.</p><div class="file-library-surface"><div class="file-folder-context" id="workspace-folder-context" hidden><button class="subtle-button" data-library-root data-folder-drop=""><span aria-hidden="true">←</span> Volver a archivos</button><h2 id="workspace-current-folder"></h2><div id="workspace-folder-actions" class="heading-actions" hidden><button class="button secondary" id="workspace-folder-add">${renderComponent($$result, "Icon", $$Icon, {
		"name": "plus",
		"size": 16
	})}Añadir existentes</button><button class="button secondary" id="workspace-folder-zip">${renderComponent($$result, "Icon", $$Icon, {
		"name": "export",
		"size": 16
	})}Descargar ZIP</button></div></div><div class="view-toolbar workspace-files-toolbar" role="toolbar" aria-label="Herramientas de archivos"><div class="asset-filters"><label class="filter-search">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 16
	})}<input id="workspace-file-search" placeholder="Buscar archivos…" aria-label="Buscar archivos"></label><div class="file-type-actions"><select id="workspace-file-filter" aria-label="Tipo de archivo"><option value="all">Todos los tipos</option><option value="image">Imágenes</option><option value="pdf">PDF</option><option value="text">Texto y CSV</option><option value="office">Office</option><option value="video">Videos</option><option value="audio">Audio</option><option value="archive">ZIP</option></select></div></div><div class="asset-display-controls"><details class="selection-menu asset-bulk"><summary><span id="workspace-files-count" aria-live="polite">0 seleccionados</span><span aria-hidden="true">⌄</span></summary><div class="selection-menu-panel"><label><input type="checkbox" id="workspace-files-all">Seleccionar visibles</label><button class="button primary" id="workspace-files-download" data-assets-bulk="download" disabled>Descargar ZIP</button><button class="button secondary" id="workspace-files-move" data-assets-bulk="move" disabled>${renderComponent($$result, "Icon", $$Icon, {
		"name": "folder",
		"size": 16
	})}Mover a carpeta</button><button class="button secondary" id="workspace-files-delete" data-assets-bulk="delete" disabled>${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Eliminar</button><button class="button secondary" id="workspace-files-restore" data-assets-bulk="restore" disabled hidden>Restaurar</button></div></details><div class="segmented layout-page-switch" role="group" aria-label="Vista de archivos y cantidad por página"><button type="button" data-assets-view="grid" aria-label="Ver archivos en grilla" aria-pressed="true">${renderComponent($$result, "Icon", $$Icon, {
		"name": "grid",
		"size": 17
	})}</button><button type="button" data-assets-view="list" aria-label="Ver archivos en lista" aria-pressed="false">${renderComponent($$result, "Icon", $$Icon, {
		"name": "list",
		"size": 17
	})}</button><select id="workspace-files-page-size" aria-label="Archivos por página"><option>8</option><option selected>12</option><option>24</option><option>48</option></select></div></div></div><div class="file-library-body"><nav id="workspace-folder-sidebar" class="file-folder-sidebar" aria-label="Carpetas" hidden></nav><div class="file-library-content"><section id="workspace-folder-section" class="file-content-section"><h2>Carpetas <span id="workspace-folder-total"></span></h2><div id="workspace-file-folders" class="file-folders-grid" aria-label="Carpetas del equipo"></div></section><div class="file-section-heading"><h2 id="workspace-file-section-title">Archivos</h2><span class="file-drop-hint">Arrastra archivos para subirlos</span></div><p id="workspace-files-status" role="status" class="asset-status"></p><progress id="workspace-upload-progress" class="workspace-upload-progress" aria-label="Progreso de carga de archivos" hidden></progress><div id="workspace-files-grid" class="workspace-files-grid"></div><div id="workspace-files-pagination" class="pagination"></div></div></div><footer class="file-library-help"><strong>Formatos y límites</strong><p>Hasta 20 MB por archivo. Puedes cargar varios a la vez. Las imágenes se optimizan y, si superan 1600 px, se redimensionan manteniendo su proporción. Cada ZIP admite hasta 100 MB.</p></footer></div>  </section><section class="view document-detail" data-panel="document" hidden><div id="document-viewer"></div></section><section class="view" data-panel="orders" hidden><div class="page-heading compact"><div><h1>Pedidos de la tienda</h1><p>Revisa los pedidos y abre sus detalles.</p></div><button class="button secondary" data-action="refresh-orders">Actualizar</button></div><div id="orders-note" class="section-note"></div><div class="panel table-panel" tabindex="0" role="region" aria-label="Listado de pedidos"><div id="orders-table"></div></div><div id="orders-pagination" class="pagination"></div></section><section class="view" data-panel="invoices" hidden><div class="page-heading compact"><div><h1>Facturas y boletas</h1><p>Comprobantes emitidos y el pedido al que corresponden.</p></div><button class="button primary" data-action="upload-receipt">↑ Subir comprobante</button></div><div id="receipts-note" class="section-note"></div><div class="receipt-filters"><label>Tipo de comprobante<select id="receipt-kind-filter"><option value="all">Facturas y boletas</option><option value="factura">Solo facturas</option><option value="boleta">Solo boletas</option></select></label><label>Buscar por número de pedido<span class="filter-search">${renderComponent($$result, "Icon", $$Icon, {
		"name": "search",
		"size": 16
	})}<input id="receipt-order-search" type="search" placeholder="Por ejemplo, 1001" inputmode="numeric"></span></label></div><div class="panel table-panel" id="receipts-table" tabindex="0" role="region" aria-label="Facturas y boletas"></div></section><section class="view" data-panel="accounting" hidden><div class="page-heading"><div><h1>Contabilidad</h1><p>Facturación propia y documentos tributarios.</p></div></div>${renderComponent($$result, "BillingPanel", $$BillingPanel, {})}</section><section class="view" data-panel="order" hidden><div id="order-detail"></div></section><input id="document-upload" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown,text/csv" hidden><input id="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><input id="import-input" type="file" accept="application/json" hidden><section class="view" data-panel="private" hidden><div class="page-heading compact"><div><div class="eyebrow">MI ÁREA PRIVADA</div><h1 id="private-title"></h1><p>Solo tú puedes ver y editar estos elementos.</p></div><div class="heading-actions"><button class="button secondary trash-button" data-trash-section="all" data-trash-private="true">${renderComponent($$result, "Icon", $$Icon, {
		"name": "trash",
		"size": 16
	})}Papelera</button><button class="button primary" data-action="private-new">Agregar</button></div></div><div id="private-directory-toolbar"></div><div id="private-grid" class="private-grid"></div><div id="private-pagination" class="pagination"></div></section><section class="view" data-panel="task" hidden><div id="task-detail"></div></section><section class="view" data-panel="page" hidden><div id="page-detail"></div></section><section class="view" data-panel="search" hidden><div id="all-search-results"></div></section><section class="view" data-panel="event" hidden><div id="event-detail"></div></section><section class="view" data-panel="trash" hidden><div id="trash-content"></div></section><section class="view" data-panel="customers" hidden><div id="customers-content"></div></section><section class="view" data-panel="customer" hidden><div id="customer-content"></div></section><section class="view" data-panel="private-index" hidden><div id="private-index-content"></div></section>` })}`;
}, "/Users/cristiandinamarca/Desktop/orbital/src/pages/app/index.astro", void 0);
var $$file = "/Users/cristiandinamarca/Desktop/orbital/src/pages/app/index.astro";
var $$url = "/app";
//#endregion
export { app_exports as n, $$Index as t };
