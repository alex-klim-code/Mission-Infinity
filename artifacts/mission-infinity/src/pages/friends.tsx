import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Inbox, Search, Send, UserMinus, UserPlus, Users, X, Check } from 'lucide-react';
import { getGetSocialQueryKey, useGetSocial, useUpdateFriendship, type Player, type PlayerAccount } from '@workspace/api-client-react';
import { AppShell, PageHeader, RequireCharacter } from '@/components/shell';
import { InvitationRow } from '@/components/invitations';
import { EmptyState, ErrorState, HudButton, Panel, Portrait, SkeletonBlock } from '@/components/ui-kit';
import { errMsg, invalidateSocial } from '@/lib/game';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Act = 'send' | 'accept' | 'reject' | 'cancel' | 'remove';

function PlayerRow({ p, actions }: { p: Player; actions: { act: Act; label: string; icon: typeof Check; variant?: 'ion' | 'ghost' | 'danger' | 'burn' }[] }) {
  const mut = useUpdateFriendship();
  const qc = useQueryClient();
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[.07] bg-white/[.02] p-3 transition-colors hover:border-white/15" data-testid={`row-player-${p.id}`}>
      <Portrait presetId={p.presetId} name={p.name} size={44} online={p.online} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{p.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Age {p.age} / {p.online ? <span className="text-[hsl(150_70%_55%)]">Online</span> : 'Offline'}
        </div>
      </div>
      <div className="flex gap-2">
        {actions.map((a) => (
          <HudButton
            key={a.act}
            variant={a.variant ?? 'ghost'}
            className="min-h-9 px-3 text-xs"
            loading={mut.isPending && mut.variables?.data.action === a.act}
            disabled={mut.isPending}
            onClick={() =>
              mut.mutate(
                { data: { action: a.act, targetId: p.id } },
                {
                  onSuccess: async (r) => {
                    await invalidateSocial(qc);
                    toast({ title: r.message || 'Done' });
                  },
                  onError: (e) => toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' }),
                },
              )
            }
            data-testid={`button-${a.act}-${p.id}`}
          >
            <a.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{a.label}</span>
          </HudButton>
        ))}
      </div>
    </div>
  );
}

const TABS = ['friends', 'incoming', 'sent', 'invitations'] as const;

function FriendsInner({ account }: { account: PlayerAccount }) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQ(input.trim().slice(0, 40)), 300);
    return () => window.clearTimeout(timer.current);
  }, [input]);
  const params = { q };
  const { data, isLoading, error, refetch, isFetching } = useGetSocial(params, {
    query: { queryKey: getGetSocialQueryKey(params), refetchInterval: 5000, placeholderData: (prev) => prev },
  });
  const [tab, setTab] = useState<(typeof TABS)[number]>('friends');
  const counts = { friends: data?.friends.length ?? 0, incoming: data?.incoming.length ?? 0, sent: data?.sent.length ?? 0, invitations: data?.invitations.length ?? 0 };

  return (
    <AppShell account={account}>
      <PageHeader kicker="Crew roster" title="Your people" sub="Find engineers by name, build your roster, and answer crew requests." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="p-5">
          <div className="kicker mb-3">Personnel search</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={40}
              placeholder="Search engineers by name"
              className="h-12 w-full rounded-md border border-white/10 bg-void/60 pl-10 pr-10 outline-none transition-colors focus:border-ion"
              data-testid="input-search"
            />
            {isFetching && q && <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-ion pulse-dot" />}
          </div>
          <div className="mt-4 space-y-2">
            {!q ? (
              <EmptyState icon={<Search className="h-5 w-5" />} title="Start typing" text="Search the Asterion personnel directory for real players who have created an engineer." />
            ) : isLoading ? (
              Array.from({ length: 3 }, (_, i) => <SkeletonBlock key={i} className="h-16" />)
            ) : (data?.search.length ?? 0) === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="No match" text={`Nobody named "${q}" in the directory yet. Ask them to enlist.`} />
            ) : (
              data!.search.map((p) => <PlayerRow key={p.id} p={p} actions={[{ act: 'send', label: 'Add', icon: UserPlus, variant: 'ion' }]} />)
            )}
          </div>
        </Panel>

        <div>
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[.02] p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 font-display text-xs font-semibold uppercase tracking-[.14em] transition-colors', tab === t ? 'bg-ion/15 text-ion' : 'text-muted-foreground hover:text-foreground')}
                data-testid={`tab-${t}`}
              >
                {t}
                {counts[t] > 0 && <span className={cn('rounded-sm px-1.5 font-mono text-[10px]', t === 'incoming' || t === 'invitations' ? 'bg-burn text-void' : 'bg-white/10')}>{counts[t]}</span>}
              </button>
            ))}
          </div>
          {error ? (
            <ErrorState message={errMsg(error, 'Could not load your roster.')} onRetry={() => refetch()} />
          ) : isLoading && !data ? (
            <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} className="h-16" />)}</div>
          ) : (
            <div className="space-y-2">
              {tab === 'friends' &&
                (counts.friends === 0 ? (
                  <EmptyState icon={<Users className="h-5 w-5" />} title="No crewmates yet" text="Search for an engineer and send a request. Friends can be invited into your mission lobbies." />
                ) : (
                  data!.friends.map((p) => <PlayerRow key={p.id} p={p} actions={[{ act: 'remove', label: 'Remove', icon: UserMinus, variant: 'danger' }]} />)
                ))}
              {tab === 'incoming' &&
                (counts.incoming === 0 ? (
                  <EmptyState icon={<Inbox className="h-5 w-5" />} title="Inbox clear" text="Friend requests from other engineers appear here." />
                ) : (
                  data!.incoming.map((p) => (
                    <PlayerRow key={p.id} p={p} actions={[{ act: 'reject', label: 'Reject', icon: X }, { act: 'accept', label: 'Accept', icon: Check, variant: 'ion' }]} />
                  ))
                ))}
              {tab === 'sent' &&
                (counts.sent === 0 ? (
                  <EmptyState icon={<Send className="h-5 w-5" />} title="Nothing pending" text="Requests you send wait here until accepted." />
                ) : (
                  data!.sent.map((p) => <PlayerRow key={p.id} p={p} actions={[{ act: 'cancel', label: 'Cancel', icon: X }]} />)
                ))}
              {tab === 'invitations' &&
                (counts.invitations === 0 ? (
                  <EmptyState icon={<Send className="h-5 w-5" />} title="No mission invitations" text="When a friend invites you into their lobby, you can join from here." />
                ) : (
                  data!.invitations.map((inv) => <InvitationRow key={inv.id} inv={inv} />)
                ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function FriendsPage() {
  return <RequireCharacter>{(a) => <FriendsInner account={a} />}</RequireCharacter>;
}
