import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Polls,
  PollVotes,
  pollsEndpoint,
  createPollEndpoint,
  votePollEndpoint,
} from "../src/polls.ts";
import { validPollInput } from "../src/poll-policy.ts";
const admin = { id: "a", role: "owner", workspace: "w" },
  member = { id: "b", role: "member", workspace: "w" },
  body = {
    question: "¿Qué elegimos?",
    options: ["Uno", "Dos"],
    recipients: ["b"],
  };
test("poll input rejects blank/duplicate choices and missing recipients", () => {
  assert.equal(validPollInput(body), true);
  for (const v of [
    { ...body, options: ["Uno", " uno "] },
    { ...body, recipients: [] },
    { ...body, question: " " },
    { ...body, all: "false" },
    { ...body, options: ["Uno"] },
    { ...body, options: ["Uno", "x".repeat(101)] },
  ])
    assert.equal(validPollInput(v), false);
  assert.equal(validPollInput({ ...body, all: true, recipients: [] }), true);
});
test("only admins create polls and generic collection access cannot bypass endpoints", async () => {
  assert.equal(
    (await createPollEndpoint.handler({ user: member })).status,
    403,
  );
  for (const c of [Polls, PollVotes])
    for (const action of ["create", "read", "update", "delete"])
      assert.equal(c.access[action]({ req: { user: admin } }), false);
});
test("creation validates team recipients, ignores supplied counts and notifies only invited members", async () => {
  const created = [];
  const payload = {
    find: async () => ({ docs: [member], totalDocs: 1 }),
    create: async (args) => (created.push(args), { id: "p", ...args.data }),
  };
  const r = await createPollEndpoint.handler({
    user: admin,
    json: async () => ({ ...body, counts: [999] }),
    payload,
  });
  assert.equal(r.status, 200);
  assert.deepEqual(created[0].data.recipients, ["b"]);
  assert.equal("counts" in created[0].data, false);
  assert.equal(created[1].data.recipient, "b");
  assert.equal(created[1].data.kind, "poll");
  assert.equal(created[1].data.pollId, "p");
  const foreign = await createPollEndpoint.handler({
    user: admin,
    json: async () => ({ ...body, recipients: ["foreign"] }),
    payload,
  });
  assert.equal(foreign.status, 400);
  assert.equal(created.length, 2);
});
test("non-invitees and foreign workspace polls cannot be voted on", async () => {
  for (const docs of [
    [],
    [{ id: "p", options: ["A", "B"], recipients: ["someone-else"] }],
  ]) {
    let written = false;
    const response = await votePollEndpoint.handler({
      user: member,
      json: async () => ({ pollId: "p", option: 0 }),
      payload: {
        find: async (args) => {
          assert.ok(JSON.stringify(args.where).includes('"w"'));
          return { docs };
        },
        create: async () => (written = true),
      },
    });
    assert.equal(response.status, 403);
    assert.equal(written, false);
  }
});
test("vote is tied to authenticated user; invalid options and duplicate ballots are rejected", async () => {
  let stored;
  const payload = {
    find: async () => ({
      docs: [{ id: "p", recipients: ["b"], options: ["A", "B"] }],
    }),
    create: async (args) => {
      if (stored) throw Error("unique");
      stored = args.data;
    },
  };
  const req = {
    user: member,
    json: async () => ({ pollId: "p", option: 1, userId: "a" }),
    payload,
  };
  assert.equal((await votePollEndpoint.handler(req)).status, 200);
  assert.equal(stored.userId, "b");
  assert.equal(stored.key, "p:b");
  assert.equal((await votePollEndpoint.handler(req)).status, 409);
  assert.equal(
    (
      await votePollEndpoint.handler({
        ...req,
        json: async () => ({ pollId: "p", option: 2 }),
      })
    ).status,
    400,
  );
});
test("results are invitation-scoped and never expose individual ballots", async () => {
  const r = await pollsEndpoint.handler({
    user: member,
    payload: {
      find: async ({ collection }) => ({
        docs:
          collection === "polls"
            ? [
                {
                  id: "p",
                  question: "Q",
                  options: ["A", "B"],
                  recipients: ["b"],
                  createdAt: "2026-11-06",
                },
                { id: "other", recipients: ["a"] },
              ]
            : [
                { userId: "b", option: 1 },
                { userId: "c", option: 0 },
              ],
      }),
    },
  });
  const { docs } = await r.json();
  assert.equal(docs.length, 1);
  assert.deepEqual(docs[0].counts, [1, 1]);
  assert.equal(docs[0].myVote, 1);
  assert.equal("votes" in docs[0], false);
});

test("demo snapshots reject forged votes and repeated voters", async () => {
  const { validDemoPolls } = await import("../src/poll-policy.ts");
  const p = {
    id: "p",
    authorId: "a",
    ...body,
    createdAt: "2026-11-06T12:00:00Z",
    votes: [{ userId: "b", option: 0 }],
  };
  assert.equal(validDemoPolls([p]), true);
  assert.equal(
    validDemoPolls([{ ...p, votes: [{ userId: "foreign", option: 0 }] }]),
    false,
  );
  assert.equal(
    validDemoPolls([
      {
        ...p,
        votes: [
          { userId: "b", option: 0 },
          { userId: "b", option: 1 },
        ],
      },
    ]),
    false,
  );
  assert.equal(
    validDemoPolls([{ ...p, votes: [{ userId: "b", option: 9 }] }]),
    false,
  );
});
