import {eventRange,eventDates,validEventDates} from "@/lib/saas/date-ranges";
import { canWrite } from "@/lib/saas/permissions";
import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { googleToken } from "@/lib/saas/integrations";
export const POST: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión" }, 401);
  if (!canWrite(user, "calendar"))
    return json({ error: "No tienes acceso al calendario." }, 403);
  try {
    const { id } = await ctx.request.json();
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      return json({ error: "Evento inválido" }, 400);
    const docs = await payload(
      ctx,
      "documents?limit=1&where[key][equals]=" +
        encodeURIComponent("events:" + id),
    );
    const event = docs.docs[0]?.value;
    if (!event)
      return json({ error: "Guarda el evento antes de sincronizarlo" }, 404);
    const token = await googleToken(ctx);
    const settings = await payload(
      ctx,
      "documents?limit=1&where[key][equals]=settings",
    );
    const timezone = settings.docs[0]?.value?.timezone || "America/Santiago";
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(docs.docs[0].workspace + ":" + id),
    );
    const googleId = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if(!validEventDates(event))return json({error:"Fechas del evento no válidas"},400);
    const {endDate,endTime}=eventDates(eventRange(event).start,eventRange(event).end);
    const body = JSON.stringify({
      id: googleId,
      summary: event.title,
      description: event.description,
      start: event.allDay ? { date: event.date } : { dateTime: `${event.date}T${event.time}:00`, timeZone: timezone },
      end: event.allDay ? { date: endDate } : { dateTime: `${endDate}T${endTime}:00`, timeZone: timezone },
    });
    const base =
      "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    let response = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 409)
      response = await fetch(base + "/" + googleId, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(12000),
      });
    if (!response.ok) throw Error();
    return json({ ok: true });
  } catch {
    return json(
      { error: "No se pudo enviar el evento. Revisa la conexión de Google." },
      502,
    );
  }
};
