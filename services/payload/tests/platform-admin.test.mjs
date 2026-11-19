import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../src/payload.config.ts";
import { platformAdminEndpoints, isPlatformAdmin } from "../src/platform-admin.ts";
const cfg = await config;
const get = platformAdminEndpoints.find((item) => item.method === "get").handler;
const post = platformAdminEndpoints.find((item) => item.method === "post").handler;

test("global management requires server-assigned IDs and guards tenant owners and transactions", async (t) => {
  const original = process.env.SAAS_ADMIN_USER_IDS;
  process.env.SAAS_ADMIN_USER_IDS = "99";
  t.after(() => {
    if (original === undefined) delete process.env.SAAS_ADMIN_USER_IDS;
    else process.env.SAAS_ADMIN_USER_IDS = original;
  });
  const operator = { id: 99, workspace: 9, role: "member" };
  assert.equal(isPlatformAdmin(operator), true);
  assert.equal(isPlatformAdmin({ id: 1, role: "owner" }), false);
  assert.equal(isPlatformAdmin({ ...operator, disabled: true }), false);
  for (const user of [undefined, { id: 1, role: "owner" }, { id: 2, role: "admin" }, { ...operator, disabled: true }]) {
    const req = { user, payload: { find: () => { throw Error("must not read"); } } };
    assert.equal((await get(req)).status, 403);
    assert.equal((await post(req)).status, 403);
  }
  let users, workspace, snapshot, committed, rolledBack, locked;
  const reset = () => {
    users = [
      { id: 1, workspace: 7, role: "owner", name: "Dueña", email: "owner@test.cl" },
      { id: 2, workspace: 7, role: "member", name: "Nuevo", email: "new@test.cl" },
      { id: 3, workspace: 8, role: "member", name: "Ajeno", email: "other@test.cl" },
    ];
    workspace = { id: 7, plan: "starter", nextPaymentAt: null };
    committed = rolledBack = locked = false;
  };
  reset();
  const payload = {
    db: {
      sessions: { tx: { db: { execute: async () => { locked = true; } } } },
      beginTransaction: async () => { snapshot = structuredClone({ users, workspace }); return "tx"; },
      commitTransaction: async () => { committed = true; },
      rollbackTransaction: async () => { users = snapshot.users; workspace = snapshot.workspace; rolledBack = true; },
    },
    findByID: async ({ collection, id }) => {
      if (collection === "workspaces") return workspace;
      return users.find((user) => user.id === id);
    },
    find: async ({ collection }) => ({ docs: collection === "users" ? users.filter((u) => u.workspace === 7 && u.role === "owner") : [workspace] }),
    update: async ({ collection, id, data, context }) => {
      assert.equal(context.platformManagement, true);
      assert.equal(locked, true);
      const row = collection === "users" ? users.find((user) => user.id === id) : workspace;
      Object.assign(row, data);
      return row;
    },
  };
  const mutate = async (body, headers = { authorization: "JWT fixture" }) => {
    const req = { user: operator, payload, headers: new Headers(headers), json: async () => body };
    const response = await post(req);
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await mutate({ workspace: 7, action: "transfer-owner", user: 2, previousOwner: 1 }, {})).status, 403);
  assert.equal((await mutate({ workspace: 7, action: "transfer-owner", user: 3, previousOwner: 1 })).status, 403);
  assert.equal(rolledBack, true);
  assert.equal((await mutate({ workspace: 7, action: "delete-user", user: 1 })).status, 400);
  assert.equal((await mutate({ workspace: 7, action: "transfer-owner", user: 2, previousOwner: 1 })).status, 200);
  assert.equal(committed, true);
  assert.equal(users.find((u) => u.id === 1).role, "admin");
  assert.equal(users.find((u) => u.id === 2).role, "owner");
  assert.equal((await mutate({ workspace: 7, action: "transfer-owner", user: 1, previousOwner: 1 })).status, 409);
  assert.equal(users.find((u) => u.id === 2).role, "owner");
  assert.equal((await mutate({ workspace: 7, action: "subscription", plan: "pro", billingStatus: "active", nextPaymentAt: "2027-02-30" })).status, 400);
  assert.equal((await mutate({ workspace: 7, action: "subscription", plan: "pro", billingStatus: "active", nextPaymentAt: "2027-02-28" })).status, 200);
  assert.equal(workspace.nextPaymentAt, "2027-02-28T12:00:00.000Z");
  assert.equal((await mutate({ workspace: 7, action: "delete-user", user: 1 })).status, 200);
  assert.equal(users.find((u) => u.id === 1).disabled, true);
  assert.equal((await mutate({ workspace: 7, action: "restore-user", user: 1 })).status, 200);
  assert.equal(users.find((u) => u.id === 1).disabled, false);
  // A failure halfway through transfer must restore the previous owner's role.
  reset();
  const update = payload.update;
  payload.update = async (args) => {
    if (args.data.role === "owner") throw Error("database unavailable");
    return update(args);
  };
  assert.equal((await mutate({ workspace: 7, action: "transfer-owner", user: 2, previousOwner: 1 })).status, 400);
  assert.equal(users.find((u) => u.id === 1).role, "owner");
  assert.equal(users.find((u) => u.id === 2).role, "member");
  // Tenant administrators cannot bypass ownership rules by supplying context.
  const hook = cfg.collections.find((item) => item.slug === "users").hooks.beforeValidate[0];
  assert.throws(() => hook({
    req: { user: { id: 1, workspace: 7, role: "owner" }, context: {} },
    operation: "update", originalDoc: { id: 99, role: "member" }, data: { email: "takeover@test.cl" },
  }));
  assert.throws(() => hook({
    req: { user: { id: 1, workspace: 7, role: "owner" }, context: { platformManagement: true } },
    operation: "update", originalDoc: { id: 2, role: "member" }, data: { role: "owner" },
  }));
});

test("business directory exposes authorized tenant counts and subscription activity", async (t) => {
  const previous = process.env.SAAS_ADMIN_USER_IDS;
  process.env.SAAS_ADMIN_USER_IDS = "99";
  t.after(() => previous === undefined ? delete process.env.SAAS_ADMIN_USER_IDS : process.env.SAAS_ADMIN_USER_IDS = previous);
  const seen = [];
  const response = await get({user:{id:99},url:"http://local/platform-admin?workspace=none",payload:{
    find:async () => ({docs:[{id:7,name:"Uno",plan:"pro",billingStatus:"active",nextPaymentAt:"2026-12-01T12:00:00Z"},{id:8,name:"Dos",plan:"starter",billingStatus:"canceled"}],totalDocs:2,page:1,totalPages:1}),
    count:async options => {assert.equal(options.overrideAccess,true);assert.equal(options.collection,"users");assert.deepEqual(options.where.and[1],{deletedAt:{exists:false}});const id=options.where.and[0].workspace.equals;seen.push(id);return {totalDocs:id===7?3:1};},
  }});
  assert.equal(response.status,200);
  const data=await response.json();assert.deepEqual(seen.sort(),[7,8]);assert.equal(data.workspaces.docs[0].nextPaymentAt,"2026-12-01T12:00:00Z");assert.equal(data.workspaces.docs[1].nextPaymentAt,null);
  assert.deepEqual(data.workspaces.docs.map(({userCount,active,billingStatus})=>({userCount,active,billingStatus})),[{userCount:3,active:true,billingStatus:"active"},{userCount:1,active:false,billingStatus:"canceled"}]);
});
