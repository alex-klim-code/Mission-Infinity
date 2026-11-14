import { Check, Crown, ExternalLink, Send } from 'lucide-react';
import type { RocketCategory, RocketComponent, SessionActionHullId } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { purchaseRocketPart } from '@/lib/rocket-purchase';
import { BODY_CATEGORY, HullVisual, Price, fmtKg, fmtSigned, formatExact, hullById, isHullOption, type Props } from './rocket-shared';
import { RocketFuelCheck } from './rocket-fuel-check';

type DetailProps = {
  option: RocketComponent; category: RocketCategory; props: Props; official: Map<string, string>; byOption: Map<string, RocketComponent>; remaining: number;
  onSelected?: () => void;
};

export function OptionDetail({ option, category, props, official, byOption, remaining, onSelected }: DetailProps) {
  const { session, me, isHost, act, pending, pendingAction } = props;
  const body = category.id === BODY_CATEGORY || isHullOption(option);
  const hullBought = !!session.build?.selectedHullId;
  const currentId = official.get(category.id);
  const current = currentId ? byOption.get(currentId) : undefined;
  const currentPrice = current?.price ?? (body ? hullById(currentId)?.price : undefined) ?? 0;
  const isOfficial = currentId === option.id;
  const diff = option.price - currentPrice;
  const completed = !!session.assembly?.completed;
  const nameOf = (id: string) => (id === me ? 'You' : session.players.find((p) => p.player.id === id)?.player.name ?? 'Engineer');
  const proposals = body
    ? (session.build?.votes ?? []).map((v) => ({ playerId: v.playerId, optionId: v.hullId }))
    : (session.assembly?.proposals ?? []).filter((p) => p.categoryId === category.id);
  const mine = proposals.find((p) => p.playerId === me)?.optionId === option.id;
  const screen = session.build?.screen ?? 'INTRO';
  const hullId = option.id as SessionActionHullId;
  const locked = completed || (body && hullBought) || (!body && !hullBought);
  const overBudget = diff > remaining;
  // Guests advance their own navigator after a successful proposal; the Leader stays put.
  const proposeDone = isHost ? undefined : onSelected;

  const propose = () => {
    if (pending) return;
    if (body) {
      if (screen === 'INTRO') { if (isHost) act({ action: 'build-next' }, () => act({ action: 'choose-hull', hullId })); return; }
      act({ action: 'choose-hull', hullId }, proposeDone);
    } else act({ action: 'choose-component', optionId: option.id }, proposeDone);
  };
  const confirm = () => {
    if (overBudget) return;
    purchaseRocketPart(props, category.id, option.id, onSelected);
  };
  const guestBlockedIntro = body && !isHost && screen === 'INTRO';

  const rows: [string, string][] = [
    ['Price', formatExact(option.price)],
    ['Mass', option.massKg == null ? 'No data' : fmtKg(option.massKg)],
    ['Game quality score', option.quality == null ? 'Not rated' : String(option.quality)],
    ['Data status', option.dataStatus || '--'],
    ['Original category', option.originalCategory || '--'],
    ['Source', option.source || '--'],
  ];

  return (
    <div data-testid={`panel-option-${option.id}`}>
      {isOfficial && <div className="inline-flex items-center gap-1 rounded-sm bg-burn/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-burn"><Check className="h-3 w-3" /> Official choice</div>}
      {body && hullById(option.id) && <HullVisual hullId={option.id} className="mx-auto mt-3 h-52 w-full" />}
      <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0 bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</dt><dd className="mt-0.5 text-sm [overflow-wrap:anywhere]">{v}</dd></div>
        ))}
      </dl>
      {option.parameters && (<><h3 className="kicker mt-5">Parameters</h3><p className="mt-1 whitespace-pre-line text-sm text-foreground/85 [overflow-wrap:anywhere]" data-testid="text-option-parameters">{option.parameters}</p></>)}
      {option.description && (<><h3 className="kicker mt-5">Description</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85 [overflow-wrap:anywhere]" data-testid="text-option-description">{option.description}</p></>)}
      <RocketFuelCheck parts={[...official.values()].flatMap(id => byOption.get(id) ? [byOption.get(id)!] : [])} candidate={option} />
      {option.qualityMethodology && (<><h3 className="kicker mt-5">Quality methodology</h3><p className="mt-1 whitespace-pre-line text-xs text-muted-foreground [overflow-wrap:anywhere]">{option.qualityMethodology}</p></>)}
      {option.referenceUrl && (
        <a href={option.referenceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs text-ion hover:underline [overflow-wrap:anywhere]" data-testid="link-option-reference">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Reference
        </a>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Quality is a game score, not a reliability figure.</p>

      <h3 className="kicker mt-6">Crew proposals</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="list-option-proposals">
        {proposals.length === 0 && <li className="text-xs text-muted-foreground">No proposals in this category yet.</li>}
        {proposals.map((p) => (
          <li key={p.playerId} className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', p.optionId === option.id ? 'bg-ion/20 text-ion' : 'bg-white/5 text-muted-foreground')}>
            {p.playerId === session.hostId && <Crown className="h-3 w-3" aria-hidden />}
            {nameOf(p.playerId)}: {byOption.get(p.optionId)?.name ?? hullById(p.optionId)?.name ?? p.optionId}
          </li>
        ))}
      </ul>

      <div className="glass mt-6 space-y-3 rounded-lg p-4" data-testid="panel-option-actions">
        <div className="text-sm text-muted-foreground" aria-live="polite" data-testid="text-option-status">
          {completed ? 'Rocket is complete. No further changes.'
            : body && hullBought ? 'The body is bought once and cannot be changed.'
            : !body && !hullBought ? 'Buy the rocket body first.'
            : guestBlockedIntro ? 'Waiting for the Leader to open body selection.'
            : current && !isOfficial ? <>Replacing <span className="text-foreground">{current.name}</span>. Difference: <span className={cn('font-mono', diff > 0 ? 'text-burn' : 'text-ion')} data-testid="text-option-diff">{fmtSigned(diff)}</span></>
            : isOfficial ? 'This is the official choice.'
            : <>Cost if confirmed: <span className="font-mono text-burn" data-testid="text-option-diff">{formatExact(option.price)}</span></>}
          {!locked && !isOfficial && overBudget && <span className="mt-1 block text-destructive">Exceeds remaining budget.</span>}
        </div>
        {!locked && !isOfficial && (
          <div className="flex flex-wrap gap-2">
            <HudButton variant={mine ? 'ghost' : 'ion'} disabled={pending || mine || guestBlockedIntro} loading={pendingAction === 'choose-component' || pendingAction === 'choose-hull'} onClick={propose} data-testid="button-propose-option">
              {mine ? (<><Check className="h-4 w-4" /> Proposed</>) : (<><Send className="h-4 w-4" /> Propose</>)}
            </HudButton>
            {isHost && (
              <HudButton variant="burn" disabled={pending || overBudget} loading={pendingAction === 'confirm-component' || pendingAction === 'confirm-hull' || pendingAction === 'build-next'} onClick={confirm} data-testid="button-confirm-option">
                <Crown className="h-4 w-4" /> {current ? 'Confirm replacement' : 'Confirm purchase'}
              </HudButton>
            )}
          </div>
        )}
        {!isHost && !locked && <p className="text-[11px] text-muted-foreground">Proposals are free. The Leader confirms purchases.</p>}
        {isHost && !locked && !isOfficial && <p className="text-[11px] text-muted-foreground">Nothing is charged until you confirm. A confirmed purchase moves you to the next category.</p>}
      </div>
    </div>
  );
}

/** One shared modal for every option card. */
export function OptionDialog({ option, category, onClose, onCloseAutoFocus, ...rest }: Omit<DetailProps, 'option' | 'category'> & {
  option?: RocketComponent; category?: RocketCategory; onClose: () => void; onCloseAutoFocus: (e: Event) => void;
}) {
  const open = !!option && !!category;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden border-white/10 bg-card p-0 [&>button]:z-10 [&>button]:rounded-md [&>button]:border [&>button]:border-white/15 [&>button]:bg-void/80 [&>button]:p-1.5 [&>button]:opacity-100 [&>button:hover]:border-ion [&>button:hover]:text-ion"
        data-testid="dialog-rocket-option"
      >
        {option && category && (
          <>
            <div className="border-b border-white/10 p-5 pr-14">
              <div className="kicker">{category.name}</div>
              <DialogTitle className="mt-1 font-display text-2xl font-bold uppercase leading-tight [overflow-wrap:anywhere] sm:text-3xl" data-testid="text-option-name">{option.name}</DialogTitle>
              <DialogDescription asChild><div className="mt-1"><Price value={option.price} className="text-base text-ion" /></div></DialogDescription>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
              <OptionDetail option={option} category={category} {...rest} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
