import test from 'node:test';
import assert from 'node:assert/strict';
import type { Props } from '../components/session/rocket-shared';
import { purchaseRocketPart } from './rocket-purchase';

function fixture(overrides: Partial<Props> = {}) {
  const calls: { action: string; hullId?: string; optionId?: string; after?: () => void }[] = [];
  const props = {
    isHost: true, pending: false, session: { build: { screen: 'INTRO', selectedHullId: null } },
    act: (data, after) => { calls.push({ ...data, after }); },
    ...overrides,
  } as Props;
  return { props, calls };
}

test('direct hull purchase waits for opening success and final purchase success', () => {
  const { props, calls } = fixture();
  let advanced = 0;
  purchaseRocketPart(props, 'rocket-body', 'falcon-shadow', () => { advanced++; });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'build-next');
  assert.equal(advanced, 0);
  calls[0].after!();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].action, 'confirm-hull');
  assert.equal(calls[1].hullId, 'falcon-shadow');
  assert.equal(advanced, 0);
  calls[1].after!();
  assert.equal(advanced, 1);
});

test('an already open body selection purchases directly without a proposal', () => {
  const { props, calls } = fixture();
  props.session.build!.screen = 'HULL_SELECTION';
  purchaseRocketPart(props, 'rocket-body', 'nova-prime');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'confirm-hull');
  assert.equal(calls[0].hullId, 'nova-prime');
});

test('component cards use existing authoritative purchase and advance only on success', () => {
  const { props, calls } = fixture();
  props.session.build!.selectedHullId = 'falcon-shadow';
  let advanced = false;
  purchaseRocketPart(props, 'main-engines', 'engine-test', () => { advanced = true; });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'confirm-component');
  assert.equal(calls[0].optionId, 'engine-test');
  assert.equal(advanced, false); // A rejected request never invokes after.
  calls[0].after!();
  assert.equal(advanced, true);
});

test('crew, pending actions, bought hulls, locked components and completed builds cannot purchase', () => {
  for (const mode of ['crew', 'pending', 'hull', 'locked-component', 'completed']) {
    const { props, calls } = fixture();
    if (mode === 'crew') props.isHost = false;
    if (mode === 'pending') props.pending = true;
    if (mode === 'hull') props.session.build!.selectedHullId = 'falcon-shadow';
    if (mode === 'completed') props.session.assembly = { completed: true, selections: [], proposals: [] };
    purchaseRocketPart(props, mode === 'locked-component' ? 'main-engines' : 'rocket-body', 'falcon-shadow');
    assert.equal(calls.length, 0, mode);
  }
});
