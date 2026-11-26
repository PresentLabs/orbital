import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { i as json, n as configured, r as currentUser } from "./server_Bo7bLI-7.mjs";
//#region src/pages/api/saas/session.ts
var session_exports = /* @__PURE__ */ __exportAll({ GET: () => GET });
var GET = async (ctx) => json({
	configured: configured(ctx),
	user: await currentUser(ctx)
});
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/session@_@ts
var page = () => session_exports;
//#endregion
export { page };
