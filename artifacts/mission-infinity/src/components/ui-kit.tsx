import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, RotateCw, TriangleAlert } from 'lucide-react';
import type { Player } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { CharacterAvatar } from '@/components/character-avatar';
import { imgUrl, portraitFor } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';

type Variant = 'ion' | 'burn' | 'ghost' | 'danger';
export function HudButton({
  variant = 'ion',
  loading,
  className,
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const { blip } = usePrefs();
  const styles: Record<Variant, string> = {
    ion: 'bg-ion text-void hover:bg-[hsl(186_92%_66%)] shadow-[0_0_0_1px_hsl(186_92%_56%/.4),0_10px_30px_-10px_hsl(186_92%_56%/.6)]',
    burn: 'bg-burn text-void hover:bg-[hsl(22_96%_64%)] shadow-[0_10px_30px_-10px_hsl(22_96%_58%/.7)]',
    ghost: 'border border-white/15 bg-white/[.03] text-foreground hover:border-ion/60 hover:bg-ion/10',
    danger: 'border border-destructive/50 text-destructive hover:bg-destructive/10',
  };
  return (
    <button
      {...rest}
      onClick={(e) => {
        blip(variant === 'burn' ? 'confirm' : 'tap');
        onClick?.(e);
      }}
      disabled={rest.disabled || loading}
      className={cn(
        'group relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-md px-5 font-display text-sm font-semibold uppercase tracking-[.14em] transition-[transform,background-color,border-color,opacity] duration-200 active:scale-[.97] disabled:pointer-events-none disabled:opacity-40',
        styles[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Portrait({
  player,
  presetId,
  name,
  size = 48,
  online,
  className,
  ring = 'ion',
}: {
  player?: Pick<Player, 'presetId' | 'name' | 'appearance'> | null;
  presetId?: string;
  name?: string;
  size?: number;
  online?: boolean;
  className?: string;
  ring?: 'ion' | 'burn' | 'none';
}) {
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className={cn(
          'h-full w-full overflow-hidden rounded-md bg-muted',
          ring === 'ion' && 'ring-1 ring-ion/40',
          ring === 'burn' && 'ring-2 ring-burn/70',
        )}
      >
        {player?.appearance ? (
          <CharacterAvatar appearance={player.appearance} title={player.name} />
        ) : (player?.presetId ?? presetId) ? (
          <img src={imgUrl(portraitFor(player?.presetId ?? presetId))} alt={player?.name ?? name ?? 'Engineer portrait'} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-muted-foreground">
            {(player?.name ?? name ?? '?').slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
            online ? 'bg-[hsl(150_70%_50%)]' : 'bg-muted-foreground/50',
          )}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('glass hud-corners rounded-lg', className)}>{children}</div>;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-white/[.04]', className)}>
      <div className="sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ion/10 to-transparent" />
    </div>
  );
}

export function ErrorState({ title = 'Signal lost', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <Panel className="flex flex-col items-start gap-4 p-6" >
      <div className="flex items-center gap-3 text-burn">
        <TriangleAlert className="h-5 w-5" />
        <span className="font-display text-lg font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="text-error">{message}</p>
      {onRetry && (
        <HudButton variant="ghost" onClick={onRetry} data-testid="button-retry">
          <RotateCw className="h-4 w-4" /> Retry transmission
        </HudButton>
      )}
    </Panel>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ion/30 text-ion">{icon}</div>
      <div className="font-display text-base font-semibold uppercase tracking-wider">{title}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

/** Large portrait: saved custom look, or the legacy preset image. */
export function PlayerPortrait({ player, className }: { player: Pick<Player, 'presetId' | 'name' | 'appearance'>; className?: string }) {
  return player.appearance ? (
    <div className={cn('aspect-[4/5] w-full overflow-hidden bg-[#081322]', className)}>
      <CharacterAvatar appearance={player.appearance} title={player.name} className="h-full w-full" />
    </div>
  ) : (
    <img src={imgUrl(portraitFor(player.presetId))} alt={player.name} className={cn('aspect-[4/5] w-full object-cover', className)} />
  );
}
