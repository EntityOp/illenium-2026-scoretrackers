import {readJson,HttpError} from '@/lib/http-security';
import {db,json,authed,checkOrigin,digest,newSession,hashPassword,constantEqual,recordLoginAttempt,clearLoginAttempts} from '@/lib/server';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return json({authenticated:await authed(req),configured:!!(env.FOOTVOLLEY_HOST_PASSWORD_HASH&&env.FOOTVOLLEY_HOST_PASSWORD_SALT)});}catch{return json({error:'Host access is temporarily unavailable.'},503);}}
export async function POST(req:Request){try{
 checkOrigin(req);const body=await readJson(req,2048);
 if(body.type==='logout'){
  const token=req.headers.get('cookie')?.match(/(?:^|; )footvolley_host=([^;]+)/)?.[1];if(token)await db().prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run();
  return json({ok:true},200,{'Set-Cookie':'footvolley_host=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
 }
 if(body.type!=='login'||typeof body.password!=='string'||body.password.length>128)return json({error:'Enter the host password.'},400);
 const expectedHash=env.FOOTVOLLEY_HOST_PASSWORD_HASH,salt=env.FOOTVOLLEY_HOST_PASSWORD_SALT;if(!expectedHash||!salt)return json({error:'Host login is not configured.'},503);
 const attempt=await recordLoginAttempt(req);
 if(!constantEqual(await hashPassword(body.password,salt),expectedHash))return json({error:'Incorrect host password.'},401);
 await clearLoginAttempts(attempt);return json({ok:true},200,{'Set-Cookie':await newSession()});
 }catch(e){return e instanceof HttpError?json({error:e.message},e.status):json({error:'Host access is temporarily unavailable. Please try again.'},503);}}
