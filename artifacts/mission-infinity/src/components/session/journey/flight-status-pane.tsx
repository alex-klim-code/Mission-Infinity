import { useMemo, useState } from 'react';
import { AlertOctagon, ChevronDown } from 'lucide-react';
import { useGetGameCatalog } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { HullVisual, hullById, type Props } from '../rocket-shared';
import { MANEUVER } from './flight-view';
import { DIAG } from './diagnostics-view';
import { Stat, kg, num } from './shared';

export function FlightStatusPane({ session }: Props) {
  const [open, setOpen] = useState(false);
  const catalog = useGetGameCatalog();
  const j = session.journey;
  const hull = hullById(session.build?.selectedHullId);
  const plan = j?.plan;
  const o = j?.operations;
  const returning = !!o?.returnStartedAt;
  const inBurn = o && ['ASCENT','EARTH_INSERTION'].includes(o.returnManeuver) && j?.phase === 'RETURN_FLIGHT';
  const f = o && j ? {...j.flight,remainingFuelKg:o.remainingFuelKg,currentDay:o.missionDay,
    progress:returning?o.returnProgress:o.landing.status==='LANDED'?1:Math.max(0,1-o.landing.altitudeM/120),
    massKg:(plan?.dryMassKg??0)+o.remainingFuelKg,
    speedKmPerSecond:j.phase==='LANDING'?Math.abs(o.landing.velocityMps)/1000:j.phase==='RETURN_FLIGHT'?1+o.returnProgress*9:0,
    consumptionKgPerSecond:j.phase==='LANDING'&&o.remainingFuelKg>0?5*o.landing.thrust/100:inBurn?o.returnRequiredKg*(o.returnManeuver==='ASCENT'?0.55/4:0.45/3):0,
  }:j?.flight;
  const failed = j?.phase === 'FAILED'||!!o?.failure;

  const instruments = useMemo(() => {
    if (j?.diagnostics.length) return j.diagnostics.map((d) => ({ id: d.instrumentId, name: d.name, quality: d.quality, status: d.status, max: d.maxSciencePoints, available: d.availableSciencePoints }));
    const all = catalog.data?.scientificInstruments ?? [];
    return (session.science?.instrumentIds ?? []).map((id) => {
      const s = all.find((x) => x.id === id);
      return { id, name: s?.name ?? id, quality: s?.quality ?? null, status: 'UNKNOWN' as const, max: s?.maxSciencePoints ?? 0, available: 0 };
    });
  }, [j?.diagnostics, catalog.data, session.science?.instrumentIds]);

  const loaded = plan?.fuelLoadedKg ?? session.fueling?.loadedKg ?? 0;
  const remaining = f?.remainingFuelKg ?? loaded;
  const fuelPct = loaded ? (remaining / loaded) * 100 : 0;
  const statusText = o ? o.returnManeuver.replaceAll('_',' ') : failed ? 'Aborted' : f ? MANEUVER[f.maneuver] : '--';

  const warn = failed && (
    <p role="alert" className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive" data-testid="alert-pane-failed">
      <AlertOctagon className="h-4 w-4 shrink-0" /> {o?.failure??'Out of fuel. The spacecraft did not reach the Moon.'}
    </p>
  );
  const stats = (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10">
      <Stat label="Status" value={statusText} tone={failed ? 'text-destructive' : 'text-ion'} testid="text-pane-status" />
      <Stat label="Mission day" value={`${f?.currentDay ?? 0}`} testid="text-pane-day" />
      <Stat label="Mass" value={kg(f?.massKg ?? plan?.initialMassKg ?? 0)} testid="text-pane-mass" />
      <Stat label="Speed" value={`${num(f?.speedKmPerSecond ?? 0, 2)} km/s`} testid="text-pane-speed" />
      <Stat label="Fuel loaded" value={kg(loaded)} testid="text-pane-fuel-loaded" />
      <Stat label="Fuel remaining" value={`${kg(remaining)} (${num(fuelPct)}%)`} tone={failed ? 'text-destructive' : 'text-ion'} testid="text-pane-fuel-remaining" />
      <Stat label="Consumption" value={`${num(f?.consumptionKgPerSecond ?? 0)} kg/s`} tone="text-burn" testid="text-pane-consumption" />
      <Stat label={returning?'Return progress':o?'Lunar descent':'Outbound'} value={`${Math.round((f?.progress ?? 0) * 100)}%`} testid="text-pane-progress" />
    </dl>
  );
  const fuelBar = (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden><div className={cn('h-full origin-left', failed ? 'bg-destructive' : 'bg-gradient-to-r from-burn to-ion')} style={{ transform: `scaleX(${Math.max(0, Math.min(1, fuelPct / 100))})` }} /></div>
  );
  const details = (
    <>
      <div>
        <div className="kicker mb-1">Propulsion</div>
        <p className="text-xs" data-testid="text-pane-engines">{plan ? `${plan.engineCount} engines (one per selected category): ${plan.engineNames.join(', ') || 'none'}` : '--'}</p>
      </div>
      <div>
        <div className="kicker mb-1">Instruments</div>
        <ul className="space-y-1" data-testid="list-pane-instruments">
          {instruments.length === 0 && <li className="text-xs text-muted-foreground">No instruments aboard.</li>}
          {instruments.map((i) => (
            <li key={i.id} className="border-b border-white/[.05] py-1.5 text-xs" data-testid={`row-pane-instrument-${i.id}`}>
              <span className="block">{i.name}<span className="ml-1 font-mono text-[10px] text-muted-foreground">Quality {i.quality ?? '--'}/100</span></span>
              <div className="mt-1 flex flex-wrap justify-between gap-1 font-mono text-[10px]">
                <span className={cn('uppercase', DIAG[i.status].tone)}>{DIAG[i.status].label}</span>
                <span className="text-ion">{i.status === 'UNKNOWN' ? '--' : i.available} / {i.max} potential points</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-xs" data-testid="text-pane-science">Science potential <span className="text-ion">{j?.diagnosticsComplete ? j.availableSciencePoints : '--'}</span> / {j?.maxSciencePoints ?? 0}</p>
        {o&&<p className="mt-1 font-mono text-xs text-ion">{o.sampleMassKg.toFixed(2)} kg samples / {o.scienceEarned} Science Points earned</p>}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">Values from Mission Control's simplified training model, not a real orbital simulation.</p>
    </>
  );

  return (
    <>
      <div className="border-b border-white/10 bg-void/85 backdrop-blur-xl md:hidden" data-testid="panel-flight-status-mobile">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2 text-left" aria-expanded={open} data-testid="button-toggle-flight-status">
          <HullVisual hullId={hull?.id} className="h-14 w-9 shrink-0 [&_span]:hidden" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-bold uppercase">{hull?.name ?? 'Rocket'}</div>
            <div className={cn('font-mono text-[11px]', failed ? 'text-destructive' : 'text-ion')}>{statusText} / day {f?.currentDay ?? 0}</div>
            <div className="font-mono text-[10px] text-muted-foreground">Fuel {kg(remaining)} ({num(fuelPct)}%)</div>
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {failed && <div className="px-3 pb-2">{warn}</div>}
        {open && <div className="scroll-thin max-h-[45dvh] space-y-3 overflow-y-auto px-3 pb-3">{stats}{fuelBar}{details}</div>}
      </div>
      <aside className="scroll-thin hidden min-h-0 space-y-3 overflow-y-auto border-l border-white/10 bg-void/60 p-4 backdrop-blur-xl md:order-2 md:block" data-testid="panel-flight-status">
        <div className="kicker">Rocket Status</div>
        <HullVisual hullId={hull?.id} className="h-48 w-full lg:h-60" />
        <div className="text-center font-display text-lg font-bold uppercase tracking-wider" data-testid="text-pane-hull">{hull?.name ?? 'Rocket'}</div>
        {warn}
        {stats}
        {fuelBar}
        {details}
      </aside>
    </>
  );
}
