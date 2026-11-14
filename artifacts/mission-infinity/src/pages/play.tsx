import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Lock, Play, User, Users } from 'lucide-react';
import {
  getGetGameSessionQueryKey,
  getGetSocialQueryKey,
  useCreateGameSession,
  useGetGameCatalog,
  useGetGameSession,
  useGetSocial,
  type GameSession,
  type Mission,
  type PlayerAccount,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AppShell, PageHeader, PageSkeleton, RequireCharacter } from '@/components/shell';
import { InvitationRow } from '@/components/invitations';
import { ErrorState, HudButton, Panel } from '@/components/ui-kit';
import { SCENE_STATUS_LABEL, errMsg, imgUrl, invalidateGame } from '@/lib/game';
import { MissionFacts, MissionSchedule } from '@/components/session/mission-summary';

function ResumeBanner({ id, data }: { id: string; data?: GameSession }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Panel className="mb-8 flex flex-col gap-4 border-ion/40 p-5 sm:flex-row sm:items-center">
        <span className="h-2 w-2 rounded-full bg-ion pulse-dot" />
        <div className="flex-1">
          <div className="kicker">Active session {data ? `/ Room ${data.roomCode}` : ''}</div>
          <div className="mt-1 font-semibold">{data ? (data.status === 'MISSION_STARTED' ? 'Etap 1 — Budowa Rakiety' : SCENE_STATUS_LABEL[data.status]) : 'Your crew is waiting.'} {data && `/ ${data.players.length} aboard`}</div>
        </div>
        <Link href={`/session/${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ion px-5 font-display text-sm font-bold uppercase tracking-[.14em] text-void" data-testid="link-resume-session">
          Resume <ArrowRight className="h-4 w-4" />
        </Link>
      </Panel>
    </motion.div>
  );
}

function LaunchDialog({ mission, onClose, busy }: { mission: Mission | null; onClose: () => void; busy: boolean }) {
  const create = useCreateGameSession();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const go = (mode: 'solo' | 'crew') =>
    mission &&
    create.mutate(
      { data: { missionId: mission.id, mode } },
      {
        onSuccess: async (s) => {
          await invalidateGame(qc);
          setLocation(`/session/${s.id}`);
        },
      },
    );
  return (
    <Dialog open={!!mission} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden border-white/10 bg-card p-0">
        {mission && (
          <>
            <div className="relative h-44">
              <img src={imgUrl(mission.image)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <div className="absolute bottom-4 left-6">
                <div className="kicker">Mission {mission.number}</div>
                <DialogTitle className="font-display text-3xl font-bold uppercase">{mission.title}</DialogTitle>
              </div>
            </div>
            <div className="p-6 pt-2">
              <DialogDescription className="mb-6 text-muted-foreground">How will you take this mission? You can't switch modes once the story begins.</DialogDescription>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { mode: 'solo' as const, icon: User, t: 'Fly solo', d: 'The story starts immediately. Just you and the director.' },
                  { mode: 'crew' as const, icon: Users, t: 'Invite friends', d: 'Open a lobby for up to four engineers. Start when everyone is ready.' },
                ].map((o) => (
                  <button
                    key={o.mode}
                    disabled={create.isPending || busy}
                    onClick={() => go(o.mode)}
                    className="group rounded-lg border border-white/10 bg-white/[.02] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ion disabled:opacity-50"
                    data-testid={`button-mode-${o.mode}`}
                  >
                    <o.icon className="mb-4 h-6 w-6 text-ion" />
                    <div className="font-display text-lg font-bold uppercase tracking-wider">{o.t}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{o.d}</div>
                    {create.isPending && create.variables?.data.mode === o.mode && <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-burn">Opening channel...</div>}
                  </button>
                ))}
              </div>
              {busy && <p className="mt-4 text-sm text-burn">You already have an active session. Resume or leave it first.</p>}
              {create.error && <p className="mt-4 text-sm text-destructive" data-testid="text-create-error">{errMsg(create.error)}</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlayInner({ account }: { account: PlayerAccount }) {
  const { data, isLoading, error, refetch } = useGetGameCatalog();
  const params = { q: '' };
  const social = useGetSocial(params, { query: { queryKey: getGetSocialQueryKey(params), refetchInterval: 5000 } });
  const [picked, setPicked] = useState<Mission | null>(null);
  const activeId = account.activeSessionId ?? '';
  const active = useGetGameSession(activeId, { query: { enabled: !!activeId, queryKey: getGetGameSessionQueryKey(activeId), refetchInterval: 5000 } });
  const activeDone = !!active.data && active.data.status === 'CLOSED';
  const busy = !!account.activeSessionId && !activeDone;
  const invites = social.data?.invitations.filter((i) => i.direction === 'incoming') ?? [];
  const missions = data?.missions ?? [];
  const featured = missions.find((m) => m.enabled);
  const locked = missions.filter((m) => !m.enabled);

  return (
    <AppShell account={account}>
      <PageHeader kicker={`Welcome back, ${account.character?.name}`} title="Mission board" sub="Pick a mission, pick a mode. The director has been expecting you." />
      {account.activeSessionId && <ResumeBanner id={account.activeSessionId} data={active.data} />}
      {invites.length > 0 && (
        <div className="mb-8 space-y-3">
          <div className="kicker text-burn">Incoming crew requests</div>
          {invites.map((i) => (
            <InvitationRow key={i.id} inv={i} />
          ))}
        </div>
      )}
      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState message={errMsg(error, 'Mission catalog is unreachable.')} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          {featured && (
            <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group relative overflow-hidden rounded-xl border border-ion/30" data-testid={`card-mission-${featured.id}`}>
              <img src={imgUrl(featured.image)} alt={featured.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.5s] group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-void/10" />
              <div className="relative grid gap-8 p-6 md:grid-cols-[1.2fr_1fr] md:p-12">
                <div>
                  <div className="kicker mb-3">Mission {featured.number} / {featured.difficulty}</div>
                  <h2 className="break-words font-display text-4xl font-bold uppercase md:text-6xl">{featured.title}</h2>
                  <p className="mt-2 text-lg text-foreground/80">{featured.subtitle}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <HudButton variant="burn" onClick={() => setPicked(featured)} data-testid="button-select-mission">
                      <Play className="h-4 w-4" /> Select mission
                    </HudButton>
                  </div>
                </div>
                <div className="min-w-0 space-y-4 self-end">
                  <MissionFacts mission={featured} />
                  <div className="scroll-thin max-h-80 overflow-y-auto rounded-md border border-white/10 bg-void/75 p-4">
                    <MissionSchedule mission={featured} />
                  </div>
                </div>
              </div>
            </motion.article>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {locked.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="relative h-56 overflow-hidden rounded-lg border border-white/10" data-testid={`card-mission-${m.id}`}>
                <img src={imgUrl(m.image)} alt={m.title} className="absolute inset-0 h-full w-full object-cover opacity-45 grayscale-[.5]" />
                <div className="absolute inset-0 bg-gradient-to-t from-void to-void/20" />
                <div className="relative flex h-full flex-col justify-between p-5">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-ion">Mission {m.number}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3" /> Coming soon</span>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-bold uppercase">{m.title}</div>
                    <div className="text-sm text-muted-foreground">{m.subtitle}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      <LaunchDialog mission={picked} onClose={() => setPicked(null)} busy={busy} />
    </AppShell>
  );
}

export default function PlayPage() {
  return <RequireCharacter>{(a) => <PlayInner account={a} />}</RequireCharacter>;
}
