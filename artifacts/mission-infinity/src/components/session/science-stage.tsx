import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronDown, FlaskConical, Info, Lock, Microscope, Send, ShoppingCart } from 'lucide-react';
import { useGetGameCatalog, type ScientificInstrument } from '@workspace/api-client-react';
import { ErrorState, HudButton } from '@/components/ui-kit';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';
import { fmtKg, formatExact, useCalm, type Props } from './rocket-shared';

const fmtW = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} W`;
const fmtPts = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function totals(list: ScientificInstrument[], ids: Iterable<string>) {
  const set = new Set(ids);
  return list.filter((i) => set.has(i.id)).reduce(
    (a, i) => ({ price: a.price + i.price, mass: a.mass + i.massKg, power: a.power + i.powerW, pts: a.pts + i.maxSciencePoints, n: a.n + 1 }),
    { price: 0, mass: 0, power: 0, pts: 0, n: 0 },
  );
}

function Stat({ label, value, tone, testid }: { label: string; value: string; tone?: string; testid: string }) {
  return (
    <div className="bg-void/85 p-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 font-mono text-sm', tone)} data-testid={testid}>{value}</dd>
    </div>
  );
}

const Disclaimer = () => (
  <p className="flex gap-2 rounded-md border border-white/10 bg-void/60 p-2.5 text-[11px] leading-snug text-muted-foreground" data-testid="text-science-disclaimer">
    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ion" />
    Prices, mass, power and quality are game balance figures, not verified manufacturer offers. Max science points are a potential ceiling, not points already earned.
  </p>
);

export function ScienceStage({ session, mission, me, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const catalog = useGetGameCatalog();
  const list = useMemo(() => catalog.data?.scientificInstruments ?? [], [catalog.data]);
  const sci = session.science;
  const [sel, setSel] = useState<Set<string>>(() => new Set(sci?.proposals.find((p) => p.playerId === me)?.instrumentIds ?? []));
  const [open, setOpen] = useState<string | null>(null);
  const seeded = useRef(false);
  // Seed the draft once from my saved proposal; never overwrite on polls.
  useEffect(() => {
    if (seeded.current || !sci) return;
    seeded.current = true;
    const mine = sci.proposals.find((p) => p.playerId === me);
    if (mine) setSel(new Set(mine.instrumentIds));
  }, [sci, me]);

  if (catalog.isLoading) return <div className="relative z-10 mx-auto max-w-4xl space-y-2 p-6" data-testid="status-science-loading">{Array.from({ length: 7 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-md bg-white/5" />)}</div>;
  if (catalog.error || list.length === 0) return <div className="relative z-10 mx-auto max-w-md p-6"><ErrorState message={errMsg(catalog.error, 'Instrument catalog unavailable.')} onRetry={() => catalog.refetch()} /></div>;

  const budget = mission?.budget ?? 0;
  const spentBefore = (session.build?.spent ?? 0) - (sci?.spent ?? 0);
  const name = (id: string) => session.players.find((p) => p.player.id === id)?.player.name ?? 'Crew member';

  if (sci?.completed) {
    const t = totals(list, sci.instrumentIds);
    const bought = list.filter((i) => sci.instrumentIds.includes(i.id));
    return (
      <div className="scroll-thin relative z-10 h-full overflow-y-auto" data-testid="panel-science-completed">
        <motion.div initial={calm ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-4xl px-4 py-8 md:px-8">
          <div className="kicker mb-2 flex items-center gap-2"><Check className="h-3.5 w-3.5 text-burn" /> Stage 2 complete</div>
          <h1 className="font-display text-4xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-science-completed">Payload Locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">The Leader finalised the scientific payload. This purchase is recorded and cannot be repeated.</p>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-5">
            <Stat label="Instruments" value={`${t.n}/${list.length}`} testid="text-science-final-count" />
            <Stat label="Science cost" value={formatExact(sci.spent)} tone="text-burn" testid="text-science-final-cost" />
            <Stat label="Mass" value={fmtKg(t.mass)} testid="text-science-final-mass" />
            <Stat label="Power" value={fmtW(t.power)} testid="text-science-final-power" />
            <Stat label="Remaining" value={formatExact(budget - (session.build?.spent ?? 0))} tone="text-ion" testid="text-science-final-remaining" />
          </dl>
          <div className="mt-2 font-mono text-xs text-muted-foreground" data-testid="text-science-final-points">Max science potential: <span className="text-ion">{fmtPts(t.pts)}</span> pts (not yet earned)</div>
          {bought.length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-white/15 bg-void/60 p-6 text-center text-sm text-muted-foreground" data-testid="text-science-none">No instruments aboard. The rocket flies without a science payload.</div>
          ) : (
            <ul className="mt-6 divide-y divide-white/[.06] rounded-md border border-white/10 bg-void/60" data-testid="list-science-final">
              {bought.map((i) => (
                <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm" data-testid={`row-science-final-${i.id}`}>
                  <span className="min-w-0 flex-1 font-semibold">{i.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{fmtKg(i.massKg)} / {fmtW(i.powerW)}</span>
                  <span className="font-mono text-xs text-ion">{formatExact(i.price)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4"><Disclaimer /></div>
        </motion.div>
      </div>
    );
  }

  const t = totals(list, sel);
  const after = budget - spentBefore - t.price;
  const over = after < 0;
  const ids = list.filter((i) => sel.has(i.id)).map((i) => i.id);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const proposals = sci?.proposals ?? [];

  return (
    <div className="scroll-thin relative z-10 h-full overflow-y-auto" data-testid="panel-science-select">
      <div className="mx-auto grid max-w-6xl gap-6 px-3 py-6 md:grid-cols-[minmax(0,1fr)_340px] md:px-8">
        <div className="min-w-0">
          <div className="kicker mb-2 flex items-center gap-2"><Microscope className="h-3.5 w-3.5 text-burn" /> Stage 2 / Scientific instruments</div>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-science-title">Choose the Payload</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Select any, all or none of the seven instruments. Every kilogram and watt competes with the budget you have left.</p>
          <div className="mt-3"><Disclaimer /></div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="font-mono text-[11px] uppercase tracking-widest text-ion hover:underline" onClick={() => setSel(new Set(list.map((i) => i.id)))} data-testid="button-science-all">Select all</button>
            <span className="text-white/20">/</span>
            <button type="button" className="font-mono text-[11px] uppercase tracking-widest text-ion hover:underline" onClick={() => setSel(new Set())} data-testid="button-science-none">Clear</button>
          </div>
          <ul className="mt-3 space-y-2" data-testid="list-science-instruments">
            {list.map((i) => {
              const on = sel.has(i.id);
              const exp = open === i.id;
              const backers = proposals.filter((p) => p.instrumentIds.includes(i.id));
              return (
                <li key={i.id} className={cn('rounded-md border bg-void/70 backdrop-blur transition-colors', on ? 'border-ion/60 bg-ion/[.06]' : 'border-white/10')} data-testid={`row-instrument-${i.id}`}>
                  <div className="flex items-start gap-3 p-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(186_92%_56%)]" data-testid={`checkbox-instrument-${i.id}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold [overflow-wrap:anywhere]">{i.name}</span>
                        <span className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground sm:grid-cols-5">
                          <span className="text-burn" data-testid={`text-instrument-price-${i.id}`}>{formatExact(i.price)}</span>
                          <span>{fmtKg(i.massKg)}</span>
                          <span>{fmtW(i.powerW)}</span>
                          <span>Quality {i.quality}/100</span>
                          <span className="text-ion">max {fmtPts(i.maxSciencePoints)} pts</span>
                        </span>
                        {backers.length > 0 && <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground/80">Proposed by {backers.map((b) => name(b.playerId)).join(', ')}</span>}
                      </span>
                    </label>
                    <button type="button" onClick={() => setOpen(exp ? null : i.id)} aria-expanded={exp} className="shrink-0 rounded p-1 text-muted-foreground hover:text-ion" aria-label="Details" data-testid={`button-instrument-details-${i.id}`}>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', exp && 'rotate-180')} />
                    </button>
                  </div>
                  {exp && (
                    <div className="space-y-2 border-t border-white/[.06] px-3 py-2.5 text-sm text-foreground/85" data-testid={`panel-instrument-details-${i.id}`}>
                      <p>{i.description}</p>
                      <p><span className="kicker mr-2">Purpose</span>{i.scientificPurpose}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="space-y-4 md:sticky md:top-4 md:self-start">
          <div className="glass hud-corners rounded-lg p-4" data-testid="panel-science-summary">
            <div className="kicker mb-2">Selection {t.n}/{list.length}</div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10">
              <Stat label="Selected cost" value={formatExact(t.price)} tone="text-burn" testid="text-science-cost" />
              <Stat label="After purchase" value={formatExact(after)} tone={over ? 'text-destructive' : 'text-ion'} testid="text-science-remaining" />
              <Stat label="Mass" value={fmtKg(t.mass)} testid="text-science-mass" />
              <Stat label="Power" value={fmtW(t.power)} testid="text-science-power" />
            </dl>
            <div className="mt-2 font-mono text-xs text-muted-foreground">Max science potential <span className="text-ion" data-testid="text-science-points">{fmtPts(t.pts)}</span> pts</div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground" data-testid="text-science-available">Available now {formatExact(budget - spentBefore)}</div>
            {over && <p className="mt-2 flex gap-2 text-xs text-destructive" data-testid="text-science-overbudget"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Over budget by {formatExact(-after)}.{isHost ? ' Remove instruments to purchase.' : ''}</p>}
            <div className="mt-3 space-y-2">
              <HudButton variant="ghost" className="w-full" disabled={pending} loading={pendingAction === 'propose-instruments'} onClick={() => act({ action: 'propose-instruments', instrumentIds: ids })} data-testid="button-propose-instruments">
                <Send className="h-4 w-4" /> Propose {t.n ? `${t.n} instruments` : 'no instruments'}
              </HudButton>
              {isHost ? (
                <HudButton variant="burn" className="w-full" disabled={over || pending} loading={pendingAction === 'purchase-instruments'} onClick={() => act({ action: 'purchase-instruments', instrumentIds: ids })} data-testid="button-purchase-instruments">
                  <ShoppingCart className="h-4 w-4" /> Purchase {formatExact(t.price)}
                </HudButton>
              ) : (
                <p className="flex gap-2 text-xs text-muted-foreground" data-testid="text-science-leader-only"><Lock className="h-3.5 w-3.5 shrink-0" /> Only the Leader can purchase. Send your proposal so the Leader can apply it.</p>
              )}
            </div>
          </div>

          <div className="glass rounded-lg p-4" data-testid="panel-science-proposals">
            <div className="kicker mb-2 flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5" /> Crew proposals</div>
            {proposals.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="text-science-no-proposals">No proposals yet.</p>
            ) : (
              <ul className="space-y-2">
                {proposals.map((p) => {
                  const pt = totals(list, p.instrumentIds);
                  return (
                    <li key={p.playerId} className="rounded-md border border-white/[.08] bg-void/60 p-2.5 text-xs" data-testid={`row-science-proposal-${p.playerId}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{name(p.playerId)}{p.playerId === me ? ' (you)' : ''}</span>
                        <span className="font-mono text-burn">{formatExact(pt.price)}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">{pt.n ? list.filter((i) => p.instrumentIds.includes(i.id)).map((i) => i.name).join(', ') : 'No instruments'}</div>
                      {isHost && (
                        <button type="button" className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-ion hover:underline" onClick={() => setSel(new Set(p.instrumentIds))} data-testid={`button-apply-proposal-${p.playerId}`}>Apply to selection</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
