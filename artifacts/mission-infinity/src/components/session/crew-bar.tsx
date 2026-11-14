import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Crown, MessageSquare, Sparkles, X } from 'lucide-react';
import type { GameSession, SessionPlayer } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Portrait } from '@/components/ui-kit';
import { MessageComposer } from '@/components/session/session-shared';
import { ChatHistory } from '@/components/session/chat-history';
import { cn } from '@/lib/utils';
import { FundingControl } from '@/components/session/funding-panel';
import { MissionNotifications } from '@/components/session/mission-notifications';

export type CrewFlag = (sp: SessionPlayer, leader: boolean) => { on: boolean; label: string };

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

const live = (sp: SessionPlayer, now: number) => (sp.lastMessage && new Date(sp.lastMessage.expiresAt).getTime() > now ? sp.lastMessage : null);

/** Current viewer first on every client; stable roster order otherwise. */
export function orderCrew(session: GameSession, meId: string) {
  const mine = session.players.filter((p) => p.player.id === meId);
  return [...mine, ...session.players.filter((p) => p.player.id !== meId)];
}

/* ---------- Crew chat dialog ---------- */

function CrewChatDialog({ open, onOpenChange, session, meId }: { open: boolean; onOpenChange: (o: boolean) => void; session: GameSession; meId: string }) {
  const panelRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    // Keep focus within the opening gesture so mobile browsers can show the keyboard.
    panelRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
  }, [open]);
  // Hiding, not unmounting, preserves drafts and in-flight send callbacks.
  return createPortal(
      <section ref={panelRef} id="crew-chat-panel" role="region" hidden={!open} aria-labelledby="crew-chat-title"
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onOpenChange(false); } }}
        className="pointer-events-auto fixed right-3 top-32 z-40 max-h-[calc(100dvh-9rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-ion/25 bg-card/95 shadow-2xl" data-testid="dialog-crew-chat">
        <div className="relative border-b border-white/10 p-3 pr-12">
          <div className="kicker">Crew channel</div>
          <h2 id="crew-chat-title" className="font-display text-lg font-bold uppercase tracking-wider">Crew chat</h2>
          <p className="text-xs text-muted-foreground">Keep playing while you chat. New messages appear on the right.</p>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close crew chat"
            className="absolute right-2 top-2 rounded p-2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ion" data-testid="button-close-chat">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ChatHistory session={session} meId={meId} open={open} />
        <div className="border-t border-white/10 p-3">
          <MessageComposer sessionId={session.id} />
        </div>
      </section>,
      document.body,
  );
}

/* ---------- AI advisor draft (not connected) ---------- */

const aiDrafts = new Map<string, string>();

function AiDraftDialog({ open, onOpenChange, draftKey }: { open: boolean; onOpenChange: (o: boolean) => void; draftKey: string }) {
  const [draft, setDraft] = useState(() => aiDrafts.get(draftKey) ?? '');
  const update = (v: string) => {
    const t = v.slice(0, 600);
    aiDrafts.set(draftKey, t);
    setDraft(t);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border-white/10 bg-card p-5" data-testid="dialog-ai-advisor">
        <div className="pr-8">
          <div className="kicker text-burn">Mission advisor / Offline</div>
          <DialogTitle className="mt-1 font-display text-xl font-bold uppercase tracking-wider">Advisor notepad</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            The AI advisor is not connected yet. You can draft a question while this game tab is open; reloading clears it. Nothing is sent, and it is never posted to crew chat.
          </DialogDescription>
        </div>
        <label htmlFor="ai-draft" className="sr-only">Draft question for the advisor</label>
        <textarea
          id="ai-draft"
          value={draft}
          onChange={(e) => update(e.target.value)}
          rows={5}
          placeholder="Draft a question for the advisor"
          className="w-full resize-none rounded-md border border-white/15 bg-void/70 p-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-burn/60"
          data-testid="input-ai-message"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">{draft.length}/600 / draft only</span>
          <button onClick={() => update('')} disabled={!draft} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40" data-testid="button-clear-ai-draft">
            Clear draft
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Bottom crew bar ---------- */

const roundBtn = 'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion';

export function CrewBar({ session, flag, meId, onOpenBadge, children }: { session: GameSession; flag: CrewFlag; meId: string; onOpenBadge: (id: string) => void; children?: ReactNode }) {
  const now = useNow();
  const [chat, setChat] = useState(false);
  const [ai, setAi] = useState(false);
  const crew = orderCrew(session, meId);
  const anyLive = crew.some((sp) => live(sp, now));
  return (
    <div className="relative z-20 shrink-0 border-t border-white/[.08] bg-void/80 backdrop-blur-xl" data-testid="bar-crew">
      {children}
      <div className="flex w-full flex-wrap items-end gap-2 px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
        <ul className="flex min-w-0 flex-1 basis-[3.75rem] items-end overflow-x-auto gap-0.5 sm:basis-[12rem] sm:gap-3" aria-label="Crew">
          {crew.map((sp) => {
            const leader = sp.player.id === session.hostId;
            const f = flag(sp, leader);
            const self = sp.player.id === meId;
            return (
              <li key={sp.player.id} className="relative flex w-[60px] shrink-0 flex-col items-center sm:w-[84px]" data-testid={`crew-${sp.player.id}`}>
                <div className={cn('w-full min-h-7 break-words text-center text-[11px] font-semibold leading-tight [overflow-wrap:anywhere]', self ? 'text-ion' : leader ? 'text-burn' : 'text-foreground')} data-testid={`text-crew-name-${sp.player.id}`}>
                  {sp.player.name}
                </div>
                <button
                  onClick={() => onOpenBadge(sp.player.id)}
                  aria-label={`Open ${sp.player.name} employee badge${self ? ' (you)' : ''}${leader ? ', Leader' : ''}`}
                  className="relative mt-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  data-testid={`button-crew-badge-${sp.player.id}`}
                >
                  <Portrait player={sp.player} size={42} ring={leader ? 'burn' : f.on ? 'ion' : 'none'} className={cn(!sp.connected && 'opacity-40 grayscale')} />
                  {leader && (
                    <span className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-burn text-void" aria-hidden>
                      <Crown className="h-2.5 w-2.5" />
                    </span>
                  )}
                  {f.on && !leader && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ion text-void" aria-hidden>
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
                <div className={cn('mt-0.5 min-h-5 w-full break-words text-center font-mono text-[8px] uppercase leading-tight', !sp.connected ? 'text-muted-foreground' : leader ? 'text-burn' : f.on ? 'text-ion' : 'text-muted-foreground')}>
                  {self ? 'You / ' : ''}{!sp.connected ? 'Offline' : leader ? 'Leader' : f.label}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 self-center sm:gap-2">
          <FundingControl session={session} meId={meId} />
          <button className={cn(roundBtn, 'border-white/15 bg-void/60 hover:border-ion hover:text-ion')} onClick={() => setChat(value => !value)} aria-label={chat ? 'Close crew chat' : 'Open crew chat'} aria-expanded={chat} aria-controls="crew-chat-panel" title="Crew chat" data-testid="button-open-chat">
            <MessageSquare className="h-4 w-4" />
            {anyLive && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ion" aria-hidden />}
          </button>
          <button className={cn(roundBtn, 'border-burn/40 bg-burn/10 text-burn hover:border-burn')} onClick={() => setAi(true)} aria-label="Open advisor notepad (AI not connected)" title="Advisor notepad" data-testid="button-open-ai">
            <Sparkles className="h-4 w-4" />
          </button>
          <MissionNotifications key={`notification:${session.id}:${meId}`} session={session} meId={meId} />
        </div>
      </div>
      <CrewChatDialog key={`chat:${session.id}:${meId}`} open={chat} onOpenChange={setChat} session={session} meId={meId} />
      <AiDraftDialog key={`advisor:${session.id}:${meId}`} open={ai} onOpenChange={setAi} draftKey={`${session.id}:${meId}`} />
    </div>
  );
}
