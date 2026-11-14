import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Box, Check, Palette } from 'lucide-react';
import { useSaveCharacter, type CharacterAppearance, type Player, type PlayerAccount } from '@workspace/api-client-react';
import { Starfield } from '@/components/starfield';
import { RequireCharacter, Wordmark } from '@/components/shell';
import { AgeControl, GenderPicker, nameError } from '@/components/character-fields';
import { AppearanceEditor, CountryPicker } from '@/components/appearance-editor';
import { EmployeeBadge } from '@/components/character-avatar';
import { HudButton, PlayerPortrait } from '@/components/ui-kit';
import { Avatar3DStudio } from '@/components/avatar3d-studio';
import { useAvatar3DDraft } from '@/hooks/use-avatar3d-draft';
import { avatarFileUrl } from '@/lib/avatar3d';
import { defaultAppearance, randomAppearance, sameAppearance, withBase, type Base } from '@/lib/avatar';
import { errMsg, imgUrl, invalidateGame } from '@/lib/game';
import { cn } from '@/lib/utils';

const STEPS = ['Identity', 'Age', 'Country', 'Avatar'];

function Heading({ title, sub, center }: { title: string; sub: string; center?: boolean }) {
  return (
    <div className={cn('mb-8', center && 'text-center')}>
      <h1 className="mb-2 font-display text-4xl font-bold uppercase leading-[1.05] md:text-5xl">{title}</h1>
      <p className="text-muted-foreground">{sub}</p>
    </div>
  );
}

function Success({ player, accountId }: { player: Player; accountId: string }) {
  const [, setLocation] = useLocation();
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-center text-center" data-testid="screen-character-saved">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-ion/50 text-ion">
        <Check className="h-5 w-5" />
      </div>
      <div className="kicker mb-3">Personnel file / approved</div>
      <h1 className="font-display text-4xl font-bold uppercase leading-[1.05] md:text-6xl">You're officially one of us.</h1>
      <p className="mt-3 text-muted-foreground">Your badge is ready. Your future is waiting.</p>
      <motion.div initial={{ opacity: 0, rotateX: 25, y: 30 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ delay: 0.25, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="my-10 w-full max-w-[340px]" style={{ perspective: 800 }}>
        <EmployeeBadge appearance={player.appearance} avatar3d={player.avatar3d ?? null} presetId={player.presetId} countryCode={player.countryCode ?? player.appearance?.countryCode} name={player.name} idSource={accountId} />
      </motion.div>
      <HudButton variant="burn" onClick={() => setLocation('/play')} data-testid="button-continue-mission-control">
        Continue to Mission Control <ArrowRight className="h-4 w-4" />
      </HudButton>
    </motion.div>
  );
}

function Creator({ account }: { account: PlayerAccount }) {
  const existing = account.character;
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Base | null>(existing && existing.gender !== 'unspecified' ? existing.gender : null);
  const [age, setAge] = useState(existing?.age ?? 20);
  const [country, setCountry] = useState((existing?.appearance?.countryCode ?? existing?.countryCode ?? 'PL').toUpperCase());
  const [app, setApp] = useState<CharacterAppearance>(() => existing?.appearance ?? defaultAppearance(account.id, gender ?? 'female', country));
  const [name, setName] = useState(existing?.name ?? '');
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState<Player | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [mode, setMode] = useState<'3d' | 'legacy'>(existing && !existing.avatar3d ? 'legacy' : '3d');
  // Preset-only profiles keep their classic portrait unless the player explicitly customizes.
  const [legacyEdited, setLegacyEdited] = useState(!existing || !!existing.appearance);
  const draftApi = useAvatar3DDraft();
  const draft = draftApi.draft;
  const inFlight = useRef(false);
  const save = useSaveCharacter();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const nErr = nameError(name);
  const canNext = [gender !== null, age >= 14 && age <= 60, /^[A-Z]{2}$/.test(country), !nErr][step];
  const live: CharacterAppearance = { ...withBase(app, gender ?? app.base), countryCode: country };

  const pickGender = (g: Base) => {
    setGender(g);
    // The first selection must start from that base, not the provisional female preview.
    // Subsequent switches retain deliberate custom choices; every hairstyle is available.
    setApp((a) => gender === null ? defaultAppearance(account.id, g, country) : withBase(a, g));
  };

  const classicOnly = !!existing && !existing.appearance && !legacyEdited;
  const sendApp = !existing ? true : existing.appearance ? !sameAppearance(live, existing.appearance) : legacyEdited;

  const reset = () => {
    if (existing && !existing.appearance) {
      setLegacyEdited(false);
      setApp(defaultAppearance(account.id, gender ?? 'female', country));
      return;
    }
    const b = gender ?? app.base;
    const src = existing?.appearance ?? defaultAppearance(account.id, b, country);
    setApp({ ...withBase(src, b), countryCode: country });
  };

  const savedModel = existing?.avatar3d ?? null;
  const draftInput = draft?.status === 'ready' && draft.input && draft.input.gender === gender ? draft.input : null;
  const savedOk = !!savedModel && savedModel.gender === gender && !draft;
  const threeDBlock =
    mode !== '3d' ? null
    : draft && gender && draft.meta.gender !== gender ? 'Your Avaturn body does not match your identity. Export a matching body or edit identity.'
    : draft && draft.status !== 'ready' ? 'Your 3D model is still transferring.'
    : !draftInput && !savedOk ? (savedModel && gender && savedModel.gender !== gender ? 'Your saved model does not match this identity. Export a matching one, or use the illustrated look.' : 'Create your 3D avatar in Avaturn, or switch to the illustrated look.')
    : null;

  const submit = () => {
    setTouched(true);
    if (nErr || !gender || inFlight.current || save.isPending || threeDBlock) return;
    setConfirmationError(null);
    inFlight.current = true;
    const avatarPart = mode === '3d' ? (draftInput ? { avatar3d: draftInput } : {}) : savedModel ? { avatar3d: null } : {};
    save.mutate(
      { data: { name: name.trim(), age, gender, countryCode: country, ...(sendApp ? { appearance: live } : {}), ...avatarPart, ...(existing?.presetId ? { presetId: existing.presetId } : {}) } },
      {
        onSuccess: async (p) => {
          if (mode === '3d' && !p.avatar3d) {
            setConfirmationError('Mission Control could not confirm your saved 3D model. Please retry.');
            return;
          }
          if (mode === 'legacy' && sendApp && !p.appearance) {
            setConfirmationError('Mission Control could not confirm your saved appearance. Please retry.');
            return;
          }
          await invalidateGame(qc);
          setSaved(p);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <div className="grain relative min-h-[100dvh] overflow-hidden bg-background">
      <img src={imgUrl('/images/headquarters.png')} alt="" className="kenburns absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/90 to-background" />
      <Starfield density={0.5} />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-6 md:px-10">
        <header className="flex items-center justify-between">
          <Wordmark small />
          <span className="font-mono text-[10px] uppercase tracking-[.25em] text-muted-foreground">{saved ? 'Badge issued' : 'Personnel file / new hire'}</span>
        </header>

        {saved ? (
          <div className="flex flex-1 flex-col justify-center py-10">
            <Success player={saved} accountId={account.id} />
          </div>
        ) : (
          <>
            <nav className="mt-10 grid grid-cols-4 gap-2" aria-label="Progress">
              {STEPS.map((s, i) => (
                <button key={s} type="button" disabled={i > step} onClick={() => setStep(i)} className="text-left" aria-current={i === step ? 'step' : undefined} data-testid={`button-step-${i + 1}`}>
                  <div className="h-0.5 overflow-hidden rounded bg-white/10">
                    <motion.div className="h-full bg-ion" initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} style={{ originX: 0 }} />
                  </div>
                  <div className={cn('mt-2 font-mono text-[10px] uppercase tracking-[.2em]', i === step ? 'text-ion' : 'text-muted-foreground')}>
                    0{i + 1} <span className="hidden sm:inline">{s}</span>
                  </div>
                </button>
              ))}
            </nav>

            <div className="flex flex-1 flex-col justify-center py-10">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                  {step === 0 && (
                    <div className="mx-auto max-w-2xl">
                      <Heading title="Who will you become?" sub="Every great mission begins with someone willing to take the first step." />
                      <GenderPicker value={gender} onChange={(g) => g !== 'unspecified' && pickGender(g)} allowUnspecified={false} />
                    </div>
                  )}
                  {step === 1 && (
                    <>
                      <Heading center title="How many orbits around the Sun?" sub="Every year is another journey around our star." />
                      <AgeControl value={age} onChange={setAge} />
                    </>
                  )}
                  {step === 2 && (
                    <div className="mx-auto max-w-3xl">
                      <Heading title="Where on Earth is home?" sub="Before you explore the universe, tell us where your story began." />
                      <CountryPicker value={country} onChange={setCountry} />
                    </div>
                  )}
                  {step === 3 && (
                    <>
                      <Heading title="Let's put a face to your name." sub="Create your look and prepare your official Asterion Aerospace badge." />
                      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
                        <div className="min-w-0 space-y-5">
                          <div className="inline-flex rounded-md border border-white/10 bg-white/[.02] p-1" role="radiogroup" aria-label="Avatar type">
                            {([
                              ['3d', '3D avatar', Box],
                              ['legacy', existing?.appearance && !existing.avatar3d ? 'Keep current look' : 'Illustrated look', Palette],
                            ] as const).map(([k, label, Icon]) => (
                              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={cn('inline-flex min-h-10 items-center gap-2 rounded px-3 font-display text-xs font-semibold uppercase tracking-[.14em] transition-colors', mode === k ? 'bg-ion text-void' : 'text-muted-foreground hover:text-foreground')} data-testid={`button-mode-${k}`}>
                                <Icon className="h-3.5 w-3.5" /> {label}
                              </button>
                            ))}
                          </div>
                          {mode === '3d' ? (
                            <Avatar3DStudio api={draftApi} gender={gender} saved={savedModel} name={name} onEditIdentity={() => setStep(0)} />
                          ) : (
                            <>
                              {savedModel && <p className="rounded-md border border-burn/30 bg-burn/5 p-3 text-sm text-muted-foreground">Saving with the illustrated look sets your 3D model aside. It stays on record; you can scan again any time.</p>}
                              {classicOnly ? (
                                <div className="flex flex-col items-start gap-5 rounded-lg border border-dashed border-white/10 p-5 sm:flex-row sm:items-center" data-testid="card-keep-classic">
                                  <div className="w-28 shrink-0 overflow-hidden rounded-md">
                                    <PlayerPortrait player={{ ...existing!, appearance: null, avatar3d: null }} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-display text-lg font-semibold uppercase tracking-wider">Classic portrait</div>
                                    <p className="mt-1 text-sm text-muted-foreground">Kept exactly as it is. Customize only if you want a new illustrated look.</p>
                                    <HudButton variant="ghost" className="mt-4" onClick={() => { setApp(defaultAppearance(account.id, gender ?? 'female', country)); setLegacyEdited(true); }} data-testid="button-customize-look">
                                      <Palette className="h-4 w-4" /> Customize illustrated look
                                    </HudButton>
                                  </div>
                                </div>
                              ) : (
                                <AppearanceEditor value={live} onChange={setApp} onRandomize={() => setApp(randomAppearance(live))} onReset={reset} />
                              )}
                            </>
                          )}
                        </div>
                        <div className="space-y-5">
                          <div>
                            <label htmlFor="input-name" className="kicker mb-2 block">Username</label>
                            <input
                              id="input-name"
                              value={name}
                              maxLength={24}
                              onChange={(e) => setName(e.target.value)}
                              onBlur={() => setTouched(true)}
                              onKeyDown={(e) => e.key === 'Enter' && submit()}
                              placeholder="e.g. Ines Okafor"
                              aria-invalid={touched && !!nErr}
                              className="w-full border-b-2 border-white/15 bg-transparent pb-2 font-display text-2xl font-semibold outline-none transition-colors placeholder:text-white/20 focus:border-ion"
                              data-testid="input-name"
                            />
                            <div className="mt-2 flex justify-between text-sm">
                              <span className="text-destructive" role="alert">{touched && nErr}</span>
                              <span className="font-mono text-muted-foreground">{name.trim().length}/24</span>
                            </div>
                          </div>
                          {mode === '3d' ? (
                            <EmployeeBadge avatar3d countryCode={country} portraitSrc={draft?.posterSrc ?? (savedOk ? avatarFileUrl(savedModel?.portraitUrl) : null)} name={name} idSource={account.id} />
                          ) : (
                            <EmployeeBadge appearance={classicOnly ? null : live} presetId={existing?.presetId} countryCode={country} name={name} idSource={account.id} />
                          )}
                          {threeDBlock && <p className="text-sm text-burn" role="status" data-testid="text-3d-block">{threeDBlock}</p>}
                          {(save.error || confirmationError) && (
                            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert" data-testid="text-save-error">
                              {confirmationError ?? errMsg(save.error)} Your edits are kept, try again.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="flex items-center justify-between gap-4 border-t border-white/10 pt-5">
              <HudButton variant="ghost" onClick={() => (step === 0 ? (existing ? setLocation('/play') : undefined) : setStep(step - 1))} disabled={(step === 0 && !existing) || save.isPending} data-testid="button-back">
                <ArrowLeft className="h-4 w-4" /> Back
              </HudButton>
              {step < 3 ? (
                <HudButton onClick={() => setStep(step + 1)} disabled={!canNext} data-testid="button-next">
                  Continue <ArrowRight className="h-4 w-4" />
                </HudButton>
              ) : (
                <HudButton variant="burn" onClick={submit} loading={save.isPending} disabled={!!nErr || !gender || !!threeDBlock} data-testid="button-save-character">
                  Issue my badge
                </HudButton>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default function CharacterPage() {
  return <RequireCharacter allowNoCharacter>{(a) => <Creator account={a} />}</RequireCharacter>;
}
