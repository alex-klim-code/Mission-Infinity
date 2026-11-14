import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useSaveCharacter, type CharacterAppearance, type Player, type PlayerAccount } from '@workspace/api-client-react';
import { Starfield } from '@/components/starfield';
import { RequireCharacter, Wordmark } from '@/components/shell';
import { AgeControl, GenderPicker, nameError } from '@/components/character-fields';
import { AppearanceEditor, CountryPicker } from '@/components/appearance-editor';
import { EmployeeBadge } from '@/components/character-avatar';
import { HudButton } from '@/components/ui-kit';
import { defaultAppearance, randomAppearance, withBase, type Base } from '@/lib/avatar';
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
        {player.appearance && <EmployeeBadge appearance={player.appearance} name={player.name} idSource={accountId} />}
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

  const reset = () => {
    const b = gender ?? app.base;
    const src = existing?.appearance ?? defaultAppearance(account.id, b, country);
    setApp({ ...withBase(src, b), countryCode: country });
  };

  const submit = () => {
    setTouched(true);
    if (nErr || !gender || inFlight.current || save.isPending) return;
    setConfirmationError(null);
    inFlight.current = true;
    save.mutate(
      { data: { name: name.trim(), age, gender, countryCode: country, appearance: live, ...(existing?.presetId ? { presetId: existing.presetId } : {}) } },
      {
        onSuccess: async (p) => {
          if (!p.appearance) {
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
                        <AppearanceEditor value={live} onChange={setApp} onRandomize={() => setApp(randomAppearance(live))} onReset={reset} />
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
                          <EmployeeBadge appearance={live} name={name} idSource={account.id} />
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
                <HudButton variant="burn" onClick={submit} loading={save.isPending} disabled={!!nErr || !gender} data-testid="button-save-character">
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
