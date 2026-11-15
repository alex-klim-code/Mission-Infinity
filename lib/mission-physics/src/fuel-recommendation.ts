import { assessGameplayPayload } from "./gameplay";
import type { PayloadInput } from "./index";

export interface FuelRecommendationLimits {
  capacityKg: number;
  loadedKg: number;
  pricePerKg: number;
  availableBudget: number;
}

/** Indicative Quality estimate, not a fuel purchase or a flight guarantee. */
export function recommendGameplayFuel(input: PayloadInput, limits: FuelRecommendationLimits) {
  const { capacityKg, loadedKg, pricePerKg, availableBudget } = limits;
  if (![capacityKg, loadedKg, pricePerKg, availableBudget].every(Number.isFinite) ||
      capacityKg < 0 || loadedKg < 0 || pricePerKg <= 0) return null;
  let low = Math.max(1, Math.ceil(loadedKg));
  let high = Math.floor(capacityKg);
  if (low > high) return null;
  const assess = (fuelKg: number) => assessGameplayPayload({ ...input, fuelKg });
  // Fuel sufficiency improves with fuel, but launch TWR worsens. Searching
  // feasibility itself would miss a feasible interval below an overweight tank.
  const hasEnoughFuel = (fuelKg: number) => !assess(fuelKg).warnings.includes("INSUFFICIENT DELTA-V");
  if (!hasEnoughFuel(high)) return null;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (hasEnoughFuel(mid)) high = mid;
    else low = mid + 1;
  }
  if (!assess(low).feasible) return null;
  const additionalKg = Math.max(0, low - loadedKg);
  const additionalCost = additionalKg * pricePerKg;
  return {
    targetKg: low,
    additionalKg,
    additionalCost,
    totalCost: low * pricePerKg,
    affordable: additionalCost <= Math.max(0, availableBudget),
    budgetShortfall: Math.max(0, additionalCost - Math.max(0, availableBudget)),
  };
}
