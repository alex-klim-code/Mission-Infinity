import { useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useGetGameCatalog, useSaveCharacter, type PlayerAccount } from '@workspace/api-client-react';
import { Starfield } from '@/components/starfield';
import { RequireCharacter, Wordmark } from '@/components/shell';
import { AgeControl, GenderPicker, PresetGrid, nameError, type Gender } from '@/components/character-fields';
import { ErrorState, HudButton, Portrait, SkeletonBlock } from '@/components/ui-kit';
import { errMsg, imgUrl, invalidateGame, portraitFor } from '@/lib/game';
import { cn } from '@/lib/utils';

const STEPS = ['Identity', 'Age', 'Appearance', 'Callsign'];

function Creator({ account }: { account: PlayerAccount }) {
  const existing = account.character;
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender | null>(existing?.gender ?? null);
  const [age, setAge] = useState(existing?.age ?? 27);
  const [presetId, setPresetId] = useState<string | null>(existing?.presetId ?? null);
  const [name, setName] = useState(existing?.name ?? '');
  const [touched, setTouched] = useState(false);
  const catalog = useGetGameCatalog();
  const save = useSaveCharacter();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const nErr = nameError(name);
  const canNext = [gender !== null, age >= 21 && age <= 60, !!presetId, !nErr][step];

  const submit = () => {
    setTouched(true);
    if (nErr || !gender || !presetId) return;
    save.mutate(
      { data: { name: name.trim(), age, gender, presetId } },
      {
        onSuccess: async () => {
          await invalidateGame(qc);
          setLocation('/play');
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
          <span className="font-mono text-[10px] uppercase tracking-[.25em] text-muted-foreground">Personnel file / new hire</span>
        </header>

        <div className="mt-10 grid grid-cols-4 gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className="text-left"
              data-testid={`button-step-${i + 1}`}
            >
              <div className="h-0.5 overflow-hidden rounded bg-white/10">
                <motion.div className="h-full bg-ion" initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} style={{ originX: 0 }} />
              </div>
              <div className={cn('mt-2 font-mono text-[10px] uppercase tracking-[.2em]', i === step ? 'text-ion' : 'text-muted-foreground')}>
                0{i + 1} <span className="hidden sm:inline">{s}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {step === 0 && (
                <>
                  <h1 className="mb-2 font-display text-4xl font-bold uppercase md:text-5xl">Who walks through the door?</h1>
                  <p className="mb-8 text-muted-foreground">Asterion's HR system needs one detail for your crew comms profile.</p>
                  <GenderPicker value={gender} onChange={setGender} />
                </>
              )}
              {step === 1 && (
                <>
                  <h1 className="mb-2 text-center font-display text-4xl font-bold uppercase md:text-5xl">How many years behind you?</h1>
                  <p className="mb-10 text-center text-muted-foreground">Fresh graduate or seasoned career-changer. Every age between 21 and 60 belongs here.</p>
                  <AgeControl value={age} onChange={setAge} />
                </>
              )}
              {step === 2 && (
                <>
                  <h1 className="mb-2 font-display text-4xl font-bold uppercase md:text-5xl">Choose your badge photo.</h1>
                  <p className="mb-8 text-muted-foreground">This face appears beside you in every lobby, scene, and briefing.</p>
                  {catalog.isLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {Array.from({ length: 10 }, (_, i) => (
                        <SkeletonBlock key={i} className="aspect-[4/5]" />
                      ))}
                    </div>
                  ) : catalog.error ? (
                    <ErrorState message={errMsg(catalog.error, 'Could not load portraits.')} onRetry={() => catalog.refetch()} />
                  ) : (
                    <PresetGrid presets={catalog.data?.presets ?? []} value={presetId} onChange={setPresetId} />
                  )}
                </>
              )}
              {step === 3 && (
                <div className="grid items-center gap-10 md:grid-cols-[320px_1fr]">
                  <div className="glass hud-corners overflow-hidden rounded-lg">
                    <img src={imgUrl(portraitFor(presetId ?? undefined))} alt="Your portrait" className="aspect-[4/5] w-full object-cover" />
                    <div className="p-4">
                      <div className="font-mono text-[10px] uppercase tracking-[.25em] text-ion">Asterion Aerospace / Mission Leader</div>
                      <div className="mt-1 font-display text-2xl font-bold uppercase" data-testid="text-preview-name">{name.trim() || 'Your name'}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Age {age} / {gender}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h1 className="mb-2 font-display text-4xl font-bold uppercase md:text-5xl">What does the crew call you?</h1>
                    <p className="mb-8 text-muted-foreground">3 to 24 characters. Friends will find you by this name.</p>
                    <input
                      autoFocus
                      value={name}
                      maxLength={24}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched(true)}
                      onKeyDown={(e) => e.key === 'Enter' && submit()}
                      placeholder="e.g. Ines Okafor"
                      className="w-full border-b-2 border-white/15 bg-transparent pb-3 font-display text-3xl font-semibold outline-none transition-colors placeholder:text-white/20 focus:border-ion md:text-4xl"
                      data-testid="input-name"
                    />
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-destructive">{touched && nErr}</span>
                      <span className="font-mono text-muted-foreground">{name.trim().length}/24</span>
                    </div>
                    {save.error && <p className="mt-4 text-sm text-destructive" data-testid="text-save-error">{errMsg(save.error)}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-white/10 pt-5">
          <HudButton variant="ghost" onClick={() => (step === 0 ? (existing ? setLocation('/play') : undefined) : setStep(step - 1))} disabled={step === 0 && !existing} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" /> Back
          </HudButton>
          {existing && <Portrait presetId={existing.presetId} name={existing.name} size={36} className="hidden sm:block" />}
          {step < 3 ? (
            <HudButton onClick={() => setStep(step + 1)} disabled={!canNext} data-testid="button-next">
              Continue <ArrowRight className="h-4 w-4" />
            </HudButton>
          ) : (
            <HudButton variant="burn" onClick={submit} loading={save.isPending} disabled={!!nErr} data-testid="button-save-character">
              Report for duty
            </HudButton>
          )}
        </footer>
      </div>
    </div>
  );
}

export default function CharacterPage() {
  return <RequireCharacter allowNoCharacter>{(a) => <Creator account={a} />}</RequireCharacter>;
}
