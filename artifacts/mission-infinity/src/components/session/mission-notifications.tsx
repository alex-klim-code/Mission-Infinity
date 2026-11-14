import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { GameSession } from '@workspace/api-client-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMissionNotifications } from '@/hooks/use-mission-notifications';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollPanel } from './scroll-panel';
import type { MissionNotification } from '@/lib/mission-notifications';

const roundBtn = 'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion';

const tone: Record<string, string> = {
  error: 'border-l-red-400 text-red-300',
  warning: 'border-l-burn text-burn',
  success: 'border-l-emerald-400 text-emerald-300',
  info: 'border-l-ion text-ion',
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function MissionNotifications({ session, meId }: { session: GameSession; meId: string }) {
  const { items, unread, markAllRead, storageWarning } = useMissionNotifications(session, meId);
  const [open, setOpen] = useState(false);
  const [detail,setDetail]=useState<MissionNotification|null>(null);
  const badge = unread > 99 ? '99+' : String(unread);
  const titleId = `notif-title-${session.id}-${meId}`;

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(roundBtn, 'border-white/15 bg-void/60 hover:border-ion hover:text-ion', open && 'border-ion text-ion')}
          aria-label={unread ? `Notifications, ${badge} unread` : 'Notifications'} title="Notifications" data-testid="button-open-notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[1.15rem] rounded-full bg-burn px-1 text-center font-mono text-[9px] font-bold leading-[1.15rem] text-void" aria-hidden data-testid="badge-notifications-unread">{badge}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={10} collisionPadding={12} role="dialog" aria-labelledby={titleId}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex max-h-[min(30rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden border-ion/25 bg-card/95 p-0 shadow-2xl backdrop-blur-xl"
        data-testid="panel-notifications">
        <div className="relative shrink-0 border-b border-white/10 p-3 pr-12">
          <div className="kicker">Mission log</div>
          <h2 id={titleId} className="font-display text-lg font-bold uppercase tracking-wider">Notifications</h2>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground" data-testid="text-notifications-count">{items.length} total / {unread} unread</span>
            <button type="button" onClick={markAllRead} disabled={!unread} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:border-ion hover:text-ion disabled:opacity-40" data-testid="button-mark-all-read">Mark all read</button>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="absolute right-2 top-2 rounded p-2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ion" data-testid="button-close-notifications">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain" tabIndex={0} role="region" aria-label="Mission notifications">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center" data-testid="empty-notifications">
              <Bell className="h-6 w-6 text-ion/50" />
              <p className="text-sm font-semibold">No notifications yet</p>
              <p className="text-xs text-muted-foreground">Mission alerts will collect here quietly.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5" aria-label="Notification list">
              {items.map((n) => (
                <li key={n.id} className={cn('border-l-2 px-3 py-2', tone[n.severity] ?? tone.info, n.read ? 'bg-transparent' : 'bg-ion/[.06]')} data-testid={`row-notification-${n.id}`}>
                  <button type="button" className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion" aria-label={`Read notification: ${n.title}`} onClick={()=>{setOpen(false);setDetail(n);}}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {!n.read && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-burn align-middle" aria-label="Unread" />}
                      {n.title}
                    </p>
                    <span className={cn('shrink-0 rounded px-1.5 font-mono text-[9px] uppercase tracking-wider', n.active ? 'bg-current/10 border border-current/40' : 'border border-white/10 text-muted-foreground')}>
                      {n.active ? 'Live' : n.scope==='event'?'Recorded':'Earlier'}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]" title={n.message}>{n.message}</p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                    {n.category} / <time dateTime={n.createdAt}>{fmt(n.createdAt)}</time>
                  </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-white/10 px-3 py-1.5 text-[10px] text-muted-foreground">
          {storageWarning?<span className="text-burn" role="status" data-testid="text-notifications-storage-warning">History could not be saved on this device; it remains available in this tab.</span>:'History saved on this device.'}
        </div>
      </PopoverContent>
    </Popover>
    <Dialog open={!!detail} onOpenChange={value=>{if(!value)setDetail(null);}}>
      <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden border-ion/25 bg-card p-0" data-testid="dialog-notification-detail">
        <div className="border-b border-white/10 p-5 pr-12">
          <DialogTitle className="font-display text-xl uppercase">{detail?.title}</DialogTitle>
          <DialogDescription className="mt-1">{detail?.category} / {detail&&fmt(detail.createdAt)}</DialogDescription>
        </div>
        <ScrollPanel className="min-h-0 flex-1" innerClassName="p-5" label="Notification" resetKey={detail?.id}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{detail?.message}</p>
        </ScrollPanel>
      </DialogContent>
    </Dialog>
    </>
  );
}
