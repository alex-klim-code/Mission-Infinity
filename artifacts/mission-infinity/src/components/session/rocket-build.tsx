import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Rocket } from 'lucide-react';
import {
  useGetGameCatalog,
  type GameSession,
  type Mission,
  type RocketCategory,
  type RocketComponent,
  type RocketSection,
} from '@workspace/api-client-react';
import { ErrorState, HudButton } from '@/components/ui-kit';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';
import { BODY_CATEGORY, HullVisual, fmtKg, formatExact, hullById, useCalm, type Props } from './rocket-shared';
import { Navigator } from './rocket-navigator';
import { ScienceStage } from './science-stage';
import type { ActFn } from './session-shared';

export { HULLS, hullById, formatExact, BODY_CATEGORY } from './rocket-shared';

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
      if (hull) byOption.set(hullId, {...hull, price: Math.max(0, (session.build?.spent ?? 0) - (session.science?.spent ?? 0) - partsCost)});
    }
    return { byOption, cats, official };
  }, [session, sections]);
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

/* ---------------- Final ---------------- */

function Built({ session, sections, summary, official, byOption, mission, isHost, act, pendingAction }: { isHost: boolean; act: ActFn; pendingAction?: string; session: GameSession; sections: RocketSection[]; summary: Summary; official: Map<string, string>; byOption: Map<string, RocketComponent>; mission?: Mission }) {
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
          <div className="mt-4 flex flex-col gap-2 rounded-md border border-white/10 bg-void/70 p-3 sm:flex-row sm:items-center" data-testid="panel-science-continue">
            <p className="flex-1 text-sm text-muted-foreground" data-testid="text-science-continue">{isHost ? 'Next: choose the scientific instruments your rocket will carry.' : 'Waiting for the Leader to open Stage 2: Scientific instruments.'}</p>
            {isHost && <HudButton variant="burn" loading={pendingAction === 'open-science'} onClick={() => act({ action: 'open-science' })} data-testid="button-open-science">Scientific instruments <ArrowRight className="h-4 w-4" /></HudButton>}
          </div>
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
  const spent = (session.build?.spent ?? 0) - (session.science?.spent ?? 0);
  const summary: Summary = { spent, remaining: (mission?.budget ?? 0) - spent, count: cats.filter((c) => official.has(c.id)).length, total: cats.length, dryMass, unknownMass, hullId: session.build?.selectedHullId };

  if (session.assembly?.completed && session.science?.opened) return <ScienceStage {...props} />;
  if (session.assembly?.completed) return <Built isHost={props.isHost} act={props.act} pendingAction={props.pendingAction} session={session} sections={sections} summary={summary} official={official} byOption={byOption} mission={mission} />;

  return (
    <div className="relative z-10 flex h-full min-h-0 flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="md:order-2 md:min-h-0 md:contents">
        <SummaryPane session={session} sections={sections} summary={summary} isHost={props.isHost} act={props.act} pending={props.pending} pendingAction={props.pendingAction} official={official} byOption={byOption} />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:order-1 md:px-6" data-testid="panel-builder-left">
        <div className="mx-auto max-w-4xl">
          <Navigator sections={sections} official={official} byOption={byOption} props={props} remaining={summary.remaining} />
        </div>
      </div>
    </div>
  );
}
