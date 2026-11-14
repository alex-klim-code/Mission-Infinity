import {test} from "node:test";
import assert from "node:assert/strict";
import {mainPropellantIssue} from "./propellant-compatibility";

const part=(id:string,systems:string[][],documented=true)=>({
  id,name:id,fuel:{role:"engine" as const,status:documented?"documented" as const:"unverified" as const,
    systems,sourceText:"",sourceLocation:""},
});
test("main propellant incompatibilities require documented, different complete fuel systems",()=>{
  const engine=part("Hydrogen engine",[["lh2","lox"]]);
  const tank=part("Methane tank",[["methane","lox"]]);
  const issue=mainPropellantIssue(engine,tank)!;
  assert.deepEqual(issue.categoryIds,["main-engines","fuel-tanks"]);
  assert.deepEqual(issue.optionIds,[engine.id,tank.id]);
  assert.match(issue.message,/will fail/);
  assert.equal(mainPropellantIssue(engine,part("Hydrogen tank",[["lox","lh2"]])),null);
  assert.equal(mainPropellantIssue(part("Electric engine",[["xenon"],["krypton"]]),part("Krypton tank",[["krypton"]])),null);
});
test("unverified, empty and absent data are not proof of incompatibility",()=>{
  const engine=part("Rutherford",[["rp-1","lox"]]);
  assert.equal(mainPropellantIssue(engine,part("LUNA Compact",[],false)),null);
  assert.equal(mainPropellantIssue(engine,part("Empty source",[])),null);
  assert.equal(mainPropellantIssue(engine,part("Invalid source",[[]])),null);
  assert.equal(mainPropellantIssue(undefined,part("Tank",[["methane","lox"]])),null);
});
