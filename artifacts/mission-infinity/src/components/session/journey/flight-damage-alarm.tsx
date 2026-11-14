import { useState } from 'react';
import { AlertOctagon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HardwareCheck } from '@workspace/api-client-react';

/** Always outside the paged scene, so an alarm cannot disappear on another page. */
export function FlightDamageAlarm({ alerts }: { alerts: HardwareCheck[] }) {
  const [chosen, setChosen] = useState<{ count: number; index: number } | null>(null);
  if (!alerts.length) return null;
  const index = chosen?.count === alerts.length ? chosen.index : alerts.length - 1;
  const current = alerts[index];
  return (
    <section role="alert" aria-live="assertive" className="relative z-20 shrink-0 border-b border-destructive/60 bg-card px-3 py-2 text-sm" data-testid="alert-flight-damage">
      <div className="flex items-start gap-2">
        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xs font-bold uppercase text-destructive">Damage alarm — {index + 1} / {alerts.length}</h2>
          <p className="break-words text-xs" data-testid="text-flight-damaged-part">{current.name} — damaged during flight.</p>
          <p className="text-[10px] text-muted-foreground">{current.critical ? 'Critical return system. Earth departure will be blocked unless the system is operational.' : 'Non-critical hardware. Damage is saved for the mission hardware check.'}</p>
        </div>
        {alerts.length > 1 && <nav className="flex shrink-0 gap-1" aria-label="Damage alarms">
          <button type="button" aria-label="Previous damage alarm" disabled={index === 0} onClick={() => setChosen({count: alerts.length,index:index-1})} className="rounded border border-white/20 p-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Next damage alarm" disabled={index === alerts.length-1} onClick={() => setChosen({count: alerts.length,index:index+1})} className="rounded border border-white/20 p-1 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </nav>}
      </div>
    </section>
  );
}
