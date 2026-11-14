import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useSaveCharacter, type CharacterAppearance, type CharacterInput, type PlayerAccount } from '@workspace/api-client-react';
import { Switch } from '@/components/ui/switch';
import { AppShell, LinkStatusPill, PageHeader, RequireCharacter } from '@/components/shell';
import { AgeControl, GenderPicker, nameError, type Gender } from '@/components/character-fields';
import { AppearanceEditor, CountryPicker } from '@/components/appearance-editor';
import { EmployeeBadge } from '@/components/character-avatar';
import { HudButton, Panel, PlayerPortrait } from '@/components/ui-kit';
import { defaultAppearance, randomAppearance, sameAppearance, withBase } from '@/lib/avatar';
import { errMsg, invalidateGame } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';
import { avatarFileUrl } from '@/lib/avatar3d';
import { useToast } from '@/hooks/use-toast';

function SettingsInner({ account }: { account: PlayerAccount }) {
  const c = account.character!;
  const savedCountry = (c.countryCode ?? c.appearance?.countryCode ?? 'PL').toUpperCase();
  const [name, setName] = useState(c.name);
  const [age, setAge] = useState(c.age);
  const [gender, setGender] = useState<Gender>(c.gender);
  const [country, setCountry] = useState(savedCountry);
  const [app, setApp] = useState<CharacterAppearance | null>(c.appearance ?? null);
  const [lookEdited, setLookEdited] = useState(false);
  const inFlight = useRef(false);
  const save = useSaveCharacter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const prefs = usePrefs();
  const nErr = nameError(name);
  const saved3d = c.avatar3d ?? null;
  const [restoreLegacy, setRestoreLegacy] = useState(false);

  const base = gender === 'unspecified' ? null : gender;
  const live = app && base ? { ...withBase(app, base), countryCode: country } : null;
  const appDirty = !sameAppearance(live, c.appearance ?? null) && (!saved3d || lookEdited);
  const needsBase = !!app && !base;
  const replaceModel = !!saved3d && (restoreLegacy || appDirty || gender !== c.gender);
  const avatarDirty = replaceModel;
  const dirty = name.trim() !== c.name || age !== c.age || gender !== c.gender || country !== savedCountry || appDirty || avatarDirty;
  const show3dBadge = !!saved3d && !replaceModel;

  const updateLook = (value: CharacterAppearance | null) => { setApp(value); setLookEdited(true); };
  const startCustom = () => updateLook(defaultAppearance(account.id, base ?? 'female', country));
  const resetLook = () => {
    const b = base ?? 'female';
    updateLook(c.appearance ? withBase(c.appearance, b) : defaultAppearance(account.id, b, country));
  };
  const revert = () => {
    setRestoreLegacy(false);
    setLookEdited(false);
    setName(c.name);
    setAge(c.age);
    setGender(c.gender);
    setCountry(savedCountry);
    setApp(c.appearance ?? null);
  };

  const submit = () => {
    if (inFlight.current || save.isPending || nErr || (needsBase && !show3dBadge)) return;
    const data: CharacterInput = { name: name.trim(), age, gender, presetId: c.presetId, countryCode: country };
    if (appDirty || (replaceModel && live)) data.appearance = live;
    if (replaceModel) data.avatar3d = null;
    inFlight.current = true;
    save.mutate(
      { data },
      {
        onSuccess: async () => {
          await invalidateGame(qc);
          if (restoreLegacy) setRestoreLegacy(false);
          toast({ title: 'Personnel file updated' });
        },
        onError: (e) => toast({ title: 'Save failed', description: `${errMsg(e)} Your edits are kept.`, variant: 'destructive' }),
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <AppShell account={account}>
      <PageHeader kicker="Configuration" title="Settings" right={<LinkStatusPill />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel className="space-y-10 p-6 md:p-8">
          <section>
            <label htmlFor="input-settings-name" className="kicker mb-3 block">Username</label>
            <input id="input-settings-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-12 w-full rounded-md border border-white/10 bg-void/60 px-4 text-lg outline-none focus:border-ion" data-testid="input-settings-name" />
            {nErr && <p className="mt-2 text-sm text-destructive">{nErr}</p>}
          </section>
          <section>
            <div className="kicker mb-3">Identity</div>
            <GenderPicker value={gender} onChange={setGender} allowUnspecified={c.gender === 'unspecified'} />
            {needsBase && !show3dBadge && <p className="mt-2 text-sm text-burn">Choose Female or Male to save a custom look, or switch back to the classic portrait.</p>}
          </section>
          <section>
            <div className="kicker mb-3">Age</div>
            <AgeControl value={age} onChange={setAge} />
          </section>
          <section>
            <div className="kicker mb-3">Home country</div>
            <CountryPicker value={country} onChange={setCountry} listClassName="max-h-[240px]" />
          </section>
          <section>
            <div className="kicker mb-3">Appearance</div>
            <p className="mb-5 text-sm text-muted-foreground">Customize your character here in the game. No extra account or external editor needed.</p>
              <div className="space-y-5">
                {saved3d && (
                  <div className="flex flex-col gap-3 rounded-md border border-burn/30 bg-burn/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground">{replaceModel ? 'Saving activates your in-game character. Your previously stored model is not deleted.' : 'Your saved character stays active until you customize and save an in-game look.'}</p>
                    <HudButton variant="ghost" onClick={() => setRestoreLegacy((v) => !v)} data-testid="button-restore-legacy">
                      {restoreLegacy ? 'Keep saved character' : 'Use in-game character'}
                    </HudButton>
                  </div>
                )}
              {live ? (
                <AppearanceEditor value={live} onChange={updateLook} onRandomize={() => updateLook(randomAppearance(live))} onReset={resetLook} />
              ) : (
                <div className="flex flex-col items-start gap-5 rounded-lg border border-dashed border-white/10 p-5 sm:flex-row sm:items-center">
                  <div className="w-28 shrink-0 overflow-hidden rounded-md">
                    <PlayerPortrait player={{ ...c, appearance: null, avatar3d: null }} />
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-lg font-semibold uppercase tracking-wider">Classic portrait</div>
                    <p className="mt-1 text-sm text-muted-foreground">Your original badge photo stays until you build a custom look in the Asterion uniform.</p>
                    {app && !base ? (
                      <HudButton variant="ghost" className="mt-4" onClick={() => updateLook(null)} data-testid="button-keep-classic">Keep classic portrait</HudButton>
                    ) : (
                      <HudButton variant="ghost" className="mt-4" onClick={startCustom} disabled={!base} data-testid="button-start-custom">
                        <Sparkles className="h-4 w-4" /> Create custom look
                      </HudButton>
                    )}
                  </div>
                </div>
              )}
              </div>
          </section>
          <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
            <HudButton variant="ghost" disabled={!dirty || save.isPending} onClick={revert} data-testid="button-reset-character">
              Revert
            </HudButton>
            <HudButton variant="burn" disabled={!dirty || !!nErr || (needsBase && !show3dBadge)} loading={save.isPending} onClick={submit} data-testid="button-save-settings">
              Save changes
            </HudButton>
          </div>
        </Panel>
        <div className="space-y-4">
          {show3dBadge ? (
            <EmployeeBadge avatar3d countryCode={country} portraitSrc={avatarFileUrl(saved3d?.portraitUrl)} name={name} idSource={account.id} className="mx-auto lg:sticky lg:top-24" />
          ) : live ? (
            <EmployeeBadge appearance={live} name={name} idSource={account.id} className="mx-auto lg:sticky lg:top-24" />
          ) : null}
          <Panel className="p-6">
            <div className="kicker mb-5">This device</div>
            {[
              { k: 'sound' as const, t: 'Interface sound', d: 'Soft tones on actions and confirmations.' },
              { k: 'reducedMotion' as const, t: 'Reduced motion', d: 'Stills the starfield and removes scene transitions.' },
            ].map((o) => (
              <label key={o.k} className="flex cursor-pointer items-start justify-between gap-4 border-b border-white/5 py-4 last:border-0">
                <div>
                  <div className="font-semibold">{o.t}</div>
                  <div className="text-sm text-muted-foreground">{o.d}</div>
                </div>
                <Switch checked={prefs[o.k]} onCheckedChange={(v) => prefs.setPref(o.k, v)} data-testid={`switch-${o.k}`} />
              </label>
            ))}
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Stored locally on this browser</p>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return <RequireCharacter>{(a) => <SettingsInner account={a} />}</RequireCharacter>;
}
