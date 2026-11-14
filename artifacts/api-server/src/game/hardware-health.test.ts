import { test } from "node:test";
import assert from "node:assert/strict";
import { rocketCatalog, rocketOptions, componentCategories } from "./rocket-catalog";
import { makeOperations } from "./lunar-operations-model";
import { resolveHardwareHealth, returnBlockers } from "./hardware-health";

const selections = Object.fromEntries(componentCategories.map(c=>[c.id,c.options[0].id]));
selections["rocket-body"]="falcon-shadow";

test("every catalog part has bounded game risk and higher quality means lower damage risk",()=>{
  for (const category of rocketCatalog.flatMap(s=>s.categories)) {
    const sorted=[...category.options].filter(c=>c.quality!==null).sort((a,b)=>a.quality!-b.quality!);
    for (let i=1;i<sorted.length;i++) assert.ok(sorted[i].damageRisk<=sorted[i-1].damageRisk);
    for (const c of category.options) assert.ok(c.damageRisk>=2&&c.damageRisk<=50);
  }
  const cheapest=rocketOptions.filter(c=>c.categoryId==="scientific-instruments").sort((a,b)=>a.price-b.price)[0];
  assert.equal(cheapest.damageRisk,50);
  assert.equal(rocketOptions.find(c=>c.id==="falcon-shadow")?.damageRisk,25);
});

test("all installed parts resolve independently exactly once, with precise 50/50 for the cheapest tier",()=>{
  let damaged=0;
  const id=selections["scientific-instruments"];
  for(let i=0;i<100;i++) {
    const o=makeOperations(selections,[],0);
    let draws=0;
    resolveHardwareHealth(o,selections,()=>{draws++;return(i+0.5)/100;});
    assert.equal(draws,Object.keys(selections).length);
    if(o.hardwareChecks!.find(c=>c.id===id)?.status==="DAMAGED")damaged++;
    const saved=JSON.parse(JSON.stringify(o));
    resolveHardwareHealth(saved,selections,()=>{throw new Error("Must not reroll after reload");});
    assert.deepEqual(saved,o);
    assert.equal(o.equipment.find(e=>e.id===id)?.status,o.hardwareChecks!.find(c=>c.id===id)?.status);
  }
  assert.equal(damaged,50);
});

test("damaged return hardware blocks return, discarded launch hardware and scientific payload do not",()=>{
  const o=makeOperations(selections,[],0);
  resolveHardwareHealth(o,selections,()=>0);
  const blockers=returnBlockers(o);
  assert.ok(blockers.some(c=>c.categoryId==="lunar-ascent-system"));
  assert.ok(blockers.some(c=>c.categoryId==="onboard-computer"));
  assert.ok(blockers.some(c=>c.categoryId==="return-capsule"));
  assert.ok(!blockers.some(c=>["main-engines","rocket-stages","rocket-body","scientific-instruments","payload-fairing"].includes(c.categoryId)));
  for(const c of o.hardwareChecks!) if(c.critical)c.status="OPERATIONAL";
  assert.deepEqual(returnBlockers(o),[]);
});

test("legacy reports and flights already returning are not retroactively damaged",()=>{
  for(const outbound of [true,false]) {
    const o=makeOperations(selections,[],0);
    if(outbound) o.returnStartedAt=new Date().toISOString();
    else o.results={success:false} as NonNullable<typeof o.results>;
    resolveHardwareHealth(o,selections,()=>{throw new Error("Legacy save must not draw");});
    assert.equal(o.hardwareChecks,undefined);
  }
});
