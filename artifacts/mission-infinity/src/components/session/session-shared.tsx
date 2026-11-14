import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Crown, FileText, LogOut, Send, UserRound } from 'lucide-react';
import {
  getGetGameSessionQueryKey,
  getGetPlayerQueryKey,
  useSendSessionMessage,
  useUpdateGameSession,
  type GameSession,
  type Mission,
  type PlayerAccount,
  type SessionAction,
  type SessionPlayer,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LinkStatusPill } from '@/components/shell';
import { Portrait } from '@/components/ui-kit';
import { EmployeeBadge } from '@/components/character-avatar';
import { errMsg, formatBudget, invalidateGame } from '@/lib/game';
import { useToast } from '@/hooks/use-toast';
import { usePlayerAccount } from '@/hooks/use-player-account';
import { cn } from '@/lib/utils';

export type ActFn = (data: SessionAction, after?: () => void) => void;

export function useSessionAct(id: string) {
  const mut = useUpdateGameSession();
  const { queryKey: playerQueryKey } = usePlayerAccount();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const act: ActFn = (data, after) =>
    mut.mutate(
      { id, data },
      {
        onSuccess: async (res) => {
          if (!res.session) {
            await Promise.all([
              qc.cancelQueries({ queryKey: getGetGameSessionQueryKey(id) }),
              qc.cancelQueries({ queryKey: getGetPlayerQueryKey() }),
            ]);
            qc.setQueryData<PlayerAccount>(playerQueryKey, (account) =>
              account?.activeSessionId === id ? { ...account, activeSessionId: null } : account);
            qc.removeQueries({ queryKey: getGetGameSessionQueryKey(id), exact: true });
            setLocation('/play');
            void invalidateGame(qc);
            return;
          }
          qc.setQueryData(getGetGameSessionQueryKey(id), res.session);
          if (data.action === 'initiate') void invalidateGame(qc);
          else void qc.invalidateQueries({ queryKey: getGetPlayerQueryKey() });
          after?.();
        },
        onError: (e) => {
          toast({ title: 'Command rejected', description: errMsg(e), variant: 'destructive' });
          void qc.invalidateQueries({ queryKey: getGetGameSessionQueryKey(id) });
        },
      },
    );
  return { act, pending: mut.isPending, pendingAction: mut.isPending ? mut.variables?.data.action : undefined };
}

/* ---------- Briefing ---------- */

export function BriefingBody({ mission }: { mission: Mission }) {
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
        {[
          ['Budget', formatBudget(mission.budget)],
          ['Development', `${mission.developmentMonths} months`],
          ['Operations', `${mission.operationalYears} years`],
          ['Destination', mission.destination],
        ].map(([k, v]) => (
          <div key={k} className="bg-void p-4">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
            <dd className="mt-1 break-words font-display text-xl font-semibold text-ion">{v}</dd>
          </div>
        ))}
      </dl>
      {mission.briefing.map((b, i) => (
        <section key={i}>
          <h3 className="mb-2 flex items-baseline gap-3 font-display text-lg font-bold uppercase tracking-wider">
            <span className="font-mono text-xs text-burn">{String(i + 1).padStart(2, '0')}</span>
            {b.title}
          </h3>
          <p className="whitespace-pre-line leading-relaxed text-foreground/80">{b.text}</p>
        </section>
      ))}
      <div className="grid gap-6 sm:grid-cols-2">
        {([
          ['Objectives', mission.objectives],
          ['Requirements', mission.requirements],
        ] as const).map(([t, list]) => (
          <section key={t}>
            <h3 className="kicker mb-3">{t}</h3>
            <ul className="space-y-2 text-sm">
              {list.map((o) => (
                <li key={o} className="flex gap-2">
                  <span className="mt-2 h-1 w-3 shrink-0 bg-burn" /> {o}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function BriefingDialog({ mission, open, onOpenChange }: { mission: Mission; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden border-white/10 bg-card p-0">
        <div className="border-b border-white/10 p-5 pr-12 sm:p-6">
          <div className="kicker">Classified / Mission {mission.number}</div>
          <DialogTitle className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">{mission.title} briefing</DialogTitle>
          <DialogDescription className="text-muted-foreground">{mission.subtitle}</DialogDescription>
        </div>
        <div className="scroll-thin max-h-[calc(88dvh-130px)] overflow-y-auto p-5 sm:p-6" data-testid="panel-briefing-dialog">
          <BriefingBody mission={mission} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Leave ---------- */

export function LeaveButton({ act, pending }: { act: ActFn; pending: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          aria-label="Leave session"
          title="Leave session"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-void/50 text-muted-foreground backdrop-blur transition-colors hover:border-destructive/60 hover:text-destructive"
          data-testid="button-leave"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100vw-1.5rem)] border-white/10 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase tracking-wider">Leave this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Your crew will continue without you. If you are the Leader, command passes to a connected crew member (or another member if everyone is offline). The session only closes once nobody is left aboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-leave">Stay</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => act({ action: 'leave' })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-leave">
            Leave session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------- Badge dialog ---------- */

export function BadgeDialog({ member, isLeader, isSelf, onOpenChange }: { member: SessionPlayer | null; isLeader: boolean; isSelf: boolean; onOpenChange: (o: boolean) => void }) {
  const p = member?.player;
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[400px] border-white/10 bg-card p-5" data-testid="dialog-employee-badge">
        {p && (
          <>
            <div className="pr-8">
              <div className="kicker">{isSelf ? 'Your credential' : 'Crew credential'}</div>
              <DialogTitle className="mt-1 font-display text-xl font-bold uppercase">{p.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-xs text-muted-foreground">
                {isLeader ? (<><Crown className="h-3.5 w-3.5 text-burn" /> Mission Leader</>) : 'Crew engineer'}
                <span aria-hidden>/</span>
                {member.connected ? 'On channel' : 'Disconnected'}
              </DialogDescription>
            </div>
            <div className="flex justify-center">
              <EmployeeBadge appearance={p.appearance} avatar3d={p.avatar3d} presetId={p.presetId} countryCode={p.countryCode} name={p.name} idSource={p.id} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Top bar ---------- */

const iconBtn = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-void/50 backdrop-blur transition-colors hover:border-ion hover:text-ion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion';

export function SessionTopBar({ session, mission, me, act, pending, onOpenBadge }: { session: GameSession; mission?: Mission; me: SessionPlayer | undefined; act: ActFn; pending: boolean; onOpenBadge: (id: string) => void }) {
  const [briefOpen, setBriefOpen] = useState(false);
  return (
    <header className="relative z-30 border-b border-white/[.08] bg-void/60 backdrop-blur-xl" data-testid="bar-session-top">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 md:px-8">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9px] uppercase tracking-[.25em] text-ion">Mission {mission?.number ?? '--'} / Room {session.roomCode}</div>
          <div className="truncate font-display text-base font-bold uppercase tracking-wider md:text-lg" data-testid="text-mission-name">{mission?.title ?? 'Mission'}</div>
        </div>
        {mission && (
          <dl className="order-3 flex w-full items-center gap-4 font-mono text-[10px] uppercase tracking-widest sm:order-none sm:w-auto">
            <div><dt className="sr-only">Budget</dt><dd className="text-ion" data-testid="text-top-budget">{formatBudget(mission.budget)}</dd></div>
            <span className="h-3 w-px bg-white/15" aria-hidden />
            <div><dt className="sr-only">Timeline</dt><dd className="text-foreground/80" data-testid="text-top-time">{mission.developmentMonths} mo build / {mission.operationalYears} yr ops</dd></div>
            <div className="ml-auto sm:hidden"><LinkStatusPill /></div>
          </dl>
        )}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LinkStatusPill /></div>
          {mission && (
            <button className={iconBtn} aria-label="Mission details" title="Mission details" onClick={() => setBriefOpen(true)} data-testid="button-mission-details">
              <FileText className="h-4 w-4" />
            </button>
          )}
          <button className={iconBtn} aria-label="My employee badge" title="My employee badge" disabled={!me} onClick={() => me && onOpenBadge(me.player.id)} data-testid="button-my-badge">
            <UserRound className="h-4 w-4" />
          </button>
          <LeaveButton act={act} pending={pending} />
        </div>
      </div>
      {mission && <BriefingDialog mission={mission} open={briefOpen} onOpenChange={setBriefOpen} />}
    </header>
  );
}

/* ---------- Crew deck with speech bubbles ---------- */

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export type CrewFlag = (sp: SessionPlayer, leader: boolean) => { on: boolean; label: string };

export function CrewDeck({ session, flag, onOpenBadge, meId, size = 56 }: { session: GameSession; flag: CrewFlag; onOpenBadge: (id: string) => void; meId: string; size?: number }) {
  const now = useNow();
  const [transmission, setTransmission] = useState<{ name: string; text: string } | null>(null);
  return (
    <>
    <ul className="flex flex-wrap items-end justify-center gap-x-3 gap-y-2 sm:gap-x-6" aria-label="Crew">
      {session.players.map((sp) => {
        const leader = sp.player.id === session.hostId;
        const f = flag(sp, leader);
        const msg = sp.lastMessage && new Date(sp.lastMessage.expiresAt).getTime() > now ? sp.lastMessage : null;
        return (
          <li key={sp.player.id} className="flex w-[78px] flex-col items-center sm:w-[112px]" data-testid={`crew-${sp.player.id}`}>
            <div className="flex h-[68px] w-full items-end justify-center" aria-live="polite">
              <AnimatePresence>
                {msg && (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="relative max-w-full rounded-md border border-ion/40 bg-[hsl(214_55%_12%/.95)] px-2 py-1.5 text-left text-[11px] leading-snug text-foreground shadow-[0_8px_24px_-12px_hsl(186_92%_40%/.6)]"
                    data-testid={`bubble-message-${sp.player.id}`}
                  >
                    <button type="button" className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion"
                      aria-label={`Read message from ${sp.player.name}`} title="Read full message"
                      onClick={() => setTransmission({ name: sp.player.name, text: msg.text })}>
                      <span className="line-clamp-3 break-words">{msg.text}</span>
                    </button>
                    <span className="absolute -bottom-[5px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-ion/40 bg-[hsl(214_55%_12%)]" aria-hidden />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className={cn('mt-2 flex max-w-full items-start justify-center gap-1 text-center text-[11px] font-semibold', leader && 'text-burn')} data-testid={`text-crew-name-${sp.player.id}`}>
              {leader && <Crown className="h-3 w-3 shrink-0" aria-hidden />}
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{sp.player.name}{sp.player.id === meId ? ' (you)' : ''}</span>
            </div>
            <button
              onClick={() => onOpenBadge(sp.player.id)}
              aria-label={`Open ${sp.player.name} employee badge${leader ? ', Leader' : ''}`}
              className="relative mt-1 rounded-full transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ion focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              data-testid={`button-crew-badge-${sp.player.id}`}
            >
              <Portrait player={sp.player} size={size} ring={leader ? 'burn' : f.on ? 'ion' : 'none'} className={cn(!sp.connected && 'opacity-40 grayscale')} />
              {f.on && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ion text-void" aria-hidden>
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
            <div className={cn('mt-1 font-mono text-[9px] uppercase tracking-widest', !sp.connected ? 'text-muted-foreground' : leader ? 'text-burn' : f.on ? 'text-ion' : 'text-muted-foreground')}>
              {!sp.connected ? 'Offline' : leader ? 'Leader' : f.label}
            </div>
          </li>
        );
      })}
    </ul>
    <Dialog open={!!transmission} onOpenChange={(open) => !open && setTransmission(null)}>
      <DialogContent className="max-h-[80dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto border-white/10 bg-card">
        <DialogTitle className="pr-6 font-display text-xl">{transmission?.name}</DialogTitle>
        <DialogDescription>Crew transmission</DialogDescription>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{transmission?.text}</p>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function MessageComposer({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cool, setCool] = useState(false);
  const send = useSendSessionMessage();
  const qc = useQueryClient();
  const coolRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(coolRef.current), []);
  const text = draft.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text || send.isPending || cool) return;
    const submitted = draft;
    setError(null);
    send.mutate(
      { id: sessionId, data: { text } },
      {
        onSuccess: (s) => {
          qc.setQueryData(getGetGameSessionQueryKey(sessionId), s);
          setDraft((d) => (d === submitted ? '' : d));
          setCool(true);
          coolRef.current = window.setTimeout(() => setCool(false), 1500);
        },
        onError: (err) => setError(errMsg(err, 'Message not transmitted.')),
      },
    );
  };
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md" aria-label="Crew channel">
      <div className="flex items-center gap-2 rounded-md border border-white/15 bg-void/70 p-1 pl-3 backdrop-blur focus-within:border-ion/60">
        <label htmlFor="session-message" className="sr-only">Short message to crew</label>
        <input
          id="session-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 180))}
          maxLength={180}
          placeholder="Say something to the crew"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/70"
          data-testid="input-session-message"
        />
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline" aria-hidden>{draft.length}/180</span>
        <button
          type="submit"
          disabled={!text || send.isPending || cool}
          aria-label="Send message"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded bg-ion text-void transition-opacity disabled:opacity-40"
          data-testid="button-send-message"
        >
          <Send className={cn('h-4 w-4', send.isPending && 'animate-pulse')} />
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive" role="alert" data-testid="text-message-error">{error}</p>}
    </form>
  );
}

/** Crew window: scene image with deck + composer at the bottom. */
export function CrewDock({ session, flag, onOpenBadge, meId }: { session: GameSession; flag: CrewFlag; onOpenBadge: (id: string) => void; meId: string }) {
  return (
    <div className="space-y-3" data-testid="panel-crew-dock">
      <CrewDeck session={session} flag={flag} onOpenBadge={onOpenBadge} meId={meId} />
      <MessageComposer sessionId={session.id} />
    </div>
  );
}
