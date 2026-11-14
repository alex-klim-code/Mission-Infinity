import type { SessionActionHullId } from '@workspace/api-client-react';
import type { Props } from '@/components/session/rocket-shared';

/** Use the existing authoritative purchase actions for both cards and details. */
export function purchaseRocketPart(
  { session, isHost, pending, act }: Props,
  categoryId: string,
  optionId: string,
  after?: () => void,
) {
  const body = categoryId === 'rocket-body';
  if (!isHost || pending || session.assembly?.completed ||
    (body && session.build?.selectedHullId) || (!body && !session.build?.selectedHullId)) return;
  if (!body) {
    act({ action: 'confirm-component', optionId }, after);
  } else {
    const hullId = optionId as SessionActionHullId;
    if ((session.build?.screen ?? 'INTRO') === 'INTRO') {
      act({ action: 'build-next' }, () => act({ action: 'confirm-hull', hullId }, after));
    } else act({ action: 'confirm-hull', hullId }, after);
  }
}
