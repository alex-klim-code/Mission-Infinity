import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, FileText, LogOut, Send, UserRound } from 'lucide-react';
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
import { EmployeeBadge } from '@/components/character-avatar';
import { errMsg, invalidateGame } from '@/lib/game';
import { MissionSummary } from './mission-summary';
import { formatExact } from './rocket-build';
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
  return <MissionSummary mission={mission} />;
}

export function BriefingDialog({ mission, open, onOpenChange }: { mission: Mission; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden border-white/10 bg-card p-0">
        <div className="border-b border-white/10 p-5 pr-12 sm:p-6">
          <div className="kicker">Classified / Mission {mission.number}</div>
          <DialogTitle className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">{mission.title}</DialogTitle>
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
          <div className="font-mono text-[9px] uppercase tracking-[.25em] text-ion" data-testid="text-session-stage">
            {session.status === 'MISSION_STARTED'
              ? session.journey && session.journey.phase !== 'NONE'
                ? session.journey.phase === 'RESULTS' ? 'Stage 8 / Mission Results'
                  : ['RETURN_FLIGHT','RETURN_FAILED','REENTRY','RECOVERY'].includes(session.journey.phase) ? 'Stage 7 / Return to Earth'
                  : ['LUNAR_OPERATIONS','LANDING','SAMPLE_COLLECTION','LANDING_FAILED'].includes(session.journey.phase) ? 'Stage 6 / Lunar Landing & Samples'
                  : session.journey.phase === 'DIAGNOSTICS' ? 'Stage 5 / Instrument Diagnostics' : 'Stage 4 / Mission Briefing'
                : session.journey?.construction.opened && !session.journey.construction.delivered && !session.fueling?.opened
                  ? 'Rocket Construction & Delivery' : session.fueling?.opened ? 'Stage 3 / Rocket Fueling' : session.science?.opened ? 'Stage 2 / Scientific Instruments' : 'Stage 1 / Rocket Construction'
              : 'Mission preparation'}
          </div>
          <div className="truncate font-display text-base font-bold uppercase tracking-wider md:text-lg" data-testid="text-mission-name">{mission?.title ?? 'Mission'}</div>
        </div>
        {mission && (
          <dl className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest sm:order-none sm:w-auto">
            <div><dt className="sr-only">Budget</dt><dd className="text-ion" data-testid="text-top-budget">{formatExact(mission.budget - (session.build?.spent ?? 0))}</dd></div>
            <span className="h-3 w-px bg-white/15" aria-hidden />
            <div><dt className="sr-only">Preparation elapsed</dt><dd className="text-foreground/80" data-testid="text-top-months">{session.build?.elapsedMonths ?? 0}/{mission.developmentMonths} months</dd></div>
            {(mission.operationalWeeks ?? 0) > 0 && (<><span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden /><div className="hidden sm:block"><dt className="sr-only">Mission duration</dt><dd className="text-foreground/60" data-testid="text-top-time">{mission.operationalWeeks} weeks</dd></div></>)}
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
        <label htmlFor="session-message" className="sr-only">Your message to the crew</label>
        <textarea
          id="session-message"
          name="message"
          rows={2}
          inputMode="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 180))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={180}
          placeholder="Write your message…"
          autoComplete="off"
          className="pointer-events-auto min-w-0 flex-1 resize-none bg-transparent py-2 text-sm text-foreground caret-ion outline-none placeholder:text-muted-foreground/70"
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
      <p className="mt-1 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
      {error && <p className="mt-1.5 text-xs text-destructive" role="alert" data-testid="text-message-error">{error}</p>}
    </form>
  );
}

