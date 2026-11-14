import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScienceForecast } from './science-forecast';

const rules = { maxSciencePoints: 1000, objectiveWeight: 10, totalMissionWeight: 100 };
const render = (points: number, scoring = rules) =>
  renderToStaticMarkup(createElement(ScienceForecast, { points, rules: scoring }));

test('forecast displays the objective percentage and percentage-point contribution, not a guaranteed mission score', () => {
  const html = render(300);
  assert.match(html, /30%/);
  assert.match(html, /3 percentage points/);
  assert.match(html, /not a guaranteed result/);
  assert.match(html, /all three locations/);
  assert.match(html, /scored separately/);
  assert.match(html, /Stage 1 adds no Science Points/);
});

test('empty and full selections and server rule changes are reflected without hardcoded weights', () => {
  assert.match(render(0), /0 percentage points/);
  assert.match(render(1000), /100%/);
  assert.match(render(1000), /10 percentage points/);
  assert.match(render(300, { maxSciencePoints: 600, objectiveWeight: 30, totalMissionWeight: 120 }), /12.5 percentage points/);
});

test('missing scoring rules explicitly mark the forecast unavailable', () => {
  const html = renderToStaticMarkup(createElement(ScienceForecast, { points: 300 }));
  assert.match(html, /forecast unavailable/);
  assert.doesNotMatch(html, /percentage points/);
});
