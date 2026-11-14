import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Copy, Crown, FileText, LogOut, Rocket, Send, UserPlus, Users } from 'lucide-react';
import {
  getGetGameSessionQueryKey,
  getGetPlayerQueryKey,
  getGetSocialQueryKey,
  useGetGameCatalog,
  useGetGameSession,
  useGetSocial,
  useInvitePlayer,
  useUpdateGameSession,
  type GameSession,
  type Mission,
  type PlayerAccount,
  type SessionAction,
  type StoryScene,
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
import { Starfield } from '@/components/starfield';
import { FullScreenLoader, LinkStatusPill, RequireCharacter } from '@/components/shell';
import { EmptyState, ErrorState, HudButton, PlayerPortrait, Portrait } from '@/components/ui-kit';
import { SCENE_STATUS_LABEL, errMsg, errStatus, formatBudget, imgUrl, invalidateGame, invalidateSocial } from '@/lib/game';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ActFn = (data: SessionAction, after?: () => void) => void;

function useSessionAct(id: string) {
  const mut = useUpdateGameSession();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const act: ActFn = (data, after) =>
    mut.mutate(
      { id, data },
      {
        onSuccess: async (res) => {
          if (!res.session) {
            await invalidateGame(qc);
            setLocation('/play');
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

function CrewStrip({ session, mode }: { session: GameSession; mode: 'lobby' | 'continue' | 'accept' }) {
  return (
    <div className="flex items-center gap-2">
      {session.players.map((sp) => {
        const host = sp.player.id === session.hostId;
        const flag = mode === 'lobby' ? sp.ready || host : mode === 'continue' ? sp.continueReady || host : sp.accepted;
        return (
          <div key={sp.player.id} className="group relative" title={`${sp.player.name}${host ? ' (host)' : ''}`} data-testid={`crew-${sp.player.id}`}>
            <Portrait player={sp.player} size={40} ring={flag ? 'ion' : 'none'} className={cn(!sp.connected && 'opacity-40')} />
            {host && <Crown className="absolute -top-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-burn" />}
            {flag && !host && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-ion text-void">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
            {mode === 'accept' && host && sp.accepted && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-ion text-void">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BriefingBody({ mission }: { mission: Mission }) {
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
            <dd className="mt-1 font-display text-xl font-semibold text-ion">{v}</dd>
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
        {[
          ['Objectives', mission.objectives],
          ['Requirements', mission.requirements],
        ].map(([t, list]) => (
          <section key={t as string}>
            <h3 className="kicker mb-3">{t as string}</h3>
            <ul className="space-y-2 text-sm">
              {(list as string[]).map((o) => (
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

function BriefingDialog({ mission, open, onOpenChange }: { mission: Mission; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] max-w-3xl overflow-hidden border-white/10 bg-card p-0">
        <div className="border-b border-white/10 p-6">
          <div className="kicker">Classified / Mission {mission.number}</div>
          <DialogTitle className="mt-1 font-display text-3xl font-bold uppercase">{mission.title} briefing</DialogTitle>
          <DialogDescription className="text-muted-foreground">{mission.subtitle}</DialogDescription>
        </div>
        <div className="scroll-thin max-h-[calc(88dvh-130px)] overflow-y-auto p-6" data-testid="panel-briefing-dialog">
          <BriefingBody mission={mission} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeaveButton({ act, pending, compact }: { act: ActFn; pending: boolean; compact?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 bg-void/50 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur hover:border-destructive/60 hover:text-destructive" data-testid="button-leave">
          <LogOut className="h-4 w-4" />
          {!compact && 'Leave'}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase tracking-wider">Leave this session?</AlertDialogTitle>
          <AlertDialogDescription>Your crew will continue without you. If you're the host, command passes to a connected crew member (or another member if everyone is offline). The session only closes once nobody is left aboard.</AlertDialogDescription>
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

/* ---------------- LOBBY ---------------- */

function InvitePanel({ session }: { session: GameSession }) {
  const params = { q: '' };
  const { data, isLoading } = useGetSocial(params, { query: { queryKey: getGetSocialQueryKey(params), refetchInterval: 5000 } });
  const invite = useInvitePlayer();
  const qc = useQueryClient();
  const { toast } = useToast();
  const aboard = new Set(session.players.map((p) => p.player.id));
  const pendingOut = new Set((data?.invitations ?? []).filter((i) => i.direction === 'outgoing' && i.sessionId === session.id).map((i) => i.to.id));
  const friends = data?.friends ?? [];
  return (
    <div className="glass rounded-lg p-5">
      <div className="kicker mb-4 flex items-center gap-2">
        <UserPlus className="h-3.5 w-3.5" /> Invite crew
      </div>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-white/5" />
      ) : friends.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No friends yet"
          text="Add engineers on the Crew page, then invite them here."
          action={<Link href="/friends" className="text-sm text-ion hover:underline" data-testid="link-find-friends">Find engineers</Link>}
        />
      ) : (
        <div className="scroll-thin max-h-72 space-y-2 overflow-y-auto pr-1">
          {friends.map((f) => {
            const on = aboard.has(f.id);
            const was = pendingOut.has(f.id);
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-md border border-white/[.06] p-2.5">
                <Portrait player={f} size={36} online={f.online} />
                <div className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name}</div>
                <HudButton
                  variant={was ? 'ghost' : 'ion'}
                  className="min-h-8 px-3 text-[11px]"
                  disabled={on || was || session.players.length >= 4 || (invite.isPending && invite.variables?.data.userId === f.id)}
                  loading={invite.isPending && invite.variables?.data.userId === f.id}
                  onClick={() =>
                    invite.mutate(
                      { id: session.id, data: { userId: f.id } },
                      {
                        onSuccess: async () => {
                          await invalidateSocial(qc);
                          toast({ title: `Invitation sent to ${f.name}` });
                        },
                        onError: (e) => toast({ title: 'Invite failed', description: errMsg(e), variant: 'destructive' }),
                      },
                    )
                  }
                  data-testid={`button-invite-${f.id}`}
                >
                  {on ? 'Aboard' : was ? 'Invited' : (<><Send className="h-3 w-3" /> Invite</>)}
                </HudButton>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Lobby({ session, mission, me, isHost }: { session: GameSession; mission?: Mission; me: string; isHost: boolean }) {
  const { act, pending, pendingAction } = useSessionAct(session.id);
  const { toast } = useToast();
  const mine = session.players.find((p) => p.player.id === me);
  const others = session.players.filter((p) => p.player.id !== session.hostId);
  const canStart = others.filter((p) => p.connected).every((p) => p.ready);
  const slots = Array.from({ length: 4 }, (_, i) => session.players[i]);
  return (
    <div className="grain relative min-h-[100dvh] overflow-hidden bg-background">
      {mission && <img src={imgUrl(mission.image)} alt="" className="kenburns absolute inset-0 h-full w-full object-cover opacity-30" />}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      <Starfield density={0.5} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/play" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-play">
            <ArrowLeft className="h-4 w-4" /> Mission board
          </Link>
          <div className="flex items-center gap-2">
            <LinkStatusPill />
            <LeaveButton act={act} pending={pending} compact />
          </div>
        </header>
        <div className="mt-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="kicker mb-2">Crew lobby / Mission {mission?.number}</div>
            <h1 className="font-display text-4xl font-bold uppercase md:text-6xl">{mission?.title ?? 'Mission'}</h1>
            <p className="mt-2 text-muted-foreground">{mission?.subtitle}</p>
          </div>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(session.roomCode);
              toast({ title: 'Room code copied' });
            }}
            className="glass hud-corners flex items-center gap-4 rounded-lg px-5 py-3 text-left"
            data-testid="button-copy-room"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.25em] text-muted-foreground">Room code</div>
              <div className="font-display text-2xl font-bold tracking-[.3em] text-ion" data-testid="text-room-code">{session.roomCode}</div>
            </div>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {slots.map((sp, i) => (
                <motion.div key={sp?.player.id ?? `empty-${i}`} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  {sp ? (
                    <div className={cn('relative overflow-hidden rounded-lg border', sp.ready || sp.player.id === session.hostId ? 'border-ion/50' : 'border-white/10')} data-testid={`slot-player-${sp.player.id}`}>
                      <PlayerPortrait player={sp.player} className={cn('aspect-[3/4]', !sp.connected && 'grayscale opacity-50')} />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/80 to-transparent p-3">
                        <div className="flex items-center gap-1.5 truncate font-semibold">
                          {sp.player.id === session.hostId && <Crown className="h-3.5 w-3.5 shrink-0 text-burn" />}
                          {sp.player.name}
                        </div>
                        <div className={cn('font-mono text-[10px] uppercase tracking-widest', !sp.connected ? 'text-muted-foreground' : sp.player.id === session.hostId ? 'text-burn' : sp.ready ? 'text-ion' : 'text-muted-foreground')}>
                          {!sp.connected ? 'Disconnected' : sp.player.id === session.hostId ? 'Host' : sp.ready ? 'Ready' : 'Standing by'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 text-muted-foreground">
                      <UserPlus className="h-5 w-5" />
                      <span className="font-mono text-[10px] uppercase tracking-widest">Open seat</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            <div className="glass mt-6 flex flex-col items-start justify-between gap-4 rounded-lg p-5 sm:flex-row sm:items-center">
              <div className="text-sm text-muted-foreground" data-testid="text-lobby-status">
                {isHost
                  ? canStart
                    ? session.players.length === 1
                      ? 'You can start alone, or wait for invited crew to arrive.'
                      : 'Every connected crew member is ready.'
                    : 'Waiting for connected crew to mark ready.'
                  : mine?.ready
                    ? 'You are ready. The host will start the mission.'
                    : 'Mark ready when you are set.'}
              </div>
              {isHost ? (
                <HudButton variant="burn" disabled={!canStart} loading={pendingAction === 'start'} onClick={() => act({ action: 'start' })} data-testid="button-start">
                  <Rocket className="h-4 w-4" /> Start story
                </HudButton>
              ) : (
                <HudButton variant={mine?.ready ? 'ghost' : 'ion'} loading={pendingAction === 'ready'} onClick={() => act({ action: 'ready', ready: !mine?.ready })} data-testid="button-ready">
                  {mine?.ready ? 'Not ready' : (<><Check className="h-4 w-4" /> Ready</>)}
                </HudButton>
              )}
            </div>
          </div>
          {isHost ? <InvitePanel session={session} /> : (
            <div className="glass rounded-lg p-5 text-sm text-muted-foreground">
              <div className="kicker mb-3">Briefing note</div>
              Only the host can invite crew and advance scenes. You will move through the story together.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STORY ---------------- */

function Story({ session, mission, scenes, me, isHost }: { session: GameSession; mission?: Mission; scenes: StoryScene[]; me: string; isHost: boolean }) {
  const { act, pending, pendingAction } = useSessionAct(session.id);
  const [briefOpen, setBriefOpen] = useState(false);
  const scene = scenes.find((s) => s.id === session.scene) ?? scenes[session.scene];
  const solo = session.players.length === 1;
  const paragraphs = scene ? (solo && scene.soloParagraphs.length ? scene.soloParagraphs : scene.paragraphs) : [];
  const mine = session.players.find((p) => p.player.id === me);
  const others = session.players.filter((p) => p.player.id !== session.hostId && p.connected);
  const allContinue = others.every((p) => p.continueReady);
  const isLast = session.scene >= scenes.length - 1 || session.status === 'MISSION_ACCEPTANCE';
  const isBriefing = session.status === 'MISSION_BRIEFING';
  const accepted = session.players.filter((p) => p.accepted).length;
  const director = scene && /director/i.test(scene.speaker);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background">
      <AnimatePresence mode="sync">
        <motion.div key={session.scene} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
          {scene && <img src={imgUrl(scene.image)} alt="" className="kenburns h-full w-full object-cover" />}
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      <div className="vignette absolute inset-0" />
      <div className="scanline pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="flex flex-wrap items-center gap-3 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[.25em] text-ion">Room {session.roomCode}</span>
            <div className="flex gap-1" aria-label="Scene progress">
              {scenes.map((s) => (
                <span key={s.id} className={cn('h-1 w-6 rounded-full transition-colors md:w-10', s.id < session.scene ? 'bg-ion/60' : s.id === session.scene ? 'bg-burn' : 'bg-white/15')} />
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block"><LinkStatusPill /></div>
            {mission && (
              <button onClick={() => setBriefOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 bg-void/50 px-3 text-xs font-semibold uppercase tracking-widest backdrop-blur hover:border-ion" data-testid="button-open-briefing">
                <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Briefing</span>
              </button>
            )}
            <LeaveButton act={act} pending={pending} compact />
          </div>
        </header>

        <div className="flex flex-1 items-end px-4 pb-6 md:px-8 md:pb-10">
          <AnimatePresence mode="wait">
            <motion.div key={session.scene} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mx-auto w-full max-w-5xl">
              <div className="kicker mb-3 flex items-center gap-3">
                <span className="text-burn">Scene {String(session.scene + 1).padStart(2, '0')}</span>
                <span className="h-px w-8 bg-ion/50" />
                {scene?.label}
              </div>
              <h1 className="mb-6 font-display text-4xl font-bold uppercase leading-none md:text-7xl" data-testid="text-scene-title">{scene?.title ?? SCENE_STATUS_LABEL[session.status]}</h1>

              <div className="glass rounded-lg">
                {scene?.speaker && (
                  <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
                    {director && <img src={imgUrl('/images/director.png')} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-burn/50" />}
                    <span className="font-mono text-[11px] uppercase tracking-[.25em] text-burn" data-testid="text-speaker">{scene.speaker}</span>
                  </div>
                )}
                <div className={cn('scroll-thin space-y-4 overflow-y-auto px-5 py-5 text-base leading-relaxed text-foreground/90 md:text-lg', isBriefing ? 'max-h-[52dvh]' : 'max-h-[40dvh]')} data-testid="panel-scene-text">
                  {paragraphs.map((p, i) => (
                    <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.25 }}>
                      {p}
                    </motion.p>
                  ))}
                  {isBriefing && mission && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="border-t border-white/10 pt-6 text-base">
                      <BriefingBody mission={mission} />
                    </motion.div>
                  )}
                </div>

                <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center">
                  <CrewStrip session={session} mode={isLast ? 'accept' : 'continue'} />
                  <div className="text-xs text-muted-foreground sm:flex-1" data-testid="text-story-status">
                    {isLast
                      ? `${accepted} of ${session.players.length} signatures`
                      : isHost
                        ? solo || allContinue
                          ? 'Crew is with you.'
                          : 'Waiting for the crew to signal ready.'
                        : mine?.continueReady
                          ? 'Signal sent. The host will advance.'
                          : 'Signal when you are ready to continue.'}
                  </div>
                  <div className="flex gap-2">
                    {isLast ? (
                      mine?.accepted ? (
                        <HudButton variant="ghost" disabled data-testid="button-accepted">
                          <Check className="h-4 w-4" /> Accepted
                        </HudButton>
                      ) : (
                        <HudButton variant="burn" loading={pendingAction === 'accept'} onClick={() => act({ action: 'accept' })} data-testid="button-accept-mission">
                          Accept mission
                        </HudButton>
                      )
                    ) : isHost ? (
                      <HudButton disabled={!allContinue} loading={pendingAction === 'next'} onClick={() => act({ action: 'next', expectedScene: session.scene })} data-testid="button-next-scene">
                        Continue <ArrowRight className="h-4 w-4" />
                      </HudButton>
                    ) : (
                      <HudButton variant={mine?.continueReady ? 'ghost' : 'ion'} loading={pendingAction === 'continue-ready'} onClick={() => act({ action: 'continue-ready', ready: !mine?.continueReady })} data-testid="button-continue-ready">
                        {mine?.continueReady ? 'Ready sent' : 'Ready to continue'}
                      </HudButton>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {mission && <BriefingDialog mission={mission} open={briefOpen} onOpenChange={setBriefOpen} />}
    </div>
  );
}

/* ---------------- START MISSION ---------------- */

function StartMission({ session, mission, isHost }: { session: GameSession; mission?: Mission; isHost: boolean }) {
  const { act, pending, pendingAction } = useSessionAct(session.id);
  const [briefOpen, setBriefOpen] = useState(false);
  const [stamp, setStamp] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setStamp(false), 1800);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="grain relative min-h-[100dvh] overflow-x-hidden bg-background">
      <img src={imgUrl('/images/mission-control.png')} alt="" className="kenburns absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/85 to-background" />
      <Starfield density={0.8} />
      <AnimatePresence>
        {stamp && (
          <motion.div key="stamp" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <motion.div initial={{ scale: 1.6, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="rounded-md border-4 border-burn px-6 py-3 font-display text-3xl font-bold uppercase tracking-[.2em] text-burn md:text-6xl" data-testid="text-mission-accepted">
              Mission accepted
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 py-5 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[.25em] text-ion">Room {session.roomCode}</span>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LinkStatusPill /></div>
            {mission && (
              <button onClick={() => setBriefOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 bg-void/50 px-3 text-xs font-semibold uppercase tracking-widest backdrop-blur hover:border-ion" data-testid="button-open-briefing">
                <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Briefing</span>
              </button>
            )}
            <LeaveButton act={act} pending={pending} compact />
          </div>
        </header>
        <div className="flex flex-1 flex-col justify-center py-10 text-center">
          <div className="kicker mb-4">Mission {mission?.number} / {mission?.title}</div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none md:text-7xl" data-testid="text-start-heading">YOUR FIRST MISSION BEGINS NOW</h1>
          <p className="mt-4 text-lg text-foreground/80 md:text-xl" data-testid="text-start-subtitle">The future of Earth observation is in your hands.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-5">
            {session.players.map((sp) => (
              <div key={sp.player.id} className="flex w-20 flex-col items-center gap-2" data-testid={`start-crew-${sp.player.id}`}>
                <Portrait player={sp.player} size={72} ring={sp.player.id === session.hostId ? 'burn' : 'ion'} />
                <span className="w-full truncate text-xs font-semibold">{sp.player.name}</span>
                {sp.player.id === session.hostId && <span className="font-mono text-[9px] uppercase tracking-widest text-burn">Host</span>}
              </div>
            ))}
          </div>
          {mission && (
            <div className="glass mx-auto mt-10 grid w-full max-w-3xl gap-6 rounded-lg p-5 text-left md:grid-cols-[200px_1fr]">
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-1">
                <div><dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Budget</dt><dd className="font-display text-2xl font-semibold text-ion" data-testid="text-start-budget">{formatBudget(mission.budget)}</dd></div>
                <div><dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Timeline</dt><dd className="font-display text-2xl font-semibold text-ion" data-testid="text-start-timeline">{mission.developmentMonths} months</dd></div>
              </dl>
              <div>
                <div className="kicker mb-3">Objectives</div>
                <ul className="space-y-2 text-sm">
                  {mission.objectives.map((o) => (
                    <li key={o} className="flex gap-2"><span className="mt-2 h-1 w-3 shrink-0 bg-burn" /> {o}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="mt-10 flex flex-col items-center gap-3">
            {isHost ? (
              <HudButton variant="burn" className="min-h-14 px-10 text-base" loading={pendingAction === 'initiate'} onClick={() => act({ action: 'initiate' })} data-testid="button-start-mission">
                <Rocket className="h-5 w-5" /> START MISSION
              </HudButton>
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-white/10 px-5 py-3 text-sm text-muted-foreground" data-testid="text-waiting-host">
                <span className="h-2 w-2 rounded-full bg-burn pulse-dot" /> Waiting for the host to start the mission
              </div>
            )}
          </div>
        </div>
      </div>
      {mission && <BriefingDialog mission={mission} open={briefOpen} onOpenChange={setBriefOpen} />}
    </div>
  );
}

/* ---------------- FINALE ---------------- */

function Finale({ session, mission }: { session: GameSession; mission?: Mission }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const { act, pendingAction } = useSessionAct(session.id);
  const words = 'MISSION INITIATED'.split('');
  return (
    <div className="grain relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-5 text-center">
      <img src={imgUrl('/images/mission-control.png')} alt="" className="kenburns absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      <Starfield density={1.2} />
      <div className="relative z-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kicker mb-6">MISSION {mission?.number} — {mission?.title} / Room {session.roomCode}</motion.div>
        <h1 className="font-display text-5xl font-bold uppercase tracking-wide md:text-8xl" data-testid="text-mission-initiated">
          {words.map((ch, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }} className={ch === ' ' ? 'inline-block w-4 md:w-8' : 'inline-block'}>
              {ch}
            </motion.span>
          ))}
        </h1>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.4, duration: 0.8 }} className="mx-auto mt-8 h-px w-64 bg-gradient-to-r from-transparent via-burn to-transparent" />
        <motion.div initial={{ opacity: 0, letterSpacing: '0.1em' }} animate={{ opacity: 1, letterSpacing: '0.5em' }} transition={{ delay: 2, duration: 1.6 }} className="mt-8 font-mono text-sm uppercase text-burn md:text-base" data-testid="text-to-be-continued">
          To be continued...
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.8 }} className="mt-12 flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center gap-4">
            {session.players.map((sp) => (
              <div key={sp.player.id} className="flex flex-col items-center gap-2">
                <Portrait player={sp.player} size={64} ring={sp.player.id === session.hostId ? 'burn' : 'ion'} />
                <span className="text-xs font-semibold">{sp.player.name}</span>
              </div>
            ))}
          </div>
          <p className="max-w-md text-muted-foreground">Earth Observer's development phase begins in the next chapter of Mission: Infinity. Your crew's decision has been logged to your career.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {mission && (
              <HudButton variant="ghost" onClick={() => setBriefOpen(true)} data-testid="button-finale-briefing">
                <FileText className="h-4 w-4" /> Review briefing
              </HudButton>
            )}
            <Link href="/profile" className="inline-flex min-h-11 items-center rounded-md border border-white/15 px-5 font-display text-sm font-semibold uppercase tracking-[.14em] hover:border-ion" data-testid="link-finale-career">
              Career
            </Link>
            <HudButton loading={pendingAction === 'leave'} onClick={() => act({ action: 'leave' })} data-testid="button-finale-archive">
              Archive and return to board <ArrowRight className="h-4 w-4" />
            </HudButton>
          </div>
        </motion.div>
      </div>
      {mission && <BriefingDialog mission={mission} open={briefOpen} onOpenChange={setBriefOpen} />}
    </div>
  );
}

function CenterMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <Starfield />
      <div className="relative w-full max-w-md space-y-4 text-center">
        <div className="kicker">Transmission ended</div>
        <h1 className="font-display text-3xl font-bold uppercase">{title}</h1>
        <p className="text-muted-foreground">{text}</p>
        <Link href="/play" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ion px-5 font-display text-sm font-bold uppercase tracking-[.14em] text-void" data-testid="link-back-to-play">
          <ArrowLeft className="h-4 w-4" /> Mission board
        </Link>
      </div>
    </div>
  );
}

function SessionInner({ account, id }: { account: PlayerAccount; id: string }) {
  const { data: session, isLoading, error, refetch } = useGetGameSession(id, {
    query: { queryKey: getGetGameSessionQueryKey(id), refetchInterval: 5000, retry: (n, e) => errStatus(e) !== 404 && errStatus(e) !== 403 && n < 2 },
  });
  const catalog = useGetGameCatalog();
  if (isLoading || catalog.isLoading) return <FullScreenLoader label="Joining crew channel" />;
  if (error || !session) {
    const s = errStatus(error);
    if (s === 404 || s === 403) return <CenterMessage title="Session unavailable" text="This session no longer exists, or you are not part of its crew." />;
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <Starfield />
        <div className="relative w-full max-w-md space-y-4">
          <ErrorState message={errMsg(error, 'Could not reach the session.')} onRetry={() => refetch()} />
          <Link href="/play" className="block text-center text-sm text-ion hover:underline">Back to mission board</Link>
        </div>
      </div>
    );
  }
  const mission = catalog.data?.missions.find((m) => m.id === session.missionId);
  const scenes = catalog.data?.scenes ?? [];
  const me = account.character?.id ?? account.id;
  const isHost = session.hostId === me || session.hostId === account.id;
  if (session.status === 'CLOSED') return <CenterMessage title="Session closed" text="The host closed this session. Start a new mission from the board." />;
  if (session.status === 'MISSION_STARTED') return <Finale session={session} mission={mission} />;
  if (session.status === 'READY_TO_START') return <StartMission session={session} mission={mission} isHost={isHost} />;
  if (session.status === 'LOBBY') return <Lobby session={session} mission={mission} me={me} isHost={isHost} />;
  return <Story session={session} mission={mission} scenes={scenes} me={me} isHost={isHost} />;
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  return <RequireCharacter>{(a) => <SessionInner account={a} id={params.id} />}</RequireCharacter>;
}
