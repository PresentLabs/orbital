import { t as __exportAll } from "./rolldown-runtime_BBjsoOtd.mjs";
import { a as payload, i as json, l as setting, r as currentUser, s as sameOrigin } from "./server_Bo7bLI-7.mjs";
import { n as canWrite } from "./permissions_BVhMm5T3.mjs";
import { n as googleToken } from "./integrations_P9zpvxGj.mjs";
//#region src/lib/saas/meet.ts
function validMeeting(value) {
	if (!value || value.immediate !== void 0 && typeof value.immediate !== "boolean" || typeof value.requestId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.requestId) || typeof value.title !== "string" || !value.title.trim() || value.title.length > 120 || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || typeof value.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || ![
		15,
		30,
		45,
		60,
		90,
		120
	].includes(value.duration) || !Array.isArray(value.members) || value.members.length > 50 || value.members.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) return false;
	const date = /* @__PURE__ */ new Date(value.date + "T12:00:00Z");
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.date;
}
function meetingBody(input, attendees, timezone, id, owner, workspace) {
	const end = /* @__PURE__ */ new Date(input.date + "T" + input.time + ":00Z");
	end.setUTCMinutes(end.getUTCMinutes() + input.duration);
	return {
		id,
		summary: input.title.trim(),
		description: "Reunión organizada desde Orbital.",
		start: {
			dateTime: input.date + "T" + input.time + ":00",
			timeZone: timezone
		},
		end: {
			dateTime: end.toISOString().slice(0, 19),
			timeZone: timezone
		},
		attendees: attendees.map((m) => ({
			email: m.email,
			displayName: m.name
		})),
		conferenceData: { createRequest: {
			requestId: id,
			conferenceSolutionKey: { type: "hangoutsMeet" }
		} },
		guestsCanInviteOthers: false,
		visibility: "private",
		extendedProperties: { private: {
			orbitaOwner: owner,
			orbitaWorkspace: workspace
		} }
	};
}
function safeMeetUrl(value) {
	try {
		const url = new URL(String(value));
		return url.protocol === "https:" && url.hostname === "meet.google.com" && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}
async function createGoogleMeeting(token, body, fetcher = fetch) {
	const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
	let response = await fetcher(base + "?conferenceDataVersion=1&sendUpdates=all", {
		method: "POST",
		headers: {
			Authorization: "Bearer " + token,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15e3)
	});
	if (response.status === 409) response = await fetcher(base + "/" + body.id, {
		headers: { Authorization: "Bearer " + token },
		signal: AbortSignal.timeout(12e3)
	});
	if (!response.ok) throw Error("Google no pudo crear la reunión. Revisa los permisos de Calendar y Meet de la cuenta conectada.");
	let event = await response.json();
	if (event.extendedProperties?.private?.orbitaOwner !== body.extendedProperties.private.orbitaOwner || event.extendedProperties?.private?.orbitaWorkspace !== body.extendedProperties.private.orbitaWorkspace) throw Error("No pudimos verificar la reunión.");
	for (let i = 0; i < 2 && event.conferenceData?.createRequest?.status?.statusCode === "pending"; i++) {
		const retry = await fetcher(base + "/" + body.id, {
			headers: { Authorization: "Bearer " + token },
			signal: AbortSignal.timeout(12e3)
		});
		if (!retry.ok) break;
		event = await retry.json();
	}
	const url = safeMeetUrl(event.hangoutLink) || safeMeetUrl(event.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri);
	if (event.conferenceData?.createRequest?.status?.statusCode === "failure") throw Error("El evento fue creado, pero esta cuenta de Google no pudo generar Meet. Revisa sus permisos antes de volver a intentarlo.");
	return {
		event,
		meetUrl: url
	};
}
//#endregion
//#region src/pages/api/saas/google/meet.ts
var meet_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST
});
var GET = async (ctx) => {
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canWrite(user, "calendar")) return json({ error: "No puedes organizar reuniones." }, 403);
	try {
		const eventId = ctx.url.searchParams.get("eventId");
		if (eventId) {
			if (!/^[a-f0-9]{64}$/.test(eventId)) return json({ error: "Reunión no válida." }, 400);
			const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events/" + eventId, {
				headers: { Authorization: "Bearer " + await googleToken(ctx) },
				signal: AbortSignal.timeout(12e3)
			});
			if (!response.ok) return json({ error: "No pudimos consultar la reunión." }, 502);
			const event = await response.json(), workspace = String(typeof user.workspace === "object" ? user.workspace.id : user.workspace);
			if (event.extendedProperties?.private?.orbitaOwner !== String(user.id) || event.extendedProperties?.private?.orbitaWorkspace !== workspace) return json({ error: "No puedes consultar esta reunión." }, 403);
			const meetUrl = safeMeetUrl(event.hangoutLink) || safeMeetUrl(event.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri);
			if (meetUrl) {
				const row = (await payload(ctx, "documents?limit=1&where[key][equals]=" + encodeURIComponent("events:meet-" + eventId.slice(0, 32)))).docs[0];
				if (row) await payload(ctx, "documents/" + row.id, {
					method: "PATCH",
					body: JSON.stringify({
						key: row.key,
						value: {
							...row.value,
							meetUrl
						}
					})
				});
			}
			return json({
				meetUrl,
				googleEventId: eventId
			});
		}
		const [directory, connections] = await Promise.all([payload(ctx, "meeting-directory"), payload(ctx, "integrations?limit=1&depth=0&where[provider][equals]=google")]);
		const configured = !!(setting(ctx, "GOOGLE_CLIENT_ID") && setting(ctx, "GOOGLE_CLIENT_SECRET"));
		return json({
			members: directory.docs,
			configured,
			connected: configured && !!connections.docs[0]
		});
	} catch {
		return json({ error: "No pudimos consultar el equipo y la conexión de Google." }, 503);
	}
};
var POST = async (ctx) => {
	if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
	const user = await currentUser(ctx);
	if (!user) return json({ error: "Inicia sesión." }, 401);
	if (!canWrite(user, "calendar")) return json({ error: "No puedes organizar reuniones." }, 403);
	try {
		const input = await ctx.request.json();
		if (input.immediate === true) {
			const branding = await payload(ctx, "branding");
			const parts = new Intl.DateTimeFormat("sv-SE", {
				timeZone: branding.timezone || "America/Santiago",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23"
			}).formatToParts(/* @__PURE__ */ new Date());
			const part = (type) => parts.find((p) => p.type === type).value;
			input.date = `${part("year")}-${part("month")}-${part("day")}`;
			input.time = `${part("hour")}:${part("minute")}`;
		}
		if (!validMeeting(input)) return json({ error: "Revisa el título, fecha, hora, duración e invitados." }, 400);
		const ids = [...new Set(input.members)];
		const invited = (await payload(ctx, "meeting-directory")).docs.filter((m) => ids.includes(String(m.id)));
		if (invited.length !== ids.length) return json({ error: "Solo puedes invitar a personas activas de tu organización." }, 400);
		const timezone = (await payload(ctx, "branding")).timezone || "America/Santiago", workspace = String(typeof user.workspace === "object" ? user.workspace.id : user.workspace);
		const fingerprint = JSON.stringify([
			workspace,
			String(user.id),
			input.requestId,
			input.title,
			input.immediate ? "now" : input.date,
			input.immediate ? "now" : input.time,
			input.duration,
			[...ids].sort()
		]);
		const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
		const id = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
		const result = await createGoogleMeeting(await googleToken(ctx), meetingBody(input, invited, timezone, id, String(user.id), workspace));
		const event = {
			id: "meet-" + id.slice(0, 32),
			title: input.title.trim(),
			date: /^\d{4}-\d{2}-\d{2}T/.test(result.event.start?.dateTime || "") ? result.event.start.dateTime.slice(0, 10) : input.date,
			time: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(result.event.start?.dateTime || "") ? result.event.start.dateTime.slice(11, 16) : input.time,
			description: "Google Meet" + (result.meetUrl ? " · " + result.meetUrl : ""),
			meetUrl: result.meetUrl || void 0,
			googleEventId: id
		};
		const key = "events:" + event.id, existing = await payload(ctx, "documents?limit=1&where[key][equals]=" + encodeURIComponent(key));
		await payload(ctx, "documents" + (existing.docs[0] ? "/" + existing.docs[0].id : ""), {
			method: existing.docs[0] ? "PATCH" : "POST",
			body: JSON.stringify({
				key,
				value: event
			})
		});
		const calendarUrl = typeof result.event.htmlLink === "string" && result.event.htmlLink.startsWith("https://www.google.com/calendar/") ? result.event.htmlLink : "https://calendar.google.com";
		return json({
			event,
			meetUrl: result.meetUrl,
			calendarUrl
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : "No pudimos crear la reunión." }, 502);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/saas/google/meet@_@ts
var page = () => meet_exports;
//#endregion
export { page };
