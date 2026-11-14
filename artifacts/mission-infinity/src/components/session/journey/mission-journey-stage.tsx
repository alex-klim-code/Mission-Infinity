import { AnimatePresence, motion } from 'framer-motion';
import { useCalm, type Props } from '../rocket-shared';
import { RouteView } from './route-view';
import { CalendarView } from './calendar-view';
import { FlightView, MissionDayView } from './flight-view';
import { DiagnosticsView } from './diagnostics-view';
import { LunarGameplayStage, ReturnGameplayStage } from './endgame';
import { HudButton } from '@/components/ui-kit';
import { Waiting, useJourneyTicker } from './shared';

export function MissionJourneyStage(props: Props) {
  const calm = useCalm();
  const j = props.session.journey;
  const phase = j?.phase ?? 'NONE';
  const tickActive = ['FLIGHT','LANDING','RETURN_FLIGHT','REENTRY','RECOVERY'].includes(phase) || (phase === 'SAMPLE_COLLECTION' && !!j?.operations?.siteId) || (phase === 'DIAGNOSTICS' && !j?.diagnosticsComplete);
  const ticker = useJourneyTicker(tickActive, props.isHost, props.act, props.pending,phase === 'LANDING'?500:1000);
  const group = phase === 'MOON_ARRIVAL' || phase === 'FAILED' ? 'FLIGHT' : phase;

  let body;
  switch (phase) {
    case 'ROUTE': body = <RouteView {...props} />; break;
    case 'CALENDAR': body = <CalendarView {...props} />; break;
    case 'MISSION_DAY': body = <MissionDayView {...props} />; break;
    case 'FLIGHT': case 'MOON_ARRIVAL': body = <FlightView {...props} tickError={ticker.error} onRetry={ticker.retry} />; break;
    case 'FAILED': body = <><FlightView {...props} tickError={ticker.error} onRetry={ticker.retry} />{props.isHost&&<div className="px-6 pb-6"><HudButton disabled={props.pending} onClick={()=>props.act({action:'view-results'})} data-testid="button-failed-results">View mission results</HudButton></div>}</>; break;
    case 'DIAGNOSTICS': body = <DiagnosticsView {...props} tickError={ticker.error} onRetry={ticker.retry} />; break;
    case 'LUNAR_OPERATIONS': case 'LANDING': case 'SAMPLE_COLLECTION': body = <LunarGameplayStage {...props} tickError={ticker.error} onRetry={ticker.retry} />; break;
    case 'LANDING_FAILED': case 'RETURN_FLIGHT': case 'RETURN_FAILED': case 'REENTRY': case 'RECOVERY': case 'RESULTS': body = <ReturnGameplayStage {...props} tickError={ticker.error} onRetry={ticker.retry} />; break;
    default: body = <div className="p-6"><Waiting testid="status-journey-waiting">Waiting for Mission Control</Waiting></div>;
  }

  return (
    <div className="scroll-thin relative z-10 h-full overflow-y-auto overflow-x-hidden" data-testid="panel-mission-journey">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={group} initial={calm ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={calm ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -12 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
          {body}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
