import {db,json,authed,checkOrigin,limitWrites} from '@/lib/server';
import {GameError,initialState,transition,publicState,normalizeState} from '@/lib/game';
import {readJson,HttpError} from '@/lib/http-security';
import {servePublic,rememberPublic} from '@/lib/live-read';
export const dynamic='force-dynamic';
async function read(){const row=await db().prepare('SELECT version,data FROM event_state WHERE id=1').first<{version:number,data:string}>();return row?{version:row.version,state:normalizeState(JSON.parse(row.data))}:{version:0,state:initialState()};}
export async function GET(req:Request=new Request('https://local.test/api/live')){return servePublic(req,db());}
export async function POST(req:Request){try{
 checkOrigin(req);if(!await authed(req))return json({error:'Log in to update scores.'},401);await limitWrites(req);const body=await readJson(req);
 if(!Number.isSafeInteger(body.version)||body.version<0||!body.action||typeof body.action!=='object'||typeof body.actionId!=='string'||!/^[a-f0-9-]{36}$/.test(body.actionId))throw new HttpError('Invalid score update.');
 const old=await read();if(old.state.recentActions?.includes(body.actionId))return json({version:old.version,state:publicState(old.state),duplicate:true});
 if(body.version!==old.version)return json({error:'Scores changed on another device. Review the latest score before retrying.'},409);
 const state=transition(old.state,body.action);state.recentActions=[...(state.recentActions||[]),body.actionId].slice(-256);const pub=publicState(state),data=JSON.stringify(state),publicData=JSON.stringify(pub);
 const result=old.version===0?await db().prepare('INSERT OR IGNORE INTO event_state(id,version,data,public_data) VALUES(1,1,?,?)').bind(data,publicData).run():await db().prepare('UPDATE event_state SET version=version+1,data=?,public_data=? WHERE id=1 AND version=?').bind(data,publicData,old.version).run();
 if(result.meta.changes!==1)return json({error:'Another update arrived. Refresh and review the score.'},409);rememberPublic({version:old.version+1,state:pub});return json({version:old.version+1,state:pub});
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof GameError)return json({error:e.message},400);return json({error:'Score update could not be confirmed. Check the latest score, then retry the saved update if needed.'},503);}}
