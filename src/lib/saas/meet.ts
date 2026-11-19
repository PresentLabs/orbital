export interface MeetingInput {
  immediate?: boolean;
  requestId: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  members: string[];
}
export function validMeeting(value: any): value is MeetingInput {
  if (
    !value ||
    (value.immediate !== undefined && typeof value.immediate !== "boolean") ||
    typeof value.requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.requestId) ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 120 ||
    typeof value.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    typeof value.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ||
    ![15, 30, 45, 60, 90, 120].includes(value.duration) ||
    !Array.isArray(value.members) ||
    value.members.length > 50 ||
    value.members.some(
      (id: unknown) =>
        typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id),
    )
  )
    return false;
  const date = new Date(value.date + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value.date
  );
}
export function meetingBody(
  input: MeetingInput,
  attendees: { email: string; name: string }[],
  timezone: string,
  id: string,
  owner: string,
  workspace: string,
) {
  const end = new Date(input.date + "T" + input.time + ":00Z");
  end.setUTCMinutes(end.getUTCMinutes() + input.duration);
  return {
    id,
    summary: input.title.trim(),
    description: "Reunión organizada desde Órbita.",
    start: {
      dateTime: input.date + "T" + input.time + ":00",
      timeZone: timezone,
    },
    end: { dateTime: end.toISOString().slice(0, 19), timeZone: timezone },
    attendees: attendees.map((m) => ({ email: m.email, displayName: m.name })),
    conferenceData: {
      createRequest: {
        requestId: id,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    guestsCanInviteOthers: false,
    visibility: "private",
    extendedProperties: {
      private: { orbitaOwner: owner, orbitaWorkspace: workspace },
    },
  };
}
export function safeMeetUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" &&
      url.hostname === "meet.google.com" &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export async function createGoogleMeeting(
  token: string,
  body: ReturnType<typeof meetingBody>,
  fetcher: typeof fetch = fetch,
) {
  const base =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  let response = await fetcher(
    base + "?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 409)
    response = await fetcher(base + "/" + body.id, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(12000),
    });
  if (!response.ok)
    throw Error(
      "Google no pudo crear la reunión. Revisa los permisos de Calendar y Meet de la cuenta conectada.",
    );
  let event = await response.json();
  if (
    event.extendedProperties?.private?.orbitaOwner !==
      body.extendedProperties.private.orbitaOwner ||
    event.extendedProperties?.private?.orbitaWorkspace !==
      body.extendedProperties.private.orbitaWorkspace
  )
    throw Error("No pudimos verificar la reunión.");
  for (
    let i = 0;
    i < 2 &&
    event.conferenceData?.createRequest?.status?.statusCode === "pending";
    i++
  ) {
    const retry = await fetcher(base + "/" + body.id, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(12000),
    });
    if (!retry.ok) break;
    event = await retry.json();
  }
  const url =
    safeMeetUrl(event.hangoutLink) ||
    safeMeetUrl(
      event.conferenceData?.entryPoints?.find(
        (p: any) => p.entryPointType === "video",
      )?.uri,
    );
  if (event.conferenceData?.createRequest?.status?.statusCode === "failure")
    throw Error(
      "El evento fue creado, pero esta cuenta de Google no pudo generar Meet. Revisa sus permisos antes de volver a intentarlo.",
    );
  return { event, meetUrl: url };
}
