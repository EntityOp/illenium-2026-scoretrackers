import {build} from 'esbuild';
import {readFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const password='test-footvolley-host-password';
const salt='footvolley-test-salt';
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
const passwordHash=Array.from(new Uint8Array(derived),n=>n.toString(16).padStart(2,'0')).join('');
const out=mkdtempSync(join(tmpdir(),'illenium-footvolley-api-'));
const stub=`import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
const sql=new DatabaseSync(':memory:');sql.exec(${JSON.stringify(readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort().map(x=>readFileSync(join('drizzle',x),'utf8')).join('\n'))});
class Statement{constructor(q){this.q=q;this.args=[]}bind(...args){this.args=args;return this}async first(){env.reads++;await new Promise(r=>setTimeout(r,5));return sql.prepare(this.q).get(...this.args)||null}async run(){const r=sql.prepare(this.q).run(...this.args);return {meta:{changes:Number(r.changes)}}}}
export const env={reads:0,FOOTVOLLEY_HOST_PASSWORD_HASH:${JSON.stringify(passwordHash)},FOOTVOLLEY_HOST_PASSWORD_SALT:${JSON.stringify(salt)},DB:{prepare:q=>new Statement(q),batch:async statements=>{const result=[];for(const statement of statements)result.push(await statement.run());return result}}};`;

try{
 await build({stdin:{contents:`export * as auth from './app/api/auth/route.ts';export * as live from './app/api/live/route.ts';export {env as testEnv} from 'cloudflare:workers';`,resolveDir:process.cwd()},outfile:join(out,'api.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'test-env',setup(builder){builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test-env'}));builder.onLoad({filter:/.*/,namespace:'test-env'},()=>({contents:stub,loader:'js'}));}}]});
 const {auth,live,testEnv}=await import(join(out,'api.mjs'));
 const origin='https://test.local';
 const request=(path,body,headers={})=>new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',origin,...headers},body:JSON.stringify(body)});

 assert.equal((await live.GET()).status,200);
 assert.equal((await live.POST(request('/api/live',{version:0,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'start'}}))).status,401);
 let response=await auth.POST(request('/api/auth',{type:'login',password:'wrong-password'}));
 assert.equal(response.status,401);
 response=await auth.POST(request('/api/auth',{type:'login',password}));
 assert.equal(response.status,200);
 assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const cookie=response.headers.get('set-cookie').split(';')[0];

 const fixture={version:0,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'fixture',teams:['Test A','Test B'],start:'09:30',end:'09:45'}};
 response=await live.POST(request('/api/live',{...fixture,actionId:crypto.randomUUID()},{cookie,origin:'https://evil.test'}));
 assert.equal(response.status,403);
 response=await live.POST(request('/api/live',fixture,{cookie}));
 assert.equal(response.status,200);

 let version=1;
 const startAction={version,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'start'}};
 response=await live.POST(request('/api/live',startAction,{cookie}));
 assert.equal(response.status,200);
 version++;
 let lastPoint;
 for(let count=0;count<14;count++)for(const team of [0,1]){
  lastPoint={version,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'point',team}};
  response=await live.POST(request('/api/live',lastPoint,{cookie}));
  assert.equal(response.status,200);
  version++;
 }
 lastPoint={version,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'point',team:0}};
 response=await live.POST(request('/api/live',lastPoint,{cookie}));
 assert.equal(response.status,200);
 assert.equal((await response.json()).state.matches[0].status,'live');
 version++;
 const finalPoint={version,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'point',team:0}};
 response=await live.POST(request('/api/live',finalPoint,{cookie}));
 assert.equal(response.status,200);
 let result=await response.json();
 assert.equal(result.state.matches[0].status,'finished');
 assert.deepEqual(result.state.matches[0].points,[16,14]);
 const duplicate=await live.POST(request('/api/live',finalPoint,{cookie}));
 assert.equal(duplicate.status,200);
 assert.equal((await duplicate.json()).duplicate,true);

 response=await live.GET();
 result=await response.json();
 assert.equal(result.state.matches[0].status,'finished');
 assert.equal('history' in result.state.matches[0],false);
 const logout=await auth.POST(request('/api/auth',{type:'logout'},{cookie}));
 assert.equal(logout.status,200);
 assert.equal((await live.POST(request('/api/live',{version,actionId:crypto.randomUUID(),action:{id:'footvolley-1',type:'undo'}},{cookie}))).status,401);

 assert.equal((await auth.POST(request('/api/auth',{type:'login',password:'x'.repeat(9000)}))).status,413);
 assert.equal((await auth.POST(new Request(origin+'/api/auth',{method:'POST',headers:{origin,'Content-Type':'text/plain'},body:'hello'}))).status,415);
 for(let count=0;count<10;count++)await auth.POST(request('/api/auth',{type:'login',password:'wrong-password'},{'cf-connecting-ip':'192.0.2.99'}));
 assert.equal((await auth.POST(request('/api/auth',{type:'login',password},{'cf-connecting-ip':'192.0.2.99'}))).status,429);
 assert.equal((await live.GET(new Request(origin+'/api/live',{headers:{'If-None-Match':'"footvolley-v1-32"'}}))).status,304);

 await new Promise(resolve=>setTimeout(resolve,2100));
 const before=testEnv.reads,startTime=performance.now();
 const burst=await Promise.all(Array.from({length:500},()=>live.GET(new Request(origin+'/api/live'))));
 assert(burst.every(item=>item.status===200));
 assert.equal(testEnv.reads-before,1);
 console.log('Footvolley API test source covers protected scoring, win-by-two, deduplication, security responses and cached reads.');
}finally{rmSync(out,{recursive:true,force:true});}
