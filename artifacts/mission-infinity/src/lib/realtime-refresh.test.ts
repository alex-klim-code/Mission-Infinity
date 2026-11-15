import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRealtimeRefreshQueue } from './realtime-refresh';

test('a full minute of continuous room traffic has bounded refreshes and does not starve updates', ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  let sessions = 0, accounts = 0;
  const queue = createRealtimeRefreshQueue(() => sessions++, () => accounts++);
  for (let n = 0; n < 600; n++) {
    queue.enqueue();
    ctx.mock.timers.tick(100);
  }
  assert.equal(sessions, 60);
  assert.equal(accounts, 6);
  queue.dispose();
});

test('bursts coalesce and unmount cancels pending refreshes', ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const queue = createRealtimeRefreshQueue(() => calls++, () => calls++);
  for (let n = 0; n < 100; n++) queue.enqueue();
  ctx.mock.timers.tick(1000);
  assert.equal(calls, 1);
  queue.enqueue();
  queue.dispose();
  ctx.mock.timers.tick(20_000);
  assert.equal(calls, 1);
});
