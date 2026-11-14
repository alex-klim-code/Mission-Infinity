import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, CloudUpload, Info, Loader2, RotateCw, ScanFace, ShieldCheck, Trash2 } from 'lucide-react';
import { getGetAvatarConfigQueryKey, useGetAvatarConfig, type Avatar3D } from '@workspace/api-client-react';
import { AvaturnEditor } from '@/components/avaturn-editor';
import { Avatar3DStage } from '@/components/avatar3d';
import { HudButton, SkeletonBlock } from '@/components/ui-kit';
import type { Avatar3DDraftApi } from '@/hooks/use-avatar3d-draft';
import { avatarFileUrl, genderLabel } from '@/lib/avatar3d';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';

export function FreePilotNotes({ className }: { className?: string }) {
  return (
    <details className={cn('group rounded-md border border-white/10 bg-white/[.02] px-4 py-3 text-sm', className)} data-testid="text-free-pilot-limits">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-ion" /> Free pilot limits
      </summary>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-muted-foreground">
        <li>Your model wears Avaturn's standard outfits, not an Asterion uniform.</li>
        <li>Your country flag lives on your badge and file, not sewn onto the 3D model.</li>
        <li>Skin, hair and eye options are only what Avaturn's own editor offers.</li>
        <li>We can't reopen a specific saved avatar; Avaturn may remember its own editor state.</li>
      </ul>
    </details>
  );
}

function Consent({ onLaunch, again }: { onLaunch: () => void; again?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-4">
      <ul className="space-y-2.5 text-sm">
        {[
          'Avaturn, an outside service, builds your 3D look. Any photos you take or upload there go to Avaturn, under their terms. It may ask you to log in with an Avaturn account; your Mission: Infinity sign-in stays as it is.',
          'The 3D model you export and save becomes visible to signed-in players: crewmates, friends and lobbies.',
          "We never use your camera ourselves. Only Avaturn's editor can.",
        ].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 font-mono text-[10px] text-burn">0{i + 1}</span>
            <span className="text-muted-foreground">{t}</span>
          </li>
        ))}
      </ul>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 p-3 hover:border-ion/40">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(186_92%_56%)]" data-testid="checkbox-avaturn-consent" />
        <span className="text-sm">I understand. Open Avaturn for me.</span>
      </label>
      <HudButton onClick={onLaunch} disabled={!ok} data-testid="button-launch-avaturn">
        <ScanFace className="h-4 w-4" /> {again ? 'Re-open Avaturn' : 'Launch Avaturn'}
      </HudButton>
    </div>
  );
}

/**
 * Avaturn scan bay: consent, embedded editor, local draft preview, upload.
 * The parent owns the draft hook so the draft survives step changes.
 */
export function Avatar3DStudio({
  api,
  gender,
  saved,
  name,
  onEditIdentity,
}: {
  api: Avatar3DDraftApi;
  gender: 'female' | 'male' | null;
  saved?: Avatar3D | null;
  name?: string;
  onEditIdentity?: () => void;
}) {
  const cfg = useGetAvatarConfig({ query: { queryKey: getGetAvatarConfigQueryKey(), staleTime: 60_000 } });
  const [open, setOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const { draft, decoding, ingestError } = api;

  if (cfg.isLoading) return <SkeletonBlock className="h-[420px]" />;
  if (cfg.error || !cfg.data)
    return (
      <div className="rounded-lg border border-burn/30 bg-burn/5 p-6" role="alert">
        <div className="font-display text-lg font-semibold uppercase tracking-wider text-burn">Scan bay offline</div>
        <p className="mt-1 text-sm text-muted-foreground">{errMsg(cfg.error, 'Could not reach the badge office.')}</p>
        <HudButton variant="ghost" className="mt-4" onClick={() => cfg.refetch()} data-testid="button-retry-avatar-config">
          <RotateCw className="h-4 w-4" /> Retry
        </HudButton>
      </div>
    );
  const config = cfg.data;
  if (!config.configured || !config.editorUrl)
    return (
      <div className="relative overflow-hidden rounded-lg border border-dashed border-white/15 p-6" data-testid="status-avaturn-unconfigured">
        <div className="scanline absolute inset-0 opacity-50" aria-hidden />
        <div className="relative">
          <div className="kicker mb-2">3D scan bay / standby</div>
          <div className="font-display text-xl font-semibold uppercase">3D avatars aren't switched on yet</div>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">This deployment has no Avaturn project connected, so there's no 3D editor to open. Use the illustrated look for now; you can scan in later from Settings.</p>
        </div>
      </div>
    );

  const editorUrl = config.editorUrl;
  const limits = { maxModelBytes: config.maxModelBytes, maxPortraitBytes: config.maxPortraitBytes };
  const mismatch = draft && gender && draft.meta.gender !== gender;
  const savedUrl = avatarFileUrl(saved?.modelUrl);
  const showSaved = !draft && saved && savedUrl;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative">
        {draft ? (
          <Avatar3DStage key={draft.token} modelUrl={draft.modelSrc} posterUrl={draft.posterSrc} name={name} className="aspect-[4/5] w-full rounded-lg ring-1 ring-ion/30" onPoster={draft.poster === undefined ? (b) => api.attachPoster(draft.token, b) : undefined} />
        ) : showSaved ? (
          <Avatar3DStage modelUrl={savedUrl} posterUrl={avatarFileUrl(saved.portraitUrl)} name={name} className="aspect-[4/5] w-full rounded-lg ring-1 ring-ion/30" />
        ) : (
          <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(ellipse_at_50%_30%,hsl(198_55%_15%),hsl(224_52%_5%)_75%)]">
            <div className="scanline absolute inset-0" aria-hidden />
            <motion.div className="absolute inset-x-6 h-px bg-ion/70 shadow-[0_0_12px_hsl(186_92%_56%)]" animate={{ y: [-160, 160] }} transition={{ duration: 3.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} aria-hidden />
            <ScanFace className="h-16 w-16 text-ion/50" strokeWidth={1} aria-hidden />
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[.3em] text-ion/80">Scan bay empty</div>
          </div>
        )}
        {decoding && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-void/80 backdrop-blur" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-ion" />
            <span className="font-mono text-[10px] uppercase tracking-[.25em] text-ion">Receiving export</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="kicker mb-1">{draft ? 'Draft scan / not yet saved' : showSaved ? 'On file / Avaturn 3D' : 'Primary / 3D personnel model'}</div>
          <div className="font-display text-2xl font-bold uppercase leading-tight">{draft ? 'Model received.' : showSaved ? 'Your 3D model is on file.' : 'Scan yourself into the roster.'}</div>
        </div>

        <AnimatePresence>
          {ingestError && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert" data-testid="text-avatar-ingest-error">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {ingestError}
            </motion.p>
          )}
        </AnimatePresence>

        {draft && (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center gap-2 text-sm" data-testid="status-avatar-upload">
              {draft.status === 'ready' ? (
                <><Check className="h-4 w-4 text-ion" /> <span>Secured in storage. It becomes your look once you save.</span></>
              ) : draft.status === 'error' ? (
                <><CircleAlert className="h-4 w-4 text-destructive" /> <span className="text-destructive">{draft.error} Your draft is kept.</span></>
              ) : draft.status === 'uploading' ? (
                <><CloudUpload className="h-4 w-4 animate-pulse text-ion" /> <span>Transferring model to the badge office...</span></>
              ) : (
                <><Loader2 className="h-4 w-4 animate-spin text-ion" /> <span>Capturing badge snapshot...</span></>
              )}
            </div>
            {draft.status === 'error' && (
              <HudButton variant="ghost" onClick={api.retry} data-testid="button-retry-upload"><RotateCw className="h-4 w-4" /> Retry upload</HudButton>
            )}
            {draft.portraitNote && <p className="text-xs text-muted-foreground">{draft.portraitNote}</p>}
            <div className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Avaturn body / {genderLabel(draft.meta.gender)}</div>
            {mismatch && (
              <div className="rounded-md border border-burn/40 bg-burn/10 p-3 text-sm" role="alert" data-testid="text-gender-mismatch">
                <p>Avaturn exported a <b>{genderLabel(draft.meta.gender).toLowerCase()}</b> body, but your identity says <b>{genderLabel(gender!).toLowerCase()}</b>. We won't save a mismatch. Pick the matching body in Avaturn and export again{onEditIdentity ? ', or change your identity.' : ', or change Identity above.'}</p>
                {onEditIdentity && <button type="button" onClick={onEditIdentity} className="mt-2 text-ion underline-offset-2 hover:underline" data-testid="button-edit-identity">Edit identity</button>}
              </div>
            )}
          </div>
        )}
        {showSaved && saved && gender && saved.gender !== gender && !draft && (
          <p className="rounded-md border border-burn/40 bg-burn/10 p-3 text-sm" role="alert" data-testid="text-saved-gender-mismatch">
            Your saved model has a {genderLabel(saved.gender).toLowerCase()} body. To switch identity, export a matching model, or restore your illustrated look.
          </p>
        )}

        {!draft && !showSaved && !consentOpen ? (
          <>
            <p className="text-sm text-muted-foreground">Take a selfie or pick a body in Avaturn's editor. A real, rotatable 3D you walks into every lobby and briefing.</p>
            <HudButton onClick={() => setConsentOpen(true)} className="self-start" data-testid="button-start-avaturn">
              <ScanFace className="h-4 w-4" /> Create 3D avatar
            </HudButton>
          </>
        ) : consentOpen || !draft ? (
          consentOpen ? (
            <Consent onLaunch={() => { setConsentOpen(false); setOpen(true); }} again={!!draft || !!showSaved} />
          ) : (
            <HudButton variant="ghost" onClick={() => setConsentOpen(true)} className="self-start" data-testid="button-new-export">
              <ScanFace className="h-4 w-4" /> Create a new export
            </HudButton>
          )
        ) : (
          <div className="flex flex-wrap gap-2">
            <HudButton variant="ghost" onClick={() => setConsentOpen(true)} data-testid="button-reopen-avaturn"><ScanFace className="h-4 w-4" /> Export again</HudButton>
            <HudButton variant="ghost" onClick={api.discard} data-testid="button-discard-draft"><Trash2 className="h-4 w-4" /> Discard draft</HudButton>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-ion" /> Saved models are visible to signed-in players.</p>
          <FreePilotNotes />
        </div>
      </div>

      {open && (
        <AvaturnEditor
          editorUrl={editorUrl}
          onClose={() => setOpen(false)}
          onExport={(r) => {
            setOpen(false);
            void api.ingest(r, limits);
          }}
        />
      )}
    </div>
  );
}
