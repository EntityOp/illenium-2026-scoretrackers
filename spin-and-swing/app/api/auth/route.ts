import {readJson,HttpError} from '@/lib/http-security';
import {db,json,owner,authed,checkOrigin,digest,hashPassword,newSession,constantEqual} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return json({authenticated:await authed(req),owner:owner(req),configured:!!await db().prepare('SELECT id FROM credentials WHERE id=1').first()});}catch{return json({error:'Host access is temporarily unavailable.'},503);}}
export async function POST(req:Request){try{
 checkOrigin(req);const body=await readJson(req,2048);
 if(body.type==='logout'){const t=req.headers.get('cookie')?.match(/(?:^|; )illenium_host=([^;]+)/)?.[1];if(t)await db().prepare('DELETE FROM sessions WHERE token=?').bind(await digest(t)).run();return json({ok:true},200,{'Set-Cookie':'illenium_host=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});}
 if(typeof body.password!=='string'||body.password.length<10||body.password.length>128)return json({error:'Use a password of 10–128 characters.'},400);
 if(body.type==='setup'){
  if(!owner(req))return json({error:'Only the site owner can set or reset the host password.'},403);
  const salt=crypto.randomUUID();const hash=await hashPassword(body.password,salt);
  await db().batch([db().prepare('INSERT INTO credentials(id,hash,salt) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,salt=excluded.salt').bind(hash,salt),db().prepare('DELETE FROM sessions')]);
 }else if(body.type==='login'){
  const id='login:'+await digest(req.headers.get('cf-connecting-ip')||'unknown');const now=Date.now();
  await db().prepare('INSERT INTO attempts(id,count,until) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END').bind(id,now+900000,now,now).run();
  const attempt=await db().prepare('SELECT count FROM attempts WHERE id=?').bind(id).first<{count:number}>();if(attempt&&attempt.count>10)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  const row=await db().prepare('SELECT hash,salt FROM credentials WHERE id=1').first<{hash:string,salt:string}>();if(!row)return json({error:'Host password has not been set up yet. The site owner must sign in with ChatGPT and set it up first.'},401);if(!constantEqual(await hashPassword(body.password,row.salt),row.hash))return json({error:'Incorrect host password.'},401);
  await db().prepare('DELETE FROM attempts WHERE id=?').bind(id).run();
 }else return json({error:'Invalid request.'},400);
 return json({ok:true},200,{'Set-Cookie':await newSession()});
 }catch(e){return e instanceof HttpError?json({error:e.message},e.status):json({error:'Host access is temporarily unavailable. Please try again.'},503);}}
