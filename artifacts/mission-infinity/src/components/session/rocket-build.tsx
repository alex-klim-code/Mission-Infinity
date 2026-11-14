import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Coins, Crown, Hourglass, Rocket } from 'lucide-react';
import type { GameSession, Mission, SessionActionHullId } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { imgUrl } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { ActFn } from './session-shared';

export const HULLS: { id: SessionActionHullId; name: string; colors: string; price: number; image: string }[] = [
  { id: 'falcon-shadow', name: 'Falcon Shadow', colors: 'czarno-biała', price: 500, image: '/api/game/story-images/falcon-shadow.webp' },
  { id: 'titan-explorer', name: 'Titan Explorer', colors: 'pomarańczowo-biała', price: 1200, image: '/api/game/story-images/titan-explorer.webp' },
  { id: 'nova-prime', name: 'Nova Prime', colors: 'biało-niebieska', price: 2500, image: '/api/game/story-images/nova-prime.webp' },
];

export const hullById = (id: string | null | undefined) => HULLS.find((h) => h.id === id);
export const formatExact = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

type Props = { session: GameSession; mission?: Mission; me: string; isHost: boolean; act: ActFn; pending: boolean; pendingAction?: string };

function useCalm() {
  const sys = useReducedMotion();
  const { reducedMotion } = usePrefs();
  return !!sys || reducedMotion;
}

function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono', className)}>
      <Coins className="h-3.5 w-3.5 text-burn" aria-hidden /> {formatExact(value)}
    </span>
  );
}

function Intro({ session, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const leader = session.players.find((p) => p.player.id === session.hostId);
  return (
    <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-10 text-center">
      <motion.div initial={calm ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="kicker mb-4">Mission started / Build phase</motion.div>
      <motion.h1
        initial={calm ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="font-display text-4xl font-bold uppercase leading-tight [overflow-wrap:anywhere] sm:text-6xl md:text-7xl"
        data-testid="text-build-intro"
      >
        Etap 1 <span className="text-burn">—</span> Budowa Rakiety
      </motion.h1>
      <motion.div initial={calm ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4, duration: 0.7 }} className="mx-auto mt-6 h-px w-56 bg-gradient-to-r from-transparent via-burn to-transparent" />
      <div className="mt-8" data-testid="text-build-status">
        {isHost ? (
          <HudButton variant="burn" disabled={pending} loading={pendingAction === 'build-next'} onClick={() => act({ action: 'build-next' })} data-testid="button-build-next">
            Continue <ArrowRight className="h-4 w-4" />
          </HudButton>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Hourglass className="h-4 w-4 text-ion" /> Waiting for the Leader{leader ? `, ${leader.player.name},` : ''} to continue.
          </p>
        )}
      </div>
    </div>
  );
}

function Selection({ session, mission, me, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const votes = session.build?.votes ?? [];
  const myVote = votes.find((v) => v.playerId === me)?.hullId;
  const budget = (mission?.budget ?? 0) - (session.build?.spent ?? 0);
  const nameOf = (id: string) => session.players.find((p) => p.player.id === id)?.player.name ?? 'Engineer';
  const chosen = hullById(myVote);
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-3 py-6 md:px-8">
      <div className="kicker mb-2">Etap 1 / Budowa Rakiety</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-hull-title">Wybierz obudowę rakiety</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Available budget <span className="font-mono text-ion" data-testid="text-hull-budget">{formatExact(budget)}</span>. Every engineer votes; the Leader buys.
      </p>
      <div role="radiogroup" aria-label="Rocket hull" className="mt-6 grid gap-4 sm:grid-cols-3">
        {HULLS.map((h, i) => {
          const sel = myVote === h.id;
          const voters = votes.filter((v) => v.hullId === h.id);
          const busy = pendingAction === 'choose-hull';
          return (
            <motion.button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={pending}
              onClick={() => !sel && act({ action: 'choose-hull', hullId: h.id })}
              initial={calm ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-void/70 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion disabled:cursor-wait',
                sel ? 'border-burn bg-burn/[.07]' : 'border-white/10 hover:border-ion/60',
              )}
              data-testid={`button-hull-${h.id}`}
            >
              <div className="relative mx-auto flex h-56 w-full items-center justify-center sm:h-72">
                <div className={cn('absolute inset-x-6 bottom-2 h-6 rounded-full blur-xl transition-opacity', sel ? 'bg-burn/40 opacity-100' : 'bg-ion/20 opacity-60')} />
                <img src={imgUrl(h.image)} alt={`${h.name} rocket hull`} width={724} height={2172} loading="lazy" className={cn('relative h-full w-auto max-w-full object-contain transition-transform duration-500', !calm && 'group-hover:-translate-y-1')} />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold uppercase tracking-wider">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.colors}</div>
                </div>
                <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border', sel ? 'border-burn bg-burn text-void' : 'border-white/25')} aria-hidden>
                  {sel && <Check className="h-3.5 w-3.5" />}
                </span>
              </div>
              <Price value={h.price} className="mt-2 text-sm text-ion" />
              <div className="mt-3 flex min-h-6 flex-wrap gap-1" data-testid={`list-votes-${h.id}`}>
                {voters.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/70">No votes yet</span>
                ) : (
                  voters.map((v) => (
                    <span key={v.playerId} className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', v.playerId === session.hostId ? 'bg-burn/20 text-burn' : 'bg-ion/15 text-ion')}>
                      {v.playerId === session.hostId && <Crown className="h-3 w-3" aria-hidden />}
                      {v.playerId === me ? 'You' : nameOf(v.playerId)}
                    </span>
                  ))
                )}
              </div>
              {busy && sel && <span className="sr-only">Saving vote</span>}
            </motion.button>
          );
        })}
      </div>
      <div className="glass mt-6 flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground sm:flex-1" data-testid="text-hull-status" aria-live="polite">
          {votes.length} of {session.players.length} votes cast.{' '}
          {isHost
            ? chosen
              ? `Confirm to buy ${chosen.name} for ${formatExact(chosen.price)}.`
              : 'Pick your hull to enable the purchase.'
            : chosen
              ? `Your vote: ${chosen.name}. The Leader makes the final purchase.`
              : 'Cast your vote. The Leader makes the final purchase.'}
        </div>
        {isHost && (
          <HudButton
            variant="burn"
            disabled={!chosen || pending || (chosen && chosen.price > budget)}
            loading={pendingAction === 'confirm-hull'}
            onClick={() => chosen && act({ action: 'confirm-hull', hullId: chosen.id })}
            data-testid="button-confirm-hull"
          >
            <Rocket className="h-4 w-4" /> Confirm purchase
          </HudButton>
        )}
      </div>
    </div>
  );
}

function Confirmed({ session, mission }: Props) {
  const calm = useCalm();
  const hull = hullById(session.build?.selectedHullId);
  const spent = session.build?.spent ?? 0;
  const remaining = (mission?.budget ?? 0) - spent;
  const elapsed = session.build?.elapsedMonths ?? 0;
  return (
    <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:px-8">
      <motion.div initial={calm ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative mx-auto flex h-72 w-full items-center justify-center sm:h-[26rem]">
        <div className="absolute inset-x-10 bottom-4 h-8 rounded-full bg-burn/30 blur-2xl" />
        {hull && <img src={imgUrl(hull.image)} alt={`${hull.name} rocket hull`} width={724} height={2172} className="relative h-full w-auto max-w-full object-contain" data-testid="img-purchased-hull" />}
      </motion.div>
      <div className="min-w-0">
        <div className="kicker mb-2 flex items-center gap-2"><Check className="h-3.5 w-3.5 text-burn" /> Hull purchased</div>
        <h1 className="font-display text-4xl font-bold uppercase leading-tight [overflow-wrap:anywhere] sm:text-5xl" data-testid="text-purchased-hull">{hull?.name ?? 'Hull'}</h1>
        {hull && <p className="mt-1 text-sm text-muted-foreground">{hull.colors}</p>}
        <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-2">
          <div className="bg-void/85 p-4">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Price paid</dt>
            <dd className="mt-1 text-lg text-ion" data-testid="text-hull-price">{hull ? <Price value={hull.price} /> : '--'}</dd>
          </div>
          <div className="bg-void/85 p-4">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Remaining budget</dt>
            <dd className="mt-1 font-mono text-lg text-ion" data-testid="text-remaining-budget">{formatExact(remaining)}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-foreground/75" data-testid="text-design-status">
          Rocket &amp; Spacecraft Design continues. Preparation time used: {elapsed} of {mission?.developmentMonths ?? 0} months.
        </p>
      </div>
    </div>
  );
}

export function RocketBuildView(props: Props) {
  const screen = props.session.build?.screen ?? 'INTRO';
  if (screen === 'HULL_CONFIRMED') return <Confirmed {...props} />;
  if (screen === 'HULL_SELECTION') return <Selection {...props} />;
  return <Intro {...props} />;
}
