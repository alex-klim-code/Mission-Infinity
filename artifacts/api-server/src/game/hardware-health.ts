import { randomInt } from "node:crypto";
import type { MissionOperations } from "@workspace/api-zod";
import { componentById } from "./rocket-catalog";

// Launch-only stages/fairings/engines remain behind and cannot block Earth return.
const criticalReturnCategories = new Set([
  "upper-stage-engines", "orbital-maneuvering", "fuel-tanks",
  "onboard-computer", "navigation-sensors", "attitude-control",
  "electrical-power-system", "batteries", "communication", "thermal-protection",
  "lunar-ascent-system", "return-capsule", "re-entry-heat-shield", "recovery-system",
]);

/** Mutate only inside the session transaction, never during a GET projection.
 * Existing arrays (including empty ones) are final receipts, not reroll requests. */
export function resolveHardwareHealth(
  operations: MissionOperations,
  selections: Record<string,string>,
  random = () => randomInt(0,1_000_000)/1_000_000,
) {
  if (operations.hardwareChecks !== undefined || operations.results || operations.returnStartedAt) return;
  operations.hardwareChecks = Object.entries(selections).flatMap(([categoryId,id]) => {
    const part = componentById.get(id);
    if (!part || part.categoryId !== categoryId) return [];
    const previous = operations.equipment.find(e => e.id === id);
    const damaged = previous
      ? previous.status !== "OPERATIONAL"
      : random() < part.damageRisk/100;
    return [{
      id, categoryId, name:part.name, quality:part.quality, damageRisk:part.damageRisk,
      status:damaged ? "DAMAGED" as const : "OPERATIONAL" as const,
      critical:criticalReturnCategories.has(categoryId),
    }];
  });
  const instrument = operations.hardwareChecks.find(c => c.categoryId === "scientific-instruments");
  if (instrument && !operations.equipment.some(e => e.id === instrument.id)) {
    const damaged = instrument.status === "DAMAGED";
    const warning = damaged ? `${instrument.name} was damaged during the outbound mission (gameplay damage chance: ${instrument.damageRisk}%).` : null;
    operations.equipment.push({id:instrument.id,name:instrument.name,status:instrument.status,available:!damaged,potential:0,warning});
    if (warning) operations.warnings.push(warning);
  }
}

export function returnBlockers(operations: MissionOperations) {
  return operations.hardwareChecks?.filter(c => c.critical && c.status === "DAMAGED") ?? [];
}
