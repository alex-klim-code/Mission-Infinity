import { test } from "node:test";
import assert from "node:assert/strict";
import { assessGameplayPayload, recommendGameplayFuel, type PayloadInput } from "./index";

const configuration = (): PayloadInput => ({
  components: [
    { id: "falcon-shadow", name: "Falcon", categoryId: "rocket-body", massKg: 12000, quality: 60 },
    { id: "main", name: "Main", categoryId: "main-engines", massKg: 1000, quality: 65 },
    { id: "upper", name: "Upper", categoryId: "upper-stage-engines", massKg: 500, quality: 65 },
    { id: "stages", name: "Triple", categoryId: "rocket-stages", massKg: 1000, quality: 65 },
  ],
  instruments: [{ id: "camera", massKg: 3 }],
  fuelKg: 0,
});
const limits = { capacityKg: 30000, loadedKg: 0, pricePerKg: 8, availableBudget: 1_000_000 };

test("recommends the minimum whole-kg feasible Quality load with the real price", () => {
  const input = configuration();
  const before = JSON.stringify(input);
  const r = recommendGameplayFuel(input, limits)!;
  assert.ok(r);
  assert.equal(assessGameplayPayload({ ...input, fuelKg: r.targetKg }).feasible, true);
  assert.equal(assessGameplayPayload({ ...input, fuelKg: r.targetKg - 1 }).feasible, false);
  assert.equal(r.additionalCost, r.targetKg * 8);
  assert.equal(r.totalCost, r.additionalCost);
  assert.equal(r.affordable, true);
  assert.equal(JSON.stringify(input), before);
});

test("overweight payload or inadequate tank capacity produces no recommendation", () => {
  const input = configuration();
  input.instruments.push({ id: "heavy", massKg: 200000 });
  assert.equal(recommendGameplayFuel(input, limits), null);
  assert.equal(recommendGameplayFuel(configuration(), { ...limits, capacityKg: 1000 }), null);
});

test("insufficient budget is explicit and never substitutes an infeasible cheap load", () => {
  const full = recommendGameplayFuel(configuration(), limits)!;
  const poor = recommendGameplayFuel(configuration(), { ...limits, availableBudget: 7 })!;
  assert.equal(poor.targetKg, full.targetKg);
  assert.equal(poor.affordable, false);
  assert.equal(poor.budgetShortfall, poor.additionalCost - 7);
  assert.equal(recommendGameplayFuel(configuration(), { ...limits, availableBudget: full.additionalCost })!.affordable, true);
});

test("already loaded fuel is never removed or charged twice", () => {
  const first = recommendGameplayFuel(configuration(), limits)!;
  const partial = recommendGameplayFuel(configuration(), { ...limits, loadedKg: 500 })!;
  assert.equal(partial.targetKg, first.targetKg);
  assert.equal(partial.additionalCost, (first.targetKg - 500) * limits.pricePerKg);
  const loaded = first.targetKg + 100;
  const ready = recommendGameplayFuel(configuration(), { ...limits, loadedKg: loaded, availableBudget: 0 })!;
  assert.equal(ready.targetKg, loaded);
  assert.equal(ready.additionalCost, 0);
  assert.equal(ready.affordable, true);
});

test("search finds a feasible window even when filling the tank prevents launch", () => {
  const input = configuration();
  input.components[1].quality = 0;
  input.components[2].quality = 0;
  const wideTank = { ...limits, capacityKg: 100000 };
  assert.equal(assessGameplayPayload({ ...input, fuelKg: wideTank.capacityKg }).feasible, false);
  const r = recommendGameplayFuel(input, wideTank)!;
  assert.ok(r);
  assert.equal(assessGameplayPayload({ ...input, fuelKg: r.targetKg }).feasible, true);
  // Fuel already loaded beyond the thrust limit cannot be drained.
  assert.equal(recommendGameplayFuel(input, { ...wideTank, loadedKg: 100000 }), null);
});

test("capacity and price come from the station, including whole-kg boundaries", () => {
  const first = recommendGameplayFuel(configuration(), limits)!;
  assert.equal(recommendGameplayFuel(configuration(), { ...limits, capacityKg: first.targetKg - 0.5 }), null);
  const r = recommendGameplayFuel(configuration(), { ...limits, capacityKg: first.targetKg, pricePerKg: 3 })!;
  assert.equal(r.targetKg, first.targetKg);
  assert.equal(r.totalCost, first.targetKg * 3);
  assert.equal(recommendGameplayFuel(configuration(), { ...limits, pricePerKg: 0 }), null);
});
