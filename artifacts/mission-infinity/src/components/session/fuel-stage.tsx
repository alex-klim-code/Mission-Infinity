import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Fuel, Info, Link2, Lock, Plug, Unplug } from 'lucide-react';
import type { SessionAction } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { HullVisual, formatExact, hullById, useCalm, type Props } from './rocket-shared';

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`;
const pct = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const TICK_MS = 600;

type Phase = 'DISCONNECTED' | 'CONNECTED' | 'FUELING IN PROGRESS' | 'PAUSED' | 'FUELING COMPLETE';

function Light({ on, tone }: { on: boolean; tone: string }) {
  return <span className={cn('h-2 w-2 rounded-full transition-opacity duration-300', tone, on ? 'opacity-100' : 'opacity-20')} aria-hidden />;
}

function Row({ label, value, tone, testid }: { label: string; value: string; tone?: string; testid: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[.06] py-1.5 last:border-0">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={cn('font-mono text-sm tabular-nums', tone)} data-testid={testid}>{value}</dd>
    </div>
  );
}

const Disclaimer = () => (
  <p className="flex gap-2 rounded-md border border-white/10 bg-void/60 p-2.5 text-[11px] leading-snug text-muted-foreground" data-testid="text-fuel-disclaimer">
    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ion" />
    Capacity, price per kilogram and pump speed are gameplay training parameters, not engineering figures or certified propellant chemistry for your chosen tank. Engine and tank compatibility remains as reviewed in Stage 1.
  </p>
);

export function FuelStage({ session, mission, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const f = session.fueling;
  const hull = hullById(session.build?.selectedHullId);

  /* ---------- server mirror refs ---------- */
  const fRef = useRef(f);
  fRef.current = f;
  const actRef = useRef(act);
  actRef.current = act;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const availableRef = useRef(0);
  availableRef.current = Math.max(0, (mission?.budget ?? 0) - (session.build?.spent ?? 0));
  const holdingRef = useRef(false);
  const inflightRef = useRef(false);
  const lastTickRef = useRef(0);
  const [holding, setHolding] = useState(false);
  const [stationError, setStationError] = useState(false);

  const send = useCallback((data: SessionAction, after?: () => void) => {
    if (inflightRef.current || pendingRef.current) return false;
    inflightRef.current = true;
    setStationError(false);
    actRef.current(data, () => { inflightRef.current = false; if (data.action === 'start-fueling' || data.action === 'fuel-tick') lastTickRef.current = performance.now(); after?.(); });
    return true;
  }, []);

  const release = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
  }, []);

  useEffect(() => {
    if (!pending && inflightRef.current) {
      // ActFn calls the callback only on success. Stop a failed hold instead
      // of automatically retrying a rejected request every scheduler tick.
      inflightRef.current = false;
      setStationError(true);
      release();
    }
  }, [pending, release]);

  /* Single scheduler: queued pause has priority, never overlaps mutations. */
  useEffect(() => {
    if (!isHost) return;
    const id = window.setInterval(() => {
      const s = fRef.current;
      if (!s || s.completed || inflightRef.current || pendingRef.current) return;
      if (!holdingRef.current) {
        if (s.loading) send({ action: 'pause-fueling' });
        return;
      }
      if (!s.connected || s.loadedKg >= s.targetKg) {
        release();
        if (s.loading) send({ action: 'pause-fueling' });
        return;
      }
      if (!s.loading) send({ action: 'start-fueling' });
      else if (performance.now() - lastTickRef.current >= TICK_MS) send({ action: 'fuel-tick' });
    }, 100);
    return () => window.clearInterval(id);
  }, [isHost, send, release]);

  useEffect(() => {
    const onHidden = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [release]);

  /* ---------- smooth visual amount (display only, never persisted) ---------- */
  const [visual, setVisual] = useState(f?.loadedKg ?? 0);
  const baseRef = useRef({ kg: f?.loadedKg ?? 0, t: performance.now() });
  useEffect(() => { baseRef.current = { kg: f?.loadedKg ?? 0, t: performance.now() }; }, [f?.loadedKg, f?.loading]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = fRef.current;
      if (s) {
        const flowing = s.loading && (!isHost || holdingRef.current);
        const b = baseRef.current;
        const goal = flowing ? Math.min(s.targetKg, s.loadedKg + Math.floor(availableRef.current / s.pricePerKg), b.kg + s.rateKgPerSecond * 1.5, b.kg + (s.rateKgPerSecond * (performance.now() - b.t)) / 1000) : s.loadedKg;
        setVisual((v) => {
          if (calm) return goal;
          const nv = flowing ? Math.max(v, goal) : v + (goal - v) * 0.25;
          return Math.abs(nv - goal) < 0.5 ? goal : nv;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm, isHost]);

  /* ---------- target draft ---------- */
  const [draft, setDraft] = useState(String(f?.targetKg ?? 0));
  const lastTarget = useRef(f?.targetKg);
  useEffect(() => { if (f && f.targetKg !== lastTarget.current) { lastTarget.current = f.targetKg; setDraft(String(f.targetKg)); } }, [f]);

  /* ---------- hose geometry ---------- */
  const stageRef = useRef<HTMLDivElement>(null);
  const portRef = useRef<HTMLButtonElement>(null);
  const [geo, setGeo] = useState({ w: 600, h: 420, ox: 70, oy: 300, px: 330, py: 210 });
  const measure = useCallback(() => {
    const st = stageRef.current, p = portRef.current;
    if (!st || !p) return;
    const a = st.getBoundingClientRect(), b = p.getBoundingClientRect();
    setGeo({ w: a.width, h: a.height, ox: Math.min(90, a.width * 0.16), oy: a.height * 0.62, px: b.left - a.left + b.width / 2, py: b.top - a.top + b.height / 2 });
  }, []);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [measure, f?.completed]);

  const rest = { x: geo.ox + 4, y: geo.h - 46 };
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [nz, setNz] = useState(rest);
  const connected = !!f?.connected;
  const target = drag ?? (connected ? { x: geo.px - 14, y: geo.py } : rest);
  const goalRef = useRef(target);
  goalRef.current = target;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNz((p) => {
        const g = goalRef.current;
        if (Math.hypot(p.x - g.x, p.y - g.y) < 0.01) return p;
        if (calm || drag) return g;
        const n = { x: p.x + (g.x - p.x) * 0.18, y: p.y + (g.y - p.y) * 0.18 };
        return Math.hypot(n.x - g.x, n.y - g.y) < 0.4 ? g : n;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [calm, drag]);

  const near = !!drag && Math.hypot(drag.x - geo.px, drag.y - geo.py) < 70;
  const [flash, setFlash] = useState(0);

  if (!f) {
    return (
      <div className="relative z-10 flex h-full items-center justify-center p-6" data-testid="status-fuel-waiting">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Fuel station is not open yet. Waiting for the Leader.</p>
      </div>
    );
  }

  const canOperate = isHost && !f.completed;
  const budget = mission?.budget ?? 0;
  const spentNow = session.build?.spent ?? 0;
  const available = budget - spentNow; // fuel spent already included
  const visualKg = Math.min(f.capacityKg, Math.max(0, visual));
  const visualCost = f.spent + Math.max(0, visualKg - f.loadedKg) * f.pricePerKg;
  const fill = f.capacityKg ? (visualKg / f.capacityKg) * 100 : 0;
  const progress = f.targetKg ? Math.min(100, (visualKg / f.targetKg) * 100) : 0;
  const draftNum = Math.round(Number(draft));
  const draftValid = Number.isFinite(draftNum) && draftNum >= Math.ceil(f.loadedKg) && draftNum <= f.capacityKg && draftNum <= 30000;
  const extraCost = Math.max(0, (draftValid ? draftNum : f.targetKg) - f.loadedKg) * f.pricePerKg;
  const affordableKg = Math.floor(f.loadedKg + Math.max(0, available) / f.pricePerKg);
  const unaffordable = extraCost > available;
  const done = f.targetKg > 0 && f.loadedKg >= f.targetKg && !f.loading;
  const flowing = f.loading && (!isHost || holding);
  const phase: Phase = f.completed || done ? 'FUELING COMPLETE' : flowing ? 'FUELING IN PROGRESS' : f.loadedKg > 0 && connected ? 'PAUSED' : connected ? 'CONNECTED' : 'DISCONNECTED';
  const minKg = Math.ceil(f.loadedKg);

  const commitTarget = (n: number) => {
    const v = Math.max(minKg, Math.min(f.capacityKg, Math.round(n)));
    setDraft(String(v));
    if (v !== f.targetKg && canOperate && !f.loading && !pending) send({ action: 'set-fuel-target', quantityKg: v });
  };

  const connect = () => { if (canOperate && !connected && !pending) send({ action: 'connect-fuel-hose' }, () => setFlash((x) => x + 1)); };
  const disconnect = () => { if (canOperate && connected && !f.loading && !pending) send({ action: 'disconnect-fuel-hose' }); };

  const holdDisabled = !canOperate || !connected || f.loadedKg >= f.targetKg || available < f.pricePerKg || (!holding && (pending || Number(draft) !== f.targetKg));
  const startHold = () => { if (holdDisabled) return; holdingRef.current = true; setHolding(true); };

  /* nozzle drag */
  const local = (e: RPointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: Math.max(8, Math.min(r.width - 8, e.clientX - r.left)), y: Math.max(8, Math.min(r.height - 8, e.clientY - r.top)) };
  };
  const onNzDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!canOperate || connected || pending) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(local(e));
  };
  const onNzMove = (e: RPointerEvent<HTMLButtonElement>) => { if (drag) setDrag(local(e)); };
  const onNzUp = () => { if (!drag) return; const hit = near; setDrag(null); if (hit) connect(); };

  /* hose path */
  const sx = geo.ox, sy = geo.oy, ex = nz.x, ey = nz.y;
  const dist = Math.hypot(ex - sx, ey - sy);
  const sag = Math.max(30, 140 - dist * 0.25);
  const hose = `M ${sx} ${sy} C ${sx + 30} ${sy + sag}, ${ex - 60} ${ey + sag * 0.8}, ${ex - 12} ${ey}`;

  const lights = { red: phase === 'DISCONNECTED', amber: phase === 'CONNECTED' || phase === 'PAUSED', ion: phase === 'FUELING IN PROGRESS', green: phase === 'FUELING COMPLETE' };

  /* ---------- completed ---------- */
  if (f.completed) {
    return (
      <div className="relative z-10" data-testid="panel-fuel-completed">
        <motion.div initial={calm ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="mx-auto grid max-w-4xl gap-6 px-4 py-8 md:grid-cols-[180px_1fr] md:px-8">
          <div className="relative mx-auto h-72 w-32">
            <HullVisual hullId={session.build?.selectedHullId} className="h-full" />
            <div className="absolute bottom-2 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-ion/60" />
          </div>
          <div>
            <div className="kicker mb-2 flex items-center gap-2"><Check className="h-3.5 w-3.5 text-burn" /> Stage 3 complete</div>
            <h1 className="font-display text-4xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-fuel-completed">Fuel Load Confirmed</h1>
            <p className="mt-1 text-sm text-muted-foreground">The Leader sealed the propellant load. The cost was charged during fueling; confirmation added no extra charge.</p>
            <dl className="mt-5 rounded-md border border-white/10 bg-void/70 px-3">
              <Row label="Fuel type" value={f.fuelType} testid="text-fuel-final-type" />
              <Row label="Loaded" value={kg(f.loadedKg)} tone="text-ion" testid="text-fuel-final-loaded" />
              <Row label="Tank fill" value={pct((f.loadedKg / f.capacityKg) * 100)} testid="text-fuel-final-fill" />
              <Row label="Fuel cost" value={formatExact(f.spent)} tone="text-burn" testid="text-fuel-final-cost" />
              <Row label="Budget remaining" value={formatExact(available)} tone="text-ion" testid="text-fuel-final-remaining" />
            </dl>
            <div className="mt-4">
              {isHost
                ? <HudButton variant="burn" loading={pendingAction === 'open-briefing'} disabled={pending} onClick={() => act({ action: 'open-briefing' })} data-testid="button-open-briefing">Continue to Mission Briefing <ArrowRight className="h-4 w-4" /></HudButton>
                : <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground" data-testid="text-fuel-next">Waiting for the Leader to open the Mission Briefing.</p>}
            </div>
            <div className="mt-4"><Disclaimer /></div>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------- active station ---------- */
  return (
    <div className="relative z-10" data-testid="panel-fuel-station">
      <div className="mx-auto max-w-6xl px-3 py-5 md:px-6">
        <div className="kicker mb-1 flex items-center gap-2"><Fuel className="h-3.5 w-3.5 text-burn" /> Propellant operations</div>
        <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl" data-testid="text-fuel-title">Fuel Loading Station</h1>
        <p className="mt-1 text-sm text-muted-foreground">Refuel Your Rocket Before Launch</p>
        {stationError && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-void/90 p-3 text-sm text-destructive" data-testid="alert-fuel-command">
          Fuel station command failed. Pumping has stopped. Your saved fuel load is safe. Check your connection and try again.
        </p>}
        {!isHost && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-fuel-leader-only"><Lock className="h-3.5 w-3.5" /> Only the Leader operates the pump. You are watching live telemetry.</p>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
          {/* ---------- pad ---------- */}
          <div ref={stageRef} className="glass hud-corners scanline relative h-[440px] touch-none select-none overflow-hidden rounded-lg" data-testid="panel-fuel-pad">
            {/* pump */}
            <motion.div
              className="absolute bottom-6 left-3 w-[clamp(90px,16%,120px)] rounded-md border border-white/15 bg-[linear-gradient(180deg,hsl(220_40%_14%),hsl(224_50%_7%))] p-2"
              animate={flowing && !calm ? { x: [0, -0.8, 0.8, 0] } : { x: 0 }}
              transition={flowing && !calm ? { duration: 0.18, repeat: Infinity } : { duration: 0.2 }}
            >
              <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Pump 03</div>
              <div className="mt-1 rounded-sm border border-ion/30 bg-void px-1.5 py-1 font-mono text-[9px] leading-tight text-ion" role="status" aria-live="polite" data-testid="status-pump">{phase}</div>
              <div className="mt-1.5 flex gap-1.5">
                <Light on={lights.red} tone="bg-destructive" /><Light on={lights.amber} tone="bg-[hsl(40_90%_60%)]" /><Light on={lights.ion} tone="bg-ion" /><Light on={lights.green} tone="bg-[hsl(150_70%_55%)]" />
              </div>
              <div className="mt-2 font-mono text-[10px] tabular-nums text-foreground/80">{kg(visualKg)}</div>
              <div className="h-24" />
            </motion.div>

            {/* rocket */}
            <div className="absolute inset-y-4 left-[52%] flex -translate-x-1/2 items-end">
              <div className="relative h-full">
                <HullVisual hullId={session.build?.selectedHullId} className="h-full" />
                {/* tank gauge */}
                <div className="absolute -right-7 bottom-[18%] top-[22%] w-3 overflow-hidden rounded-full border border-white/15 bg-void/80" aria-hidden>
                  <div className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-gradient-to-t from-burn to-ion" style={{ transform: `scaleY(${fill / 100})` }} />
                  <div className="absolute inset-x-0 h-px bg-white" style={{ bottom: `${(f.targetKg / f.capacityKg) * 100}%` }} />
                </div>
                <button
                  ref={portRef}
                  type="button"
                  onClick={connected ? disconnect : connect}
                  disabled={!canOperate || pending || (connected && f.loading)}
                  aria-label={connected ? 'Disconnect fuel hose from rocket port' : 'Connect fuel hose to rocket port'}
                  className={cn('absolute left-[18%] top-[58%] h-5 w-5 -translate-x-1/2 rounded-full border-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion',
                    connected ? 'border-[hsl(150_70%_55%)] bg-[hsl(150_70%_55%)/.3]' : near ? 'scale-150 border-ion bg-ion/40' : 'border-ion/70 bg-void/80')}
                  data-testid="button-fuel-port"
                />
                <AnimatePresence>
                  {flash > 0 && !calm && (
                    <motion.span key={flash} className="pointer-events-none absolute left-[18%] top-[58%] h-5 w-5 -translate-x-1/2 rounded-full border-2 border-ion" initial={{ scale: 1, opacity: 1 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 0.7 }} />
                  )}
                </AnimatePresence>
              </div>
            </div>
            {!hull && <div className="absolute left-1/2 top-3 -translate-x-1/2 font-mono text-[10px] uppercase text-muted-foreground">No hull on record</div>}

            {/* hose */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <path d={hose} fill="none" stroke="hsl(220 30% 8%)" strokeWidth="11" strokeLinecap="round" />
              <path d={hose} fill="none" stroke="hsl(218 25% 30%)" strokeWidth="8" strokeLinecap="round" />
              {flowing && <path d={hose} fill="none" stroke="hsl(186 92% 56%)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 14" className={calm ? '' : 'fuel-flow'} />}
            </svg>
            <style>{'@keyframes fuel-flow{to{stroke-dashoffset:-48}}.fuel-flow{animation:fuel-flow .5s linear infinite}'}</style>

            {/* nozzle */}
            <button
              type="button"
              onPointerDown={onNzDown}
              onPointerMove={onNzMove}
              onPointerUp={onNzUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (connected) disconnect(); else connect(); } }}
              disabled={!canOperate || pending}
              aria-label={connected ? 'Fuel nozzle connected. Press Enter to disconnect.' : 'Fuel nozzle. Drag to the rocket port, or press Enter to connect.'}
              className={cn('absolute flex h-8 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border bg-[hsl(220_35%_16%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion',
                connected ? 'border-[hsl(150_70%_55%)]' : 'border-ion/60', canOperate && !connected ? 'cursor-grab active:cursor-grabbing' : 'cursor-default')}
              style={{ left: nz.x, top: nz.y }}
              data-testid="button-fuel-nozzle"
            >
              {connected ? <Link2 className="h-4 w-4 text-[hsl(150_70%_55%)]" /> : <Plug className="h-4 w-4 text-ion" />}
            </button>
            {canOperate && !connected && !drag && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest text-ion/80">Drag the nozzle to the glowing port</div>
            )}
          </div>

          {/* ---------- dashboard ---------- */}
          <aside className="space-y-3">
            <div className="glass rounded-lg p-3" data-testid="panel-fuel-dashboard">
              <div className="kicker mb-1">Fuel dashboard</div>
              <dl>
                <Row label="Fuel type" value={f.fuelType} testid="text-fuel-type" />
                <Row label="Tank capacity" value={kg(f.capacityKg)} testid="text-fuel-capacity" />
                <Row label="Target" value={kg(f.targetKg)} testid="text-fuel-target" />
                <Row label="Fuel loaded" value={kg(visualKg)} tone="text-ion" testid="text-fuel-loaded" />
                <Row label="Tank fill" value={pct(fill)} testid="text-fuel-fill" />
                <Row label="Fuel cost" value={formatExact(visualCost)} tone="text-burn" testid="text-fuel-cost" />
                <Row label="Pump speed" value={`${f.rateKgPerSecond.toLocaleString('en-US')} kg/s`} testid="text-fuel-rate" />
                <Row label="Price" value={`${formatExact(f.pricePerKg)} / kg`} testid="text-fuel-price" />
                <Row label="Status" value={phase === 'FUELING IN PROGRESS' ? 'In progress' : phase.charAt(0) + phase.slice(1).toLowerCase()} testid="text-fuel-status" />
              </dl>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Fueling progress">
                <div className="h-full origin-left bg-gradient-to-r from-burn to-ion" style={{ transform: `scaleX(${progress / 100})` }} />
              </div>
            </div>

            <div className="glass rounded-lg p-3" data-testid="panel-fuel-target">
              <div className="kicker mb-2">Fuel quantity</div>
              <input
                type="range" min={0} max={f.capacityKg} step={100}
                value={Math.max(minKg, Number(draft) || 0)}
                disabled={!canOperate || f.loading || pending}
                onChange={(e) => setDraft(String(Math.max(minKg, Number(e.target.value))))}
                onPointerUp={() => commitTarget(Number(draft))}
                onKeyUp={() => commitTarget(Number(draft))}
                aria-label="Target fuel quantity"
                className="w-full accent-[hsl(186_92%_56%)]"
                data-testid="input-fuel-target-slider"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number" inputMode="numeric" min={minKg} max={f.capacityKg} step={1}
                  value={draft}
                  disabled={!canOperate || f.loading || pending}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => draftValid ? commitTarget(draftNum) : setDraft(String(f.targetKg))}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  aria-label="Target fuel quantity in kilograms"
                  className="min-w-0 flex-1 rounded-md border border-white/15 bg-void/80 px-2 py-1.5 font-mono text-sm outline-none focus:border-ion/60"
                  data-testid="input-fuel-target"
                />
                <span className="font-mono text-xs text-muted-foreground">kg</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {[25, 50, 75, 100].map((p) => {
                  const v = Math.round((f.capacityKg * p) / 100);
                  return (
                    <button key={p} type="button" disabled={!canOperate || f.loading || pending || v < minKg} onClick={() => commitTarget(v)}
                      className={cn('rounded border py-1 font-mono text-[11px] transition-colors disabled:opacity-30', f.targetKg === v ? 'border-ion bg-ion/15 text-ion' : 'border-white/15 hover:border-ion/60')}
                      data-testid={`button-fuel-preset-${p}`}>{p}%</button>
                  );
                })}
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted-foreground" data-testid="text-fuel-estimate">
                Estimated additional cost <span className="text-burn">{formatExact(extraCost)}</span>
              </div>
              {!draftValid && draft !== '' && <p className="mt-1 text-[11px] text-destructive" data-testid="text-fuel-target-invalid">Enter {kg(minKg)} to {kg(f.capacityKg)}. Loaded fuel cannot be removed.</p>}
              {unaffordable && (
                <p className="mt-1 flex gap-1.5 text-[11px] text-destructive" data-testid="text-fuel-unaffordable"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Budget covers about {kg(affordableKg)}. Pumping stops when funds run out.</p>
              )}
            </div>

            {isHost && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={holdDisabled}
                  onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); startHold(); }}
                  onPointerUp={release}
                  onPointerCancel={release}
                  onLostPointerCapture={release}
                  onContextMenu={(e) => e.preventDefault()}
                  onKeyDown={(e: RKeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } }}
                  onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') release(); }}
                  onBlur={release}
                  aria-pressed={holding}
                  className={cn('relative w-full touch-none select-none overflow-hidden rounded-md border py-4 font-display text-sm font-bold uppercase tracking-[.2em] transition-colors disabled:opacity-40',
                    holding ? 'border-ion bg-ion/25 text-ion' : 'border-burn bg-burn text-void')}
                  data-testid="button-fuel-hold"
                >
                  <span className="relative">{holding ? 'Fueling... release to stop' : !connected ? 'Connect hose first' : f.loadedKg >= f.targetKg ? 'Target reached' : 'Hold to refuel'}</span>
                </button>
                <p className="text-center font-mono text-[10px] text-muted-foreground">Hold with mouse, touch, Space or Enter</p>
                <div className="grid grid-cols-2 gap-2">
                  <HudButton variant="ghost" disabled={!connected || f.loading || pending} loading={pendingAction === 'disconnect-fuel-hose'} onClick={disconnect} data-testid="button-fuel-disconnect">
                    <Unplug className="h-4 w-4" /> Disconnect
                  </HudButton>
                  <HudButton variant="ion" disabled={!done || pending} loading={pendingAction === 'confirm-fuel'} onClick={() => send({ action: 'confirm-fuel' })} data-testid="button-fuel-confirm">
                    <CheckCircle2 className="h-4 w-4" /> Confirm fuel load
                  </HudButton>
                </div>
                {done && <p className="text-[11px] text-muted-foreground" data-testid="text-fuel-ready">Target reached. Confirm the fuel load, or raise the target to keep pumping. Cost is already charged.</p>}
              </div>
            )}
            <Disclaimer />
          </aside>
        </div>
      </div>
    </div>
  );
}
