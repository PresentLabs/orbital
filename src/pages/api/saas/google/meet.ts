import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { canWrite } from "@/lib/saas/permissions";
import { googleToken } from "@/lib/saas/integrations";
import {
  validMeeting,
  meetingBody,
  createGoogleMeeting,
  safeMeetUrl,
} from "@/lib/saas/meet";
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canWrite(user, "calendar"))
    return json({ error: "No puedes organizar reuniones." }, 403);
  try {
    const eventId = ctx.url.searchParams.get("eventId");
    if (eventId) {
      if (!/^[a-f0-9]{64}$/.test(eventId))
        return json({ error: "Reunión no válida." }, 400);
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
          eventId,
        {
          headers: { Authorization: "Bearer " + (await googleToken(ctx)) },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok)
        return json({ error: "No pudimos consultar la reunión." }, 502);
      const event = await response.json(),
        workspace = String(
          typeof user.workspace === "object"
            ? user.workspace.id
            : user.workspace,
        );
      if (
        event.extendedProperties?.private?.orbitaOwner !== String(user.id) ||
        event.extendedProperties?.private?.orbitaWorkspace !== workspace
      )
        return json({ error: "No puedes consultar esta reunión." }, 403);
      const meetUrl =
        safeMeetUrl(event.hangoutLink) ||
        safeMeetUrl(
          event.conferenceData?.entryPoints?.find(
            (p: any) => p.entryPointType === "video",
          )?.uri,
        );
      if (meetUrl) {
        const row = (
          await payload(
            ctx,
            "documents?limit=1&where[key][equals]=" +
              encodeURIComponent("events:meet-" + eventId.slice(0, 32)),
          )
        ).docs[0];
        if (row)
          await payload(ctx, "documents/" + row.id, {
            method: "PATCH",
            body: JSON.stringify({
              key: row.key,
              value: { ...row.value, meetUrl },
            }),
          });
      }
      return json({ meetUrl, googleEventId: eventId });
    }
    const [directory, connections] = await Promise.all([
      payload(ctx, "meeting-directory"),
      payload(
        ctx,
        "integrations?limit=1&depth=0&where[provider][equals]=google",
      ),
    ]);
    return json({ members: directory.docs, connected: !!connections.docs[0] });
  } catch {
    return json(
      { error: "No pudimos consultar el equipo y la conexión de Google." },
      503,
    );
  }
};
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Solicitud no válida." }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  if (!canWrite(user, "calendar"))
    return json({ error: "No puedes organizar reuniones." }, 403);
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
        hourCycle: "h23",
      }).formatToParts(new Date());
      const part = (type: string) => parts.find((p) => p.type === type)!.value;
      input.date = `${part("year")}-${part("month")}-${part("day")}`;
      input.time = `${part("hour")}:${part("minute")}`;
    }
    if (!validMeeting(input))
      return json(
        { error: "Revisa el título, fecha, hora, duración e invitados." },
        400,
      );
    const ids = [...new Set(input.members)],
      directory = await payload(ctx, "meeting-directory");
    const invited = directory.docs.filter((m: any) =>
      ids.includes(String(m.id)),
    );
    if (invited.length !== ids.length)
      return json(
        { error: "Solo puedes invitar a personas activas de tu organización." },
        400,
      );
    const branding = await payload(ctx, "branding"),
      timezone = branding.timezone || "America/Santiago",
      workspace = String(
        typeof user.workspace === "object" ? user.workspace.id : user.workspace,
      );
    const fingerprint = JSON.stringify([
      workspace,
      String(user.id),
      input.requestId,
      input.title,
      input.immediate ? "now" : input.date,
      input.immediate ? "now" : input.time,
      input.duration,
      [...ids].sort(),
    ]);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(fingerprint),
    );
    const id = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const result = await createGoogleMeeting(
      await googleToken(ctx),
      meetingBody(input, invited, timezone, id, String(user.id), workspace),
    );
    const event = {
      id: "meet-" + id.slice(0, 32),
      title: input.title.trim(),
      date: /^\d{4}-\d{2}-\d{2}T/.test(result.event.start?.dateTime || "")
        ? result.event.start.dateTime.slice(0, 10)
        : input.date,
      time: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(
        result.event.start?.dateTime || "",
      )
        ? result.event.start.dateTime.slice(11, 16)
        : input.time,
      description:
        "Google Meet" + (result.meetUrl ? " · " + result.meetUrl : ""),
      meetUrl: result.meetUrl || undefined,
      googleEventId: id,
    };
    const key = "events:" + event.id,
      existing = await payload(
        ctx,
        "documents?limit=1&where[key][equals]=" + encodeURIComponent(key),
      );
    await payload(
      ctx,
      "documents" + (existing.docs[0] ? "/" + existing.docs[0].id : ""),
      {
        method: existing.docs[0] ? "PATCH" : "POST",
        body: JSON.stringify({ key, value: event }),
      },
    );
    const calendarUrl =
      typeof result.event.htmlLink === "string" &&
      result.event.htmlLink.startsWith("https://www.google.com/calendar/")
        ? result.event.htmlLink
        : "https://calendar.google.com";
    return json({ event, meetUrl: result.meetUrl, calendarUrl });
  } catch (e) {
    return json(
      {
        error: e instanceof Error ? e.message : "No pudimos crear la reunión.",
      },
      502,
    );
  }
};
