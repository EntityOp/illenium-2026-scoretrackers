import {initialState,normalizeState,publicState} from './game';
type Snapshot={version:number,state:ReturnType<typeof publicState>};
let latest:{value:Snapshot,until:number}|null=null;let pending:Promise<Snapshot>|null=null;
export function rememberPublic(value:Snapshot){if(!latest||value.version>=latest.value.version)latest={value,until:Date.now()+2000};}
export async function publicSnapshot(db:D1Database):Promise<Snapshot>{
 if(latest&&latest.until>Date.now())return latest.value;if(pending)return pending;
 pending=(async()=>{const row=await db.prepare('SELECT version,public_data FROM event_state WHERE id=1').first<{version:number,public_data:string|null}>();let value:Snapshot;
 if(!row)value={version:0,state:publicState(initialState())};else if(row.public_data)value={version:row.version,state:publicState(normalizeState(JSON.parse(row.public_data)))};else{const old=await db.prepare('SELECT version,data FROM event_state WHERE id=1').first<{version:number,data:string}>();value=old?{version:old.version,state:publicState(JSON.parse(old.data))}:{version:0,state:publicState(initialState())};}rememberPublic(value);return latest!.value;})();try{return await pending;}finally{pending=null;}
}
export async function servePublic(req:Request,db:D1Database,ctx?:{waitUntil:(p:Promise<unknown>)=>void}){
 const key=new Request(new URL('/api/live?schema=footvolley-v1',req.url).href);const cache=typeof caches!=='undefined'?(caches as CacheStorage & {default?:Cache}).default:undefined;let response:Response|undefined;
 if(cache&&ctx)try{response=await cache.match(key);}catch{}
 if(!response){try{const data=await publicSnapshot(db);response=Response.json(data,{headers:{'Cache-Control':'public, max-age=2',ETag:`"footvolley-v1-${data.version}"`}});if(cache&&ctx)ctx.waitUntil(cache.put(key,response.clone()).catch(()=>{}));}catch{return Response.json({error:'Scores temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'3'}});}}
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');if(req.headers.get('if-none-match')===headers.get('etag'))return new Response(null,{status:304,headers});return new Response(response.body,{status:200,headers});
}
