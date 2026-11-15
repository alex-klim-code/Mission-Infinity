import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, ArrowUpRight, CheckCircle2, Drill, Gauge, PlaneLanding } from 'lucide-react';
import type { MissionOperations, SessionActionSiteId } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { useCalm, type Props } from '../../rocket-shared';
import { Stat, TickError, Waiting, clamp01, kg, num, useNow } from '../shared';
import { ReturnCheckView } from './hardware-checks';
import { LandingScene } from './landing-scene';
import { LanderSvg, Warn, compOf, landerVariant } from './common';

type Extra = { tickError?: boolean; onRetry?: () => void };

const SITES: { id: SessionActionSiteId; label: string; note: string; x: number }[] = [
  { id: 'regolith', label: 'Regolith plain', note: 'Loose surface soil, easy scoop', x: 150 },
  { id: 'crater', label: 'Crater rim', note: 'Ejecta from deep layers', x: 400 },
  { id: 'ridge', label: 'Basalt ridge', note: 'Hard rock, drill core', x: 650 },
];
const STATUS_EQ: Record<string, string> = { MISSING: 'text-destructive', CRITICAL_FAILURE: 'text-destructive', DAMAGED: 'text-[hsl(44_95%_60%)]', OPERATIONAL: 'text-[hsl(150_70%_55%)]', UNKNOWN: 'text-muted-foreground' };

function Surface() {
  return (
    <g>
      <defs>
        <linearGradient id="lsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(225 40% 6%)" /><stop offset="1" stopColor="hsl(220 30% 12%)" /></linearGradient>
        <linearGradient id="lground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(30 6% 62%)" /><stop offset="1" stopColor="hsl(30 5% 30%)" /></linearGradient>
      </defs>
      <rect width="800" height="360" fill="url(#lsky)" />
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 197) % 800} cy={(i * 61) % 220} r={i % 5 === 0 ? 1.3 : 0.7} fill="hsl(210 40% 95% / .7)" />)}
      <circle cx="690" cy="60" r="22" fill="hsl(205 70% 45%)" /><path d="M672 52 q10 -8 22 0 q6 10 -6 16 q-10 4 -16 -16Z" fill="hsl(130 35% 45% / .8)" />
      <path d="M0 290 Q120 270 230 286 T470 280 T800 284 L800 360 L0 360Z" fill="url(#lground)" />
      <path d="M0 300 Q200 296 400 302 T800 300 L800 360 L0 360Z" fill="hsl(30 5% 40% / .5)" />
      {[[90, 320, 30], [380, 330, 46], [600, 315, 22], [720, 340, 34]].map(([x, y, r]) => <ellipse key={x} cx={x} cy={y} rx={r} ry={r / 5} fill="hsl(30 5% 22% / .6)" />)}
    </g>
  );
}

function EquipmentPanel({ ops }: { ops: MissionOperations }) {
  const atRisk = !ops.canCollect || (!ops.hasCamera && !ops.alternativeNavigation);
  return (
    <section className="glass rounded-md p-3" data-testid="panel-equipment">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scientific equipment validation</h2>
      {atRisk && (
        <div role="alert" className="mt-2 rounded-sm border border-destructive/60 bg-destructive/10 p-2.5" data-testid="alert-mission-at-risk">
          <div className="font-display text-sm font-bold uppercase text-destructive">Mission at risk — required scientific equipment missing</div>
          <p className="mt-1 text-xs text-foreground/85">
            {!ops.canCollect && 'No working sample collector or container: lunar samples cannot be physically collected, so the main objective (at least 1 kg returned) will fail. '}
            {!ops.hasCamera && !ops.alternativeNavigation && 'No camera and no alternative navigation: a guided landing is impossible. You may still return to Earth.'}
          </p>
        </div>
      )}
      {ops.warnings.length > 0 && <ul className="mt-2 space-y-1">{ops.warnings.map((w, i) => <Warn key={i} testid={`text-warning-${i}`}>{w}</Warn>)}</ul>}
      <ul className="mt-2 divide-y divide-white/5">
        {ops.equipment.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5" data-testid={`row-equipment-${e.id}`}>
            <span className={cn('min-w-0 text-xs [overflow-wrap:anywhere]', !e.available && 'text-muted-foreground line-through decoration-white/30')}>{e.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest">
              <span className={STATUS_EQ[e.status]}>{e.available ? e.status.replace('_', ' ') : `Unavailable / ${e.status.replace('_', ' ')}`}</span>
              <span className="ml-2 text-muted-foreground">pot. {e.potential}</span>
            </span>
            {e.warning && <span className="w-full text-[11px] text-[hsl(44_95%_65%)]">{e.warning}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ThrustControl({ ops, isHost, act, pending }: { ops: MissionOperations; isHost: boolean; act: Props['act']; pending: boolean }) {
  const [val, setVal] = useState(ops.landing.thrust);
  const editing = useRef(false);
  const queued = useRef<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const actRef = useRef(act); actRef.current = act;
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const flush = () => {
    if (queued.current === null || pendingRef.current) return;
    const v = queued.current; queued.current = null;
    actRef.current({ action: 'set-landing-thrust', thrust: v });
    clearTimeout(release.current);
    release.current = setTimeout(() => { if (queued.current === null) editing.current = false; }, 800);
  };
  useEffect(() => { if (!editing.current) setVal(ops.landing.thrust); }, [ops.landing.thrust]);
  useEffect(() => { if (!pending && queued.current !== null && !debounce.current) flush(); }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearTimeout(debounce.current); clearTimeout(release.current); }, []);
  const change = (v: number) => {
    editing.current = true; setVal(v); queued.current = v;
    clearTimeout(release.current); clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { debounce.current = undefined; flush(); }, 300);
  };
  const disabled = !isHost || ops.landing.status !== 'DESCENDING';
  return (
    <div className="rounded-md border border-white/10 bg-void/70 p-3">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <label htmlFor="landing-thrust" className="text-muted-foreground">Descent engine thrust</label>
        <span className="tabular-nums text-burn" data-testid="text-thrust-value">{Math.round(val)}%</span>
      </div>
      <div className="relative mt-2">
        <input id="landing-thrust" type="range" min={0} max={100} step={1} value={val} disabled={disabled} aria-busy={pending}
          onChange={(e) => change(Number(e.target.value))} className="w-full accent-[hsl(28_100%_58%)]" data-testid="input-landing-thrust" />
        <div className="pointer-events-none absolute -top-1 h-5 w-0.5 bg-ion" style={{ left: `${ops.landing.recommendedThrust}%` }} aria-hidden />
      </div>
      <p className="mt-1 font-mono text-[10px] text-ion" data-testid="text-recommended-thrust">Guidance suggests {Math.round(ops.landing.recommendedThrust)}% / touchdown at 6 m/s or less</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Landing assist stabilizes thrust and helps slow your descent.</p>
      {isHost&&<HudButton variant="ion" className="mt-2 w-full" disabled={disabled||pending} onClick={()=>change(ops.landing.recommendedThrust)} data-testid="button-landing-guidance">Use recommended thrust</HudButton>}
      {!isHost && <p className="mt-1 text-[11px] text-muted-foreground">The Leader is flying the descent.</p>}
    </div>
  );
}

function Rover({ x, drilling, calm }: { x: number; drilling: boolean; calm: boolean }) {
  return (
    <motion.g animate={{ x }} initial={false} transition={{ duration: calm ? 0 : 1.6, ease: 'easeInOut' }}>
      <g transform="translate(0 262)">
        {[-26, 0, 26].map((w) => <motion.circle key={w} cx={w} cy="22" r="8" fill="hsl(220 10% 22%)" stroke="hsl(210 15% 70%)" strokeWidth="2" strokeDasharray="3 3"
          animate={!calm ? { rotate: 360 } : undefined} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${w}px 22px` }} />)}
        <rect x="-36" y="0" width="72" height="16" rx="3" fill="hsl(210 15% 85%)" />
        <rect x="-30" y="-14" width="34" height="14" fill="hsl(215 50% 30%)" stroke="hsl(186 92% 56% / .5)" />
        <line x1="-20" y1="-14" x2="-20" y2="-30" stroke="hsl(210 15% 70%)" strokeWidth="2" /><circle cx="-20" cy="-32" r="4" fill="hsl(28 100% 58%)" />
        <motion.g style={{ transformOrigin: '30px 4px' }} animate={drilling && !calm ? { rotate: [0, 22, 30, 22, 0] } : { rotate: drilling ? 26 : -20 }} transition={{ duration: 2.6, repeat: drilling ? Infinity : 0 }}>
          <line x1="30" y1="4" x2="56" y2="-10" stroke="hsl(210 15% 80%)" strokeWidth="4" strokeLinecap="round" />
          <motion.g style={{ transformOrigin: '56px -10px' }} animate={drilling && !calm ? { rotate: [40, 70, 40] } : { rotate: 50 }} transition={{ duration: 1.3, repeat: drilling ? Infinity : 0 }}>
            <line x1="56" y1="-10" x2="80" y2="-10" stroke="hsl(210 15% 80%)" strokeWidth="3.5" strokeLinecap="round" />
            <motion.rect x="78" y="-14" width="14" height="8" fill="hsl(28 100% 58%)" animate={drilling && !calm ? { x: [78, 80, 78] } : undefined} transition={{ duration: 0.12, repeat: Infinity }} />
          </motion.g>
        </motion.g>
      </g>
      {drilling && !calm && [0, 1, 2, 3, 4].map((i) => (
        <motion.circle key={i} r={1.5 + (i % 2)} fill="hsl(30 8% 65%)" initial={{ cx: 70, cy: 296, opacity: 0 }}
          animate={{ cx: [70, 64 + i * 6, 58 + i * 8], cy: [296, 280 - i * 3, 296], opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity }} />
      ))}
    </motion.g>
  );
}

function CollectionView({ session, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const ops = session.journey!.operations!;
  const active = !!ops.siteId && ops.collectionProgress < 1 && !ops.collectedSites.includes(ops.siteId);
  const now = useNow(active && !calm, 100);
  const started = ops.siteStartedAt ? new Date(ops.siteStartedAt).getTime() : 0;
  const local = active && started ? Math.max(ops.collectionProgress, clamp01((now - started) / 8000)) : ops.collectionProgress;
  const [sel, setSel] = useState<SessionActionSiteId | null>(null);
  const target = SITES.find((s) => s.id === (ops.siteId ?? sel))?.x ?? 400;
  const potential = ops.equipment.filter((e) => e.available).reduce((a, e) => a + e.potential, 0);
  const canGo = !active && !pending;

  return (
    <>
      <div className="glass hud-corners relative mt-4 overflow-hidden rounded-lg" style={{ aspectRatio: '800 / 360' }} data-testid="panel-collection-scene">
        <svg viewBox="0 0 800 360" className="absolute inset-0 h-full w-full" aria-hidden>
          <Surface />
          <g transform="translate(720 296) scale(.9)"><LanderSvg variant={landerVariant(compOf(ops.components, 'lander')?.name)} flame={0} /></g>
          {SITES.map((s) => (
            <g key={s.id} opacity={ops.collectedSites.includes(s.id) ? 0.45 : 1}>
              <line x1={s.x + 70} y1="230" x2={s.x + 70} y2="292" stroke={ops.siteId === s.id || sel === s.id ? 'hsl(28 100% 58%)' : 'hsl(186 92% 56% / .6)'} strokeDasharray="3 3" />
              <circle cx={s.x + 70} cy="296" r="6" fill="none" stroke="hsl(186 92% 56%)" />
              <text x={s.x + 70} y="222" textAnchor="middle" fontSize="12" fill="hsl(210 30% 90%)" fontFamily="monospace">{s.label.toUpperCase()}</text>
            </g>
          ))}
          <Rover x={target} drilling={active} calm={calm} />
        </svg>
        <div className="absolute left-3 top-3 rounded-sm border border-white/15 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ion" role="status" aria-live="polite" data-testid="status-collection">
          {active ? `Collecting at ${SITES.find((s) => s.id === ops.siteId)?.label} / ${Math.round(local * 100)}%` : 'Rover idle / select a site'}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Collection progress" aria-valuenow={Math.round(local * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full origin-left bg-burn" style={{ transform: `scaleX(${local})` }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
        <Stat label="Samples collected" value={`${num(ops.sampleMassKg, 2)} kg`} tone="text-burn" testid="text-sample-mass" />
        <Stat label="Science earned" value={`${ops.scienceEarned}`} tone="text-ion" testid="text-science-earned" />
        <Stat label="Science potential" value={`${potential}`} testid="text-science-potential" />
        <Stat label="Sites done" value={`${ops.collectedSites.length} / 3`} testid="text-sites-done" />
      </dl>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {SITES.map((s) => {
          const done = ops.collectedSites.includes(s.id);
          return (
            <div key={s.id} className={cn('rounded-md border bg-void/70 p-3', sel === s.id ? 'border-burn/60' : 'border-white/10')} data-testid={`card-site-${s.id}`}>
              <button type="button" className="w-full text-left" onClick={() => setSel(s.id)} disabled={done} data-testid={`button-select-site-${s.id}`}>
                <div className="font-display text-sm font-bold uppercase">{s.label}</div>
                <div className="text-[11px] text-muted-foreground">{s.note}</div>
              </button>
              <div className="mt-2">
                {done ? <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[hsl(150_70%_55%)]"><CheckCircle2 className="h-3.5 w-3.5" /> Collected</span>
                  : isHost ? <HudButton variant="ion" className="w-full" disabled={!canGo || !ops.canCollect} loading={pendingAction === 'collect-site' && sel === s.id}
                      onClick={() => { setSel(s.id); act({ action: 'collect-site', siteId: s.id }); }} data-testid={`button-collect-${s.id}`}><Drill className="h-4 w-4" /> Collect</HudButton>
                  : <span className="font-mono text-[10px] uppercase text-muted-foreground">Leader controls rover</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!ops.canCollect && <p className="mt-2 text-xs text-destructive" data-testid="text-cannot-collect">No working sample collector or container aboard. Physical collection is impossible.</p>}
      <div className="mt-4 flex flex-col gap-2 rounded-md border border-white/10 bg-void/70 p-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs text-muted-foreground">{ops.sampleMassKg < 1 ? 'Below 1 kg of samples the main objective fails, but you can still lift off.' : 'Main sample objective covered. Additional sites add science.'}</p>
        {isHost ? <HudButton variant="burn" disabled={!canGo} loading={pendingAction === 'start-return'} onClick={() => act({ action: 'start-return' })} data-testid="button-start-return"><ArrowUpRight className="h-4 w-4" /> Run pre-return check</HudButton>
          : <Waiting testid="text-return-guest">Waiting for the Leader to lift off</Waiting>}
      </div>
    </>
  );
}

export function LunarGameplayStage(props: Props & Extra) {
  const { session, isHost, act, pending, pendingAction, tickError = false, onRetry = () => {} } = props;
  const calm = useCalm();
  const j = session.journey;
  const ops = j?.operations;
  if (!j || !ops) return <div className="mx-auto max-w-5xl px-4 py-6"><div className="h-64 animate-pulse rounded-lg bg-white/5" data-testid="skeleton-lunar" /></div>;
  const phase = j.phase;
  const L = ops.landing;
  const lander = compOf(ops.components, 'lander');
  const legs = compOf(ops.components, 'legs');
  const engine = compOf(ops.components, 'descent');
  const blind = !ops.hasCamera && !ops.alternativeNavigation;
  const crashed = L.status === 'CRASHED';
  const vTone = L.velocityMps > 6 ? 'text-destructive' : 'text-[hsl(150_70%_55%)]';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8" data-testid="panel-journey-lunar-gameplay">
      <div className="kicker mb-1">Stage 6 / Lunar landing and sample collection</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-lunar-stage-title">
        {ops.returnCheckOpened ? 'Pre-return check' : phase === 'SAMPLE_COLLECTION' ? 'Sample collection' : L.status === 'DESCENDING' ? 'Powered descent' : crashed ? 'Lander lost' : 'Landing preparation'}
      </h1>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground" data-testid="text-lander-components">
        {[['Lander', lander], ['Legs', legs], ['Descent engine', engine]].map(([l, c]) => (
          <span key={l as string}>{l as string}: <span className="text-foreground">{c && typeof c === 'object' ? `${c.name} / Q${c.quality}` : 'none'}</span></span>
        ))}
      </div>

      {ops.returnCheckOpened ? <ReturnCheckView {...props} ops={ops} /> : phase === 'SAMPLE_COLLECTION' ? <CollectionView {...props} /> : (
        <>
          <div className={cn('glass hud-corners relative mt-4 overflow-hidden rounded-lg', crashed && 'border-destructive/50')} style={{ aspectRatio: '800 / 360' }} data-testid="panel-landing-scene">
            <LandingScene ops={ops} calm={calm}><Surface /></LandingScene>
            <div className="absolute right-3 top-3 space-y-1 rounded-sm border border-white/15 bg-void/80 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest" role="status" aria-live="polite">
              <div>Alt <span className="tabular-nums text-ion" data-testid="text-landing-altitude">{num(L.altitudeM, 0)} m</span></div>
              <div>V-down <span className={cn('tabular-nums', vTone)} data-testid="text-landing-velocity">{num(L.velocityMps, 1)} m/s</span></div>
              <div>T+ <span className="tabular-nums">{num(L.elapsedSeconds, 0)} s</span></div>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
            <Stat label="Altitude" value={`${num(L.altitudeM, 0)} m`} tone="text-ion" />
            <Stat label="Descent rate" value={`${num(L.velocityMps, 1)} m/s`} tone={vTone} />
            <Stat label="Fuel used" value={kg(L.fuelUsedKg)} tone="text-burn" testid="text-landing-fuel-used" />
            <Stat label="Fuel remaining" value={kg(ops.remainingFuelKg)} testid="text-landing-fuel" />
          </dl>
          {tickError && <TickError onRetry={onRetry} testid="alert-landing-tick" />}
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              {L.status === 'DESCENDING' && <ThrustControl ops={ops} isHost={isHost} act={act} pending={pending} />}
              {L.status === 'READY' && (
                <div className="rounded-md border border-white/10 bg-void/70 p-3">
                  <p className="text-sm text-muted-foreground"><Gauge className="mr-1 inline h-4 w-4 text-ion" />Landing assist is active. Follow the guidance marker or use recommended thrust. Aim for 6 m/s or less at touchdown.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isHost ? <>
                      <HudButton variant="burn" disabled={pending || blind} loading={pendingAction === 'start-landing'} onClick={() => act({ action: 'start-landing' })} data-testid="button-start-landing"><PlaneLanding className="h-4 w-4" /> Begin powered descent</HudButton>
                      {blind && <HudButton variant="ghost" disabled={pending} loading={pendingAction === 'start-return'} onClick={() => act({ action: 'start-return' })} data-testid="button-abort-return"><ArrowUpRight className="h-4 w-4" /> Abort landing: run pre-return check</HudButton>}
                    </> : <Waiting testid="text-landing-guest">Waiting for the Leader to begin descent</Waiting>}
                  </div>
                  {blind && <p className="mt-2 text-xs text-destructive" data-testid="text-landing-blocked">No camera and no alternative navigation. Landing is impossible; aborting fails the main objective but brings the craft home.</p>}
                </div>
              )}
              {crashed && (
                <div role="alert" className="flex gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4" data-testid="alert-landing-crashed">
                  <AlertOctagon className="h-6 w-6 shrink-0 text-destructive" />
                  <div><div className="font-display text-lg font-bold uppercase text-destructive">Impact at {num(L.velocityMps, 1)} m/s</div><p className="text-sm text-foreground/85">{ops.failure ?? 'The lander hit the surface too fast. No samples can be collected.'}</p></div>
                </div>
              )}
              {phase === 'LANDING_FAILED' && isHost && <HudButton variant="ion" disabled={pending} loading={pendingAction === 'view-results'} onClick={() => act({ action: 'view-results' })} data-testid="button-view-results">View mission results</HudButton>}
            </div>
            <EquipmentPanel ops={ops} />
          </div>
        </>
      )}
      {phase === 'SAMPLE_COLLECTION' && !ops.returnCheckOpened && <div className="mt-4"><EquipmentPanel ops={ops} /></div>}
      {phase === 'SAMPLE_COLLECTION' && tickError && <TickError onRetry={onRetry} testid="alert-collection-tick" />}
      {!calm && L.status === 'DESCENDING' && <motion.span className="sr-only">descending</motion.span>}
    </div>
  );
}
