import type { ScienceEquipmentCredit } from "@workspace/api-zod";
import { componentById } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";

export const requiredScienceEquipment = [
  { group: "camera", warning: "NO VIDEO SIGNAL — Lunar surface visualization unavailable." },
  { group: "sample-collection", warning: "SAMPLE COLLECTION UNAVAILABLE — Cannot collect lunar samples." },
  { group: "sample-container", warning: "SAMPLE STORAGE MISSING — Cannot safely return lunar samples to Earth." },
] as const;

/** Stage 1 receipts satisfy the same equipment requirement without purchasing,
 * duplicating their flight mass, or inventing extra science points. */
export function scienceEquipmentCredits(selections: Record<string, string>): ScienceEquipmentCredit[] {
  return (["sample-collection", "sample-container"] as const).flatMap(group => {
    const part = componentById.get(selections[group]);
    return part?.categoryId === group
      ? [{ categoryId: group, optionId: part.id, name: part.name, group, massKg: part.massKg, quality: part.quality }]
      : [];
  });
}

export function scienceEquipmentCheck(
  selections: Record<string, string>, ids: string[], massLimitKg?: number | null,
) {
  const selected = scientificInstruments.filter(item => ids.includes(item.id));
  const credits = scienceEquipmentCredits(selections);
  const covered = new Set<string>([...selected.map(item => item.group), ...credits.map(item => item.group)]);
  const missing = requiredScienceEquipment.filter(item => !covered.has(item.group));
  const massKg = selected.reduce((sum, item) => sum + item.massKg, 0)
    + credits.reduce((sum, item) => sum + (item.massKg ?? 0), 0);
  return { credits, missing, massKg, withinMassLimit: massLimitKg == null || massKg <= massLimitKg };
}
