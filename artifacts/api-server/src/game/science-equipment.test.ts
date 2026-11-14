import { test } from "node:test";
import assert from "node:assert/strict";
import { componentCategories } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";
import { scienceEquipmentCheck, scienceEquipmentCredits } from "./science-equipment";
import { makeOperations } from "./lunar-operations-model";

const existing = Object.fromEntries(["sample-collection", "sample-container"].map(id => {
  const part = componentCategories.find(c => c.id === id)!.options[0];
  return [id, part.id];
}));

test("Stage 2 catalog contains six required variants and seven optional instruments", () => {
  assert.equal(scientificInstruments.length, 13);
  assert.equal(new Set(scientificInstruments.map(i => i.id)).size, 13);
  for (const group of ["camera", "sample-collection", "sample-container"])
    assert.equal(scientificInstruments.filter(i => i.group === group).length, 2);
  assert.equal(scientificInstruments.filter(i => i.group === "optional").length, 7);
  assert.equal(scientificInstruments.filter(i => i.powerW === null).length, 6);
  assert.equal(scienceEquipmentCheck({},scientificInstruments.map(i=>i.id)).withinMassLimit,true);
});

test("missing equipment uses the three supplied warnings", () => {
  assert.deepEqual(scienceEquipmentCheck({}, []).missing.map(i => i.warning), [
    "NO VIDEO SIGNAL — Lunar surface visualization unavailable.",
    "SAMPLE COLLECTION UNAVAILABLE — Cannot collect lunar samples.",
    "SAMPLE STORAGE MISSING — Cannot safely return lunar samples to Earth.",
  ]);
});

test("Stage 1 collector and container fulfill requirements without a second purchase", () => {
  const credits = scienceEquipmentCredits(existing);
  assert.equal(credits.length, 2);
  const result = scienceEquipmentCheck(existing, ["panchromatic-camera"]);
  assert.equal(result.missing.length, 0);
  assert.equal(result.massKg, credits.reduce((sum, c) => sum + c.massKg!, 0) + 3);
  assert.equal(result.withinMassLimit, true);
  assert.equal(scienceEquipmentCheck(existing, []).missing[0].group, "camera");
  assert.equal(scienceEquipmentCredits({ "sample-container": existing["sample-collection"] }).length, 0);
});

test("either camera, both cameras, no optional equipment, or every instrument are valid", () => {
  for (const ids of [["panchromatic-camera"], ["multispectral-camera"], ["panchromatic-camera", "multispectral-camera"], scientificInstruments.map(i => i.id)]) {
    const result = scienceEquipmentCheck(existing, ids);
    assert.equal(result.missing.length, 0);
    assert.equal(result.withinMassLimit, true);
  }
  assert.equal(scienceEquipmentCheck({}, ["panchromatic-camera", "sample-collection-system", "sample-container"]).missing.length, 0);
});

test("mass includes credited hardware once and the boundary is inclusive", () => {
  const ids = ["panchromatic-camera", "sample-collection-system", "sample-container"];
  assert.equal(scienceEquipmentCheck({}, ids).massKg, 26);
  assert.equal(scienceEquipmentCheck({}, ids, 26).withinMassLimit, true);
  assert.equal(scienceEquipmentCheck({}, ids, 25).withinMassLimit, false);
  const mass = scienceEquipmentCheck(existing, ids).massKg;
  assert.equal(scienceEquipmentCheck(existing, ids, mass).withinMassLimit, true);
  assert.equal(scienceEquipmentCheck(existing, ids, mass - 1).withinMassLimit, false);
});

test("new Stage 2 collection and storage systems work in lunar operations", () => {
  const diagnostics = scientificInstruments.filter(i => ["panchromatic-camera", "sample-collection-system", "sample-container"].includes(i.id))
    .map(i => ({ instrumentId:i.id, name:i.name, quality:i.quality, status:"OPERATIONAL" as const,
      maxSciencePoints:i.maxSciencePoints, availableSciencePoints:i.maxSciencePoints, progress:1, failure:null }));
  const operations = makeOperations({}, diagnostics, 1000);
  assert.equal(operations.hasCamera, true);
  assert.equal(operations.canCollect, true);
  assert.equal(operations.warnings.some(w => w.startsWith("SAMPLE COLLECTION UNAVAILABLE") || w.startsWith("SAMPLE STORAGE MISSING")), false);
  assert.equal(makeOperations({}, [], 1000).canCollect, false);
});
