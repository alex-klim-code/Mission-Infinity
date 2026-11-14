import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetGameCatalog, useSaveCharacter, type PlayerAccount } from '@workspace/api-client-react';
import { Switch } from '@/components/ui/switch';
import { AppShell, LinkStatusPill, PageHeader, RequireCharacter } from '@/components/shell';
import { AgeControl, GenderPicker, PresetGrid, nameError, type Gender } from '@/components/character-fields';
import { ErrorState, HudButton, Panel, SkeletonBlock } from '@/components/ui-kit';
import { errMsg, invalidateGame } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/hooks/use-toast';

function SettingsInner({ account }: { account: PlayerAccount }) {
  const c = account.character!;
  const [name, setName] = useState(c.name);
  const [age, setAge] = useState(c.age);
  const [gender, setGender] = useState<Gender>(c.gender);
  const [presetId, setPresetId] = useState(c.presetId);
  const catalog = useGetGameCatalog();
  const save = useSaveCharacter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const prefs = usePrefs();
  const nErr = nameError(name);
  const dirty = name.trim() !== c.name || age !== c.age || gender !== c.gender || presetId !== c.presetId;

  const submit = () =>
    save.mutate(
      { data: { name: name.trim(), age, gender, presetId } },
      {
        onSuccess: async () => {
          await invalidateGame(qc);
          toast({ title: 'Personnel file updated' });
        },
        onError: (e) => toast({ title: 'Save failed', description: errMsg(e), variant: 'destructive' }),
      },
    );

  return (
    <AppShell account={account}>
      <PageHeader kicker="Configuration" title="Settings" right={<LinkStatusPill />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel className="space-y-10 p-6 md:p-8">
          <section>
            <div className="kicker mb-3">Callsign</div>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-12 w-full rounded-md border border-white/10 bg-void/60 px-4 text-lg outline-none focus:border-ion" data-testid="input-settings-name" />
            {nErr && <p className="mt-2 text-sm text-destructive">{nErr}</p>}
          </section>
          <section>
            <div className="kicker mb-3">Identity</div>
            <GenderPicker value={gender} onChange={setGender} />
          </section>
          <section>
            <div className="kicker mb-3">Age</div>
            <AgeControl value={age} onChange={setAge} />
          </section>
          <section>
            <div className="kicker mb-3">Portrait</div>
            {catalog.isLoading ? <SkeletonBlock className="h-64" /> : catalog.error ? <ErrorState message={errMsg(catalog.error)} onRetry={() => catalog.refetch()} /> : <PresetGrid presets={catalog.data?.presets ?? []} value={presetId} onChange={setPresetId} />}
          </section>
          <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
            <HudButton variant="ghost" disabled={!dirty || save.isPending} onClick={() => { setName(c.name); setAge(c.age); setGender(c.gender); setPresetId(c.presetId); }} data-testid="button-reset-character">
              Revert
            </HudButton>
            <HudButton variant="burn" disabled={!dirty || !!nErr} loading={save.isPending} onClick={submit} data-testid="button-save-settings">
              Save changes
            </HudButton>
          </div>
        </Panel>
        <div className="space-y-4">
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
