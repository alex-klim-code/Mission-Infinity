import test from 'node:test';
import assert from 'node:assert/strict';
import { completionPercent, completionStats } from './rocket-completion';

const sections = [
  { id: 'structure', categories: ['rocket-body', 'stages', 'fairing', 'separation'].map(id => ({ id })) },
  { id: 'protection', categories: ['thermal', 'adapter'].map(id => ({ id })) },
];

test('empty or unconfirmed configurations have zero completion', () => {
  assert.equal(completionPercent(0, 0), 0);
  assert.deepEqual(completionStats([], new Map()), { per: [], done: 0, total: 0, pct: 0 });
  assert.equal(completionStats(sections, new Map()).pct, 0);
});

test('completion is weighted by confirmed categories, not section averages', () => {
  const st = completionStats(sections, new Map([['rocket-body', 'falcon-shadow'], ['thermal', 'shield']]));
  assert.equal(st.done, 2);
  assert.equal(st.total, 6);
  assert.equal(st.pct, 33);
  assert.deepEqual(st.per.map(s => s.pct), [25, 50]);
});

test('a purchased body counts once and replacements do not increase progress', () => {
  const official = new Map([['rocket-body', 'falcon-shadow']]);
  assert.equal(completionStats(sections, official).done, 1);
  official.set('rocket-body', 'nova-prime');
  official.set('unknown-category', 'unknown-part');
  assert.equal(completionStats(sections, official).done, 1);
});

test('all confirmed categories produce exactly 100 percent', () => {
  const official = new Map(sections.flatMap(s => s.categories.map(c => [c.id, `part-${c.id}`] as const)));
  const st = completionStats(sections, official);
  assert.equal(st.pct, 100);
  assert.ok(st.per.every(s => s.pct === 100));
});
