import { useState, type ReactNode } from 'react';
import { MessageNotifications } from '@/components/session/message-notifications';
import { BadgeDialog, SessionTopBar, useSessionAct } from '@/components/session/session-shared';
import { CrewBar, type CrewFlag } from '@/components/session/crew-bar';
import { Link, useParams } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Copy, Rocket, Send, UserPlus, Users } from 'lucide-react';
import {
  getGetGameSessionQueryKey,
  getGetSocialQueryKey,
  useGetGameCatalog,
  useGetGameSession,
  useGetSocial,
  useInvitePlayer,
  type GameSession,
  type Mission,
  type PlayerAccount,
  type StoryScene,
} from '@workspace/api-client-react';
import { Starfield } from '@/components/starfield';
import { FullScreenLoader, RequireCharacter } from '@/components/shell';
import { EmptyState, ErrorState, HudButton, Portrait } from '@/components/ui-kit';
import { SCENE_STATUS_LABEL, errMsg, errStatus, formatBudget, imgUrl, invalidateSocial } from '@/lib/game';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

type StageProps = { session: GameSession; mission?: Mission; me: string; isHost: boolean; openBadge: (id: string) => void };

const lobbyFlag: CrewFlag = (sp) => ({ on: sp.ready, label: sp.ready ? 'Ready' : 'Standing by' });
const continueFlag: CrewFlag = (sp) => ({ on: sp.continueReady, label: sp.continueReady ? 'Ready' : 'Reading' });
const launchFlag: CrewFlag = (sp) => ({ on: sp.accepted, label: sp.accepted ? 'Ready' : 'Standing by' });

function Lobby({ session, mission, me, isHost, openBadge }: StageProps) {
  const { act, pending, pendingAction } = useSessionAct(session.id);
  const { toast } = useToast();
  const mine = session.players.find((p) => p.player.id === me);
  const others = session.players.filter((p) => p.player.id !== session.hostId);
  const canStart = others.filter((p) => p.connected).every((p) => p.ready);
  const slots = Array.from({ length: 4 }, (_, i) => session.players[i]);
  return (
    <div className="grain relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      {mission && <img src={imgUrl(mission.image)} alt="" className="kenburns absolute inset-0 h-full w-full object-cover opacity-30" />}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      <Starfield density={0.5} />
      <SessionTopBar session={session} mission={mission} me={mine} act={act} pending={pending} onOpenBadge={openBadge} />
      <div className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto"><div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <Link href="/play" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-play">
          <ArrowLeft className="h-4 w-4" /> Mission board
        </Link>
        <div className="mt-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="kicker mb-2">Crew lobby / Mission {mission?.number}</div>
            <h1 className="break-words font-display text-3xl font-bold uppercase sm:text-4xl md:text-6xl">{mission?.title ?? 'Mission'}</h1>
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
            <section className="relative aspect-[16/9] overflow-hidden rounded-lg border border-white/10" aria-label="Mission scene" data-testid="panel-scene-window">
              {mission && <img src={imgUrl(mission.image)} alt={mission.title} className="kenburns absolute inset-0 h-full w-full object-cover" />}
              <div className="kicker absolute left-3 top-3 flex items-center gap-2 rounded bg-void/70 px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-burn pulse-dot" /> {session.players.length} of 4 aboard</div>
            </section>
            <div className="glass mt-6 flex flex-col items-start justify-between gap-4 rounded-lg p-5 sm:flex-row sm:items-center">
              <div className="text-sm text-muted-foreground" data-testid="text-lobby-status">
                {isHost
                  ? canStart
                    ? session.players.length === 1
                      ? 'You can start alone, or wait for invited crew to arrive.'
                      : 'Every connected crew member is ready.'
                    : 'Waiting for connected crew to mark ready.'
                  : mine?.ready
                    ? 'You are ready. The Leader will start the mission.'
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
              Only the Leader can invite crew and approve each stage. Your part: mark ready, signal when you have read each scene, and signal ready to start the mission at the end.
            </div>
          )}
        </div>
      </div></div>
      <CrewBar session={session} flag={lobbyFlag} meId={me} onOpenBadge={openBadge} />
    </div>
  );
}

/* ---------------- STORY (scenes 0-5, acceptance and ready share the final scene) ---------------- */

function StoryAction({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>;
}

function Story({ session, mission, scenes, me, isHost, openBadge }: StageProps & { scenes: StoryScene[] }) {
  const { act, pending, pendingAction } = useSessionAct(session.id);
  const finalStatus = session.status === 'MISSION_ACCEPTANCE' || session.status === 'READY_TO_START';
  const lastIdx = Math.max(scenes.length - 1, 0);
  const idx = finalStatus ? lastIdx : Math.min(session.scene, lastIdx);
  const scene = scenes.find((s) => s.id === idx) ?? scenes[idx];
  const isFinal = finalStatus || idx >= lastIdx;
  const solo = session.players.length === 1;
  const paragraphs = scene ? (solo && scene.soloParagraphs.length ? scene.soloParagraphs : scene.paragraphs) : [];
  const mine = session.players.find((p) => p.player.id === me);
  const others = session.players.filter((p) => p.player.id !== session.hostId && p.connected);
  const allContinue = others.every((p) => p.continueReady);
  const allAccepted = others.every((p) => p.accepted);
  const signed = others.filter((p) => p.accepted).length;
  const kind: 'story' | 'message' | 'crew' | 'launch' = isFinal ? 'launch' : idx === 3 ? 'message' : idx === 4 ? 'crew' : 'story';
  const title = kind === 'launch' ? 'Start Mission' : kind === 'crew' ? 'Meet Your Crew' : kind === 'message' ? 'Get a Message' : scene?.title ?? SCENE_STATUS_LABEL[session.status];
  const director = scene && /director/i.test(scene.speaker);

  const status = isFinal
    ? isHost
      ? solo || allAccepted
        ? 'Every connected engineer is standing by. Your command.'
        : `Waiting for crew: ${signed} of ${others.length} ready to launch.`
      : mine?.accepted
        ? 'Ready recorded. Waiting for the Leader to launch.'
        : 'Signal that you are ready to start the mission.'
    : isHost
      ? solo || allContinue
        ? 'Crew is with you.'
        : 'Waiting for connected crew to signal ready.'
      : mine?.continueReady
        ? 'Signal sent. The Leader will approve the next stage.'
        : 'Signal when you are ready to continue.';

  const action = isFinal ? (
    isHost ? (
      <HudButton variant="burn" disabled={!(solo || allAccepted)} loading={pendingAction === 'initiate'} onClick={() => act({ action: 'initiate' })} data-testid="button-start-mission">
        <Rocket className="h-4 w-4" /> Start Mission
      </HudButton>
    ) : mine?.accepted ? (
      <HudButton variant="ghost" disabled data-testid="button-accepted">
        <Check className="h-4 w-4" /> Waiting for Leader
      </HudButton>
    ) : (
      <HudButton variant="burn" loading={pendingAction === 'accept'} onClick={() => act({ action: 'accept' })} data-testid="button-accept-mission">
        <Check className="h-4 w-4" /> Start Mission
      </HudButton>
    )
  ) : isHost ? (
    <HudButton disabled={!(solo || allContinue)} loading={pendingAction === 'next'} onClick={() => act({ action: 'next', expectedScene: session.scene })} data-testid="button-next-scene">
      Continue <ArrowRight className="h-4 w-4" />
    </HudButton>
  ) : (
    <HudButton variant={mine?.continueReady ? 'ghost' : 'ion'} loading={pendingAction === 'continue-ready'} onClick={() => act({ action: 'continue-ready', ready: !mine?.continueReady })} data-testid="button-continue-ready">
      {mine?.continueReady ? (<><Check className="h-4 w-4" /> Ready sent</>) : 'Ready to continue'}
    </HudButton>
  );

  const facts: [string, string][] = mission
    ? [
        ['Budget', formatBudget(mission.budget)],
        ['Development', `${mission.developmentMonths} months`],
        ['Operations', `${mission.operationalYears} years`],
        ['Destination', mission.destination],
      ]
    : [];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <SessionTopBar session={session} mission={mission} me={mine} act={act} pending={pending} onOpenBadge={openBadge} />
      <div className="flex gap-1 bg-void/80 px-3 py-1.5 md:px-8" aria-label={`Scene ${idx + 1} of ${scenes.length}`}>
        {scenes.map((s) => (
          <span key={s.id} className={cn('h-1 flex-1 rounded-full transition-colors', s.id < idx ? 'bg-ion/60' : s.id === idx ? 'bg-burn' : 'bg-white/15')} />
        ))}
      </div>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="sync">
          <motion.div key={idx} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }}>
            {scene && <img src={imgUrl(scene.image)} alt={scene.title} className="kenburns h-full w-full object-cover" data-testid="img-scene" />}
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-void via-void/70 to-transparent" />

        {kind === 'crew' && mission && (
          <div className="absolute inset-x-0 top-0 bottom-[46%] flex items-center justify-center p-3">
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass hud-corners w-full max-w-md rounded-lg p-4 text-center" data-testid="panel-mission-card">
              <div className="kicker">Mission {mission.number}</div>
              <div className="mt-1 break-words font-display text-2xl font-bold uppercase leading-tight sm:text-3xl" data-testid="text-crew-mission-title">{mission.title}</div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                    <dd className="break-words font-display text-base font-semibold text-ion">{v}</dd>
                  </div>
                ))}
              </dl>
            </motion.section>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-full w-full max-w-4xl flex-col px-3 pb-3 md:px-8"
          >
            <div className="kicker mb-1 flex items-center gap-2 [text-shadow:0_1px_8px_hsl(224_52%_4%)]">
              <span className="text-burn">Scene {String(idx + 1).padStart(2, '0')}</span>
              <span className="h-px w-6 bg-ion/50" />
              <span className="truncate">{kind === 'story' ? scene?.label : kind === 'message' ? 'Incoming transmission' : kind === 'crew' ? 'Assignment' : 'Launch authority'}</span>
            </div>
            <h1 className="font-display text-2xl font-bold uppercase leading-tight [overflow-wrap:anywhere] [text-shadow:0_2px_16px_hsl(224_52%_4%)] sm:text-4xl md:text-5xl" data-testid="text-scene-title">
              {title}
            </h1>
            <div className="mt-2 rounded-md border border-white/10 bg-void/70 backdrop-blur-md">
              {kind === 'story' && (
                <div className="scroll-thin max-h-[22dvh] space-y-2 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-foreground/90 md:text-base" data-testid="panel-scene-text">
                  {scene?.speaker && (
                    <div className="flex items-center gap-2">
                      {director && <img src={imgUrl('/images/director.png')} alt="" className="h-6 w-6 rounded object-cover ring-1 ring-burn/50" />}
                      <span className="font-mono text-[10px] uppercase tracking-[.22em] text-burn" data-testid="text-speaker">{scene.speaker}</span>
                    </div>
                  )}
                  {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
              {kind === 'message' && (
                <div className="scroll-thin max-h-[26dvh] overflow-y-auto px-3 py-3" data-testid="panel-scene-text">
                  <div className="font-mono text-[10px] uppercase tracking-[.22em] text-burn">From: Asterion Mission Directorate</div>
                  <p className="mt-1.5 font-display text-base font-semibold leading-snug text-foreground md:text-xl" data-testid="text-mission-description">{mission?.description}</p>
                </div>
              )}
              {kind === 'crew' && (
                <p className="px-3 py-2.5 text-sm text-foreground/85" data-testid="panel-scene-text">
                  {solo ? 'You lead this mission alone. Full briefing is under Mission details in the top bar.' : 'This is your crew. Open any badge below to meet them. Full briefing is under Mission details in the top bar.'}
                </p>
              )}
              {kind === 'launch' && (
                <div className="px-3 py-2.5 text-sm text-foreground/85" data-testid="panel-scene-text">
                  {mission ? `${mission.title}: ${formatBudget(mission.budget)}, ${mission.developmentMonths} months to build, ${mission.operationalYears} years in operation.` : 'Final launch authority.'}{' '}
                  {isHost ? 'Only you, as Leader, can launch.' : 'Crew signal readiness; the Leader launches.'}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-2 sm:flex-row sm:items-center">
                <div className="text-xs text-muted-foreground sm:flex-1" data-testid="text-story-status">{status}</div>
                <StoryAction>{action}</StoryAction>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <CrewBar session={session} flag={isFinal ? launchFlag : continueFlag} meId={me} onOpenBadge={openBadge} />
    </div>
  );
}

/* ---------------- FINALE ---------------- */

function Finale({ session, mission, me, openBadge }: StageProps) {
  const { act, pending, pendingAction } = useSessionAct(session.id);
  const mine = session.players.find((p) => p.player.id === me);
  const words = ['MISSION', 'INITIATED'];
  return (
    <div className="grain flex h-[100dvh] flex-col overflow-hidden bg-background">
      <SessionTopBar session={session} mission={mission} me={mine} act={act} pending={pending} onOpenBadge={openBadge} />
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <img src={imgUrl('/images/mission-control.png')} alt="" className="kenburns absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        <Starfield density={1.2} />
        <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-5 py-8 text-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kicker mb-5">Mission {mission?.number} / {mission?.title}</motion.div>
          <h1 className="flex flex-wrap justify-center gap-x-4 font-display text-4xl font-bold uppercase tracking-wide sm:text-6xl md:text-8xl" data-testid="text-mission-initiated">
            {words.map((w, wi) => (
              <span key={w} className="whitespace-nowrap">
                {w.split('').map((ch, i) => (
                  <motion.span key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + (wi * 8 + i) * 0.05 }} className="inline-block">
                    {ch}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.4, duration: 0.8 }} className="mx-auto mt-6 h-px w-56 bg-gradient-to-r from-transparent via-burn to-transparent" />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1.2 }} className="mt-6 font-mono text-sm uppercase tracking-[.4em] text-burn" data-testid="text-to-be-continued">
            To be continued...
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6 }} className="mt-8 flex flex-col items-center gap-6">
            <p className="max-w-md text-muted-foreground">Earth Observer's development phase begins in the next chapter of Mission: Infinity. Your crew's decision has been logged to your career.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/profile" className="inline-flex min-h-11 items-center rounded-md border border-white/15 px-5 font-display text-sm font-semibold uppercase tracking-[.14em] hover:border-ion" data-testid="link-finale-career">
                Career
              </Link>
              <HudButton loading={pendingAction === 'leave'} onClick={() => act({ action: 'leave' })} data-testid="button-finale-archive">
                Archive and return to board <ArrowRight className="h-4 w-4" />
              </HudButton>
            </div>
          </motion.div>
        </div>
      </main>
      <CrewBar session={session} flag={launchFlag} meId={me} onOpenBadge={openBadge} />
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
  const [badgeId, setBadgeId] = useState<string | null>(null);
  const { data: session, isLoading, error, refetch } = useGetGameSession(id, {
    query: { queryKey: getGetGameSessionQueryKey(id), refetchInterval: 2000, retry: (n, e) => errStatus(e) !== 404 && errStatus(e) !== 403 && n < 2 },
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
  if (session.status === 'CLOSED') return <CenterMessage title="Session closed" text="The Leader closed this session. Start a new mission from the board." />;
  const meId = session.players.some((p) => p.player.id === me) ? me : account.id;
  const props: StageProps = { session, mission, me: meId, isHost, openBadge: setBadgeId };
  const badgeMember = session.players.find((p) => p.player.id === badgeId) ?? null;
  return (
    <>
      {session.status === 'MISSION_STARTED' ? <Finale {...props} /> : session.status === 'LOBBY' ? <Lobby {...props} /> : <Story {...props} scenes={scenes} />}
      <MessageNotifications key={`${session.id}:${meId}`} session={session} meId={meId} />
      <BadgeDialog member={badgeMember} isLeader={badgeMember?.player.id === session.hostId} isSelf={badgeMember?.player.id === meId} onOpenChange={(o) => !o && setBadgeId(null)} />
    </>
  );
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  return <RequireCharacter>{(a) => <SessionInner account={a} id={params.id} />}</RequireCharacter>;
}
