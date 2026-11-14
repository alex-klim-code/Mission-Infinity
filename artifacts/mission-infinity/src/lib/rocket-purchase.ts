import type { SessionActionHullId } from '@workspace/api-client-react';
import { isRepairLocked, type Props } from '@/components/session/rocket-shared';

/**
 * Use the existing authoritative purchase actions for both cards and details.
 * Call only after an engineering preview (see EngineeringGuardProvider);
 * acceptedIssueIds are passed only after an explicit "Purchase anyway".
 */
export function purchaseRocketPart(
  { session, isHost, pending, act }: Props,
  categoryId: string,
  optionId: string,
  after?: () => void,
  acceptedIssueIds?: string[],
) {
  const body = categoryId === 'rocket-body';
  if (!isHost || pending || session.assembly?.completed || isRepairLocked(session, categoryId) ||
    (body && session.build?.selectedHullId) || (!body && !session.build?.selectedHullId)) return;
  const accepted = acceptedIssueIds?.length ? { acceptedIssueIds } : {};
  if (!body) {
    act({ action: 'confirm-component', optionId, ...accepted }, after);
  } else {
    const hullId = optionId as SessionActionHullId;
    if ((session.build?.screen ?? 'INTRO') === 'INTRO') {
      act({ action: 'build-next' }, () => act({ action: 'confirm-hull', hullId, ...accepted }, after));
    } else act({ action: 'confirm-hull', hullId, ...accepted }, after);
  }
}
