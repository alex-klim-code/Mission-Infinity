import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { getGetCareerQueryKey, useGetCareer, type PlayerAccount } from '@workspace/api-client-react';
import { AppShell, PageHeader, RequireCharacter } from '@/components/shell';
import { ErrorState, Panel, PlayerPortrait, SkeletonBlock } from '@/components/ui-kit';
import { errMsg, imgUrl } from '@/lib/game';
import { countryName } from '@/lib/avatar';

function ProfileInner({ account }: { account: PlayerAccount }) {
  const c = account.character!;
  const { data, isLoading, error, refetch } = useGetCareer({ query: { queryKey: getGetCareerQueryKey() } });
  const joined = data ? new Date(data.joinedAt) : null;
  return (
    <AppShell account={account}>
      <PageHeader kicker="Personnel file" title="Career record" />
      <div className="grid gap-6 md:grid-cols-[340px_1fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Panel className="overflow-hidden">
            <PlayerPortrait player={c} />
            <div className="p-5">
              <div className="font-mono text-[10px] uppercase tracking-[.25em] text-ion">Asterion Aerospace</div>
              <div className="mt-1 font-display text-3xl font-bold uppercase" data-testid="text-profile-name">{c.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">Age {c.age} / {c.gender}{c.countryCode ? ` / ${countryName(c.countryCode)}` : ''}</div>
              <Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-sm text-ion hover:underline" data-testid="link-edit-character">
                <Pencil className="h-3.5 w-3.5" /> Edit engineer
              </Link>
            </div>
          </Panel>
        </motion.div>
        <div className="space-y-6">
          {isLoading ? (
            <SkeletonBlock className="h-64" />
          ) : error || !data ? (
            <ErrorState message={errMsg(error, 'Career record unavailable.')} onRetry={() => refetch()} />
          ) : (
            <>
              <Panel className="relative overflow-hidden p-8">
                <img src={imgUrl('/images/headquarters.png')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
                <div className="relative">
                  <div className="kicker">Current rank</div>
                  <div className="mt-2 font-display text-4xl font-bold uppercase text-burn md:text-6xl" data-testid="text-rank">{data.rank}</div>
                  <div className="mt-3 text-sm text-muted-foreground">On the roster since {joined && !Number.isNaN(joined.getTime()) ? joined.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'day one'}</div>
                </div>
              </Panel>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Sessions created', data.sessionsCreated, 'Lobbies and solo runs you opened'],
                  ['Missions initiated', data.missionsInitiated, 'Crews you carried to launch authority'],
                ].map(([k, v, d], i) => (
                  <motion.div key={k as string} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
                    <Panel className="p-6">
                      <div className="kicker">{k}</div>
                      <div className="mt-3 font-display text-6xl font-bold tabular-nums text-ion" data-testid={`text-stat-${i}`}>{v}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{d}</div>
                    </Panel>
                  </motion.div>
                ))}
              </div>
              {data.missionsInitiated === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 p-5 text-sm text-muted-foreground">
                  No missions initiated yet. <Link href="/play" className="text-ion hover:underline">Head to the mission board</Link> and take Earth Observer to launch.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function ProfilePage() {
  return <RequireCharacter>{(a) => <ProfileInner account={a} />}</RequireCharacter>;
}
