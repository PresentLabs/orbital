import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { n as canWrite } from "./permissions_BVhMm5T3.mjs";
import { n as googleToken } from "./integrations_P9zpvxGj.mjs";
//#region src/lib/saas/date-ranges.ts
var clock = /^([01]\d|2[0-3]):[0-5]\d$/;
function eventRange(event) {
	const start = Date.parse(`${event.date}T${event.time}:00Z`);
	const end = event.endDate && event.endTime ? Date.parse(`${event.endDate}T${event.endTime}:00Z`) : start + 36e5;
	return {
		start,
		end: Number.isFinite(end) && end > start ? end : start + 36e5
	};
}
function eventDates(start, end) {
	const a = new Date(start).toISOString(), b = new Date(end).toISOString();
	return {
		date: a.slice(0, 10),
		time: a.slice(11, 16),
		endDate: b.slice(0, 10),
		endTime: b.slice(11, 16)
	};
}
function validEventDates(event) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !clock.test(event.time)) return false;
	const stamp = Date.parse(event.date + "T00:00:00Z");
	if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== event.date) return false;
	if (event.allDay !== void 0 && typeof event.allDay !== "boolean") return false;
	if (event.allDay && (event.time !== "00:00" || event.endTime !== "00:00")) return false;
	if (event.endDate === void 0 && event.endTime === void 0) return true;
	if (!event.endDate || !event.endTime || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate) || !clock.test(event.endTime)) return false;
	const end = Date.parse(`${event.endDate}T${event.endTime}:00Z`), start = Date.parse(`${event.date}T${event.time}:00Z`);
	return Number.isFinite(end) && new Date(end).toISOString().slice(0, 10) === event.endDate && end > start;
}
//#endregion
//#region src/pages/api/saas/google/events.ts
var events_exports = /* @__PURE__ */ __exportAll({ POST: () => POST });
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
	if (!await currentUser(ctx)) return json({ error: "Inicia sesión" }, 401);
	if (!canWrite(await currentUser(ctx), "calendar")) return json({ error: "No tienes acceso al calendario." }, 403);
	try {
		const { id } = await ctx.request.json();
		if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return json({ error: "Evento inválido" }, 400);
		const docs = await payload(ctx, "documents?limit=1&where[key][equals]=" + encodeURIComponent("events:" + id));
		const event = docs.docs[0]?.value;
		if (!event) return json({ error: "Guarda el evento antes de sincronizarlo" }, 404);
		const token = await googleToken(ctx);
		const timezone = (await payload(ctx, "documents?limit=1&where[key][equals]=settings")).docs[0]?.value?.timezone || "America/Santiago";
		const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(docs.docs[0].workspace + ":" + id));
		const googleId = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
		if (!validEventDates(event)) return json({ error: "Fechas del evento no válidas" }, 400);
		const { endDate, endTime } = eventDates(eventRange(event).start, eventRange(event).end);
		const body = JSON.stringify({
			id: googleId,
			summary: event.title,
			description: event.description,
			start: event.allDay ? { date: event.date } : {
				dateTime: `${event.date}T${event.time}:00`,
				timeZone: timezone
			},
			end: event.allDay ? { date: endDate } : {
				dateTime: `${endDate}T${endTime}:00`,
				timeZone: timezone
			}
		});
		const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
		let response = await fetch(base, {
			method: "POST",
			headers: {
				Authorization: "Bearer " + token,
				"Content-Type": "application/json"
			},
			body,
			signal: AbortSignal.timeout(12e3)
		});
		if (response.status === 409) response = await fetch(base + "/" + googleId, {
			method: "PUT",
			headers: {
				Authorization: "Bearer " + token,
				"Content-Type": "application/json"
			},
			body,
			signal: AbortSignal.timeout(12e3)
		});
		if (!response.ok) throw Error();
		return json({ ok: true });
	} catch {
		return json({ error: "No se pudo enviar el evento. Revisa la conexión de Google." }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/google/events@_@ts
var page = () => events_exports;
//#endregion
export { page };
