// Opt-in local test with an isolated workspace, owner and second administrator.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { getPayload } from "payload";
process.loadEnvFile(".env");
const { default: config } = await import("../src/payload.config.ts");
const local = await getPayload({ config }),
  base = "http://127.0.0.1:4345",
  backend = "http://127.0.0.1:3001";
let ownerId, otherId, workspace, viewerId, foreignOwnerId, foreignWorkspace;
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
  const board = {
    id: "qa-work",
    name: "QA trabajo",
    description: "",
    color: "green",
    createdAt: new Date().toISOString(),
    work: { mode: "cycles", cycles: [], periods: [] },
  };
  const put = (key, value) => request(token, "PUT", { key, value });
  assert.ok((await put("boards:qa-work", board)).ok);
  const task = {
    id: "qa-task",
    boardId: "qa-work",
    title: "QA",
    description: "",
    project: "QA",
    status: "todo",
    priority: "normal",
    due: "",
    blockedAt: new Date().toISOString(),
    blockedReason: "Esperando una foto",
  };
  assert.ok((await put("tasks:qa-task", task)).ok);
  const at = new Date().toISOString(),
    day = at.slice(0, 10),
    end = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
  board.work.cycles = [
    {
      id: "qa-cycle",
      name: "Campaña",
      goal: "Probar persistencia real",
      start: day,
      end,
      status: "active",
      taskIds: ["qa-task"],
      initial: 1,
      initialScope: 1,
      startedAt: at,
      events: [
        { id: "event-start", at, kind: "started", remaining: 1, scope: 1 },
      ],
    },
  ];
  assert.ok((await put("boards:qa-work", board)).ok);
  let read = (await (await request(other)).json()).docs.find(
    (d) => d.key === "boards:qa-work",
  );
  assert.equal(read.value.work.cycles[0].goal, "Probar persistencia real");
  const bad = structuredClone(board);
  bad.work.cycles.push({ ...bad.work.cycles[0], id: "second" });
  assert.equal((await put("boards:qa-work", bad)).ok, false);
  const incompatible = structuredClone(board);
  incompatible.work.mode = "project";
  assert.equal((await put("boards:qa-work", incompatible)).ok, false);
  const privateBoard = {
    ...board,
    id: "qa-private",
    privateOwner: String(ownerId),
    work: { mode: "daily", cycles: [], periods: [] },
  };
  assert.ok((await put("boards:qa-private", privateBoard)).ok);
  const privateNote = {
    id: "qa-note",
    title: "Privado",
    body: "No revelar",
    emoji: "▤",
    updated: at,
    privateOwner: String(ownerId),
  };
  assert.ok((await put("pages:qa-note", privateNote)).ok);
  assert.equal(
    (await (await request(other)).json()).docs.some(
      (d) => d.key === "pages:qa-note",
    ),
    false,
  );
  assert.equal(
    (
      await request(other, "PUT", {
        key: "pages:qa-note",
        value: { ...privateNote, body: "Ataque" },
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await put("tasks:qa-task", {
        ...task,
        links: [{ kind: "pages", id: "qa-note" }],
      })
    ).ok,
    false,
  );
  assert.equal(
    (await put("tasks:qa-task", { ...task, boardId: "another-business-board" }))
      .ok,
    false,
  );
  task.status = "done";
  task.activity = [{ at: new Date().toISOString(), kind: "completed" }];
  assert.ok((await put("tasks:qa-task", task)).ok);
  const currentCycle = board.work.cycles[0];
  currentCycle.events.push({
    id: "event-done",
    at: new Date().toISOString(),
    kind: "completed",
    taskId: task.id,
    remaining: 0,
    scope: 1,
  });
  assert.ok((await put("boards:qa-work", board)).ok);
  currentCycle.status = "closed";
  currentCycle.closedAt = new Date().toISOString();
  currentCycle.review = {
    achieved: "Sí",
    worked: "En equipo",
    improve: "Menos tareas",
    pending: "later",
  };
  board.work.mode = "project";
  board.work.periods = [{ id: "p1", start: day, end, status: "active" }];
  assert.ok((await put("boards:qa-work", board)).ok);
  read = (await (await request(token)).json()).docs.find(
    (d) => d.key === "boards:qa-work",
  );
  assert.equal(read.value.work.cycles[0].events.length, 2);
  assert.equal(read.value.work.periods[0].status, "active");
  const history = structuredClone(board);
  history.work.cycles = [];
  assert.equal((await put("boards:qa-work", history)).ok, false);
  const duplicatePeriod=structuredClone(board);duplicatePeriod.work.periods.push({...duplicatePeriod.work.periods[0],id:"p2"});assert.equal((await put("boards:qa-work",duplicatePeriod)).ok,false);
  const viewerCredentials=credentials();viewerId=(await local.create({collection:"users",data:{...viewerCredentials,name:"QA lector",role:"viewer",permissions:["tasks"],workspace},overrideAccess:true})).id;
  const viewerToken=await login(viewerCredentials);assert.equal((await request(viewerToken,"PUT",{key:"tasks:qa-task",value:{...task,title:"No permitido"}})).ok,false);
  const foreignCredentials=credentials(),foreignRegistration=await fetch(backend+"/api/register-workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...foreignCredentials,code:process.env.REGISTRATION_CODE,name:"QA empresa distinta",business:"QA aislamiento de empresas"})});assert.equal(foreignRegistration.status,201);foreignOwnerId=(await foreignRegistration.json()).id;
  foreignWorkspace=(await local.findByID({collection:"users",id:foreignOwnerId,depth:0,overrideAccess:true})).workspace;
  const foreignToken=await login(foreignCredentials);assert.ok((await request(foreignToken,"PUT",{key:"boards:qa-foreign",value:{id:"qa-foreign",name:"Empresa distinta",description:"",color:"green"}})).ok);
  assert.equal((await (await request(token)).json()).docs.some(d=>d.key==="boards:qa-foreign"),false);
  assert.equal((await put("tasks:qa-task",{...task,boardId:"qa-foreign"})).ok,false);
  console.log(
    "Passed: real board, task/block persistence; cycle start/close/history; simultaneous active cycle rejection; incompatible mode rejection; project periods; private administrator isolation; private-to-shared and unavailable board rejection; viewer mutation rejection; isolation between two real companies.",
  );
} finally {
  if (workspace)
    await local.delete({
      collection: "documents",
      where: { workspace: { equals: workspace } },
      overrideAccess: true,
    });
  if(foreignWorkspace)await local.delete({collection:"documents",where:{workspace:{equals:foreignWorkspace}},overrideAccess:true});
  for (const id of [viewerId,otherId,ownerId,foreignOwnerId])
    if (id)
      await local.delete({ collection: "users", id, overrideAccess: true });
  if (workspace)
    await local.delete({
      collection: "workspaces",
      id: workspace,
      overrideAccess: true,
    });
  if(foreignWorkspace)await local.delete({collection:"workspaces",id:foreignWorkspace,overrideAccess:true});
  await local.db.destroy();
}
process.exit(0);
