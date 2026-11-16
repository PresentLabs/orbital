import type { CollectionConfig, Endpoint } from "payload";
import { canView, isAdmin } from "./permissions.ts";
import { validPollInput, pollResults } from "./poll-policy.ts";
const tenant = (u: any) =>
  String(
    typeof u?.workspace === "object" ? u.workspace.id : u?.workspace || "",
  );
const closed = {
  create: () => false,
  read: () => false,
  update: () => false,
  delete: () => false,
};
// All reads/writes go through the endpoint: callers never receive other people's ballots.
export const Polls: CollectionConfig = {
  slug: "polls",
  access: closed,
  fields: [
    {
      name: "workspace",
      type: "relationship",
      relationTo: "workspaces",
      required: true,
      index: true,
    },
    { name: "authorId", type: "text", required: true },
    { name: "question", type: "text", required: true, maxLength: 180 },
    { name: "options", type: "json", required: true },
    { name: "recipients", type: "json", required: true },
  ],
};
export const PollVotes: CollectionConfig = {
  slug: "poll-votes",
  access: closed,
  fields: [
    { name: "key", type: "text", unique: true, required: true },
    { name: "pollId", type: "text", required: true, index: true },
    { name: "userId", type: "text", required: true },
    { name: "option", type: "number", required: true },
  ],
};
export const pollsEndpoint: Endpoint = {
  path: "/team-polls",
  method: "get",
  handler: async (req) => {
    if (!canView(req.user, "profile") || !tenant(req.user))
      return Response.json({ error: "Inicia sesión." }, { status: 403 });
    const p = req.payload as any,
      userId = String(req.user!.id);
    const result = await p.find({
      collection: "polls",
      where: { workspace: { equals: tenant(req.user) } },
      limit: 1000,
      sort: "-createdAt",
      depth: 0,
      req,
    });
    const docs = [];
    for (const poll of result.docs) {
      if (!isAdmin(req.user) && !poll.recipients.includes(userId)) continue;
      const votes = await p.find({
        collection: "poll-votes",
        where: { pollId: { equals: String(poll.id) } },
        limit: 1000,
        depth: 0,
        req,
      });
      docs.push({
        ...pollResults(poll, votes.docs, userId),
        canVote: poll.recipients.includes(userId),
      });
    }
    return Response.json({ docs });
  },
};
export const createPollEndpoint: Endpoint = {
  path: "/team-polls",
  method: "post",
  handler: async (req) => {
    if (!isAdmin(req.user) || !tenant(req.user))
      return Response.json(
        { error: "Solo los administradores pueden crear votaciones." },
        { status: 403 },
      );
    const body = await req.json?.();
    if (!validPollInput(body))
      return Response.json(
        {
          error:
            "Escribe una pregunta, entre 2 y 6 opciones distintas y elige participantes.",
        },
        { status: 400 },
      );
    const p = req.payload as any;
    const people = await p.find({
      collection: "users",
      where: {
        and: [
          { workspace: { equals: tenant(req.user) } },
          { disabled: { not_equals: true } },
          { deletedAt: { exists: false } },
        ],
      },
      depth: 0,
      limit: 1000,
      req,
    });
    const available = people.docs.filter((m: any) => canView(m, "profile"));
    const recipients = body.all
      ? available.map((m: any) => String(m.id))
      : [...new Set(body.recipients.map(String))];
    if (
      !recipients.length ||
      recipients.some(
        (id: string) => !available.some((m: any) => String(m.id) === id),
      )
    )
      return Response.json(
        { error: "Elige personas activas de tu equipo." },
        { status: 400 },
      );
    const poll = await p.create({
      collection: "polls",
      data: {
        workspace: tenant(req.user),
        authorId: String(req.user!.id),
        question: body.question.trim(),
        options: body.options.map((s: string) => s.trim()),
        recipients,
      },
      req,
    });
    for (const recipient of recipients)
      await p.create({
        collection: "notifications",
        data: {
          workspace: tenant(req.user),
          recipient,
          key: `poll:${poll.id}:${recipient}`,
          kind: "poll",
          pollId: String(poll.id),
          authorName: req.user!.name,
          text: `Nueva votación: ${poll.question}`,
        },
        req,
      });
    return Response.json({ ok: true });
  },
};
export const votePollEndpoint: Endpoint = {
  path: "/team-poll-vote",
  method: "post",
  handler: async (req) => {
    if (!canView(req.user, "profile") || !tenant(req.user))
      return Response.json({ error: "Inicia sesión." }, { status: 403 });
    const body = await req.json?.(),
      p = req.payload as any,
      userId = String(req.user!.id);
    if (
      !body ||
      !/^[-\w]{1,100}$/.test(String(body.pollId)) ||
      !Number.isInteger(body.option)
    )
      return Response.json({ error: "Voto no válido." }, { status: 400 });
    const found = await p.find({
      collection: "polls",
      where: {
        and: [
          { id: { equals: body.pollId } },
          { workspace: { equals: tenant(req.user) } },
        ],
      },
      depth: 0,
      limit: 1,
      req,
    });
    const poll = found.docs[0];
    if (!poll || !poll.recipients.includes(userId))
      return Response.json(
        { error: "No estás invitado a esta votación." },
        { status: 403 },
      );
    if (body.option < 0 || body.option >= poll.options.length)
      return Response.json({ error: "Opción no válida." }, { status: 400 });
    try {
      await p.create({
        collection: "poll-votes",
        data: {
          key: `${poll.id}:${userId}`,
          pollId: String(poll.id),
          userId,
          option: body.option,
        },
        req,
      });
    } catch {
      return Response.json(
        { error: "Ya registraste tu voto. Actualiza para ver los resultados." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true });
  },
};
