import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RocketComponent } from '@workspace/api-client-react';
import { assessFuel, compareFuel, fuelDescription, fuelRole } from './rocket-fuel';

function part(id: string, categoryId: string, systems?: string[][]): RocketComponent {
  return {
    id, categoryId, name: id, price: 100, massKg: 1, quality: null, damageRisk: 25,
    parameters: '', description: '', dataStatus: 'TEST', source: 'Test fixture',
    originalCategory: '', referenceUrl: '', qualityMethodology: '',
    fuel: { role: categoryId === 'fuel-tanks' ? 'tank' : 'engine',
      status: systems ? 'documented' : 'unverified', systems: systems ?? [],
      sourceText: '', sourceLocation: '' },
  };
}

test('fuel descriptions stay English without altering original workbook text', () => {
  const engine = part('engine', 'main-engines', [['lh2', 'lox']]);
  engine.fuel!.sourceText = 'Ciekły wodór (LH2) / LOX';
  assert.equal(fuelDescription(engine), 'Liquid hydrogen (LH2) + Liquid oxygen (LOX)');
  assert.equal(engine.fuel!.sourceText, 'Ciekły wodór (LH2) / LOX');
  assert.equal(fuelDescription(part('Hall', 'orbital-maneuvering', [['xenon'], ['krypton']])), 'Xenon or Krypton');
});

test('different known fuel systems conflict, even with a shared oxidizer', () => {
  assert.equal(compareFuel(part('RS-25', 'main-engines', [['lh2', 'lox']]),
    part('methane tank', 'fuel-tanks', [['methane', 'lox']])).status, 'conflict');
});

test('complete combinations match regardless of ordering; oxidizer alone is insufficient', () => {
  const engine = part('engine', 'main-engines', [['rp-1', 'lox']]);
  assert.equal(compareFuel(engine, part('tank', 'fuel-tanks', [['lox', 'rp-1']])).status, 'no-conflict');
  assert.equal(compareFuel(engine, part('tank', 'fuel-tanks', [['rp-1']])).status, 'conflict');
});

test('alternative propellants are not treated as a mandatory mixture', () => {
  const engine = part('Hall', 'orbital-maneuvering', [['xenon'], ['krypton']]);
  assert.equal(compareFuel(engine, part('tank', 'fuel-tanks', [['krypton']])).status, 'no-conflict');
  assert.equal(compareFuel(engine, part('tank', 'fuel-tanks', [['xenon', 'krypton']])).status, 'conflict');
});

test('missing, empty or explicitly unverified data never claims compatibility', () => {
  const engine = part('engine', 'main-engines', [['lh2', 'lox']]);
  for (const fuel of [null, undefined, part('t', 'fuel-tanks').fuel,
    { ...part('t', 'fuel-tanks', [[]]).fuel! },
    { ...part('t', 'fuel-tanks', [['lh2', 'lox']]).fuel!, status: 'unverified' as const }]) {
    const tank = { ...part('Cryogenic XL', 'fuel-tanks'), fuel };
    assert.equal(compareFuel(engine, tank).status, 'unverified');
    assert.equal(fuelRole(tank), 'tank');
  }
});

test('engines on separate stages do not conflict with one another', () => {
  const design = [part('main', 'main-engines', [['methane', 'lox']]),
    part('upper', 'upper-stage-engines', [['lh2', 'lox']])];
  assert.equal(assessFuel(design).conflicts, 0);
  assert.equal(assessFuel(design).comparisons.length, 0);
  assert.equal(assessFuel([...design, part('unknown tank', 'fuel-tanks')]).comparisons.length, 2);
});

test('preview replaces only its category without changing selections or prices', () => {
  const engine = part('main', 'main-engines', [['methane', 'lox']]);
  const tank = part('methane tank', 'fuel-tanks', [['methane', 'lox']]);
  const design = [engine, tank];
  const before = JSON.stringify(design);
  const preview = assessFuel(design, part('hydrogen tank', 'fuel-tanks', [['lh2', 'lox']]));
  assert.equal(preview.conflicts, 1);
  assert.equal(preview.tanks.length, 1);
  assert.equal(JSON.stringify(design), before);
  assert.equal(assessFuel(design).conflicts, 0);
  assert.equal(assessFuel([]).comparisons.length, 0);
});
