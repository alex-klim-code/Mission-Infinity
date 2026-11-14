import { type ReactNode } from 'react';
import { Link, Redirect, useLocation } from 'wouter';
import { Show, useClerk } from '@clerk/react';
import { Award, LogOut, Rocket, Settings, Users } from 'lucide-react';
import { getGetPlayerQueryKey, getGetSocialQueryKey, useGetPlayer, useGetSocial, type PlayerAccount } from '@workspace/api-client-react';
import { Starfield } from '@/components/starfield';
import { ErrorState, Portrait, SkeletonBlock } from '@/components/ui-kit';
import { useLinkStatus } from '@/hooks/use-realtime';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
      <img src={`${basePath}/logo.svg`} alt="" className={small ? 'h-7 w-7' : 'h-9 w-9'} />
      <span className="font-display text-sm font-bold uppercase tracking-[.22em]">
        Mission<span className="text-burn">:</span> Infinity
      </span>
    </Link>
  );
}

export function LinkStatusPill() {
  const status = useLinkStatus();
  const label = status === 'online' ? 'Uplink live' : status === 'connecting' ? 'Reconnecting' : 'Uplink offline';
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground"
      data-testid="status-connection"
      title="Real-time crew link"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'online' && 'bg-[hsl(150_70%_50%)]',
          status === 'connecting' && 'pulse-dot bg-burn',
          status === 'offline' && 'bg-destructive',
        )}
      />
      {label}
    </div>
  );
}

const NAV = [
  { href: '/play', label: 'Missions', icon: Rocket },
  { href: '/friends', label: 'Crew', icon: Users },
  { href: '/profile', label: 'Career', icon: Award },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function useInviteCount(enabled: boolean) {
  const params = { q: '' };
  const { data } = useGetSocial(params, {
    query: { enabled, queryKey: getGetSocialQueryKey(params), refetchInterval: 5000 },
  });
  return (data?.invitations.filter((i) => i.direction === 'incoming').length ?? 0) + (data?.incoming.length ?? 0);
}

export function AppShell({ account, children }: { account: PlayerAccount; children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const badge = useInviteCount(true);
  const c = account.character;
  return (
    <div className="grain relative min-h-[100dvh] overflow-x-hidden bg-background">
      <div className="fixed inset-0 -z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(214_70%_14%/.55),transparent_60%)]" />
        <Starfield density={0.7} />
      </div>
      <header className="sticky top-0 z-40 border-b border-white/[.06] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-8">
          <Wordmark small />
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = location.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`link-nav-${n.label.toLowerCase()}`}
                  className={cn(
                    'relative rounded-md px-3 py-2 font-display text-xs font-semibold uppercase tracking-[.18em] transition-colors',
                    active ? 'text-ion' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {n.label}
                  {n.href === '/friends' && badge > 0 && (
                    <span className="ml-1.5 rounded-sm bg-burn px-1.5 py-0.5 font-mono text-[10px] text-void">{badge}</span>
                  )}
                  {active && <span className="absolute inset-x-3 -bottom-[17px] h-px bg-ion" />}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <LinkStatusPill />
            </div>
            {c && (
              <Link href="/profile" className="flex items-center gap-2" data-testid="link-player-chip">
                <Portrait player={c} size={34} />
                <span className="hidden text-sm font-semibold lg:inline" data-testid="text-player-name">{c.name}</span>
              </Link>
            )}
            <button
              onClick={() => signOut({ redirectUrl: basePath || '/' })}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label="Sign out"
              data-testid="button-sign-out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-28 pt-8 md:px-8 md:pb-16">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-background/90 backdrop-blur-xl md:hidden">
        {NAV.map((n) => {
          const active = location.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              data-testid={`link-mobile-${n.label.toLowerCase()}`}
              className={cn('relative flex flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-widest', active ? 'text-ion' : 'text-muted-foreground')}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
              {n.href === '/friends' && badge > 0 && <span className="absolute right-[30%] top-2 h-2 w-2 rounded-full bg-burn" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function FullScreenLoader({ label = 'Establishing uplink' }: { label?: string }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background">
      <Starfield />
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border border-ion/20 border-t-ion" />
        <div className="absolute inset-3 rounded-full bg-burn/80 pulse-dot" />
      </div>
      <div className="kicker">{label}</div>
    </div>
  );
}

/** Signed-in + has character. Renders children with the account. */
export function RequireCharacter({ children, allowNoCharacter }: { children: (a: PlayerAccount) => ReactNode; allowNoCharacter?: boolean }) {
  return (
    <>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
      <Show when="signed-in">
        <AccountGate allowNoCharacter={allowNoCharacter}>{children}</AccountGate>
      </Show>
    </>
  );
}

function AccountGate({ children, allowNoCharacter }: { children: (a: PlayerAccount) => ReactNode; allowNoCharacter?: boolean }) {
  const { data, isLoading, error, refetch } = useGetPlayer({ query: { queryKey: getGetPlayerQueryKey() } });
  if (isLoading) return <FullScreenLoader />;
  if (error || !data)
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <Starfield />
        <div className="relative w-full max-w-md">
          <ErrorState message={errMsg(error, 'Could not load your engineer profile.')} onRetry={() => refetch()} />
        </div>
      </div>
    );
  if (!data.character && !allowNoCharacter) return <Redirect to="/character" />;
  return <>{children(data)}</>;
}

export function PageHeader({ kicker, title, sub, right }: { kicker: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="kicker mb-3">{kicker}</div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide md:text-5xl">{title}</h1>
        {sub && <p className="mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-10 w-64" />
      <SkeletonBlock className="h-64 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>
    </div>
  );
}
