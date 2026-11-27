import assert from 'node:assert/strict';
import {initialState,normalizeState,transition,matchWinner} from '../lib/game.ts';

let state=initialState();
const id='footvolley-1';
const match=()=>state.matches.find(item=>item.id===id);
const act=(type,extra={})=>state=transition(state,{id,type,...extra});

assert.equal(state.matches.length,22);
assert.equal(state.matches[0].start,'09:30');
assert.equal(state.matches[14].end,'13:15');
assert.equal(state.matches[15].start,'13:45');
assert.equal(state.matches[20].end,'15:45');
assert.equal(state.matches[21].round,'Third Place');
assert.equal(state.matches[21].start,'15:45');
assert.equal(state.matches[21].end,'16:05');
const legacy=initialState();delete legacy.schemaVersion;legacy.matches=legacy.matches.filter(item=>item.id!=='footvolley-third-place');
const migrated=normalizeState(legacy);
assert.equal(migrated.matches.at(-1).round,'Third Place');
assert.equal(migrated.schemaVersion,2);
assert.equal(matchWinner([14,14]),null);
assert.equal(matchWinner([15,14]),null);
assert.equal(matchWinner([16,14]),0);

state=transition(state,{type:'addFixture',round:'Exhibition',teams:['Gamma','Delta'],start:'15:45',end:'16:05'});
assert.equal(state.matches.length,23);
assert.equal(state.matches.at(-1).n,23);
assert.equal(state.matches.at(-1).slot,'Exhibition · Match 23');
assert.deepEqual(state.matches.at(-1).teams,['Gamma','Delta']);
assert.throws(()=>transition(state,{type:'addFixture',round:'Exhibition',teams:['Gamma',''],start:'15:45',end:'16:05'}));
state=initialState();

act('fixture',{teams:['Alpha','Beta'],start:'09:30',end:'09:45'});
act('start');
assert.throws(()=>transition(state,{id:'footvolley-2',type:'start'}));
for(let point=0;point<14;point++)act('point',{team:0});
for(let point=0;point<14;point++)act('point',{team:1});
act('point',{team:0});
assert.equal(match().status,'live');
assert.deepEqual(match().points,[15,14]);
act('undo');
assert.deepEqual(match().points,[14,14]);
act('point',{team:0});
act('point',{team:0});
assert.equal(match().status,'finished');
assert.equal(match().winner,0);

act('undo');
assert.equal(match().status,'live');
act('correct',{points:[15,15]});
assert.equal(match().status,'live');
act('correct',{points:[17,15]});
assert.equal(match().status,'finished');
assert.equal(match().winner,0);

const before=structuredClone(match());
act('resetMatch',{confirmation:'RESET 1'});
assert.equal(match().status,'upcoming');
assert.deepEqual(match().points,[0,0]);
assert.deepEqual(match().teams,before.teams);
act('undo');
assert.deepEqual(match().points,before.points);

act('deleteMatch',{confirmation:'DELETE 1'});
assert.equal(state.matches.length,21);
assert.equal(state.matches[0].n,2);

console.log('Footvolley scoring source covers 22 fixtures including third place, migration, deuce, live-match locking, points, corrections, undo, reset and delete.');
