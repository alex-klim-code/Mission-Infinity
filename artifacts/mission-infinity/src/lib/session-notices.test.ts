import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCrewNotices } from './session-notices';

const now = Date.parse('2026-11-14T14:00:00Z');
const member = (id: string, seconds = 0) => ({
  player: { id: 'sender', name: 'Engineer' },
  lastMessage: { id, text: `Message ${id}`, createdAt: new Date(now + seconds * 1000).toISOString(), expiresAt: new Date(now + 12_000 + seconds * 1000).toISOString() },
});

test('polling never duplicates a notification or resets its expiry', () => {
  const first = collectCrewNotices([], [member('one')], now);
  const again = collectCrewNotices(first, [member('one')], now + 5000);
  assert.equal(again.length, 1);
  assert.equal(again[0].expiresAt, first[0].expiresAt);
  assert.equal(collectCrewNotices(again, [member('one')], now + 12_000).length, 0);
});

test('successive messages from the same player are retained separately and bounded', () => {
  const first = collectCrewNotices([], [member('one')], now);
  const second = collectCrewNotices(first, [member('two', 1)], now + 1000);
  assert.deepEqual(second.map(n => n.text), ['Message one', 'Message two']);
  let queue = second;
  for (let i = 2; i < 10; i++) queue = collectCrewNotices(queue, [member(String(i), i)], now + i * 1000);
  assert.equal(queue.length, 6);
  assert.equal(queue.at(-1)!.id, '9');
});

test('notifications keep the correct sender and never interpret message markup', () => {
  const input = member('plain');
  input.lastMessage.text = '<b>Ready</b>';
  const [notice] = collectCrewNotices([], [input], now);
  assert.equal(notice.playerId, 'sender');
  assert.equal(notice.name, 'Engineer');
  assert.equal(notice.text, '<b>Ready</b>');
});
