export type Match={id:string,n:number,round:string,slot:string,start:string,end:string,teams:[string,string],status:'upcoming'|'live'|'finished',points:[number,number],winner?:number,resolution?:'walkover'|'no-result',history:string[],canUndo?:boolean};
export type State={matches:Match[],updated:string|null,recentActions:string[],schemaVersion?:number};
const clock=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
function fixture(n:number,start:number,duration:number){
 const round=n<=10?'Round 1':n<=15?'Round 2':n<=18?'Round 3':n<=20?'Round 4':'Grand Final';
 const note=n===18?' · Best Loser 1':n===20?' · Best Loser 2':'';
 return {id:`footvolley-${n}`,n,round,slot:`${round} · Match ${n}${note}`,start:clock(start),end:clock(start+duration),teams:['',''] as [string,string],status:'upcoming' as const,points:[0,0] as [number,number],history:[] as string[]};
}
export function initialState():State{
 const matches:Match[]=[];
 for(let k=0;k<10;k++)matches.push(fixture(k+1,570+k*15,15));
 for(let k=0;k<5;k++)matches.push(fixture(k+11,720+k*15,15));
 for(let k=0;k<6;k++)matches.push(fixture(k+16,825+k*20,20));
 matches.push({id:'footvolley-third-place',n:22,round:'Third Place',slot:'Third Place · Match 22',start:'15:45',end:'16:05',teams:['',''],status:'upcoming',points:[0,0],history:[]});
 return {matches,updated:null,recentActions:[],schemaVersion:2};
}
export function normalizeState(input:State):State{
 const state=structuredClone(input);
 state.recentActions=state.recentActions||[];
 for(const match of state.matches)match.history=match.history||[];
 if((state.schemaVersion||1)<2&&!state.matches.some(match=>match.id==='footvolley-third-place'))state.matches.push({id:'footvolley-third-place',n:Math.max(21,...state.matches.map(match=>match.n))+1,round:'Third Place',slot:`Third Place · Match ${Math.max(21,...state.matches.map(match=>match.n))+1}`,start:'15:45',end:'16:05',teams:['',''],status:'upcoming',points:[0,0],history:[]});
 state.schemaVersion=2;return state;
}
export function matchWinner(points:[number,number]):number|null{
 if(points[0]>=15&&points[0]-points[1]>=2)return 0;
 if(points[1]>=15&&points[1]-points[0]>=2)return 1;
 return null;
}
export class GameError extends Error{}
const assert=(ok:unknown,message:string)=>{if(!ok)throw new GameError(message);};
const safePoints=(v:unknown)=>{assert(Array.isArray(v)&&v.length===2&&v.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=999),'Enter valid scores.');return v as [number,number];};
export function transition(input:State,action:any):State{
 assert(action&&typeof action==='object','Invalid action.');
 const state=normalizeState(input);
 if(action.type==='addFixture'){
  assert(Array.isArray(action.teams)&&action.teams.length===2&&action.teams.every((t:any)=>typeof t==='string'&&t.trim().length>0&&t.trim().length<=60),'Enter both team names (up to 60 characters).');
  assert(typeof action.round==='string'&&action.round.trim().length>0&&action.round.trim().length<=60,'Enter a round name (up to 60 characters).');
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(action.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(action.end)&&action.start<action.end,'Enter valid start and end times.');
  const n=Math.max(0,...state.matches.map(match=>match.n))+1,round=action.round.trim();
  state.matches.push({id:`footvolley-${n}-${Date.now()}`,n,round,slot:`${round} · Match ${n}`,start:action.start,end:action.end,teams:action.teams.map((t:string)=>t.trim()) as [string,string],status:'upcoming',points:[0,0],history:[]});
  state.updated=new Date().toISOString();return state;
 }
 if(action.type==='resetTournament'){
  assert(action.confirmation==='RESET ALL','Type RESET ALL to confirm.');
  for(const m of state.matches){const {history,...before}=m;m.history=[...history,JSON.stringify(before)].slice(-120);m.status='upcoming';m.points=[0,0];delete m.winner;delete m.resolution;}
  state.updated=new Date().toISOString();return state;
 }
 const m=state.matches.find(x=>x.id===action.id);assert(m,'Match not found.');if(!m)return state;
 if(action.type==='deleteMatch'){
  assert(action.confirmation===`DELETE ${m.n}`,'Type the match deletion confirmation.');
  state.matches=state.matches.filter(x=>x.id!==m.id);state.updated=new Date().toISOString();return state;
 }
 if(action.type==='undo'){
  assert(m.history.length,'Nothing to undo.');const old=JSON.parse(m.history.pop()!);assert(old.status!=='live'||!state.matches.some(x=>x.id!==m.id&&x.status==='live'),'Finish the other live match first.');delete m.winner;delete m.resolution;Object.assign(m,old);
 }else{
  const {history,...before}=m;m.history=[...history,JSON.stringify(before)].slice(-120);
  if(action.type==='absence'){
   assert(m.status==='upcoming','Record attendance before starting the match.');
   assert(action.confirmation==='CONFIRM ABSENCE','Confirm the attendance result.');
   assert(action.winner===0||action.winner===1||action.winner===null,'Select the attending team or neither team.');
   if(action.winner!==null)assert(!!m.teams[action.winner]?.trim(),'Enter the attending team name first.');
   m.status='finished';m.resolution=action.winner===null?'no-result':'walkover';
   if(action.winner===null)delete m.winner;else m.winner=action.winner;
  }else if(action.type==='fixture'){
   assert(m.status==='upcoming','Only upcoming fixtures can be edited.');
   assert(Array.isArray(action.teams)&&action.teams.length===2&&action.teams.every((t:any)=>typeof t==='string'&&t.trim().length>0&&t.trim().length<=60),'Enter both team names (up to 60 characters).');
   assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(action.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(action.end)&&action.start<action.end,'Enter valid start and end times.');
   m.teams=action.teams.map((t:string)=>t.trim()) as [string,string];m.start=action.start;m.end=action.end;
  }else if(action.type==='start'){
   assert(m.status==='upcoming'&&m.teams.every(Boolean)&&m.teams[0]!==m.teams[1],'Enter two different teams before starting.');
   assert(!state.matches.some(x=>x.status==='live'),'Finish the current live match first.');m.status='live';m.points=[0,0];delete m.winner;delete m.resolution;
  }else if(action.type==='point'){
   assert(m.status==='live','This match is not live.');assert(action.team===0||action.team===1,'Choose a team.');
   m.points[action.team]++;const winner=matchWinner(m.points);if(winner!==null){m.status='finished';m.winner=winner;}
  }else if(action.type==='correct'){
   assert(m.status==='live','Only a live score can be corrected.');m.points=safePoints(action.points);const winner=matchWinner(m.points);if(winner!==null){m.status='finished';m.winner=winner;}else{m.status='live';delete m.winner;delete m.resolution;}
  }else if(action.type==='resetMatch'){
   assert(action.confirmation===`RESET ${m.n}`,'Type the match reset confirmation.');m.status='upcoming';m.points=[0,0];delete m.winner;delete m.resolution;
  }else throw new GameError('Unknown match action.');
 }
 state.updated=new Date().toISOString();return state;
}
export function publicState(input:State){const state=normalizeState(input);return {updated:state.updated,schemaVersion:state.schemaVersion,matches:state.matches.map(({history,...m})=>({...m,canUndo:history.length>0}))};}
