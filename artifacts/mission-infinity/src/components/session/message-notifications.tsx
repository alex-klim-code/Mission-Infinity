import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import type { GameSession } from '@workspace/api-client-react';
import { collectCrewNotices, type CrewNotice } from '@/lib/session-notices';

export function MessageNotifications({ session, meId }: { session: GameSession; meId: string }) {
  const [notices, setNotices] = useState<CrewNotice[]>([]);
  const [now, setNow] = useState(Date.now);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    setNotices(previous => collectCrewNotices(previous, session.players, Date.now()));
  }, [session.players]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const visible = notices.filter(n => Date.parse(n.expiresAt) > now).slice(-3).reverse();
  return (
    <aside className="pointer-events-none fixed right-3 top-32 z-30 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-2"
      role="log" aria-label="Live crew messages" aria-live="polite" aria-relevant="additions" data-testid="crew-message-notifications">
      <AnimatePresence initial={false}>
        {visible.map(notice => (
          <motion.div key={notice.id} initial={reducedMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="rounded-md border border-ion/30 bg-void/95 p-3 text-sm shadow-xl"
            data-testid={`message-notification-${notice.id}`}>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-ion">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{notice.name}{notice.playerId === meId ? ' (you)' : ''}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">{notice.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
}
