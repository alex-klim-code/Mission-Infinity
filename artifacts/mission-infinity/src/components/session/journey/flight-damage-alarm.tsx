import { AlertOctagon } from 'lucide-react';
import type { HardwareCheck } from '@workspace/api-client-react';

/** Alarms remain outside the scene; only their list scrolls, newest first. */
export function FlightDamageAlarm({ alerts }: { alerts: HardwareCheck[] }) {
  if (!alerts.length) return null;
  return (
    <section role="alert" aria-live="assertive" aria-atomic="false" className="relative z-20 shrink-0 border-b border-destructive/60 bg-card px-3 py-2 text-sm" data-testid="alert-flight-damage">
      <div className="flex items-start gap-2">
        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xs font-bold uppercase text-destructive">Damage alarms — {alerts.length}</h2>
          <ul tabIndex={0} aria-label="Flight damage alarms" className="scroll-thin mt-1 max-h-[18dvh] space-y-2 overflow-y-auto overscroll-contain">
            {[...alerts].reverse().map(current => (
              <li key={current.id}>
                <p className="break-words text-xs" data-testid="text-flight-damaged-part">{current.name} — damaged during flight.</p>
                <p className="text-[10px] text-muted-foreground">{current.critical ? 'Critical system: Earth return is blocked while damaged.' : 'Non-critical damage recorded for the hardware check.'}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
