import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendGameplayFuel } from '@workspace/mission-physics';
import { availableFuelBudget } from './fuel-budget';

test('approved funding covers the remainder of a partially loaded fuel recommendation', () => {
  const input = { components: [], instruments: [], fuelKg: 1000 };
  const station = { capacityKg: 30000, loadedKg: 1000, pricePerKg: 8 };
  const mission = { budget: 100000 };
  // The 98,000 already spent includes the 8,000 paid for loaded fuel.
  const build = { spent: 98000 };
  const before = recommendGameplayFuel(input, {
    ...station, availableBudget: availableFuelBudget({ build }, mission),
  })!;
  assert.equal(before.affordable, false);
  const funded = { build, finance: { totalBudget: 300000 } };
  const remaining = availableFuelBudget(funded, mission);
  assert.equal(remaining, 202000);
  const after = recommendGameplayFuel(input, { ...station, availableBudget: remaining })!;
  assert.equal(after.targetKg, before.targetKg);
  assert.equal(after.affordable, true);
  assert.equal(after.budgetShortfall, 0);
  assert.equal(after.additionalCost, (after.targetKg - station.loadedKg) * station.pricePerKg);
});

test('station funds fall back to mission budget only when finance is absent', () => {
  assert.equal(availableFuelBudget({ build: { spent: 40 } }, { budget: 100 }), 60);
  assert.equal(availableFuelBudget({ finance: { totalBudget: 0 } }, { budget: 100 }), 0);
  assert.equal(availableFuelBudget({}), 0);
});
