export type Declaration={target:number,actual:number,base:number,status:'active'|'success'|'failed'|'skipped',unusedBalls:number,wicketPenalty?:number};
export type Innings={team:number,runs:number,wickets:number,balls:number,events:string[],closed?:boolean,declaration?:Declaration};
export type Match={id:string,sport:'cricket',n:number,round:string,start:string,end:string,teams:[string,string],status:'upcoming'|'live'|'finished',innings:Innings[],winner?:number,history:string[]};
export type State={matches:Match[],updated:string|null,recentActions?:string[]};
const time=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export function initialState():State{return {matches:Array.from({length:15},(_,k)=>{const n=k+1,start=540+k*30+(n>8?30:0);return {id:`cricket-${n}`,sport:'cricket',n,round:n<=8?'Round 1':n<=12?'Quarter-final':n<=14?'Semi-final':'Grand final',start:time(start),end:time(start+30),teams:['',''],status:'upcoming',innings:[],history:[]};}),updated:null,recentActions:[]};}
// Retain existing cricket IDs, fixtures, score data and undo records when upgrading.
function extraEvent(event:string){return event==='Wd'||event==='Nb'||event.startsWith('Nb+')||event.includes(' ex');}
function wicketEvent(event:string){return event==='W'||event.endsWith(' W');}
function eventRuns(event:string){const value=event.match(/^\d+/);return value?Number(value[0]):event==='Wd'||event==='Nb'?1:event.startsWith('Nb+')?1+Number(event.slice(3)):0;}
function migrateDeclaration(i:Innings,d:Declaration){
 if(d.wicketPenalty!==undefined)return;
 if(d.status==='skipped'){d.wicketPenalty=0;return;}
 // Older releases included wicket deductions in target progress, but did not
 // subtract them from the match total. Recover the third-over deliveries so
 // existing scores get the corrected accounting when the next save occurs.
 const events=i.events||[];if(events.length>=120){d.wicketPenalty=0;return;}
 let legalBefore=0,wicketsBefore=0,start=-1;
 for(let n=0;n<events.length;n++){
  const e=events[n];if(legalBefore>=12){start=n;break;}
  if(wicketEvent(e))wicketsBefore++;if(!extraEvent(e))legalBefore++;
 }
 if(start<0){d.wicketPenalty=0;return;}
 const oldStatus=d.status,wasActive=oldStatus==='active';
 let actual=0,wickets=0,legal=0,oldNet=0,boundary=events.length,rawTargetAt=-1,rawRuns=0,rawWickets=0,rawLegal=0;
 for(let n=start;n<events.length;n++){
  const e=events[n],runs=eventRuns(e),isWicket=wicketEvent(e),isLegal=!extraEvent(e);
  actual+=runs;if(isWicket)wickets++;if(isLegal)legal++;oldNet+=runs-(isWicket?5:0);
  if(rawTargetAt<0&&actual>=d.target){rawTargetAt=n;rawRuns=actual;rawWickets=wickets;rawLegal=legal;}
  if(oldStatus==='success'&&oldNet>=d.target){boundary=n+1;break;}
  if(oldStatus==='failed'&&(legal>=6||wicketsBefore+wickets>=7)){boundary=n+1;break;}
 }
 const hasRawSuccess=rawTargetAt>=0;
 d.actual=hasRawSuccess?rawRuns:actual;
 d.wicketPenalty=5*(hasRawSuccess?rawWickets:wickets);
 if(hasRawSuccess){d.status='success';i.wickets=Math.max(0,i.wickets-(wickets-rawWickets));}
 else if(!wasActive)d.status='failed';
 if(hasRawSuccess)d.unusedBalls=Math.max(0,6-rawLegal);
 let laterRuns=0;
 if(!wasActive)for(let n=boundary;n<events.length;n++)laterRuns+=eventRuns(events[n]);
 i.runs=d.base-d.wicketPenalty+(d.status==='success'?2*d.target:0)+laterRuns;
 if(d.status==='active'&&hasRawSuccess)i.balls=18;
}
export function normalizeState(s:State):State{return {...s,matches:s.matches.filter(m=>m.sport==='cricket').map(m=>{const {points,...clean}=m as Match & {points?:unknown};for(const inning of clean.innings){if(inning.declaration?.status==='active'&&inning.balls<12)delete inning.declaration;if(inning.declaration)migrateDeclaration(inning,inning.declaration);}return clean;}),recentActions:s.recentActions||[]};}
export const freshInnings=(team:number):Innings=>({team,runs:0,wickets:0,balls:0,events:[]});
export const limits=(m:Match)=>m.innings.length>2?{balls:6,wickets:2}:{balls:30,wickets:7};
export function inningsDone(m:Match){const i=m.innings.at(-1);if(!i)return false;const l=limits(m);return !!i.closed||i.balls>=l.balls||i.wickets>=l.wickets||(m.innings.length%2===0&&i.runs>m.innings.at(-2)!.runs);}
export function outcome(m:Match):number|'tie'|null{if(!m.innings.length||m.innings.length%2!==0||!inningsDone(m))return null;const a=m.innings.at(-2)!,b=m.innings.at(-1)!;return a.runs===b.runs?'tie':a.runs>b.runs?a.team:b.team;}
export function needsDeclaration(m:Match){const i=m.innings.at(-1);return m.innings.length<=2&&!!i&&i.balls===12&&!i.declaration&&!inningsDone(m);}
function settle(i:Innings){const d=i.declaration;if(!d||d.status!=='active')return;const penalty=d.wicketPenalty||0;if(d.actual>=d.target){d.status='success';d.unusedBalls=Math.max(0,18-i.balls);i.runs=d.base-penalty+2*d.target;i.balls=18;}else if(i.balls>=18||i.wickets>=7||i.closed){d.status='failed';i.runs=d.base-penalty;}}
export class GameError extends Error{}
const assert=(v:unknown,msg:string)=>{if(!v)throw new GameError(msg);};
const num=(v:unknown,max:number)=>{assert(Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=max,'Invalid score.');return Number(v);};
export function transition(input:State,action:any):State{
 assert(action&&typeof action==='object','Invalid action.');const state=normalizeState(structuredClone(input));
 if(action.type==='resetTournament'){
  assert(action.confirmation==='RESET ALL','Type RESET ALL to confirm.');
  for(const match of state.matches){const {history,...before}=match;match.history=[...history,JSON.stringify(before)].slice(-120);match.innings=[];match.status='upcoming';delete match.winner;}
  state.updated=new Date().toISOString();return state;
 }
 const m=state.matches.find(x=>x.id===action.id);assert(m,'Match not found.');if(!m)return state;
 if(action.type==='deleteMatch'){
  assert(action.confirmation===`DELETE ${m.n}`,'Type the match deletion confirmation.');
  state.matches=state.matches.filter(x=>x.id!==m.id);state.updated=new Date().toISOString();return state;
 }
 if(action.type==='undo'){assert(m.history.length,'Nothing to undo.');const old=JSON.parse(m.history.pop()!);assert(old.status!=='live'||!state.matches.some(x=>x.id!==m.id&&x.status==='live'),'Finish the other live match before undoing this result.');delete m.winner;Object.assign(m,old);}
 else{
  const {history,...before}=m;m.history=[...history,JSON.stringify(before)].slice(-120);
  if(action.type==='resetMatch'){
   assert(action.confirmation===`RESET ${m.n}`,'Type the match reset confirmation.');
   m.innings=[];m.status='upcoming';delete m.winner;
  }else if(action.type==='fixture'){
   assert(m.status==='upcoming','Only upcoming fixtures can be edited.');assert(Array.isArray(action.teams)&&action.teams.length===2&&action.teams.every((t:any)=>typeof t==='string'&&t.trim().length<=60),'Team names must be at most 60 characters.');
   assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(action.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(action.end)&&action.start<action.end,'Enter valid start and end times.');m.teams=action.teams.map((t:string)=>t.trim());m.start=action.start;m.end=action.end;
  }else if(action.type==='start'){
   assert(m.status==='upcoming'&&m.teams.every(Boolean)&&m.teams[0]!==m.teams[1],'Enter two different teams before starting.');assert(!state.matches.some(x=>x.status==='live'),'Finish the current live match first.');m.status='live';m.innings=[freshInnings(num(action.firstBat,1))];
  }else{
   assert(m.status==='live','This match is not live.');const i=m.innings.at(-1)!;
   if(action.type==='declare'){
    assert(needsDeclaration(m),'Declare only before the third over starts.');const target=num(action.target,999);assert(target>0,'A positive target is required.');i.declaration={target,actual:0,base:i.runs,status:'active',unusedBalls:0,wicketPenalty:0};
    }else if(action.type==='targetDelivery'){
    assert(i.declaration?.status==='active'&&i.balls>=12&&!inningsDone(m),'Typed deliveries require an active third-over target.');
    const runs=num(action.runs,99),wickets=num(action.wickets,1);
    const legacyDelivery=action.delivery===undefined;
    const delivery=legacyDelivery?(action.legal===1?'legal':'wide'):action.delivery;
    if(legacyDelivery)assert(action.legal===0||action.legal===1,'Invalid delivery type.');
    assert(['legal','wide','noball'].includes(delivery),'Choose a legal ball, wide or no-ball.');
    if(legacyDelivery&&delivery!=='legal')assert(runs>=1,'A wide or no-ball must include its one-run penalty.');
    const creditedRuns=legacyDelivery?runs:runs+(delivery==='legal'?0:1);
    i.declaration!.actual+=creditedRuns;i.declaration!.wicketPenalty=(i.declaration!.wicketPenalty||0)+5*wickets;i.runs-=5*wickets;i.balls+=delivery==='legal'?1:0;i.wickets+=wickets;
    const extra=delivery==='wide'?' Wd ex':delivery==='noball'?' Nb ex':'';
    i.events=[...i.events,`${creditedRuns}${extra}${wickets?' W':''}`].slice(-120);settle(i);
   }else if(action.type==='ball'){
    assert(i.declaration?.status!=='active','Normal scoring buttons are locked until the third-over target is reached or the over ends.');
    assert(!inningsDone(m),'This innings is complete.');assert(!needsDeclaration(m),'Enter a third-over target before play can continue.');assert(['run','wide','noball','wicket'].includes(action.kind),'Invalid delivery.');
    let runs=0,event='';if(action.kind==='wide'){runs=1;event='Wd';}else if(action.kind==='noball'){const bat=num(action.runs??0,12);runs=1+bat;event=bat?`Nb+${bat}`:'Nb';}else if(action.kind==='run'){runs=num(action.runs,12);assert([0,1,2,3,4,5,6,12].includes(runs),'Invalid run option.');i.balls++;event=String(runs);}else{i.balls++;i.wickets++;event='W';}
    if(i.declaration?.status==='active')i.declaration.actual+=runs;else i.runs+=runs;i.events=[...i.events,event].slice(-120);settle(i);
   }else if(action.type==='correct'){
    const balls=num(action.balls,limits(m).balls),wickets=num(action.wickets,limits(m).wickets),runs=num(action.runs,9999);const d=i.declaration;
    assert(d?.status!=='active','Use Undo to reopen an active betting over before correcting the score.');
    if(d&&d.status!=='skipped')assert(balls===i.balls&&wickets===i.wickets,'After the betting over settles, correct the total only. Use Undo to change balls or wickets.');
    else if(d?.status==='skipped'&&balls<12)delete i.declaration;
    i.runs=runs;i.wickets=wickets;i.balls=balls;if(!d||d.status==='skipped')i.closed=false;i.events.push('Edit');settle(i);
   }else if(action.type==='closeInnings'){i.closed=true;settle(i);}
   else if(action.type==='next'){assert(m.innings.length%2===1&&inningsDone(m),'Complete the first innings before switching.');m.innings.push(freshInnings(1-i.team));}
   else if(action.type==='super'){assert(outcome(m)==='tie','Super Over requires a tied result.');m.innings.push(freshInnings(num(action.firstBat,1)));}
   else if(action.type==='finish'){const winner=outcome(m);assert(typeof winner==='number','A winning score is required.');m.winner=winner as number;m.status='finished';}
   else throw new GameError('Unknown scoring action.');
  }
 }
 state.updated=new Date().toISOString();return normalizeState(state);
}
export function publicState(state:State){return {updated:state.updated,matches:normalizeState(state).matches.map(({history,...m})=>({...m,innings:m.innings.map(i=>({...i,events:i.events.slice(-10)})),canUndo:history.length>0}))};}
