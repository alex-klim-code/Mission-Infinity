import { test } from "node:test";
import assert from "node:assert/strict";
import { GetGameCatalogResponse } from "@workspace/api-zod";
import { scienceScoring, missionObjectiveWeights } from "./mission-scoring";
import { scientificInstruments } from "./scientific-instruments";
import { componentCategories } from "./rocket-catalog";
import { makeFlightPlan } from "./mission-flight-model";
import { advanceOperations, COLLECTION_MS, makeOperations, missionResults } from "./lunar-operations-model";

const selections = Object.fromEntries(componentCategories.map(c => [c.id, c.options.reduce((a, b) => (a.quality ?? 0) > (b.quality ?? 0) ? a : b).id]));
const plan = makeFlightPlan("falcon-shadow", selections, [], 30000);
const now = Date.UTC(2026, 10, 14);

function collect(ids: string[], damaged = false, locations = 3) {
  const diagnostics = scientificInstruments.filter(i => ids.includes(i.id)).map((i, index) => ({
    instrumentId: i.id, name: i.name, quality: i.quality, maxSciencePoints: i.maxSciencePoints,
    status: damaged ? (index === 0 ? "CRITICAL_FAILURE" as const : "DAMAGED" as const) : "OPERATIONAL" as const,
    availableSciencePoints: damaged ? (index === 0 ? 0 : Math.floor(i.maxSciencePoints / 2)) : i.maxSciencePoints,
    failure: null, progress: 1,
  }));
  let o = makeOperations(selections, diagnostics, 30000);
  o.landing.status = "LANDED";
  for (const siteId of ["regolith", "crater", "ridge"].slice(0, locations)) {
    o.siteId = siteId;
    o.siteStartedAt = new Date(now).toISOString();
    o = advanceOperations("SAMPLE_COLLECTION", o, plan, now + COLLECTION_MS).operations;
  }
  o.returnProgress = 1;
  o.returnManeuver = "LANDED_ON_EARTH";
  o.recoveryStartedAt = new Date(now).toISOString();
  return o;
}

test("catalog transmits the same scoring rules as the final report", () => {
  const catalog = GetGameCatalogResponse.parse({ missions: [], presets: [], scenes: [], rocketCatalog: [], scientificInstruments, scienceScoring });
  assert.deepEqual(catalog.scienceScoring, scienceScoring);
  assert.equal(scienceScoring.maxSciencePoints, scientificInstruments.reduce((s, i) => s + i.maxSciencePoints, 0));
  assert.equal(scienceScoring.totalMissionWeight, 100);
  assert.equal(scienceScoring.objectiveWeight, 10);
});

for (const [label, ids] of [
  ["camera only with Stage 1 sampler and container", ["panchromatic-camera"]],
  ["minimal standalone payload", ["panchromatic-camera", "sample-collection-system", "sample-container"]],
  ["all instruments", scientificInstruments.map(i => i.id)],
  ["empty legacy payload", []],
] as const) {
  test(`${label}: maximum forecast matches science earned and the actual Stage 8 report`, () => {
    const o = collect([...ids]);
    const points = scientificInstruments.filter(i => (ids as readonly string[]).includes(i.id)).reduce((s, i) => s + i.maxSciencePoints, 0);
    assert.equal(o.scienceEarned, points);
    const report = missionResults(o, plan, 0);
    const science = report.objectives.find(i => i.id === "science")!;
    assert.equal(science.completion, points / scienceScoring.maxSciencePoints);
    assert.equal(science.weight, scienceScoring.objectiveWeight);
    const otherWeights = Object.entries(missionObjectiveWeights).filter(([id]) => id !== "science").reduce((s, [, weight]) => s + weight, 0);
    assert.equal(report.completionPercent, Math.round(otherWeights + science.weight * science.completion));
  });
}

test("partial instrument failures and unfinished research reduce actual science below the forecast", () => {
  const ids = scientificInstruments.map(i => i.id);
  const full = collect(ids);
  const damaged = collect(ids, true);
  const partial = collect(ids, false, 1);
  assert.ok(damaged.scienceEarned > 0 && damaged.scienceEarned < full.scienceEarned);
  assert.equal(partial.scienceEarned, Math.floor(full.scienceEarned / 3));
  for (const o of [damaged, partial]) {
    const result = missionResults(o, plan, 0);
    assert.equal(result.objectives.find(i => i.id === "science")!.completion, o.scienceEarned / scienceScoring.maxSciencePoints);
    assert.ok(result.completionPercent < missionResults(full, plan, 0).completionPercent);
  }
  damaged.failure = "Return failed";
  damaged.returnManeuver = "ENGINE_OUT";
  const lost = missionResults(damaged, plan, 0);
  assert.equal(lost.scienceEarned, damaged.scienceEarned);
  assert.equal(lost.recoveredSciencePoints, 0);
  assert.equal(lost.recoveredSampleMassKg, 0);
  assert.equal(lost.success, false);
});
