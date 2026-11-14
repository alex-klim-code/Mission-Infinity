import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Coins, Crown, ExternalLink, Lock, Rocket, Send } from 'lucide-react';
import {
  useGetGameCatalog,
  type GameSession,
  type Mission,
  type RocketCategory,
  type RocketComponent,
  type RocketSection,
  type SessionActionHullId,
} from '@workspace/api-client-react';
import { ErrorState, HudButton } from '@/components/ui-kit';
import { errMsg, imgUrl } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { ActFn } from './session-shared';

export const HULLS: { id: SessionActionHullId; name: string; colors: string; price: number; image: string }[] = [
  { id: 'falcon-shadow', name: 'Falcon Shadow', colors: 'black and white', price: 50000000, image: '/api/game/story-images/falcon-shadow.webp' },
  { id: 'titan-explorer', name: 'Titan Explorer', colors: 'orange and white', price: 60000000, image: '/api/game/story-images/titan-explorer.webp' },
  { id: 'nova-prime', name: 'Nova Prime', colors: 'white and blue', price: 90000000, image: '/api/game/story-images/nova-prime.webp' },
];

export const hullById = (id: string | null | undefined) => HULLS.find((h) => h.id === id);
export const formatExact = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtSigned = (n: number) => (n === 0 ? '$0' : `${n > 0 ? '+' : '-'}${formatExact(Math.abs(n))}`);
const fmtKg = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 6 })} kg`;

export const BODY_CATEGORY = 'rocket-body';
const isHullOption = (o: RocketComponent) => o.categoryId === BODY_CATEGORY || !!hullById(o.id);

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

/** Official selection per category, hull merged from build.selectedHullId. */
function useOfficial(session: GameSession, sections: RocketSection[]) {
  return useMemo(() => {
    const byOption = new Map<string, RocketComponent>();
    const cats: RocketCategory[] = [];
    sections.forEach((s) => s.categories.forEach((c) => { cats.push(c); c.options.forEach((o) => byOption.set(o.id, o)); }));
    const official = new Map<string, string>();
    (session.assembly?.selections ?? []).forEach((s) => official.set(s.categoryId, s.optionId));
    const hullId = session.build?.selectedHullId;
    if (hullId) {
      official.set(BODY_CATEGORY, hullId);
      // Only hull catalog prices changed. Existing purchases retain their paid
      // amount, so their configuration rows must still add up to saved spending.
      const hull = byOption.get(hullId);
      const partsCost = (session.assembly?.selections ?? []).reduce((sum, s) => sum + (byOption.get(s.optionId)?.price ?? 0), 0);
      if (hull) byOption.set(hullId, {...hull, price: Math.max(0, (session.build?.spent ?? 0) - partsCost)});
    }
    return { byOption, cats, official };
  }, [session, sections]);
}

/* ---------------- Right pane: hull + totals ---------------- */

function HullVisual({ hullId, className }: { hullId?: string | null; className?: string }) {
  const hull = hullById(hullId);
  if (!hull)
    return (
      <div className={cn('relative flex items-center justify-center', className)} data-testid="img-hull-placeholder">
        <svg viewBox="0 0 60 180" className="h-full w-auto opacity-60" aria-hidden>
          <path d="M30 4 C44 24 46 52 46 70 L46 150 L54 172 L6 172 L14 150 L14 70 C14 52 16 24 30 4 Z" fill="none" stroke="hsl(186 92% 56% / .5)" strokeWidth="1.2" strokeDasharray="4 4" />
        </svg>
        <span className="absolute rounded-sm border border-white/15 bg-void/85 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Not purchased</span>
      </div>
    );
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className="absolute inset-x-8 bottom-1 h-5 rounded-full bg-burn/30 blur-xl" />
      <img src={imgUrl(hull.image)} alt={`${hull.name} rocket hull`} width={724} height={2172} className="relative h-full w-auto max-w-full object-contain" data-testid="img-builder-hull" />
    </div>
  );
}

type Summary = { spent: number; remaining: number; count: number; total: number; dryMass: number; unknownMass: number; hullId?: string | null };

function SummaryPane({ session, sections, summary, isHost, act, pending, pendingAction, official, byOption }: {
  session: GameSession; sections: RocketSection[]; summary: Summary; isHost: boolean; act: ActFn; pending: boolean; pendingAction?: string;
  official: Map<string, string>; byOption: Map<string, RocketComponent>;
}) {
  const [open, setOpen] = useState(false);
  const hull = hullById(summary.hullId);
  const ready = summary.count === summary.total && summary.total > 0;
  const finish = isHost && !session.assembly?.completed && (
    <HudButton variant="burn" className="w-full" disabled={!ready || pending} loading={pendingAction === 'finish-rocket'} onClick={() => act({ action: 'finish-rocket' })} data-testid="button-finish-rocket">
      <Rocket className="h-4 w-4" /> Finish rocket {summary.count}/{summary.total}
    </HudButton>
  );
  const stats = (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 text-left">
      <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Total spent</dt><dd className="mt-0.5 font-mono text-sm text-burn" data-testid="text-builder-spent">{formatExact(summary.spent)}</dd></div>
      <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Remaining</dt><dd className="mt-0.5 font-mono text-sm text-ion" data-testid="text-builder-remaining">{formatExact(summary.remaining)}</dd></div>
      <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Categories</dt><dd className="mt-0.5 font-mono text-sm" data-testid="text-builder-count">{summary.count}/{summary.total}</dd></div>
      <div className="bg-void/85 p-2.5"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Known dry mass</dt><dd className="mt-0.5 font-mono text-sm" data-testid="text-builder-mass">{fmtKg(summary.dryMass)}</dd></div>
    </dl>
  );
  const list = (
    <ul className="space-y-1" data-testid="list-builder-selected">
      {sections.flatMap((s) => s.categories).map((c) => {
        const o = byOption.get(official.get(c.id) ?? '');
        const h = c.id === BODY_CATEGORY ? hull : undefined;
        const name = o?.name ?? h?.name;
        return (
          <li key={c.id} className="flex items-baseline justify-between gap-2 border-b border-white/[.05] py-1 text-xs" data-testid={`row-selected-${c.id}`}>
            <span className="min-w-0"><span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">{c.name}</span><span className={cn('block truncate', name ? 'text-foreground' : 'text-muted-foreground/60')}>{name ?? 'Not selected'}</span></span>
            {(o || h) && <span className="shrink-0 font-mono text-[11px] text-ion">{formatExact(o?.price ?? h?.price ?? 0)}</span>}
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      {/* compact mobile strip */}
      <div className="border-b border-white/10 bg-void/85 backdrop-blur-xl md:hidden" data-testid="panel-builder-summary-mobile">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2 text-left" aria-expanded={open} data-testid="button-toggle-summary">
          <HullVisual hullId={summary.hullId} className="h-16 w-10 shrink-0 [&_span]:hidden" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-bold uppercase">{hull?.name ?? 'Body not bought'}</div>
            <div className="font-mono text-[11px] text-burn">{formatExact(summary.spent)} <span className="text-muted-foreground">spent</span></div>
            <div className="font-mono text-[10px] text-muted-foreground">{summary.count}/{summary.total} categories / {fmtKg(summary.dryMass)} known dry</div>
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open && <div className="scroll-thin max-h-[45dvh] space-y-3 overflow-y-auto px-3 pb-3">{stats}{list}</div>}
        {finish && <div className="px-3 pb-2">{finish}</div>}
      </div>
      {/* desktop pane */}
      <aside className="scroll-thin hidden min-h-0 overflow-y-auto border-l md:order-2 border-white/10 bg-void/60 p-4 backdrop-blur-xl md:block" data-testid="panel-builder-summary">
        <div className="kicker mb-2">Assembly</div>
        <HullVisual hullId={summary.hullId} className="h-64 w-full lg:h-80" />
        <div className="mt-2 text-center font-display text-lg font-bold uppercase tracking-wider" data-testid="text-builder-hull">{hull?.name ?? 'Body not bought'}</div>
        <div className="mt-3">{stats}</div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">Dry mass sums parts with known catalog mass only{summary.unknownMass ? ` (${summary.unknownMass} without data)` : ''}; body mass is not included. Not a total wet mass.</p>
        {finish && <div className="mt-3">{finish}</div>}
        <div className="mt-4">{list}</div>
      </aside>
    </>
  );
}

/* ---------------- Left pane ---------------- */

function OptionDetail({ option, category, props, official, byOption, remaining, onBack }: {
  option: RocketComponent; category: RocketCategory; props: Props; official: Map<string, string>; byOption: Map<string, RocketComponent>; remaining: number; onBack: () => void;
}) {
  const { session, me, isHost, act, pending, pendingAction } = props;
  const body = category.id === BODY_CATEGORY || isHullOption(option);
  const hullBought = !!session.build?.selectedHullId;
  const currentId = official.get(category.id);
  const current = currentId ? byOption.get(currentId) ?? (body ? undefined : undefined) : undefined;
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

  const propose = () => {
    if (body) {
      if (screen === 'INTRO') { if (isHost) act({ action: 'build-next' }, () => act({ action: 'choose-hull', hullId })); return; }
      act({ action: 'choose-hull', hullId });
    } else act({ action: 'choose-component', optionId: option.id });
  };
  const confirm = () => {
    if (body) {
      if (screen === 'INTRO') act({ action: 'build-next' }, () => act({ action: 'confirm-hull', hullId }));
      else act({ action: 'confirm-hull', hullId });
    } else act({ action: 'confirm-component', optionId: option.id });
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
    <div className="pb-6" data-testid={`panel-option-${option.id}`}>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ion" data-testid="button-back-options">
        <ArrowLeft className="h-4 w-4" /> {category.name}
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold uppercase leading-tight [overflow-wrap:anywhere] sm:text-3xl" data-testid="text-option-name">{option.name}</h2>
          {isOfficial && <div className="mt-1 inline-flex items-center gap-1 rounded-sm bg-burn/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-burn"><Check className="h-3 w-3" /> Official choice</div>}
        </div>
        <Price value={option.price} className="text-lg text-ion" />
      </div>
      {body && hullById(option.id) && <HullVisual hullId={option.id} className="mx-auto mt-3 h-44 w-full" />}
      <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0 bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</dt><dd className="mt-0.5 text-sm [overflow-wrap:anywhere]">{v}</dd></div>
        ))}
      </dl>
      {option.parameters && (<><h3 className="kicker mt-5">Parameters</h3><p className="mt-1 whitespace-pre-line text-sm text-foreground/85 [overflow-wrap:anywhere]" data-testid="text-option-parameters">{option.parameters}</p></>)}
      {option.description && (<><h3 className="kicker mt-5">Description</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85 [overflow-wrap:anywhere]" data-testid="text-option-description">{option.description}</p></>)}
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
      </div>
    </div>
  );
}

function Navigator({ sections, official, byOption, props, remaining }: { sections: RocketSection[]; official: Map<string, string>; byOption: Map<string, RocketComponent>; props: Props; remaining: number }) {
  const [catId, setCatId] = useState<string | null>(null);
  const [optId, setOptId] = useState<string | null>(null);
  const [openSec, setOpenSec] = useState<string | null>(sections[0]?.id ?? null);
  const cat = sections.flatMap((s) => s.categories).find((c) => c.id === catId);
  const opt = cat?.options.find((o) => o.id === optId);
  const hullBought = !!props.session.build?.selectedHullId;

  if (cat && opt) return <OptionDetail option={opt} category={cat} props={props} official={official} byOption={byOption} remaining={remaining} onBack={() => setOptId(null)} />;
  if (cat)
    return (
      <div className="pb-6" data-testid={`panel-category-${cat.id}`}>
        <button type="button" onClick={() => setCatId(null)} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ion" data-testid="button-back-categories">
          <ArrowLeft className="h-4 w-4" /> All sections
        </button>
        <h2 className="font-display text-2xl font-bold uppercase leading-tight [overflow-wrap:anywhere]" data-testid="text-category-name">{cat.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{cat.options.length} options. Open one for full details.</p>
        <ul className="mt-4 divide-y divide-white/[.06] overflow-hidden rounded-md border border-white/10 bg-void/60">
          {cat.options.map((o) => {
            const sel = official.get(cat.id) === o.id;
            return (
              <li key={o.id}>
                <button type="button" onClick={() => setOptId(o.id)} className={cn('flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ion/[.06] focus-visible:bg-ion/[.08] focus-visible:outline-none', sel && 'bg-burn/[.08]')} data-testid={`button-option-${o.id}`}>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', sel ? 'bg-burn' : 'bg-white/15')} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{o.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ion">{formatExact(o.price)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  return (
    <div className="pb-6">
      <div className="kicker mb-1">Stage 1 / Rocket Construction</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl" data-testid="text-builder-title">Rocket Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">{hullBought ? 'Pick one part per category. Crew proposes, the Leader confirms.' : 'Start with the rocket body. Other parts unlock once it is bought.'}</p>
      <div className="mt-5 space-y-2">
        {sections.map((s) => {
          const done = s.categories.filter((c) => official.has(c.id)).length;
          const open = openSec === s.id;
          return (
            <section key={s.id} className="overflow-hidden rounded-md border border-white/10 bg-void/60">
              <button type="button" onClick={() => setOpenSec(open ? null : s.id)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-white/[.03]" data-testid={`button-section-${s.id}`}>
                <span className="min-w-0 flex-1 font-display text-sm font-bold uppercase tracking-wider [overflow-wrap:anywhere]">{s.name}</span>
                <span className={cn('font-mono text-[11px]', done === s.categories.length ? 'text-burn' : 'text-muted-foreground')}>{done}/{s.categories.length}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <ul className="border-t border-white/[.06]">
                  {s.categories.map((c) => {
                    const o = byOption.get(official.get(c.id) ?? '') ?? (c.id === BODY_CATEGORY ? undefined : undefined);
                    const hull = c.id === BODY_CATEGORY ? hullById(official.get(c.id)) : undefined;
                    const lockedCat = !hullBought && c.id !== BODY_CATEGORY;
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => setCatId(c.id)} className="flex w-full items-center gap-3 px-3 py-2.5 pl-5 text-left text-sm hover:bg-ion/[.05]" data-testid={`button-category-${c.id}`}>
                          {official.has(c.id) ? <Check className="h-3.5 w-3.5 shrink-0 text-burn" /> : lockedCat ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/25" />}
                          <span className="min-w-0 flex-1"><span className="block [overflow-wrap:anywhere]">{c.name}</span>{(o || hull) && <span className="block truncate text-[11px] text-muted-foreground">{o?.name ?? hull?.name}</span>}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Final ---------------- */

function Built({ session, sections, summary, official, byOption, mission }: { session: GameSession; sections: RocketSection[]; summary: Summary; official: Map<string, string>; byOption: Map<string, RocketComponent>; mission?: Mission }) {
  const calm = useCalm();
  const hull = hullById(session.build?.selectedHullId);
  return (
    <div className="scroll-thin relative z-10 h-full overflow-y-auto" data-testid="panel-rocket-built">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:px-8">
        <motion.div initial={calm ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <HullVisual hullId={hull?.id} className="h-64 w-full md:h-[28rem]" />
        </motion.div>
        <div className="min-w-0">
          <div className="kicker mb-2 flex items-center gap-2"><Check className="h-3.5 w-3.5 text-burn" /> Assembly complete</div>
          <h1 className="font-display text-4xl font-bold uppercase leading-tight sm:text-6xl" data-testid="text-rocket-built">Rocket Built</h1>
          <p className="mt-1 text-sm text-muted-foreground">{hull?.name} / {summary.count}/{summary.total} categories / {session.build?.elapsedMonths ?? 0} of {mission?.developmentMonths ?? 0} months</p>
          <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Total cost</dt><dd className="mt-0.5 font-mono text-lg text-burn" data-testid="text-built-cost">{formatExact(summary.spent)}</dd></div>
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Remaining budget</dt><dd className="mt-0.5 font-mono text-lg text-ion" data-testid="text-built-remaining">{formatExact(summary.remaining)}</dd></div>
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Known dry mass (parts)</dt><dd className="mt-0.5 font-mono text-lg">{fmtKg(summary.dryMass)}</dd></div>
          </dl>
          <div className="mt-6 space-y-4" data-testid="list-built-config">
            {sections.map((s) => (
              <section key={s.id}>
                <h2 className="kicker">{s.name}</h2>
                <ul className="mt-1.5 divide-y divide-white/[.06] rounded-md border border-white/10 bg-void/60">
                  {s.categories.map((c) => {
                    const o = byOption.get(official.get(c.id) ?? '');
                    const h = c.id === BODY_CATEGORY ? hull : undefined;
                    return (
                      <li key={c.id} className="flex items-baseline gap-3 px-3 py-2 text-sm" data-testid={`row-built-${c.id}`}>
                        <span className="w-1/3 min-w-0 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground [overflow-wrap:anywhere]">{c.name}</span>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{o?.name ?? h?.name ?? '--'}</span>
                        <span className="shrink-0 font-mono text-xs text-ion">{formatExact(o?.price ?? h?.price ?? 0)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Entry ---------------- */

export function RocketBuildView(props: Props) {
  const { session, mission } = props;
  const catalog = useGetGameCatalog();
  const sections = useMemo(() => catalog.data?.rocketCatalog ?? [], [catalog.data]);
  const { byOption, cats, official } = useOfficial(session, sections);

  if (catalog.isLoading)
    return (
      <div className="relative z-10 grid h-full gap-4 p-4 md:grid-cols-[minmax(0,1fr)_360px] md:p-6" data-testid="status-catalog-loading">
        <div className="space-y-2">{Array.from({ length: 7 }, (_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-white/5" />)}</div>
        <div className="hidden h-96 animate-pulse rounded-md bg-white/5 md:block" />
      </div>
    );
  if (catalog.error || sections.length === 0)
    return (
      <div className="relative z-10 mx-auto max-w-md p-6">
        <ErrorState message={errMsg(catalog.error, 'Rocket catalog unavailable.')} onRetry={() => catalog.refetch()} />
      </div>
    );

  let dryMass = 0;
  let unknownMass = 0;
  official.forEach((optId, catId) => {
    if (catId === BODY_CATEGORY) return;
    const o = byOption.get(optId);
    if (o?.massKg != null) dryMass += o.massKg;
    else unknownMass += 1;
  });
  const spent = session.build?.spent ?? 0;
  const summary: Summary = { spent, remaining: (mission?.budget ?? 0) - spent, count: cats.filter((c) => official.has(c.id)).length, total: cats.length, dryMass, unknownMass, hullId: session.build?.selectedHullId };

  if (session.assembly?.completed) return <Built session={session} sections={sections} summary={summary} official={official} byOption={byOption} mission={mission} />;

  return (
    <div className="relative z-10 flex h-full min-h-0 flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="md:order-2 md:min-h-0 md:contents">
        <SummaryPane session={session} sections={sections} summary={summary} isHost={props.isHost} act={props.act} pending={props.pending} pendingAction={props.pendingAction} official={official} byOption={byOption} />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:order-1 md:px-6" data-testid="panel-builder-left">
        <div className="mx-auto max-w-3xl">
          <Navigator sections={sections} official={official} byOption={byOption} props={props} remaining={summary.remaining} />
        </div>
      </div>
    </div>
  );
}
