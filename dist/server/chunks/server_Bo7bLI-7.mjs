//#region src/lib/saas/server.ts
var COOKIE = "orbita_session";
function setting(ctx, key) {
	return (ctx.locals.runtime?.env)?.[key] || globalThis.process?.env?.[key] || Object.assign({
		"ASSETS_PREFIX": void 0,
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"PUBLIC_ORBITA_BUILD": "3d6f4013-24df-4608-a547-b56ecd91c339",
		"SITE": void 0,
		"SSR": true
	}, { _: "/Users/cristiandinamarca/Desktop/orbital/node_modules/.bin/astro" })[key] || "";
}
function configured(ctx) {
	return !!setting(ctx, "PAYLOAD_URL");
}
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "private, no-store"
		}
	});
}
function sameOrigin(ctx) {
	return ctx.request.headers.get("origin") === publicOrigin(ctx);
}
function publicOrigin(ctx) {
	return setting(ctx, "ORBITA_PUBLIC_ORIGIN").trim() || setting(ctx, "ORBITAL_PUBLIC_ORIGIN").trim() || ctx.url.origin;
}
async function payload(ctx, path, init = {}, token) {
	const base = setting(ctx, "PAYLOAD_URL").replace(/\/$/, "");
	if (!base) throw new Error("Payload unavailable");
	const headers = new Headers(init.headers);
	headers.set("Content-Type", "application/json");
	const auth = token ?? ctx.cookies.get("orbita_session")?.value;
	if (auth) headers.set("Authorization", "JWT " + auth);
	const response = await fetch(base + "/api/" + path, {
		...init,
		headers,
		signal: AbortSignal.timeout(12e3)
	});
	const data = await response.json();
	if (!response.ok) throw new Error("Payload " + response.status);
	return data;
}
async function currentUser(ctx) {
	if (!ctx.cookies.get("orbita_session")?.value) return null;
	try {
		const user = (await payload(ctx, "users/me")).user;
		return user && !user.disabled ? user : null;
	} catch {
		return null;
	}
}
function setCookie(ctx, token) {
	ctx.cookies.set(COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: publicOrigin(ctx).startsWith("https://"),
		path: "/",
		maxAge: 7200
	});
}
//#endregion
export { payload as a, setCookie as c, json as i, setting as l, configured as n, publicOrigin as o, currentUser as r, sameOrigin as s, COOKIE as t };
