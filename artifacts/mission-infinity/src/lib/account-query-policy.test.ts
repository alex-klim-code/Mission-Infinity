import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountQueryPolicy, isAccountConnectionError } from './account-query-policy';

test('account fetch retries connection failures and temporary HTTP server failures only', () => {
  for (const error of [new TypeError('Failed to fetch'), { status: 502 }, { status: 503 }, { status: 408 }]) {
    assert.equal(isAccountConnectionError(error), true);
    assert.equal(accountQueryPolicy.retry(3, error), true);
    assert.equal(accountQueryPolicy.retry(6, error), false);
  }
  for (const error of [null, new Error('Invalid data'), { status: 401 }, { status: 403 }, { status: 404 }, { name: 'AbortError' }]) {
    assert.equal(accountQueryPolicy.retry(0, error), false);
  }
});
test('startup retries are bounded and visible connection errors recover automatically', () => {
  assert.equal(accountQueryPolicy.retryDelay(0), 500);
  assert.equal(accountQueryPolicy.retryDelay(20), 4000);
  assert.equal(accountQueryPolicy.refetchInterval({ state: { status: 'error', error: new TypeError('Failed to fetch') } }), 5000);
  assert.equal(accountQueryPolicy.refetchInterval({ state: { status: 'error', error: { status: 401 } } }), false);
  assert.equal(accountQueryPolicy.refetchInterval({ state: { status: 'success', error: null } }), false);
});
