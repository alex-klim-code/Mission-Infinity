import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Camera, Check, ChevronDown, Container, FlaskConical, Lock, Microscope, Pickaxe, Send, ShoppingCart, Sparkles } from 'lucide-react';
import { useGetGameCatalog, type ScienceEquipmentCredit, type ScientificInstrument } from '@workspace/api-client-react';
import { ErrorState, HudButton } from '@/components/ui-kit';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';
import { fmtKg, formatExact, useCalm, type Props } from './rocket-shared';
import { useEngineeringGuard } from './engineering-guard';
import { useDemoGuide } from '@/hooks/use-demo-guide';
import { DemoChoiceBadge, DemoGuidePanel } from './demo-guide';
import { usePayloadCapacity } from '@/hooks/use-payload-capacity';
import { PayloadCapacityPanel } from './payload-capacity-panel';
import { usePayloadDraft } from './payload-draft';

const fmtW = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} W`;
const fmtPts = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

type ReqGroup = 'camera' | 'sample-collection' | 'sample-container';
const REQUIRED: { id: ReqGroup; label: string; icon: typeof Camera; warning: string }[] = [
  { id: 'camera', label: 'Camera', icon: Camera, warning: 'NO VIDEO SIGNAL — Lunar surface visualization unavailable.' },
  { id: 'sample-collection', label: 'Sample collection', icon: Pickaxe, warning: 'SAMPLE COLLECTION UNAVAILABLE — Cannot collect lunar samples.' },
  { id: 'sample-container', label: 'Sample container', icon: Container, warning: 'SAMPLE STORAGE MISSING — Cannot safely return lunar samples to Earth.' },
];

function totals(list: ScientificInstrument[], ids: Iterable<string>) {
  const set = new Set(ids);
  return list.filter((i) => set.has(i.id)).reduce(
    (a, i) => ({ price: a.price + i.price, mass: a.mass + i.massKg, power: a.power + (i.powerW ?? 0), unknownPower: a.unknownPower + (i.powerW == null ? 1 : 0), pts: a.pts + i.maxSciencePoints, n: a.n + 1 }),
    { price: 0, mass: 0, power: 0, unknownPower: 0, pts: 0, n: 0 },
  );
}
const powerText = (t: { power: number; unknownPower: number; n: number }) =>
  t.n === 0 ? fmtW(0) : t.unknownPower === t.n ? 'Not provided' : `${fmtW(t.power)}${t.unknownPower ? ` + ${t.unknownPower} unlisted` : ''}`;

function creditMass(credits: ScienceEquipmentCredit[]) {
  return credits.reduce((a, c) => ({ kg: a.kg + (c.massKg ?? 0), unknown: a.unknown + (c.massKg == null ? 1 : 0) }), { kg: 0, unknown: 0 });
}

function Stat({ label, value, tone, testid }: { label: string; value: string; tone?: string; testid: string }) {
  return (
    <div className="bg-void/85 p-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 font-mono text-sm', tone)} data-testid={testid}>{value}</dd>
    </div>
  );
}

function Warning({ text, testid, muted }: { text: string; testid: string; muted?: boolean }) {
  return (
    <p className={cn('flex gap-2 rounded-md border px-2.5 py-2 font-mono text-[11px] leading-snug', muted ? 'border-white/15 bg-void/60 text-muted-foreground' : 'border-destructive/40 bg-destructive/10 text-destructive')} data-testid={testid}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{text}
    </p>
  );
}

function CreditRow({ c }: { c: ScienceEquipmentCredit }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 rounded-md border border-dashed border-ion/30 bg-ion/[.04] px-3 py-2 text-sm" data-testid={`row-science-credit-${c.optionId}`}>
      <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{c.name}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{c.massKg == null ? 'Mass not listed' : fmtKg(c.massKg)}{c.quality != null ? ` / Q ${c.quality}` : ''}</span>
      <span className="rounded-sm border border-ion/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ion">Paid in Stage 1</span>
    </li>
  );
}

const STEPS = [
  { id: 'required', label: 'Required equipment' },
  { id: 'optional', label: 'Optional instruments' },
  { id: 'review', label: 'Review & purchase' },
] as const;
type Step = (typeof STEPS)[number]['id'];

export function ScienceStage({ session, mission, me, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const { guard, checking } = useEngineeringGuard();
  const catalog = useGetGameCatalog();
  const demo = useDemoGuide(session, me);
  const demoIds = demo.enabled && demo.plan?.feasible ? demo.plan.instrumentIds : undefined;
  const list = useMemo(() => catalog.data?.scientificInstruments ?? [], [catalog.data]);
  const sci = session.science;
  const [sel, setSel] = useState<Set<string>>(() => new Set(sci?.proposals.find((p) => p.playerId === me)?.instrumentIds ?? []));
  const [open, setOpen] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('required');
  const seeded = useRef(false);
  const capacity=usePayloadCapacity(session,session.science?.completed?session.science.instrumentIds:[...sel]);
  const draft=usePayloadDraft();
  const setDraft=draft?.setIds;
  useEffect(()=>{setDraft?.(session.science?.completed?null:[...sel]);},[setDraft,sel,session.science?.completed]);
  useEffect(()=>()=>setDraft?.(null),[setDraft]);
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
  const credits = sci?.creditedEquipment ?? [];
  const limit = capacity.maximumPayloadKg;
  const cm = creditMass(credits);
  const creditGroups = new Set<string>(credits.map((c) => c.group));
  const byId = new Map(list.map((i) => [i.id, i]));
  const missingFor = (ids: Iterable<string>) => {
    const g = new Set<string>(creditGroups);
    for (const id of ids) { const i = byId.get(id); if (i) g.add(i.group); }
    return REQUIRED.filter((r) => !g.has(r.id));
  };

  if (sci?.completed) {
    const t = totals(list, sci.instrumentIds);
    const bought = list.filter((i) => sci.instrumentIds.includes(i.id));
    const legacyMissing = missingFor(sci.instrumentIds);
    return (
      <div className="relative z-10" data-testid="panel-science-completed">
        <motion.div initial={calm ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-4xl px-4 py-8 md:px-8">
          <div className="kicker mb-2 flex items-center gap-2"><Check className="h-3.5 w-3.5 text-burn" /> Stage 2 complete</div>
          <h1 className="font-display text-4xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-science-completed">Payload Locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">Payload confirmed. This purchase cannot be repeated.</p>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-5">
            <Stat label="Instruments" value={`${t.n}/${list.length}`} testid="text-science-final-count" />
            <Stat label="Science cost" value={formatExact(sci.spent)} tone="text-burn" testid="text-science-final-cost" />
            <Stat label="Stage 2 mass" value={fmtKg(t.mass + cm.kg)} testid="text-science-final-mass" />
            <Stat label="Power" value={powerText(t)} testid="text-science-final-power" />
            <Stat label="Remaining" value={formatExact(budget - (session.build?.spent ?? 0))} tone="text-ion" testid="text-science-final-remaining" />
          </dl>
          <div className="mt-2 font-mono text-xs text-muted-foreground" data-testid="text-science-final-points">Max science potential: <span className="text-ion">{fmtPts(t.pts)}</span> pts</div>
          {legacyMissing.length > 0 && (
            <div className="mt-4 space-y-1.5" data-testid="panel-science-legacy-missing">
              {legacyMissing.map((m) => <Warning key={m.id} text={m.warning} testid={`text-science-missing-${m.id}`} />)}
              <p className="text-[11px] text-muted-foreground">This payload was confirmed under earlier rules and stays as purchased.</p>
            </div>
          )}
          {credits.length > 0 && (
            <ul className="mt-5 space-y-1.5" data-testid="list-science-final-credits">{credits.map((c) => <CreditRow key={c.optionId} c={c} />)}</ul>
          )}
          {bought.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-white/15 bg-void/60 p-6 text-center text-sm text-muted-foreground" data-testid="text-science-none">No Stage 2 instruments purchased.</div>
          ) : (
            <ul className="mt-4 divide-y divide-white/[.06] rounded-md border border-white/10 bg-void/60" data-testid="list-science-final">
              {bought.map((i) => (
                <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm" data-testid={`row-science-final-${i.id}`}>
                  <span className="min-w-0 flex-1 font-semibold">{i.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{fmtKg(i.massKg)} / {i.powerW == null ? 'power not provided' : fmtW(i.powerW)}</span>
                  <span className="font-mono text-xs text-ion">{formatExact(i.price)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex justify-end">
            {isHost ? (
              <HudButton variant="burn" disabled={pending || !!session.fueling?.opened} loading={pendingAction === 'open-fueling'} onClick={() => act({ action: 'open-fueling' })} data-testid="button-open-fueling">
                Continue to construction
              </HudButton>
            ) : (
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground" data-testid="text-waiting-fueling"><Lock className="h-3.5 w-3.5" /> Waiting for the Leader to open the fuel station</p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const t = totals(list, sel);
  const after = budget - spentBefore - t.price;
  const over = after < 0;
  const stageMass = t.mass + cm.kg;
  const overMass = capacity.warnings.length>0;
  const missing = missingFor(sel);
  const hasCamera = list.some((i) => sel.has(i.id) && i.group === 'camera');
  const ids = list.filter((i) => sel.has(i.id)).map((i) => i.id);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const proposals = sci?.proposals ?? [];
  const blocked = over || (overMass && capacity.basis!=='QUALITY') || missing.length > 0 || !hasCamera;

  const row = (i: ScientificInstrument) => {
    const on = sel.has(i.id);
    const exp = open === i.id;
    const demoPick = !!demoIds?.includes(i.id);
    const backers = proposals.filter((p) => p.instrumentIds.includes(i.id));
    return (
      <li key={i.id} className={cn('rounded-md border bg-void/70 backdrop-blur transition-colors', on ? 'border-ion/60 bg-ion/[.06]' : demoPick ? 'border-[hsl(44_95%_60%)]/60' : 'border-white/10', demoPick && 'border-l-4 border-l-[hsl(44_95%_60%)]')} data-testid={`row-instrument-${i.id}`}>
        <div className="flex items-start gap-3 p-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(186_92%_56%)]" data-testid={`checkbox-instrument-${i.id}`} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere]">{i.name}{demoPick && <DemoChoiceBadge />}</span>
              <span className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                <span className="text-burn" data-testid={`text-instrument-price-${i.id}`}>{formatExact(i.price)}</span>
                <span>{fmtKg(i.massKg)}</span>
                <span data-testid={`text-instrument-power-${i.id}`}>{i.powerW == null ? 'Power n/a' : fmtW(i.powerW)}</span>
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
            {i.scientificPurpose && i.scientificPurpose !== i.description && <p><span className="kicker mr-2">Purpose</span>{i.scientificPurpose}</p>}
          </div>
        )}
      </li>
    );
  };

  const optional = list.filter((i) => i.group === 'optional');

  return (
    <div className="relative z-10" data-testid="panel-science-select">
      <div className="mx-auto grid max-w-6xl gap-6 px-3 py-6 md:grid-cols-[minmax(0,1fr)_340px] md:px-8">
        <div className="min-w-0">
          <div className="kicker mb-2 flex items-center gap-2"><Microscope className="h-3.5 w-3.5 text-burn" /> Stage 2 / Scientific instruments</div>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-science-title">Choose the Payload</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">At least one camera, sampler and container. Optional instruments are up to the crew.</p>
          {demo.enabled && <div className="mt-3"><DemoGuidePanel plan={demo.plan} loading={demo.loading} error={demo.error} refetch={demo.refetch} /></div>}

          <nav className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10" aria-label="Selection steps">
            {STEPS.map((s, n) => (
              <button key={s.id} type="button" onClick={() => setStep(s.id)} aria-current={step === s.id ? 'step' : undefined}
                className={cn('flex items-center gap-2 bg-void/85 px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-widest transition-colors sm:text-[11px]', step === s.id ? 'bg-ion/10 text-ion' : 'text-muted-foreground hover:text-foreground')}
                data-testid={`button-science-step-${s.id}`}>
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border', step === s.id ? 'border-ion' : 'border-white/20')}>{n + 1}</span>
                <span className="min-w-0 leading-tight">{s.label}</span>
              </button>
            ))}
          </nav>

          {step === 'required' && (
            <div className="mt-4 space-y-5" data-testid="panel-science-step-required">
              {REQUIRED.map((g) => {
                const Icon = g.icon;
                const items = list.filter((i) => i.group === g.id);
                const gCredits = credits.filter((c) => c.group === g.id);
                const covered = gCredits.length > 0 || items.some((i) => sel.has(i.id));
                return (
                  <section key={g.id} data-testid={`section-science-group-${g.id}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-ion" />
                      <h2 className="font-display text-sm font-bold uppercase tracking-wider">{g.label}</h2>
                      <span className={cn('ml-auto font-mono text-[10px] uppercase tracking-widest', covered ? 'text-ion' : 'text-destructive')} data-testid={`status-science-group-${g.id}`}>{covered ? (gCredits.length && !items.some((i) => sel.has(i.id)) ? 'Covered by Stage 1' : 'Covered') : 'Min 1 required'}</span>
                    </div>
                    {gCredits.length > 0 && (
                      <>
                        <ul className="mb-2 space-y-1.5">{gCredits.map((c) => <CreditRow key={c.optionId} c={c} />)}</ul>
                        <p className="mb-2 text-[11px] text-muted-foreground">Already aboard. Extra units below are optional and added on top.</p>
                      </>
                    )}
                    <ul className="space-y-2">{items.map(row)}</ul>
                    {!covered && <div className="mt-2"><Warning text={g.warning} testid={`text-science-missing-${g.id}`} /></div>}
                  </section>
                );
              })}
              <div className="flex justify-end"><HudButton variant="ghost" onClick={() => setStep('optional')} data-testid="button-science-to-optional">Optional instruments</HudButton></div>
            </div>
          )}

          {step === 'optional' && (
            <div className="mt-4" data-testid="panel-science-step-optional">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ion" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Optional instruments</h2>
                <span className="ml-auto flex gap-2">
                  <button type="button" className="font-mono text-[11px] uppercase tracking-widest text-ion hover:underline" onClick={() => setSel((s) => new Set([...s, ...optional.map((i) => i.id)]))} data-testid="button-science-all">All</button>
                  <span className="text-white/20">/</span>
                  <button type="button" className="font-mono text-[11px] uppercase tracking-widest text-ion hover:underline" onClick={() => setSel((s) => new Set([...s].filter((id) => byId.get(id)?.group !== 'optional')))} data-testid="button-science-none">None</button>
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">Any number, including none. Open a row for the full description.</p>
              <ul className="space-y-2" data-testid="list-science-instruments">{optional.map(row)}</ul>
              <div className="mt-4 flex justify-between">
                <HudButton variant="ghost" onClick={() => setStep('required')} data-testid="button-science-back-required">Required equipment</HudButton>
                <HudButton variant="ghost" onClick={() => setStep('review')} data-testid="button-science-to-review">Review</HudButton>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="mt-4 space-y-4" data-testid="panel-science-step-review">
              {missing.length > 0 && <div className="space-y-1.5">{missing.map((m) => <Warning key={m.id} text={m.warning} testid={`text-science-missing-${m.id}`} />)}</div>}
              {missing.length === 0 && !hasCamera && <Warning text="NO VIDEO SIGNAL — A new purchase must include a camera." testid="text-science-missing-camera" />}
              {overMass && <Warning text={capacity.warnings.join(' · ')} testid="text-science-overmass" />}
              <section>
                <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider">New purchase</h2>
                {t.n === 0 ? (
                  <p className="rounded-md border border-dashed border-white/15 bg-void/60 p-4 text-center text-sm text-muted-foreground" data-testid="text-science-review-empty">Nothing selected yet.</p>
                ) : (
                  <ul className="divide-y divide-white/[.06] rounded-md border border-white/10 bg-void/60" data-testid="list-science-review">
                    {list.filter((i) => sel.has(i.id)).map((i) => (
                      <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm" data-testid={`row-science-review-${i.id}`}>
                        <span className="min-w-0 flex-1 font-semibold">{i.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{i.group === 'optional' ? 'Optional' : REQUIRED.find((r) => r.id === i.group)?.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{fmtKg(i.massKg)}</span>
                        <span className="font-mono text-xs text-burn">{formatExact(i.price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {credits.length > 0 && (
                <section>
                  <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider">Credited from Stage 1 (no charge)</h2>
                  <ul className="space-y-1.5">{credits.map((c) => <CreditRow key={c.optionId} c={c} />)}</ul>
                </section>
              )}
              <div className="flex justify-start"><HudButton variant="ghost" onClick={() => setStep('optional')} data-testid="button-science-back-optional">Optional instruments</HudButton></div>
            </div>
          )}
        </div>

        <aside className="space-y-4 md:sticky md:top-4 md:self-start">
          <PayloadCapacityPanel assessment={capacity} />
          <div className="glass hud-corners rounded-lg p-4" data-testid="panel-science-summary">
            <div className="kicker mb-2">Selection {t.n}/{list.length}</div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10">
              <Stat label="Selected cost" value={formatExact(t.price)} tone="text-burn" testid="text-science-cost" />
              <Stat label="After purchase" value={formatExact(after)} tone={over ? 'text-destructive' : 'text-ion'} testid="text-science-remaining" />
              <Stat label="New mass" value={fmtKg(t.mass)} testid="text-science-mass" />
              <Stat label="Power" value={powerText(t)} testid="text-science-power" />
            </dl>
            <div className="mt-3" data-testid="panel-science-mass-limit">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Equipment mass</span>
                <span className={overMass ? 'text-destructive' : 'text-foreground'} data-testid="text-science-stage-mass">{fmtKg(stageMass)} / {limit===null?'capacity incomplete':fmtKg(limit)}</span>
              </div>
              {limit!==null&&<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cn('h-full origin-left rounded-full transition-transform', overMass ? 'bg-destructive' : 'bg-ion')} style={{ transform: `scaleX(${Math.min(1, limit>0?(capacity.currentPayloadKg??0)/limit:1)})` }} />
              </div>}
              <div className="mt-1 text-[10px] text-muted-foreground">Includes {fmtKg(cm.kg)} credited from Stage 1{cm.unknown ? ` (${cm.unknown} item mass not listed)` : ''}.</div>
            </div>
            <ul className="mt-3 space-y-1" data-testid="list-science-requirements">
              {REQUIRED.map((g) => {
                const ok = !missing.some((m) => m.id === g.id);
                return (
                  <li key={g.id} className={cn('flex items-center gap-2 font-mono text-[11px]', ok ? 'text-ion' : 'text-destructive')} data-testid={`status-science-req-${g.id}`}>
                    {ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{g.label}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 font-mono text-xs text-muted-foreground">Max science potential <span className="text-ion" data-testid="text-science-points">{fmtPts(t.pts)}</span> pts</div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground" data-testid="text-science-available">Available now {formatExact(budget - spentBefore)}</div>
            {over && <p className="mt-2 flex gap-2 text-xs text-destructive" data-testid="text-science-overbudget"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Over budget by {formatExact(-after)}.{isHost ? ' Remove instruments to purchase.' : ''}</p>}
            <div className="mt-3 space-y-2">
              <HudButton variant="ghost" className="w-full" disabled={pending} loading={pendingAction === 'propose-instruments'} onClick={() => act({ action: 'propose-instruments', instrumentIds: ids })} data-testid="button-propose-instruments">
                <Send className="h-4 w-4" /> Propose {t.n ? `${t.n} instruments` : 'no instruments'}
              </HudButton>
              {isHost ? (
                <>
                  <HudButton variant="burn" className="w-full" disabled={blocked || pending || checking} loading={checking || pendingAction === 'purchase-instruments'} onClick={() => guard({ kind: 'science', instrumentIds: ids })} data-testid="button-purchase-instruments">
                    <ShoppingCart className="h-4 w-4" /> Purchase {formatExact(t.price)}
                  </HudButton>
                  {blocked && !over && <p className="text-[11px] text-muted-foreground" data-testid="text-science-purchase-blocked">{!hasCamera || missing.length ? 'Complete the required equipment first.' : 'Resolve the payload capacity warnings.'}</p>}
                </>
              ) : (
                <p className="flex gap-2 text-xs text-muted-foreground" data-testid="text-science-leader-only"><Lock className="h-3.5 w-3.5 shrink-0" /> Only the Leader can purchase. Send your proposal, drafts welcome.</p>
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
                  const pm = missingFor(p.instrumentIds);
                  const draft = pm.length > 0 || !list.some((i) => p.instrumentIds.includes(i.id) && i.group === 'camera');
                  return (
                    <li key={p.playerId} className="rounded-md border border-white/[.08] bg-void/60 p-2.5 text-xs" data-testid={`row-science-proposal-${p.playerId}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{name(p.playerId)}{p.playerId === me ? ' (you)' : ''}</span>
                        <span className="font-mono text-burn">{formatExact(pt.price)}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">{pt.n ? list.filter((i) => p.instrumentIds.includes(i.id)).map((i) => i.name).join(', ') : 'No instruments'}</div>
                      {draft && <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[hsl(44_95%_60%)]">Draft / incomplete</div>}
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
