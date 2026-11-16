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
  const token = await login(c),
    baseHeaders = { Origin: base, Cookie: "orbita_session=" + token };
  const response = await fetch(base + "/api/saas/team", {
    method: "POST",
    headers: { ...baseHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "QA invitación",
      email: `qa-invited-${randomUUID()}@orbita.invalid`,
      role: "member",
      permissions: ["tasks", "files"],
    }),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  otherId = result.doc.id;
  assert.equal(result.invite.emailSent, false);
  const inviteToken = new URL(result.invite.url).hash.slice("#token=".length),
    password = randomBytes(24).toString("base64url");
  const accept = (value, pass = password) =>
    fetch(base + "/api/saas/accept-invitation", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ token: value, password: pass }),
    });
  assert.equal((await accept(inviteToken, "short")).status, 400);
  assert.equal((await accept(inviteToken)).status, 200);
  assert.equal((await accept(inviteToken)).status, 400);
  const signed = await fetch(backend + "/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: result.doc.email, password }),
  });
  assert.equal(signed.status, 200);
  const expired = await local.forgotPassword({
    collection: "users",
    data: { email: result.doc.email },
    disableEmail: true,
    overrideAccess: true,
  });
  await local.db.updateOne({
    collection: "users",
    id: otherId,
    data: {
      resetPasswordExpiration: new Date(Date.now() - 1000).toISOString(),
    },
  });
  assert.equal((await accept(expired)).status, 400);
  const disabled = await local.forgotPassword({
    collection: "users",
    data: { email: result.doc.email },
    disableEmail: true,
    overrideAccess: true,
  });
  await local.update({
    collection: "users",
    id: otherId,
    data: { disabled: true },
    overrideAccess: true,
  });
  assert.equal((await accept(disabled)).status, 400);
  const { default: sharp } = await import("sharp"),
    image = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 4,
        background: "#6e00fe80",
      },
    })
      .png()
      .toBuffer(),
    form = new FormData();
  form.set("title", "QA imagen optimizada");
  form.set("file", new File([image], "qa-grande.png", { type: "image/png" }));
  const upload = await fetch(base + "/api/saas/workspace-files", {
    method: "POST",
    headers: baseHeaders,
    body: form,
  });
  assert.equal(upload.status, 201);
  const rows = await (
      await fetch(base + "/api/saas/workspace-files", { headers: baseHeaders })
    ).json(),
    file = rows.docs.find((f) => f.title === "QA imagen optimizada");
  assert.ok(file);
  assert.equal(file.mime, "image/webp");
  const downloaded = await fetch(
    base + "/api/saas/workspace-files?id=" + file.id,
    { headers: baseHeaders },
  );
  const meta = await sharp(
    Buffer.from(await downloaded.arrayBuffer()),
  ).metadata();
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 800);
  assert.equal(meta.hasAlpha, true);
  const anonymous = await fetch(backend + "/api/invite-member", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(anonymous.status, 403);
  console.log(
    "Passed: native invitation acceptance, own password login, token reuse/expiry/disabled rejection, anonymous invitation rejection, real lossless WebP upload at 1600×800 with alpha.",
  );
} finally {
  if (workspace)
    await local.delete({
      collection: "workspace-files",
      where: { workspace: { equals: workspace } },
      overrideAccess: true,
    });
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
