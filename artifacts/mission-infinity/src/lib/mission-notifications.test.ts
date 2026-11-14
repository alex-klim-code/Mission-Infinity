import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameSession, RocketComponent } from '@workspace/api-client-react';
import { collectNotifications, mergeNotifications, notificationKey, type NotificationSeed } from './mission-notifications';

const warning:NotificationSeed={id:'conflict',title:'Conflict',message:'Engine A cannot use tank B',severity:'warning',category:'Engineering',scope:'live'};
test('notification polling deduplicates, preserves read status and archives resolved issues',()=>{
  const first=mergeNotifications([],[warning],'2026-11-14T00:00:00Z',true);
  const read=first.map(n=>({...n,read:true}));
  assert.deepEqual(mergeNotifications(read,[warning],'2026-11-15T00:00:00Z',true),read);
  const resolved=mergeNotifications(read,[],'2026-11-15T00:00:00Z',true);
  assert.equal(resolved[0].active,false);
  assert.equal(resolved[0].read,true);
  const again=mergeNotifications(resolved,[warning],'2026-11-16T00:00:00Z',true);
  assert.equal(again.length,1);assert.equal(again[0].read,false);assert.equal(again[0].active,true);
});
test('preview events survive reconciliation and history is bounded and user/room scoped',()=>{
  const event={...warning,id:'preview',scope:'event' as const};
  const log=mergeNotifications([],[event],'2026-11-14T00:00:00Z');
  assert.equal(mergeNotifications(log,[],undefined,true).length,1);
  assert.equal(log[0].active,false);
  assert.notEqual(notificationKey('room1','player1'),notificationKey('room1','player2'));
  assert.notEqual(notificationKey('room1','player1'),notificationKey('room2','player1'));
  assert.equal(mergeNotifications([],Array.from({length:210},(_,i)=>({...event,id:String(i)}))).length,200);
});
test('selected-part chemistry conflicts include both names and reason, without flagging a compatible pair',()=>{
  const part=(id:string,categoryId:string,systems:string[][])=>({
    id,name:id,categoryId,fuel:{role:categoryId==='fuel-tanks'?'tank':'engine',status:'documented',systems},
  }) as RocketComponent;
  const engine=part('Hydrogen Engine','main-engines',[['lh2','lox']]);
  const badTank=part('Methane Tank','fuel-tanks',[['methane','lox']]);
  const s={engineering:{issues:[],checks:[]}} as unknown as GameSession;
  const alerts=collectNotifications(s,[engine,badTank]);
  assert.equal(alerts.length,1);
  assert.match(alerts[0].message,/Hydrogen Engine/);assert.match(alerts[0].message,/Methane Tank/);
  assert.match(alerts[0].message,/cannot supply/);
  assert.equal(collectNotifications(s,[engine,part('Hydrogen Tank','fuel-tanks',[['lh2','lox']])]).length,0);
});
