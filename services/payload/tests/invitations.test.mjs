import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inviteMemberEndpoint,
  acceptInvitationEndpoint,
} from "../src/invitations.ts";
test("only administrators can invite members", async () => {
  const response = await inviteMemberEndpoint.handler({
    user: { id: "viewer", role: "viewer", workspace: "a" },
  });
  assert.equal(response.status, 403);
});
test("an invitation creates an unknown random password and expiring native token without sending fake email", async () => {
  const original = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  let created, forgot;
  try {
    const response = await inviteMemberEndpoint.handler({
      user: { id: "owner", role: "owner", workspace: "a" },
      json: async () => ({
        name: "Nueva persona",
        email: "person@orbita.invalid",
        role: "member",
        permissions: ["tasks"],
      }),
      payload: {
        create: async (args) => (
          (created = args),
          { id: "unit-invite", ...args.data }
        ),
        forgotPassword: async (args) => ((forgot = args), "a".repeat(40)),
      },
    });
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.ok(created.data.password.length >= 48);
    assert.equal(created.data.workspace, "a");
    assert.equal(forgot.disableEmail, true);
    assert.equal(forgot.expiration, 3600000);
    assert.equal(data.invite.emailSent, false);
    assert.ok(data.invite.url.endsWith("#token=" + "a".repeat(40)));
    assert.equal("password" in data.doc, false);
  } finally {
    if (original !== undefined) process.env.RESEND_API_KEY = original;
  }
});
test("invalid, disabled or already used invitation tokens cannot change passwords", async () => {
  let calls = 0;
  const response = await acceptInvitationEndpoint.handler({
    json: async () => ({
      token: "a".repeat(40),
      password: "a-test-password-123",
    }),
    payload: {
      db: { findOne: async () => ({ id: "u", disabled: true }) },
      resetPassword: async () => calls++,
    },
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  const invalid = await acceptInvitationEndpoint.handler({
    json: async () => ({ token: "invalid", password: "a-test-password-123" }),
  });
  assert.equal(invalid.status, 400);
});
