import {test} from "node:test";
import assert from "node:assert/strict";
import {consumeGameRate,gameRatePolicy} from "./rate-policy";
test("real-time controls have an independent bounded rate budget, other writes retain their protection",()=>{
  assert.deepEqual(gameRatePolicy("POST","/api/game/sessions/own-room/actions"),{bucket:"controls",limit:600});
  for(const path of ["/api/game/character","/api/game/sessions","/api/game/friends","/api/game/sessions/own-room/messages"])
    assert.deepEqual(gameRatePolicy("POST",path),{bucket:"write",limit:80});
  assert.deepEqual(gameRatePolicy("GET","/api/game/sessions/own-room"),{bucket:"read",limit:240});
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
