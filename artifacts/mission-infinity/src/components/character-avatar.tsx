import { useId, useMemo } from 'react';
import type { CharacterAppearance } from '@workspace/api-client-react';
import { avatarDataUri, countryName, employeeIdFor, flagUrl, UNIFORM_NAVY } from '@/lib/avatar';
import { imgUrl, portraitFor } from '@/lib/game';
import { avatarFileUrl } from '@/lib/avatar3d';
import { Avatar3DPlaceholder } from '@/components/avatar3d';
import { cn } from '@/lib/utils';

/** Generated head + fixed Asterion uniform overlay + flag patch, all in one SVG. */
export function CharacterAvatar({
  appearance,
  className,
  title,
  backdrop = true,
}: {
  appearance: CharacterAppearance;
  className?: string;
  title?: string;
  backdrop?: boolean;
}) {
  const uri = useMemo(() => avatarDataUri(appearance), [appearance]);
  const uid = useId().replace(/:/g, '');
  const bg = `bg-${uid}`;
  const body = `body-${uid}`;
  return (
    <svg viewBox="0 0 280 280" className={cn('block h-full w-full', className)} role="img" aria-label={title ?? 'Engineer portrait'} data-testid="img-character-avatar">
      <defs>
        <radialGradient id={bg} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="#1d4a63" />
          <stop offset="1" stopColor="#081322" />
        </radialGradient>
        <clipPath id={body}>
          <path d="M44 280 C48 246 78 226 112 222 L168 222 C202 226 232 246 236 280 Z" />
        </clipPath>
      </defs>
      {backdrop && (
        <>
          <rect width="280" height="280" fill={`url(#${bg})`} />
          <circle cx="140" cy="118" r="104" fill="none" stroke="#38d7ec" strokeOpacity=".14" strokeDasharray="2 6" />
        </>
      )}
      <image href={uri} x="0" y="0" width="280" height="280" />
      <g clipPath={`url(#${body})`}>
        <path d="M40 280 L40 232 L240 232 L240 280 Z" fill={UNIFORM_NAVY} fillOpacity=".55" />
        <path d="M56 280 C62 258 76 244 96 236" stroke="#f47b2e" strokeWidth="3" fill="none" />
        <path d="M224 280 C218 258 204 244 184 236" stroke="#f47b2e" strokeWidth="3" fill="none" />
        <path d="M120 226 L140 246 L160 226" stroke="#f47b2e" strokeOpacity=".8" strokeWidth="2" fill="none" />
        <line x1="140" y1="246" x2="140" y2="280" stroke="#0a1626" strokeWidth="2" />
        {/* Asterion insignia */}
        <g transform="translate(103 258)">
          <circle r="10" fill="#0b1a2c" stroke="#38d7ec" strokeWidth="1.2" />
          <path d="M0 -6 L5 5 L0 2 L-5 5 Z" fill="#f47b2e" />
        </g>
        {/* Flag patch */}
        <g transform="translate(164 250)">
          <rect x="-1.5" y="-1.5" width="27" height="19" rx="2" fill="#0b1a2c" stroke="#f47b2e" strokeWidth="1" />
          <image href={flagUrl(appearance.countryCode)} x="0" y="0" width="24" height="16" preserveAspectRatio="xMidYMid slice" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Personnel badge. Photo source priority: 3D snapshot (or honest 3D placeholder) when the player
 * has a 3D model; otherwise the illustrated look; otherwise the legacy preset portrait.
 * The country flag always lives here on the badge, never on the 3D model.
 */
export function EmployeeBadge({
  appearance,
  avatar3d,
  portraitSrc,
  presetId,
  countryCode,
  name,
  idSource,
  className,
}: {
  appearance?: CharacterAppearance | null;
  /** true / object when the badge represents a 3D avatar */
  avatar3d?: { portraitUrl: string | null } | boolean | null;
  /** explicit snapshot (e.g. local draft) */
  portraitSrc?: string | null;
  presetId?: string;
  countryCode?: string | null;
  name: string;
  idSource: string;
  className?: string;
}) {
  const cc = countryCode ?? appearance?.countryCode ?? null;
  const is3d = !!avatar3d;
  const snap = portraitSrc ?? (avatar3d && typeof avatar3d === 'object' ? avatarFileUrl(avatar3d.portraitUrl) : null);
  return (
    <div
      className={cn('relative w-full max-w-[340px] overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(160deg,hsl(214_55%_14%),hsl(224_52%_6%))] shadow-[0_30px_60px_-30px_hsl(186_92%_40%/.5)]', className)}
      data-testid="card-employee-badge"
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={imgUrl('/logo.svg')} alt="Asterion Aerospace" className="h-6 w-6" />
          <div className="leading-tight">
            <div className="font-display text-[11px] font-bold uppercase tracking-[.22em]">Asterion</div>
            <div className="font-mono text-[8px] uppercase tracking-[.3em] text-muted-foreground">Aerospace</div>
          </div>
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[.25em] text-burn">Personnel ID</div>
      </div>
      <div className="flex gap-4 p-4">
        <div className="w-[120px] shrink-0 overflow-hidden rounded-md ring-1 ring-ion/40">
          <div className="relative aspect-square">
            {is3d ? (
              snap ? <img src={snap} alt={`${name} badge snapshot`} className="h-full w-full bg-[radial-gradient(circle_at_50%_35%,hsl(196_60%_22%),hsl(222_55%_7%))] object-cover" data-testid="img-badge-3d" /> : <Avatar3DPlaceholder name={name} />
            ) : appearance ? (
              <CharacterAvatar appearance={appearance} title={`${name} badge portrait`} />
            ) : (
              <img src={imgUrl(portraitFor(presetId))} alt={`${name} badge portrait`} className="h-full w-full object-cover" />
            )}
            {is3d && <span className="absolute bottom-1 left-1 rounded-sm bg-void/80 px-1 font-mono text-[7px] uppercase tracking-[.2em] text-ion">3D</span>}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <div className="font-mono text-[8px] uppercase tracking-[.25em] text-muted-foreground">Name</div>
            <div className="truncate font-display text-lg font-bold uppercase leading-tight" data-testid="text-badge-name">{name.trim() || 'Your name'}</div>
          </div>
          <div>
            <div className="font-mono text-[8px] uppercase tracking-[.25em] text-muted-foreground">Division</div>
            <div className="text-xs font-semibold text-ion">Engineering Division</div>
          </div>
          <div>
            <div className="font-mono text-[8px] uppercase tracking-[.25em] text-muted-foreground">Home</div>
            <div className="flex items-center gap-1.5 text-xs">
              <img src={flagUrl(cc)} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
              <span className="truncate" data-testid="text-badge-country">{countryName(cc)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
        <span className="font-mono text-[11px] tracking-[.18em]" data-testid="text-employee-id">{employeeIdFor(idSource)}</span>
        <div className="flex h-4 gap-[2px]" aria-hidden>
          {employeeIdFor(idSource).replace(/\D/g, '').split('').map((d, i) => (
            <span key={i} className="h-full bg-foreground/60" style={{ width: (Number(d) % 3) + 1 }} />
          ))}
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-burn via-burn/60 to-ion/60" />
      <p className="px-4 pb-2 pt-1.5 font-mono text-[7px] uppercase tracking-[.2em] text-muted-foreground/70">Fictional game credential / Mission: Infinity{is3d ? ' / 3D via Avaturn, standard outfit' : ''}</p>
    </div>
  );
}
