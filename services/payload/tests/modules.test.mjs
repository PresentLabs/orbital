import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {handleModules, ModuleInstallations} from '../src/modules/index.ts';
import {seal, unseal, storeOrigin} from '../src/modules/security.ts';
import {command, wooRequest} from '../src/modules/woo.ts';
process.env.INTEGRATIONS_SECRET='test-module-secret-longer-than-thirty-two-bytes';
process.env.INTEGRATION_ALLOWED_HOSTS='shop.example.test';
const capabilities={module:'woo-dte-chile',apiVersion:1,environment:'certification'};
function fixture() {
  const records=[], calls=[], upstream=[];
  const store={id:1,credentials:seal({url:'https://shop.example.test',key:'not-for-wp',secret:'not-for-wp'})};
  const req={method:'POST',headers:new Headers({Authorization:'JWT test'}),user:{id:7,role:'admin',workspace:12},json:async()=>({}),payload:{
    find:async args=>{calls.push(args);assert.equal(args.where.workspace?.equals || args.where.and[0].workspace.equals,12);return {docs:args.collection==='integrations'?[store]:records};},
    create:async args=>{calls.push(args);records.push({id:99,...args.data});return records.at(-1);},
    update:async args=>{calls.push(args);assert.equal(args.id,99);Object.assign(records[0],args.data);return records[0];},
  }};
  const woo=async(...args)=>{upstream.push(args);return args[1]==='capabilities'?capabilities:[];};
  const send=async body=>{req.method='POST';req.json=async()=>({moduleId:'woo-dte-chile',...body});return handleModules(req,woo);};
  const install=()=>send({action:'install',username:'manager',password:'abcd efgh ijkl mnop qrst uvwx'});
  return {req,records,calls,upstream,store,woo,send,install};
}
test('denies anonymous, disabled and ordinary members before DB access',async()=>{
  for(const user of [null,{role:'member',workspace:12},{role:'admin',disabled:true,workspace:12},{role:'admin'}]) {
    const f=fixture();f.req.user=user;const r=await handleModules(f.req,f.woo);assert.ok([401,403].includes(r.status));assert.equal(f.calls.length,0);
  }
});
test('cookie-only direct Payload request cannot mutate modules',async()=>{const f=fixture();f.req.headers=new Headers({cookie:'payload-token=fake'});assert.equal((await f.install()).status,401);assert.equal(f.calls.length,0);});
test('collection CRUD and credential field cannot bypass endpoint',()=>{for(const fn of Object.values(ModuleInstallations.access)) assert.equal(fn({}),false);assert.equal(ModuleInstallations.fields.find(x=>x.name==='credentials').access.read({}),false);});
test('installation derives tenant, verifies plugin and encrypts credentials',async()=>{
  const f=fixture();const r=await f.send({action:'install',workspace:999,username:'manager',password:'abcdefghijklmnopqrstuvwx'});
  assert.equal(r.status,200);assert.equal(f.records[0].workspace,12);assert.equal(f.records[0].workspaceKey,'12:woo-dte-chile');
  assert.equal(unseal(f.records[0].credentials).password,'abcdefghijklmnopqrstuvwx');assert.ok(!JSON.stringify(f.records).includes('abcdefghijklmnopqrstuvwx'));
  assert.ok(!JSON.stringify(await r.json()).includes('password'));assert.equal(f.upstream[0][1],'capabilities');
});
test('catalog redacts credentials; unknown module rejected',async()=>{const f=fixture();await f.install();f.req.method='GET';const r=await handleModules(f.req,f.woo);assert.ok(!(await r.text()).includes('credentials'));assert.equal((await f.send({moduleId:'arbitrary-code',action:'install'})).status,404);});
test('disable keeps record and prevents operations; credential rotation re-enables',async()=>{const f=fixture();await f.install();await f.send({action:'disable'});assert.equal(f.records.length,1);assert.equal((await f.send({action:'documents',orderId:1})).status,409);assert.equal((await f.install()).status,200);assert.equal(f.records.length,1);});
test('changed Woo store blocks operations and rebinding existing installation',async()=>{const f=fixture();await f.install();process.env.INTEGRATION_ALLOWED_HOSTS='shop.example.test,other.example.test';f.store.credentials=seal({url:'https://other.example.test'});assert.equal((await f.send({action:'documents',orderId:1})).status,409);assert.equal((await f.install()).status,409);process.env.INTEGRATION_ALLOWED_HOSTS='shop.example.test';});
test('requests preserve adjustment operation key and only allowed fields',async()=>{const f=fixture();await f.install();const body={action:'adjust',documentId:8,type:61,amount:5000,reason:'Devolución',kind:'return',cancel:false,operationKey:'same-operation-key',environment:'production',refund_id:999};await f.send(body);await f.send(body);assert.equal(f.upstream[1][4],f.upstream[2][4]);assert.equal(f.upstream[1][1],'documents/8/adjust');assert.ok(!('environment' in f.upstream[1][3]));assert.ok(!('refund_id' in f.upstream[1][3]));});
test('validates IDs, DTE scope, amount, keys and allowlisted commands',()=>{
  for(const body of [{action:'issue',orderId:1,type:34},{action:'documents',orderId:'../1'},{action:'documents',orderId:0},{action:'file',documentId:1,format:'php'},{action:'delete',documentId:1},{action:'adjust',operationKey:'short'}]) assert.throws(()=>command(body));
  assert.equal(command({action:'issue',type:39,orderId:1}).path,'orders/1/issue');assert.equal(command({action:'fiscal',type:33,orderId:1,receiver:{rut:'1-9',name:'X',giro:'Y',address:'Z',commune:'A'}}).method,'PUT');
});
test('SSRF: deny non HTTPS, unexpected host, path, embedded credentials and port',()=>{
  for(const value of ['http://shop.example.test','https://evil.test','https://shop.example.test@evil.test','https://user:pass@shop.example.test','https://shop.example.test:444','https://shop.example.test/private','https://shop.example.test?x=1','https://127.0.0.1']) assert.throws(()=>storeOrigin(value));
  assert.equal(storeOrigin('https://shop.example.test'),'https://shop.example.test');
});
test('cipher interoperates with existing Astro AES-GCM and detects tampering',async()=>{
  const iv=webcrypto.getRandomValues(new Uint8Array(12));const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(process.env.INTEGRATIONS_SECRET));const key=await webcrypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt']);
  const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify({url:'https://shop.example.test'})));
  assert.equal(unseal(Buffer.concat([iv,Buffer.from(ciphertext)]).toString('base64')).url,'https://shop.example.test');
  const bytes=Buffer.from(seal({secret:'hello'}),'base64');bytes[15]^=1;assert.throws(()=>unseal(bytes.toString('base64')));
});
test('Woo adapter uses WP Basic auth, forbids redirect, preserves key, handles uncertain timeout',async()=>{
  const connection={origin:'https://shop.example.test',username:'admin',password:'application-password'};
  await wooRequest(connection,'documents/1/adjust','POST',{amount:1},'operation-123',async(url,init)=>{assert.equal(url,'https://shop.example.test/wp-json/woo-dte-chile/v1/documents/1/adjust');assert.equal(init.redirect,'error');assert.equal(init.headers['Idempotency-Key'],'operation-123');assert.equal(init.headers.Authorization,'Basic '+Buffer.from('admin:application-password').toString('base64'));return Response.json({id:2});});
  await assert.rejects(()=>wooRequest(connection,'capabilities','GET',undefined,undefined,async()=>{throw new Error('secret');}),e=>e.status===504&&!e.message.includes('secret'));
  await assert.rejects(()=>wooRequest(connection,'capabilities','GET',undefined,undefined,async()=>new Response('secret-stack',{status:500})),e=>e.status===502&&!e.message.includes('secret'));
});
