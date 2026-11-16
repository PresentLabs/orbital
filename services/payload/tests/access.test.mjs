import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../src/payload.config.ts";
import { canView, canWrite, isAdmin } from "../src/permissions.ts";
const cfg = await config;
const collection = (slug) => cfg.collections.find((c) => c.slug === slug);
const req = (workspace = "a", role = "member", permissions) => ({
  user: { id: "u1", workspace, role, ...(permissions ? { permissions } : {}) },
});
function matches(where, doc) {
  if (where === true) return true;
  if (!where) return false;
  if (where.and && !where.and.every((w) => matches(w, doc))) return false;
  if (where.or && !where.or.some((w) => matches(w, doc))) return false;
  return Object.entries(where)
    .filter(([k]) => k !== "and" && k !== "or")
    .every(([key, c]) =>
      c.exists !== undefined
        ? (doc[key] !== undefined && doc[key] !== null) === c.exists
        : c.equals !== undefined
          ? doc[key] === c.equals
          : c.not_equals !== undefined
            ? doc[key] !== c.not_equals
            : c.contains !== undefined
              ? String(doc[key]).includes(c.contains)
              : true,
    );
}
test("document permissions exclude other businesses and hidden sections even through direct REST", () => {
  const c = collection("documents");
  assert.equal(c.access.read({ req: {} }), false);
  for (const method of ["read", "update"]) {
    const scope = c.access[method]({ req: req("a", "member", ["tasks"]) });
    assert.equal(matches(scope, { workspace: "a", key: "tasks:t1" }), true);
    assert.equal(matches(scope, { workspace: "b", key: "tasks:t1" }), false);
    for (const key of ["pages:p1", "nodes:n1", "settings"])
      assert.equal(matches(scope, { workspace: "a", key }), false);
  }
  const removal = c.access.delete({ req: req("a", "member", ["tasks"]) });
  const discarded = { workspace: "a", key: "tasks:t1", deletedAt: "2026-11-16" };
  assert.equal(matches(removal, discarded), true);
  for (const override of [{ deletedAt: null }, { workspace: "b" }, { key: "pages:p1" }, { privateOwner: "u2" }])
    assert.equal(matches(removal, { ...discarded, ...override }), false);
  assert.equal(matches(c.access.delete({ req: req("a", "viewer", ["tasks"]) }), discarded), false);
  const viewerScope = c.access.update({ req: req("a", "viewer", ["tasks"]) });
  assert.equal(
    matches(viewerScope, { workspace: "a", key: "tasks:t1" }),
    false,
  );
  assert.equal(
    matches(viewerScope, {
      workspace: "a",
      key: "focus:u1",
      privateOwner: "u1",
    }),
    true,
  );
});
test("workspace and document key cannot be reassigned to access another section", async () => {
  const c = collection("documents");
  const data = await c.hooks.beforeValidate[0]({
    data: {
      workspace: "victim",
      key: "tasks:abc",
      workspaceKey: "victim:tasks:abc",
    },
    req: req("own"),
  });
  assert.equal(data.workspace, "own");
  assert.equal(data.workspaceKey, "own:tasks:abc");
  await assert.rejects(() =>
    c.hooks.beforeValidate[0]({
      data: { key: "pages:p1" },
      req: req("a", "member", ["tasks"]),
    }),
  );
  await assert.rejects(() =>
    c.hooks.beforeValidate[0]({
      data: { key: "tasks:abc" },
      req: req("a", "viewer", ["tasks"]),
    }),
  );
});
test("only administrators manage teammates; users cannot promote themselves or modify the owner", () => {
  const c = collection("users");
  for (const role of ["member", "viewer"])
    assert.equal(c.access.create({ req: req("a", role) }), false);
  for (const role of ["owner", "admin"])
    assert.equal(c.access.create({ req: req("a", role) }), true);
  const own = req("a", "admin");
  for (const field of ["role", "permissions", "disabled"]) {
    const access = c.fields.find((f) => f.name === field).access.update;
    assert.equal(access({ req: own, doc: { id: "u1", role: "admin" } }), false);
    assert.equal(
      access({ req: own, doc: { id: "owner", role: "owner" } }),
      false,
    );
    assert.equal(
      access({ req: own, doc: { id: "member", role: "member" } }),
      true,
    );
  }
  const data = c.hooks.beforeValidate[0]({
    data: { workspace: "victim", role: "owner" },
    req: req("a", "owner"),
    operation: "create",
  });
  assert.equal(data.workspace, "a");
  assert.equal(data.role, "member");
  const removal = c.access.delete({ req: own });
  const discarded = { id: "u2", workspace: "a", role: "member", disabled: true, deletedAt: "2026-11-16" };
  assert.equal(matches(removal, discarded), true);
  for (const override of [{ id: "u1" }, { role: "owner" }, { workspace: "b" }, { disabled: false }, { deletedAt: null }])
    assert.equal(matches(removal, { ...discarded, ...override }), false);
  assert.equal(c.access.delete({ req: req() }), false);
});
test("disabled people cannot sign in, access records, vault or administrator actions", () => {
  const user = { id: "u1", workspace: "a", role: "admin", disabled: true };
  assert.equal(isAdmin(user), false);
  assert.equal(canView(user, "tasks"), false);
  assert.equal(collection("documents").access.read({ req: { user } }), false);
  assert.equal(collection("vault").access.read({ req: { user } }), false);
  assert.throws(() => collection("users").hooks.beforeLogin[0]({ user }));
});
test("vault access is explicit and viewers cannot write or delete secrets", () => {
  const c = collection("vault");
  assert.equal(c.access.read({ req: req() }), false);
  assert.equal(
    c.access.read({ req: req("a", "member", ["vault"]) }).workspace.equals,
    "a",
  );
  assert.equal(c.access.create({ req: req("a", "viewer", ["vault"]) }), false);
  assert.equal(c.access.update({ req: req("a", "viewer", ["vault"]) }), false);
  assert.equal(c.access.delete({ req: req("a", "member", ["vault"]) }), false);
  const removal = c.access.delete({ req: req("a", "admin") });
  assert.equal(matches(removal, { workspace: "a", deletedAt: "2026-11-16" }), true);
  assert.equal(matches(removal, { workspace: "a" }), false);
  assert.equal(matches(removal, { workspace: "b", deletedAt: "2026-11-16" }), false);
});
test("notifications can only be read, updated or deleted by their recipient", () => {
  const c = collection("notifications");
  for (const action of ["read", "update", "delete"]) {
    const scope = c.access[action]({ req: req() });
    assert.equal(matches(scope, { workspace: "a", recipient: "u1" }), true);
    assert.equal(matches(scope, { workspace: "a", recipient: "u2" }), false);
    assert.equal(matches(scope, { workspace: "b", recipient: "u1" }), false);
  }
  assert.equal(c.access.create({ req: req("a", "owner") }), false);
  assert.equal(matches(c.access.read({ req: req("a", "member", ["pages"]) }),{workspace:"a",recipient:"u1"}),true);
  for (const f of c.fields.filter((f) =>
    ["workspace", "recipient", "key", "taskId", "commentId", "text"].includes(
      f.name,
    ),
  ))
    assert.equal(f.access.update(), false);
});
test("comments force the real author and validate mentions against the workspace and task permissions", async () => {
  const c = collection("comments");
  const request = {
    ...req(),
    payload: {
      find: async (args) =>
        args.collection === "documents"
          ? { docs: [{ id: "t1" }] }
          : {
              docs: [
                {
                  id: "u2",
                  workspace: "a",
                  role: "member",
                  permissions: ["tasks"],
                },
              ],
            },
    },
  };
  request.user.name = "Alex";
  const data = await c.hooks.beforeValidate[0]({
    data: {
      taskId: "t1",
      text: "Hola @Ana",
      author: "forged",
      authorName: "forged",
      mentions: ["u2"],
    },
    req: request,
  });
  assert.equal(data.author, "u1");
  assert.equal(data.authorName, "Alex");
  assert.equal(data.workspace, "a");
  request.payload.find = async (args) =>
    args.collection === "documents" ? { docs: [{ id: "t1" }] } : { docs: [] };
  await assert.rejects(
    c.hooks.beforeValidate[0]({
      data: { taskId: "t1", text: "Hola", mentions: ["foreign"] },
      req: request,
    }),
  );
  assert.equal(c.access.create({ req: req("a", "viewer", ["tasks"]) }), false);
});
test("mentions generate one recipient notification and never notify the author", async () => {
  const created = [];
  const request = {
    ...req(),
    payload: {
      create: async (args) => {
        created.push(args);
        return { id: 1 };
      },
    },
  };
  request.user.name = "Alex";
  await collection("comments").hooks.afterChange[0]({
    operation: "create",
    doc: { id: "c1", taskId: "t1", mentions: ["u1", "u2"] },
    req: request,
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].data.recipient, "u2");
  assert.equal(created[0].data.workspace, "a");
  assert.equal(created[0].data.taskId, "t1");
});
test("workspace access remains scoped and registration rejects invalid codes before database work", async () => {
  const c = collection("workspaces");
  assert.equal(c.access.create({ req: req("a", "owner") }), false);
  assert.deepEqual(c.access.read({ req: req("a") }), { id: { equals: "a" } });
  const endpoint = cfg.endpoints.find((e) => e.path === "/register-workspace");
  const r = await endpoint.handler({ json: async () => ({ code: "invalid" }) });
  assert.equal(r.status, 403);
});

import { validateEncryptedAccess } from "../src/encrypted.ts";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
test("vault ciphertext is authenticated and plaintext cannot be saved through Payload", () => {
  const secret = "test-encryption-key-with-at-least-32-characters";
  assert.equal(validateEncryptedAccess("my plaintext password", secret), false);
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    iv,
  );
  const data = {
    title: "Hosting",
    category: "Hosting",
    url: "https://example.com",
    username: "demo",
    password: "not-a-real-secret",
    notes: "",
  };
  const encrypted = Buffer.concat([
    iv,
    cipher.update(JSON.stringify(data)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
  assert.equal(validateEncryptedAccess(encrypted, secret), true);
  assert.equal(validateEncryptedAccess(encrypted, secret + "wrong"), false);
  const bytes = Buffer.from(encrypted, "base64");
  bytes[15] ^= 1;
  assert.equal(
    validateEncryptedAccess(bytes.toString("base64"), secret),
    false,
  );
});

test("private spaces and their children stay private even within the same business", () => {
  const scope = collection("documents").access.read({ req: req("a", "owner") });
  assert.equal(
    matches(scope, { workspace: "a", key: "spaces:s1", privateOwner: "u1" }),
    true,
  );
  assert.equal(
    matches(scope, { workspace: "a", key: "spaces:s1", privateOwner: "u2" }),
    false,
  );
  assert.equal(
    matches(scope, { workspace: "a", key: "nodes:n1", privateOwner: "u2" }),
    false,
  );
  assert.equal(matches(scope, { workspace: "a", key: "spaces:s1" }), true);
});
test("store and files remain admin-only even with forged explicit permissions", () => {
  for (const role of ["member", "viewer"])
    for (const section of [
      "orders",
      "invoices",
      "documents",
      "analytics",
      "settings",
    ])
      assert.equal(canView(req("a", role, [section]).user, section), false);
  assert.equal(
    collection("files").access.read({ req: req("a", "member", ["documents"]) }),
    false,
  );
  const scope = collection("files").access.read({ req: req("a", "admin") });
  assert.equal(matches(scope, { workspace: "a" }), true);
  assert.equal(matches(scope, { workspace: "b" }), false);
});

test("private task and page ownership is forced by the server and public records cannot be claimed", async () => {
  const c = collection("documents");
  for (const key of ["tasks:t1", "pages:p1", "spaces:s1"]) {
    const data = await c.hooks.beforeValidate[0]({
      data: { key, value: { privateOwner: "forged" } },
      req: req("a"),
    });
    assert.equal(data.privateOwner, "u1");
    assert.equal(data.value.privateOwner, "u1");
    const updated = await c.hooks.beforeValidate[0]({
      data: { key, value: { privateOwner: "forged" } },
      originalDoc: { key, privateOwner: null },
      req: req("a"),
    });
    assert.equal(updated.privateOwner, null);
    const scope = c.access.read({ req: req("a", "admin") });
    assert.equal(
      matches(scope, { workspace: "a", key, privateOwner: "someone-else" }),
      false,
    );
  }
});
test("private task comments stay owner-scoped and reject mentions of another teammate", async () => {
  const c = collection("comments"),
    scope = c.access.read({ req: req("a") });
  assert.equal(matches(scope, { workspace: "a", privateOwner: "u1" }), true);
  assert.equal(matches(scope, { workspace: "a", privateOwner: "u2" }), false);
  const request = {
    ...req(),
    payload: {
      find: async () => ({ docs: [{ id: "t1", privateOwner: "u1" }] }),
    },
  };
  const comment = await c.hooks.beforeValidate[0]({
    data: { taskId: "t1", text: "Personal", mentions: [] },
    req: request,
  });
  assert.equal(comment.privateOwner, "u1");
  await assert.rejects(
    c.hooks.beforeValidate[0]({
      data: { taskId: "t1", text: "Hola", mentions: ["u2"] },
      req: request,
    }),
  );
});

test("today selections are personal even for an administrator, while monthly goals remain shared", async () => {
  const c = collection("documents"),
    request = req("a", "viewer", ["overview", "tasks"]);
  const focus = await c.hooks.beforeValidate[0]({
    data: {
      key: "focus:u1",
      value: {
        id: "forged",
        privateOwner: "forged",
        selections: [{ taskId: "t1", addedOn: "2026-11-02" }],
      },
    },
    req: request,
  });
  assert.equal(focus.privateOwner, "u1");
  assert.equal(focus.value.id, "u1");
  await assert.rejects(
    c.hooks.beforeValidate[0]({
      data: { key: "focus:u2", value: { selections: [] } },
      req: request,
    }),
  );
  const adminScope = c.access.read({ req: req("a", "admin") });
  assert.equal(
    matches(adminScope, {
      workspace: "a",
      key: "focus:u2",
      privateOwner: "u2",
    }),
    false,
  );
  const memberScope = c.access.read({ req: request });
  assert.equal(matches(memberScope, { workspace: "a", key: "goals:g1" }), true);
  assert.equal(
    matches(memberScope, { workspace: "b", key: "goals:g1" }),
    false,
  );
  await assert.rejects(
    c.hooks.beforeValidate[0]({
      data: {
        key: "goals:g1",
        value: { title: "Objetivo", month: "2026-11", done: false },
      },
      req: request,
    }),
  );
  const goal = await c.hooks.beforeValidate[0]({
    data: {
      key: "goals:g1",
      privateOwner: "fake",
      value: {
        title: "Objetivo",
        month: "2026-11",
        done: false,
        createdBy: "fake",
      },
    },
    req: req("a", "member", ["overview"]),
  });
  assert.equal(goal.privateOwner, null);
  assert.equal(goal.value.createdBy, "u1");
});
test("meeting directory requires calendar write permission and is scoped to the organization", async () => {
  const endpoint = cfg.endpoints.find((e) => e.path === "/meeting-directory");
  assert.ok(endpoint);
  const denied = await endpoint.handler(req("a", "viewer", ["calendar"]));
  assert.equal(denied.status, 403);
  let query;
  const result = await endpoint.handler({
    ...req("a", "member", ["calendar"]),
    payload: {
      find: async (args) => {
        query = args;
        return { docs: [{ id: "u2", name: "QA", email: "qa@example.com" }] };
      },
    },
  });
  assert.equal(result.status, 200);
  assert.equal(matches(query.where, { workspace: "a", disabled: false }), true);
  assert.equal(
    matches(query.where, { workspace: "b", disabled: false }),
    false,
  );
  assert.equal(matches(query.where, { workspace: "a", disabled: true }), false);
});

test('notification composer scopes directory and rejects foreign recipients before creating messages',async()=>{
 const directory=cfg.endpoints.find(e=>e.path==='/notification-directory');let scope;
 const own={...req('a','viewer',['pages']),payload:{find:async args=>{scope=args.where;return {docs:[{id:'u2',name:'Ana'}]};}}};
 assert.equal((await directory.handler(own)).status,200);assert.equal(matches(scope,{workspace:'b',disabled:false}),false);assert.equal(matches(scope,{workspace:'a',disabled:false}),true);
 const send=cfg.endpoints.find(e=>e.path==='/send-notification');let writes=0;
 const request={...req(),json:async()=>({text:'@Ana Revisa la campaña',recipients:['u2'],requestId:'request-1'}),payload:{find:async()=>({docs:[],totalDocs:0}),create:async()=>{writes++;}}};
 assert.equal((await send.handler(request)).status,400);assert.equal(writes,0);
 request.payload.find=async args=>args.collection==='users'?{docs:[{id:'u2',workspace:'a',name:'Ana'}]}:{docs:[],totalDocs:0};
 request.payload.create=async args=>{writes++;assert.equal(args.data.workspace,'a');assert.equal(args.data.authorId,'u1');assert.equal(args.data.recipient,'u2');assert.equal(args.data.kind,'message');};
 assert.equal((await send.handler(request)).status,200);assert.equal(writes,1);
});

test('private boards stay owner-scoped and tasks cannot cross board privacy',async()=>{
 const c=collection('documents'),own=req('a','admin');
 const scope=c.access.read({req:own});assert.equal(matches(scope,{workspace:'a',key:'boards:b1',privateOwner:'u2'}),false);assert.equal(matches(scope,{workspace:'a',key:'boards:b1',privateOwner:'u1'}),true);
 const request={...own,payload:{find:async()=>({docs:[{id:'b',key:'boards:b1',privateOwner:'u1'}]})}};
 const created=await c.hooks.beforeValidate[0]({req:request,data:{key:'tasks:t-new',value:{boardId:'b1',title:'Privada',privateOwner:'forged'}}});assert.equal(created.privateOwner,'u1');assert.equal(created.value.privateOwner,'u1');
 await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{key:'tasks:public',value:{boardId:'b1'}},originalDoc:{key:'tasks:public',value:{boardId:'general'}}}));
});

test('canvas photos directory protects workspace scope and returns only presence photos', async () => {
  const endpoint = cfg.endpoints.find(e => e.path === '/canvas-directory');
  assert.equal((await endpoint.handler({...req('a','viewer',['tasks'])})).status, 403);
  assert.equal((await endpoint.handler({...req(), url:'http://localhost/canvas-directory?ids=invalid%20id'})).status, 400);
  let query;
  const result = await endpoint.handler({...req(), url:'http://localhost/canvas-directory?ids=u2,u3', payload:{find:async args => {
    query = args;
    return {docs:[{id:'u2', workspace:'a', role:'member', name:'Ana', email:'private@example.com', avatarData:'photo'}, {id:'u3', workspace:'a',role:'viewer',permissions:['tasks']}]};
  }}});
  assert.deepEqual(await result.json(), {docs:[{id:'u2',avatarData:'photo'}]});
  assert.equal(matches(query.where,{workspace:'a',disabled:false}),true);
  assert.equal(matches(query.where,{workspace:'b',disabled:false}),false);
  assert.equal(matches(query.where,{workspace:'a',disabled:true}),false);
  assert.equal(matches(query.where,{workspace:'a',deletedAt:'2026-11-01'}),false);
  assert.deepEqual(query.where.and[1],{id:{in:['u2','u3']}});
});

test('discarding canvas cards is scoped, removes connectors and preserves parent trash bundles',async()=>{
 const endpoint=cfg.endpoints.find(e=>e.path==='/discard-canvas-document');
 assert.equal((await endpoint.handler({...req('a','viewer',['canvas'])})).status,403);
 assert.equal((await endpoint.handler({...req(),json:async()=>({key:'spaces:s1'})})).status,400);
 const deleted=[],queries=[];
 const request={...req(),json:async()=>({key:'nodes:n1'}),payload:{find:async args=>{
   queries.push(args);return {docs:args.limit===1?[{id:1,key:'nodes:n1'}]:[{id:2,value:{from:'n1',to:'n2'}},{id:3,value:{from:'n3',to:'n4'}}]};
 },delete:async args=>{deleted.push(args.id);assert.equal(args.req,request);}}};
 assert.equal((await endpoint.handler(request)).status,200);assert.deepEqual(deleted,[2,1]);
 for(const q of queries){assert.equal(q.overrideAccess,false);assert.equal(matches(q.where,{workspace:'b',key:'nodes:n1'}),false);}
 request.payload.find=async()=>({docs:[{id:1,deletedAt:'2026-11-01'}]});deleted.length=0;
 assert.equal((await endpoint.handler(request)).status,200);assert.deepEqual(deleted,[]);
 request.payload.find=async()=>({docs:[]});assert.equal((await endpoint.handler(request)).status,404);
});

test('one store slot per business with scoped disconnect and immutable provider',async()=>{
 const c=collection('integrations');
 assert.equal(c.access.delete({req:req('a','member')}),false);
 const deletion=c.access.delete({req:req('a','admin')});
 assert.equal(matches(deletion,{workspace:'b',provider:'woo'}),false);
 assert.deepEqual(deletion.and[1],{provider:{in:['woo','shopify','payload']}});
 const keys=[];
 const request={...req('a','admin'),payload:{find:async()=>({docs:[]})}};
 for(const provider of ['woo','shopify','payload','google']){
  const result=await c.hooks.beforeValidate[0]({req:request,data:{provider,workspace:'forged',workspaceProvider:'forged'},originalDoc:{}});
  assert.equal(result.workspace,'a');keys.push(result.workspaceProvider);
 }
 assert.deepEqual(keys,['a:store','a:store','a:store','a:google']);
 request.payload.find=async()=>({docs:[{provider:'woo'}]});
 await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{provider:'shopify'}}),/Desconecta WooCommerce/);
 await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{provider:'payload'},originalDoc:{provider:'woo'}}),/Desconecta la integración/);
 const updated=await c.hooks.beforeValidate[0]({req:request,data:{credentials:'opaque-encrypted-value'},originalDoc:{provider:'woo'}});
 assert.equal(updated.workspaceProvider,'a:store');
});

test('appearance is validated in the personal focus document',async()=>{
 const c=collection('documents'),request=req('a','member',['tasks']);
 const data={key:'focus:u1',value:{id:'u1',privateOwner:'u1',selections:[],theme:'dark'}};
 const saved=await c.hooks.beforeValidate[0]({req:request,data});assert.equal(saved.value.theme,'dark');
 await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{key:'focus:u1',value:{selections:[],theme:'invalid'}}}),/Preferencias no válidas/);
 await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{key:'focus:u2',value:{selections:[],theme:'light'}}}));
});

test('favorites and directory controls stay in the owner personal preference with bounded sizes',async()=>{
 const c=collection('documents'),request=req('a','member',['pages']);
 const saved=await c.hooks.beforeValidate[0]({req:request,data:{key:'focus:u1',value:{selections:[],favoriteKeys:['pages:p1'],directories:{notes:{view:'list',pageSize:18}}}}});
 assert.deepEqual(saved.value.favoriteKeys,['pages:p1']);
 for(const prefs of [{favoriteKeys:['invalid:p1']},{directories:{'private-notes':{view:'grid',pageSize:36}}}])
  await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{key:'focus:u1',value:{selections:[],...prefs}}}),/Preferencias no válidas/);
 await assert.rejects(()=>c.hooks.beforeValidate[0]({req:request,data:{key:'focus:u2',value:{selections:[],favoriteKeys:['pages:p1']}}}));
});

test('shared files keep other workspaces and restricted users out',async()=>{
 const c=collection('workspace-files');
 const allowed=req('a','member',['files']),denied=req('a','member',['tasks']),reader=req('a','viewer',['files']);
 assert.equal(await c.access.create({req:allowed}),true);
 const where=await c.access.read({req:allowed});assert.equal(matches(where,{workspace:'a'}),true);assert.equal(matches(where,{workspace:'b'}),false);
 assert.equal(await c.access.read({req:denied}),false);assert.equal(await c.access.create({req:reader}),false);assert.equal(await c.access.update({req:reader}),false);assert.equal(await c.access.delete({req:reader}),false);
 const removal=await c.access.delete({req:allowed});
 assert.equal(matches(removal,{workspace:'a',deletedAt:'2026-11-16'}),true);
 assert.equal(matches(removal,{workspace:'a'}),false);
 assert.equal(matches(removal,{workspace:'b',deletedAt:'2026-11-16'}),false);
 const data={workspace:'b',title:'Fixture'};c.hooks.beforeValidate[0]({data,req:allowed,originalDoc:null});assert.equal(data.workspace,'a');
});
test('shared file uploads limit size and reject executable or active content',async()=>{
 const {validWorkspaceFile,MAX_WORKSPACE_FILE,workspaceFileCategory}=await import('../src/workspace-file-policy.ts');
 assert.equal(validWorkspaceFile('application/pdf',MAX_WORKSPACE_FILE),true);assert.equal(validWorkspaceFile('application/pdf',MAX_WORKSPACE_FILE+1),false);assert.equal(validWorkspaceFile('image/png',0),false);assert.equal(validWorkspaceFile('text/html',100),false);assert.equal(validWorkspaceFile('image/svg+xml',100),false);assert.equal(validWorkspaceFile('application/x-msdownload',100),false);assert.equal(workspaceFileCategory('application/pdf'),'pdf');assert.equal(workspaceFileCategory('video/mp4'),'video');
});

test('vision board preferences remain private even from other administrators',async()=>{
 const c=collection('documents'),value={id:'u1',privateOwner:'u1',selections:[],overviewMode:'vision',visionBoard:{images:[{id:'image-1',image:'data:image/webp;base64,UklGRg==',x:0,y:0,width:230}]}};
 const own=await c.hooks.beforeValidate[0]({data:{key:'focus:u1',value},req:req('a','member')});assert.equal(own.privateOwner,'u1');
 const other={user:{...req('a','admin').user,id:'u2'}};const scope=c.access.read({req:other});assert.equal(matches(scope,{workspace:'a',key:'focus:u1',privateOwner:'u1'}),false);
 await assert.rejects(()=>c.hooks.beforeValidate[0]({data:{key:'focus:u2',value},req:req('a','admin')}));
});

test("Payload create hooks with an empty original document retain private ownership",async()=>{const c=collection('documents');for(const key of ['tasks:new','boards:new','pages:new','spaces:new']){const data=await c.hooks.beforeValidate[0]({data:{key,value:{privateOwner:'requested'}},originalDoc:{},req:req('a')});assert.equal(data.privateOwner,'u1');assert.equal(data.value.privateOwner,'u1');}});

test('folders share file permissions and derive their tenant and unique key on the server',async()=>{
 const folders=collection('workspace-folders'),allowed=req('a','member',['files']),reader=req('a','viewer',['files']),denied=req('a','member',['tasks']);
 assert.equal(folders.access.create({req:allowed}),true);assert.equal(folders.access.create({req:reader}),false);assert.equal(folders.access.read({req:denied}),false);
 const scope=folders.access.read({req:allowed});assert.equal(matches(scope,{workspace:'a'}),true);assert.equal(matches(scope,{workspace:'b'}),false);
 const data=await folders.hooks.beforeValidate[0]({req:allowed,data:{name:'  Campañas   2026 ',workspace:'b',key:'forged'}});
 assert.equal(data.workspace,'a');assert.equal(data.name,'Campañas 2026');assert.equal(data.key,'a:campañas 2026');
 assert.throws(()=>folders.hooks.beforeValidate[0]({req:reader,data:{name:'Carpeta'}}));
});
test('file moves reject foreign folders and keep unfiled uploads compatible',async()=>{
 const {validateFileFolder}=await import('../src/workspace-folders.ts');
 const request={...req('a','member',['files']),payload:{find:async args=>{assert.equal(args.overrideAccess,false);assert.ok(JSON.stringify(args.where).includes('"a"'));return {docs:[]};}}};
 await assert.rejects(()=>validateFileFolder({data:{folder:42},req:request}),/carpeta no está disponible/);
 await assert.rejects(()=>validateFileFolder({data:{folder:'../foreign'},req:request}),/Carpeta no válida/);
 assert.deepEqual(await validateFileFolder({data:{folder:null},req:request}),{folder:null});
 assert.deepEqual(await validateFileFolder({data:{title:'Sin carpeta'},req:request}),{title:'Sin carpeta'});
 const valid={...request,payload:{find:async()=>({docs:[{id:4}]})}};assert.deepEqual(await validateFileFolder({data:{folder:'4'},req:valid}),{folder:4});
});
