import { useState } from 'react';
import { AlertTriangle, CalendarDays, Check } from 'lucide-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Props } from '../rocket-shared';
import { WEATHER, Waiting, fmtUtcDate } from './shared';

export function CalendarView({ session, isHost, act, pending, pendingAction }: Props) {
  const j = session.journey;
  const days = j?.weather ?? [];
  const [draft, setDraft] = useState<string | null>(j?.briefingDate ?? null);
  const sel = days.find((d) => d.date === draft);
  const w = sel ? WEATHER[sel.condition] : null;
  const lead = days[0] ? (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8" data-testid="panel-journey-calendar">
      <div className="kicker mb-2 flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-burn" /> Launch window</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl">Pick launch day</h1>
      <p className="mt-2 text-sm text-muted-foreground">28-day forecast for the launch site, frozen by Mission Control. All dates in UTC.{!isHost && ' You can preview days; the Leader confirms.'}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="glass rounded-lg p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground" aria-hidden>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1" role="listbox" aria-label="Launch dates">
            {Array.from({ length: lead }, (_, i) => <div key={`pad-${i}`} />)}
            {days.map((d) => {
              const m = WEATHER[d.condition];
              const Icon = m.icon;
              const on = d.date === draft;
              const confirmed = d.date === j?.briefingDate;
              return (
                <button key={d.date} type="button" role="option" aria-selected={on} onClick={() => setDraft(d.date)}
                  aria-label={`${fmtUtcDate(d.date)}: ${m.label}`}
                  className={cn('relative flex min-w-0 flex-col items-center gap-1 rounded-md border px-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion',
                    on ? 'border-ion bg-ion/15' : 'border-white/10 bg-void/60 hover:border-ion/50', m.risk && !on && 'border-destructive/30')}
                  data-testid={`button-calendar-date-${d.date}`}>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground">{fmtUtcDate(d.date, { month: 'short' })}</span>
                  <span className="font-display text-base font-bold leading-none tabular-nums">{fmtUtcDate(d.date, { day: 'numeric' })}</span>
                  <Icon className={cn('h-4 w-4', m.tone)} aria-hidden />
                  {confirmed && <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-[hsl(150_70%_55%)]" />}
                </button>
              );
            })}
          </div>
          {days.length === 0 && <p className="p-4 text-sm text-muted-foreground" data-testid="text-calendar-empty">Forecast not available yet.</p>}
        </div>

        <aside className="glass rounded-lg p-3" data-testid="panel-calendar-selected">
          <div className="kicker mb-2">Selected day</div>
          {sel && w ? (
            <>
              <div className="flex items-center gap-3">
                <w.icon className={cn('h-10 w-10', w.tone)} aria-hidden />
                <div>
                  <div className="font-display text-lg font-bold uppercase" data-testid="text-calendar-selected-date">{fmtUtcDate(sel.date)}</div>
                  <div className="font-mono text-xs text-muted-foreground" data-testid="text-calendar-selected-weather">{w.label} / UTC</div>
                </div>
              </div>
              {sel.condition === 'RAIN' && <p className="mt-3 flex gap-2 rounded-md border border-[hsl(205_80%_65%/.4)] bg-[hsl(205_80%_65%/.1)] p-2 text-xs text-[hsl(205_80%_75%)]" data-testid="text-calendar-rain-risk"><AlertTriangle className="h-4 w-4 shrink-0" /> Rain day: 25% chance the launch fails and the rocket needs repairs.</p>}
              {w.risk && <p role="alert" className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive" data-testid="alert-calendar-weather"><AlertTriangle className="h-4 w-4 shrink-0" /> {sel.condition === 'STORM' ? 'Storm forecast. Launching in a storm is unsafe.' : 'Strong wind forecast. High winds can push a rocket off course.'} Consider another day.</p>}
            </>
          ) : <p className="text-sm text-muted-foreground">Tap a date to see its forecast.</p>}
          <div className="mt-4">
            {isHost
              ? <HudButton variant="burn" className="w-full" disabled={!draft || pending} loading={pendingAction === 'confirm-briefing-date'} onClick={() => draft && act({ action: 'confirm-briefing-date', briefingDate: draft })} data-testid="button-date-confirm"><Check className="h-4 w-4" /> Confirm launch date</HudButton>
              : <Waiting testid="text-calendar-guest">Waiting for the Leader to confirm</Waiting>}
          </div>
        </aside>
      </div>
    </div>
  );
}
