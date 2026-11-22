import assert from 'node:assert/strict';
import {initialState,transition,outcome,inningsDone,needsDeclaration,normalizeState} from '../lib/game.ts';

let state;
const id='cricket-1';
const match=()=>state.matches[0];
const inning=()=>match().innings.at(-1);
const act=(type,extra={})=>state=transition(state,{id,type,...extra});
function ready(runs=20,wickets=0){
 state=initialState();
 act('fixture',{teams:['Alpha','Beta'],start:'09:00',end:'09:30'});
 act('start',{firstBat:0});
 act('correct',{runs,wickets,balls:12});
}
function target(runs,{delivery='legal',wickets=0}={}){
 return act('targetDelivery',{runs,delivery,wickets});
}

assert.equal(initialState().matches.length,15);
assert.equal(initialState().matches[8].start,'13:30');
assert.equal(initialState().matches[14].end,'17:00');

state=initialState();
state=transition(state,{type:'addFixture',round:'Exhibition',teams:['Gamma','Delta'],start:'17:00',end:'17:30'});
assert.equal(state.matches.length,16);
assert.equal(state.matches.at(-1).n,16);
assert.equal(state.matches.at(-1).round,'Exhibition');
assert.deepEqual(state.matches.at(-1).teams,['Gamma','Delta']);
assert.throws(()=>transition(state,{type:'addFixture',round:'',teams:['Gamma','Delta'],start:'17:00',end:'17:30'}));

// A target is mandatory after 2.0 overs, and success settles immediately.
ready();
assert(needsDeclaration(match()));
assert.throws(()=>act('ball',{kind:'run',runs:4}));
act('declare',{target:8});
target(4);
assert.equal(inning().runs,20);
target(4);
assert.equal(inning().runs,36);
assert.equal(inning().balls,18);
assert.equal(inning().declaration.unusedBalls,4);
act('undo');
assert.equal(inning().runs,20);
assert.equal(inning().balls,13);
assert.equal(inning().declaration.status,'active');

// Undoing from the third over to 2.0 removes its form and target.
act('undo');
act('undo');
assert.equal(inning().balls,12);
assert.equal(inning().declaration,undefined);
assert(needsDeclaration(match()));

// Six legal balls without success award no target runs; regular play resumes.
ready();
act('declare',{target:8});
for(let n=0;n<6;n++)target(1);
assert.equal(inning().runs,20);
assert.equal(inning().declaration.status,'failed');
act('ball',{kind:'run',runs:12});
assert.equal(inning().runs,32);
assert.equal(inning().balls,19);

// Wide/no-ball penalties are added by the server and do not consume legal balls.
ready();
act('declare',{target:3});
target(0,{delivery:'wide'});
assert.equal(inning().declaration.actual,1);
assert.equal(inning().balls,12);
target(2,{delivery:'noball'});
assert.equal(inning().declaration.actual,4);
assert.equal(inning().runs,26);
assert.equal(inning().balls,18);
assert.equal(inning().declaration.unusedBalls,6);

// Wickets deduct five from the overall total but never increase target progress.
ready(20,6);
act('declare',{target:10});
target(0,{wickets:1});
assert.equal(inning().runs,15);
assert.equal(inning().declaration.actual,0);
assert.equal(inning().declaration.wicketPenalty,5);
assert.equal(inning().wickets,7);
assert.equal(inning().declaration.status,'failed');

ready(20,0);
act('declare',{target:10});
target(0,{wickets:1});
target(4);
target(3);
target(3);
assert.equal(inning().declaration.status,'success');
assert.equal(inning().declaration.actual,10);
assert.equal(inning().declaration.wicketPenalty,5);
assert.equal(inning().runs,35);

// Active target corrections are rejected; settled corrections can adjust total only.
ready();
act('declare',{target:8});
assert.throws(()=>act('correct',{runs:20,wickets:0,balls:12,actual:4}));
target(8);
act('correct',{runs:31,wickets:0,balls:18});
assert.equal(inning().runs,31);
assert.equal(inning().declaration.status,'success');
assert.throws(()=>act('correct',{runs:31,wickets:1,balls:18}));
assert.throws(()=>act('correct',{runs:31,wickets:0,balls:17}));

// Chase result and repeat Super Overs.
ready();
act('correct',{runs:30,wickets:0,balls:30});
act('next');
act('correct',{runs:20,wickets:0,balls:12});
act('declare',{target:8});
target(6);
assert.equal(outcome(match()),null);
target(2);
assert.equal(outcome(match()),1);
act('finish');
assert.equal(match().winner,1);
act('undo');
assert.equal(match().status,'live');

ready();
act('correct',{runs:20,wickets:0,balls:30});
act('next');
act('correct',{runs:20,wickets:0,balls:30});
assert.equal(outcome(match()),'tie');
act('super',{firstBat:1});
assert.throws(()=>act('declare',{target:8}));
act('ball',{kind:'run',runs:12});
assert.equal(inning().runs,12);
act('correct',{runs:12,wickets:2,balls:2});
act('next');
act('correct',{runs:12,wickets:0,balls:6});
assert.equal(outcome(match()),'tie');
act('super',{firstBat:0});
assert.equal(match().innings.length,5);

// Legacy public/state migration receives the complete private event history.
state=initialState();
act('fixture',{teams:['Alpha','Beta'],start:'09:00',end:'09:30'});
act('start',{firstBat:0});
for(let ball=0;ball<12;ball++)act('ball',{kind:'run',runs:0});
act('declare',{target:3});
target(0,{wickets:1});
const legacy=structuredClone(state);
delete legacy.matches[0].innings[0].declaration.wicketPenalty;
legacy.matches[0].innings[0].runs=20;
legacy.matches[0].innings[0].declaration.base=20;
const migrated=normalizeState(legacy).matches[0].innings[0];
assert.equal(migrated.declaration.wicketPenalty,5);
assert.equal(migrated.runs,15);

console.log('Scoring cases cover declaration, extras, wicket penalties, correction, undo, chase and Super Overs.');
