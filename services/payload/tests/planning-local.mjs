// Opt-in local test with an isolated workspace, owner and second administrator.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { getPayload } from "payload";
process.loadEnvFile(".env");
const { default: config } = await import("../src/payload.config.ts");
const local = await getPayload({ config }),
  base = "http://127.0.0.1:4345",
  backend = "http://127.0.0.1:3001";
let ownerId, otherId, workspace;
const credentials = () => ({
  email: `qa-planning-${randomUUID()}@orbita.invalid`,
  password: randomBytes(24).toString("base64url"),
});
async function login(c) {
  const r = await fetch(backend + "/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
  assert.equal(r.status, 200);
  return (await r.json()).token;
}
const request = (token, method = "GET", body) =>
  fetch(base + "/api/saas/documents", {
    method,
    headers: {
      Origin: base,
      Cookie: "orbita_session=" + token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
try {
  const c = credentials(),
    r = await fetch(backend + "/api/register-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...c,
        code: process.env.REGISTRATION_CODE,
        name: "QA planificación",
        business: "QA planificación privada",
      }),
    });
  assert.equal(r.status, 201);
  ownerId = (await r.json()).id;
  const owner = await local.findByID({
    collection: "users",
    id: ownerId,
    depth: 0,
    overrideAccess: true,
  });
  workspace = owner.workspace;
  const otherCredentials = credentials();
  otherId = (
    await local.create({
      collection: "users",
      data: {
        ...otherCredentials,
        name: "QA otro administrador",
        role: "admin",
        workspace,
      },
      overrideAccess: true,
    })
  ).id;
  const token = await login(c),
    other = await login(otherCredentials);
  const focus = {
    id: String(ownerId),
    privateOwner: String(ownerId),
    selections: [],
    overviewMode: "vision",
    daily:{date:"2026-11-05",done:"QA",plan:"QA",blockers:"QA"},
    taskDirectoryMode: "scrum",
    visionBoard: {
      images: [
        {
          id: "qa-image",
          image: "data:image/webp;base64,UklGRg==",
          x: 250,
          y: 160,
          width: 230,
          rotation:15,watercolor:true,
        },
      ],
    },
  };
  assert.ok(
    (await request(token, "PUT", { key: "focus:" + ownerId, value: focus })).ok,
  );
  const own = (await (await request(token)).json()).docs.find(
    (d) => d.key === "focus:" + ownerId,
  );
  assert.ok(own);
  assert.equal(own.value.visionBoard.images[0].x, 250);
  assert.equal(own.value.visionBoard.images[0].rotation,15);
  assert.equal(own.value.visionBoard.images[0].watercolor,true);
  assert.equal(own.value.daily.plan, "QA");
  assert.equal((await request(token,"PUT",{key:"focus:"+ownerId,value:{...focus,daily:{...focus.daily,date:"2026-11-31"}}})).ok,false);
  assert.equal(
    (await (await request(other)).json()).docs.some(
      (d) => d.key === "focus:" + ownerId,
    ),
    false,
  );
  assert.equal(
    (await request(other, "PUT", { key: "focus:" + ownerId, value: focus })).ok,
    false,
  );
  assert.equal(
    (
      await request(token, "PUT", {
        key: "focus:" + ownerId,
        value: {
          ...focus,
          visionBoard: {
            images: [
              {
                ...focus.visionBoard.images[0],
                image: "https://foreign.test/image.svg",
              },
            ],
          },
        },
      })
    ).ok,
    false,
  );
  const sprint = {
    id: "qa-sprint",
    name: "Sprint QA",
    start: "2026-11-05",
    end: "2026-11-19",
    initial: 3,
    initialScope: 3,
    history: [{ date: "2026-11-05", remaining: 3, scope: 3 }],
  };
  assert.ok(
    (
      await request(token, "PUT", {
        key: "boards:qa-board",
        value: {
          id: "qa-board",
          name: "QA",
          description: "",
          color: "green",
          sprints: [sprint],
        },
      })
    ).ok,
  );
  assert.equal(
    (await (await request(other)).json()).docs.find(
      (d) => d.key === "boards:qa-board",
    ).value.sprints[0].initial,
    3,
  );
  console.log(
    "Passed: private vision persistence, administrator isolation, forbidden writes, invalid image rejection, shared sprint persistence.",
  );
} finally {
  if (workspace)
    await local.delete({
      collection: "documents",
      where: { workspace: { equals: workspace } },
      overrideAccess: true,
    });
  for (const id of [otherId, ownerId])
    if (id)
      await local.delete({ collection: "users", id, overrideAccess: true });
  if (workspace)
    await local.delete({
      collection: "workspaces",
      id: workspace,
      overrideAccess: true,
    });
  await local.db.destroy();
}
process.exit(0);
