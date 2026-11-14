import type { RocketComponent, RocketFuel } from '@workspace/api-client-react';

export const fuelCopy = {
  title: 'Propellant check',
  preview: 'Preview with this part replacing the current choice. No purchase made.',
  unverified: 'Unverified',
  conflict: 'Propellant conflict',
  noConflict: 'No chemistry conflict found in catalog data',
  empty: 'Select an engine and tank to compare their catalog requirements.',
  noTank: 'Unverified: no fuel tank selected.',
  noEngine: 'Unverified: no engine selected.',
  missing: 'Unverified: fuel chemistry is not specified in the source.',
  mismatch: 'Different propellant systems. This tank cannot supply this engine as specified.',
  match: 'The listed propellant systems overlap; connections and performance remain unverified.',
  scope: 'Compares each engine with the selected tank, not engines with one another. Separate stages may use separate supplies; the catalog does not define fuel connections.',
  disclaimer: 'Educational catalog check only — not certification or a flight simulation. Warnings do not block purchases or completion.',
  unknown: 'Not specified in source — unverified',
  requirement: 'Source propellant requirement',
  reference: 'Workbook reference',
} as const;

const engineCategories = new Set(['main-engines', 'upper-stage-engines', 'orbital-maneuvering', 'lunar-descent-engine', 'lunar-ascent-system']);
const substanceNames: Record<string, string> = {
  'rp-1': 'RP-1 kerosene', lox: 'Liquid oxygen (LOX)', methane: 'Liquid methane (CH4)',
  lh2: 'Liquid hydrogen (LH2)', indium: 'Indium (In)', propylene: 'Propylene',
  n2o: 'Nitrous oxide (N2O)', 'lmp-103s': 'LMP-103S (ADN)', hydrazine: 'Hydrazine (N2H4)',
  iodine: 'Iodine (I2)', xenon: 'Xenon', krypton: 'Krypton', 'mon-3': 'MON-3',
};

/** Display English chemistry while retaining the exact workbook text in catalog data. */
export function fuelDescription(part: RocketComponent): string {
  if (!documented(part.fuel)) return fuelCopy.unknown;
  return part.fuel.systems.map(system => system.map(value => substanceNames[value] ?? value).join(' + ')).join(' or ');
}

export function fuelRole(part: RocketComponent): RocketFuel['role'] | undefined {
  if (part.fuel) return part.fuel.role;
  if (engineCategories.has(part.categoryId)) return 'engine';
  if (part.categoryId === 'fuel-tanks') return 'tank';
  return undefined;
}

export type FuelComparison = {
  engine: RocketComponent;
  tank: RocketComponent;
  status: 'conflict' | 'unverified' | 'no-conflict';
};

function documented(fuel: RocketComponent['fuel']): fuel is RocketFuel {
  return fuel?.status === 'documented' && fuel.systems.length > 0
    && fuel.systems.every(system => system.length > 0 && system.every(value => value.trim().length > 0));
}

export function compareFuel(engine: RocketComponent, tank: RocketComponent): FuelComparison {
  if (!documented(engine.fuel) || !documented(tank.fuel)) return { engine, tank, status: 'unverified' };
  const overlaps = engine.fuel.systems.some(required => tank.fuel!.systems.some(supplied =>
    required.length === supplied.length && required.every(substance => supplied.includes(substance))));
  return { engine, tank, status: overlaps ? 'no-conflict' : 'conflict' };
}

/** Pure, read-only preview; a candidate replaces its category rather than adding to it. */
export function assessFuel(parts: RocketComponent[], candidate?: RocketComponent) {
  const design = candidate ? [...parts.filter(part => part.categoryId !== candidate.categoryId), candidate] : parts;
  const engines = design.filter(part => fuelRole(part) === 'engine');
  const tanks = design.filter(part => fuelRole(part) === 'tank');
  const comparisons = engines.flatMap(engine => tanks.map(tank => compareFuel(engine, tank)));
  return { engines, tanks, comparisons, conflicts: comparisons.filter(pair => pair.status === 'conflict').length };
}
