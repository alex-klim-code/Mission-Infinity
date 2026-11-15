import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountQueryPolicy, connectionRetryDelay, isAccountConnectionError } from './account-query-policy';

test('account fetch retries connection failures and temporary HTTP server failures only', () => {
  for (const error of [new TypeError('Failed to fetch'), { status: 502 }, { status: 503 }, { status: 408 }, { status: 429 }]) {
    assert.equal(isAccountConnectionError(error), true);
    assert.equal(accountQueryPolicy.retry(3, error), true);
    assert.equal(accountQueryPolicy.retry(6, error), false);
  }
  for (const error of [null, new Error('Invalid data'), { status: 401 }, { status: 403 }, { status: 404 }, { name: 'AbortError' }]) {
    assert.equal(accountQueryPolicy.retry(0, error), false);
  }
});
test('rate-limited reads respect Retry-After instead of immediately retrying', () => {
  const error = { status: 429, headers: new Headers({ 'Retry-After': '42' }) };
  assert.equal(connectionRetryDelay(0, error), 42_250);
  assert.equal(accountQueryPolicy.refetchInterval({state:{status:'error',error}}),42_250);
  assert.equal(connectionRetryDelay(0, {status:429}),30_250);
  assert.equal(connectionRetryDelay(0, {status:429,headers:new Headers({'Retry-After':'invalid'})}),30_250);
  assert.equal(connectionRetryDelay(0, {status:429,headers:new Headers({'Retry-After':'0'})}),1250);
});
test('startup retries are bounded and visible connection errors recover automatically', () => {
  assert.equal(accountQueryPolicy.retryDelay(0), 500);
  assert.equal(accountQueryPolicy.retryDelay(20), 4000);
  assert.equal(accountQueryPolicy.refetchInterval({ state: { status: 'error', error: new TypeError('Failed to fetch') } }), 5000);
  assert.equal(accountQueryPolicy.refetchInterval({ state: { status: 'error', error: { status: 401 } } }), false);
  assert.equal(accountQueryPolicy.refetchInterval({ state: { status: 'success', error: null } }), false);
});
