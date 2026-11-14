import {test} from "node:test";
import assert from "node:assert/strict";
import type { PhysicalComponent, PayloadProfile } from "@workspace/mission-physics";
import type { GameConnection } from "./database";
import { requireKnownPayloadFeasible, sessionPayloadCapacity } from "./payload-capacity";

test("server computes quality references for proposed instruments/fuel without adding purchase gates",async()=>{
  const parts=new Map<string,PhysicalComponent>([
    ["test-body",{id:"test-body",name:"Synthetic body",categoryId:"rocket-body",massKg:100}],
    ["test-main",{id:"test-main",name:"Synthetic engine",categoryId:"main-engines",massKg:10,thrustN:100000,specificImpulseSeconds:350}],
    ["test-stage",{id:"test-stage",name:"Synthetic stage",categoryId:"rocket-stages",massKg:20}],
  ]);
  const profiles:Record<string,PayloadProfile>={"test-stage":{source:"Synthetic test only",stages:[{
    id:"one",componentCategoryIds:["rocket-body","main-engines","rocket-stages"],engineCategoryIds:["main-engines"],fuelFraction:1,
  }],burns:[
    {id:"launch",stageId:"one",phase:"LAUNCH",requiredDeltaVMps:1000,separateStageIds:[]},
    {id:"landing",stageId:"one",phase:"LUNAR_LANDING",requiredDeltaVMps:500,separateStageIds:[]},
    {id:"return",stageId:"one",phase:"EARTH_RETURN",requiredDeltaVMps:500,separateStageIds:[]},
  ]}};
  const catalog={components:parts,profiles};
  const rows:Record<string,unknown>={
    game_session_builds:{selected_hull_id:"test-body"},
    game_session_rocket_assemblies:{selections:{"rocket-stages":"test-stage","main-engines":"test-main"}},
    game_session_science_loadouts:{instrument_ids:[]},
    game_session_fuel_loads:{opened:true,loaded_kg:1000},
  };
  const db={selectFrom(table:string){const query={select(){return query;},where(){return query;},async executeTakeFirst(){return rows[table];}};return query;}} as unknown as GameConnection;
  const saved=await sessionPayloadCapacity(db,"synthetic",{},catalog);
  assert.equal(saved.status,"COMPLETE");assert.equal(saved.currentPayloadKg,0);assert.equal(saved.totalMassKg,1130);
  const draft=await requireKnownPayloadFeasible(db,"synthetic",{instrumentIds:["panchromatic-camera"]},catalog);
  assert.equal(draft.currentPayloadKg,3);assert.equal(draft.totalMassKg,1133);
  const lowFuel=await requireKnownPayloadFeasible(db,"synthetic",{instrumentIds:["panchromatic-camera"],fuelKg:1},catalog);
  assert.ok(lowFuel.warnings.includes("INSUFFICIENT DELTA-V"));
  assert.equal(lowFuel.basis,"QUALITY");
  parts.set("test-body",{...parts.get("test-body")!,massKg:null});
  const missing=await requireKnownPayloadFeasible(db,"synthetic",{},catalog);
  assert.equal(missing.status,"COMPLETE");assert.ok(Number.isFinite(missing.maximumPayloadKg));
  assert.equal(missing.basis,"QUALITY");assert.deepEqual(missing.missingData,[]);
});
