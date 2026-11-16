// Opt-in local integration check; all records belong to a temporary isolated workspace.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {getPayload} from 'payload';
process.loadEnvFile('.env');
const {default:config}=await import('../src/payload.config.ts');
const local=await getPayload({config}), base='http://127.0.0.1:4345', backend='http://127.0.0.1:3001';
const email=`qa-${randomUUID()}@orbita.invalid`,password=randomBytes(24).toString('base64url');
let workspace,account;
try {
 const registered=await fetch(backend+'/api/register-workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:process.env.REGISTRATION_CODE,email,password,name:'Prueba local',business:'Verificación local aislada'})});
 assert.equal(registered.status,201);account=(await registered.json()).id;
 workspace=(await local.findByID({collection:'users',id:account,depth:0,overrideAccess:true})).workspace;
 const login=await fetch(backend+'/api/users/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 assert.equal(login.status,200);const {token}=await login.json();assert.ok(token);
 const call=async(path,method='GET',body)=>{
  const res=await fetch(base+'/api/saas/'+path,{method,headers:{Origin:base,Cookie:'orbita_session='+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json();assert.ok(res.ok,`${method} ${path}: ${res.status}`);return data;
 };
 assert.equal((await call('session')).user.role,'owner');
 await call('documents','PUT',{key:'focus:'+account,value:{id:String(account),privateOwner:String(account),selections:[],theme:'dark',favoriteKeys:['spaces:qa-space'],directories:{spaces:{view:'list',pageSize:18}}}});
 assert.equal((await call('documents')).docs.find(d=>d.key==='focus:'+account).value.theme,'dark');
 assert.equal((await call('documents')).docs.find(d=>d.key==='focus:'+account).value.directories.spaces.pageSize,18);
 for(const [key,value] of [
  ['spaces:qa-space',{id:'qa-space',name:'Espacio de prueba',color:'green'}],
  ['nodes:qa-node',{id:'qa-node',space:'qa-space',kind:'note',title:'Tarjeta 1',body:'Prueba',x:0,y:0}],
  ['nodes:qa-node-2',{id:'qa-node-2',space:'qa-space',kind:'note',title:'Tarjeta 2',body:'Prueba',x:300,y:0}],
  ['edges:qa-edge',{id:'qa-edge',from:'qa-node',to:'qa-node-2'}],
 ])await call('documents','PUT',{key,value});
 await call('documents','DELETE',{key:'nodes:qa-node'});
 assert.equal((await call('documents')).docs.some(d=>d.key==='nodes:qa-node'||d.key==='edges:qa-edge'),false);
 assert.equal((await call('trash')).docs.length,0);
 await call('documents','DELETE',{key:'spaces:qa-space'});
 const trash=(await call('trash')).docs;assert.equal(trash.length,1);assert.equal(trash[0].key,'spaces:qa-space');
 await call('trash','PATCH',{collection:'documents',id:trash[0].id});
 const restored=(await call('documents')).docs;
 assert.ok(restored.some(d=>d.key==='spaces:qa-space'));assert.ok(restored.some(d=>d.key==='nodes:qa-node-2'));
 assert.equal((await call('trash')).docs.length,0);
 const owner = await local.findByID({collection:'users',id:account,depth:0,overrideAccess:true});
 const createStore = provider => local.create({collection:'integrations',data:{provider,credentials:'opaque-qa-fixture'},user:owner,overrideAccess:false});
 await createStore('woo');
 assert.deepEqual((await call('integrations')).connected,['woo']);
 const rejected = await fetch(base+'/api/saas/integrations',{method:'POST',headers:{Origin:base,Cookie:'orbita_session='+token,'Content-Type':'application/json'},body:JSON.stringify({provider:'shopify',credentials:{shop:'invalid',token:'invalid'}})});
 assert.equal(rejected.status,409);assert.match((await rejected.json()).error,/WooCommerce/);
 await call('integrations','DELETE',{provider:'woo'});
 assert.deepEqual((await call('integrations')).connected,[]);
 const concurrent = await Promise.allSettled([createStore('woo'),createStore('shopify')]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1,'unique store slot under concurrent requests');
 const connected=(await call('integrations')).connected;assert.equal(connected.length,1);
 await call('integrations','DELETE',{provider:connected[0]});
 await createStore('payload');assert.deepEqual((await call('integrations')).connected,['payload']);
 await call('integrations','DELETE',{provider:'payload'});
 console.log('Local integration passed: auth, canvas trash, exclusive store slot, HTTP conflict, concurrent connects, disconnect and reconnect.');
} finally {
 if(account)await local.delete({collection:'users',id:account,overrideAccess:true});
 if(workspace){await local.delete({collection:'integrations',where:{workspace:{equals:workspace}},overrideAccess:true});await local.delete({collection:'documents',where:{workspace:{equals:workspace}},overrideAccess:true});await local.delete({collection:'workspaces',id:workspace,overrideAccess:true});}
 await local.db.destroy();
}
process.exit(0);
