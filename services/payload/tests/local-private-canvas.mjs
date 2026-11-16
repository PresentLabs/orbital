// Opt-in integration check against local PostgreSQL. It only creates and removes
// fixtures in its own temporary workspace.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { getPayload } from "payload";
process.loadEnvFile(".env");
assert.match(process.env.DATABASE_URL || "", /@(?:localhost|127\.0\.0\.1)(?::\d+)?\//, "Use a local database");
const {default:config}=await import("../src/payload.config.ts");
const payload=await getPayload({config});
const uid=randomUUID();
const accounts=[];
let team;
try {
  team=await payload.create({collection:"workspaces",data:{name:"Prueba de cifrado Órbita",slug:"qa-"+uid}});
  for(const role of ["owner","admin"])
    accounts.push(await payload.create({collection:"users",data:{workspace:team.id,email:`qa-${role}-${uid}@orbita.invalid`,password:randomBytes(24).toString("base64url"),name:"QA",role}}));
  const [owner,peer]=accounts;
  const create=(key,value)=>payload.create({collection:"documents",data:{key,value},user:owner,overrideAccess:false,depth:0});
  const root="spaces:root-"+uid, folder="spaces:folder-"+uid, shared="spaces:shared-"+uid, node="nodes:note-"+uid;
  await create(root,{id:root.slice(7),name:"Root",color:"green"});
  const placement={parentId:root.slice(7),x:20,y:30};
  const privateFolder=await create(folder,{id:folder.slice(7),name:"Private folder name",privateOwner:String(owner.id),color:"green",folder:placement});
  await create(shared,{id:shared.slice(7),name:"Shared folder",color:"green",folder:placement});
  const card={id:node.slice(6),space:folder.slice(7),title:"Private note",body:"Content for its owner only",kind:"note",x:0,y:0};
  const created=await create(node,card);
  for(const [doc,content] of [[privateFolder,"Private folder name"],[created,card.body]]) {
    const raw=await payload.db.findOne({collection:"documents",where:{id:{equals:doc.id}}});
    assert.equal(raw.value.canvasCipher,"aes-256-gcm-v1");
    assert.ok(!JSON.stringify(raw.value).includes(content));
  }
  const read=async user=>(await payload.find({collection:"documents",user,overrideAccess:false,depth:0})).docs;
  const own=await read(owner), other=await read(peer);
  assert.equal(own.find(d=>d.key===node).value.body,card.body);
  assert.equal(own.find(d=>d.key===node).canvasEncrypted,true);
  assert.ok(other.some(d=>d.key===shared));
  assert.ok(!other.some(d=>[folder,node].includes(d.key)));
  const updated=await payload.update({collection:"documents",id:created.id,data:{value:{...card,body:"Changed"}},user:owner,overrideAccess:false,depth:0});
  assert.equal(updated.value.body,"Changed");
  console.log("Payload: encrypted private folder and card, owner-only reads, shared folder visible and updates verified.");
} finally {
  if(team) await payload.delete({collection:"documents",where:{workspace:{equals:team.id}},overrideAccess:true});
  for(const account of accounts) await payload.delete({collection:"users",id:account.id,overrideAccess:true});
  if(team) await payload.delete({collection:"workspaces",id:team.id,overrideAccess:true});
  await payload.db.destroy();
}
process.exit(0);
