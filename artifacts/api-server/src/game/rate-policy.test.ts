import {test} from "node:test";
import assert from "node:assert/strict";
import {consumeGameRate,gameRatePolicy,gameRateRetryAfter} from "./rate-policy";
test("real-time controls have an independent bounded rate budget, other writes retain their protection",()=>{
  assert.deepEqual(gameRatePolicy("POST","/api/game/sessions/own-room/actions"),{bucket:"controls",limit:600});
  for(const path of ["/api/game/character","/api/game/sessions","/api/game/friends","/api/game/sessions/own-room/messages"])
    assert.deepEqual(gameRatePolicy("POST",path),{bucket:"write",limit:80});
  assert.deepEqual(gameRatePolicy("GET","/api/game/sessions/own-room"),{bucket:"telemetry",limit:600});
  assert.deepEqual(gameRatePolicy("GET","/api/game/sessions/own-room/demo-plan"),{bucket:"telemetry",limit:600});
  for(const path of ["/api/game/me","/api/game/social","/api/game/sessions/own-room/messages"])
    assert.deepEqual(gameRatePolicy("GET",path),{bucket:"read",limit:240});
});
test("two live tabs fit a full minute without starving account reads; telemetry is still bounded",()=>{
  const windows=new Map<string,{count:number;until:number}>();
  for(let n=0;n<60;n++){
    const now=10_000+n*1000;
    // Two tabs, each with poll, room events and DEMO-plan refreshes.
    for(let reads=0;reads<6;reads++)
      assert.equal(consumeGameRate(windows,"pilot:telemetry",600,now),true);
    for(let controls=0;controls<6;controls++)
      assert.equal(consumeGameRate(windows,"pilot:controls",600,now),true);
    assert.equal(consumeGameRate(windows,"pilot:read",240,now),true);
  }
  for(let n=360;n<600;n++)assert.equal(consumeGameRate(windows,"pilot:telemetry",600,69_000),true);
  assert.equal(consumeGameRate(windows,"pilot:telemetry",600,69_000),false);
  assert.equal(gameRateRetryAfter(windows,"pilot:telemetry",69_000),1);
  assert.equal(consumeGameRate(windows,"other:telemetry",600,69_000),true);
  assert.equal(consumeGameRate(windows,"pilot:read",240,69_000),true);
  assert.equal(consumeGameRate(windows,"pilot:telemetry",600,70_000),true);
});
test("a full minute of landing ticks and slider commands fits without allowing unbounded traffic",()=>{
  const windows=new Map<string,{count:number;until:number}>();
  for(let n=0;n<320;n++)assert.equal(consumeGameRate(windows,"pilot:controls",600,10000+n*100),true);
  assert.equal(consumeGameRate(windows,"pilot:write",80,43000),true);
  for(let n=320;n<600;n++)assert.equal(consumeGameRate(windows,"pilot:controls",600,45000),true);
  assert.equal(consumeGameRate(windows,"pilot:controls",600,45000),false);
  assert.equal(consumeGameRate(windows,"other-pilot:controls",600,45000),true);
  assert.equal(consumeGameRate(windows,"pilot:controls",600,71000),true);
});
