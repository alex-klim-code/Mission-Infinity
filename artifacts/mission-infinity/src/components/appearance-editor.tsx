import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCcw, Search, Shuffle } from 'lucide-react';
import type { CharacterAppearance } from '@workspace/api-client-react';
import { countryList, FACES, flagUrl, HAIR_COLORS, HAIRSTYLES, SKIN_TONES } from '@/lib/avatar';
import { CharacterAvatar } from '@/components/character-avatar';
import { HudButton } from '@/components/ui-kit';
import { usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';

export function CountryPicker({ value, onChange, listClassName }: { value: string; onChange: (code: string) => void; listClassName?: string }) {
  const [q, setQ] = useState('');
  const { blip } = usePrefs();
  const all = countryList();
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter((c) => c.name.toLowerCase().includes(t) || c.code.toLowerCase() === t);
  }, [q, all]);
  const current = all.find((c) => c.code === value);
  return (
    <div className="w-full">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search countries"
          aria-label="Search countries"
          className="h-12 w-full rounded-md border border-white/10 bg-void/60 pl-10 pr-4 outline-none transition-colors focus:border-ion"
          data-testid="input-country-search"
        />
      </label>
      {current && (
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground">
          Selected <img src={flagUrl(current.code)} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
          <span className="text-ion" data-testid="text-selected-country">{current.name}</span>
        </div>
      )}
      <div role="listbox" aria-label="Countries" className={cn('scroll-thin mt-3 grid max-h-[300px] gap-1 overflow-y-auto pr-1 sm:grid-cols-2', listClassName)}>
        {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No country matches "{q}". Try a shorter name.</p>}
        {filtered.map((c) => {
          const on = c.code === value;
          return (
            <button
              type="button"
              role="option"
              aria-selected={on}
              key={c.code}
              onClick={() => {
                blip();
                onChange(c.code);
              }}
              className={cn('flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors', on ? 'border-ion bg-ion/10' : 'border-transparent hover:border-white/15 hover:bg-white/[.03]')}
              data-testid={`button-country-${c.code}`}
            >
              <img src={flagUrl(c.code)} alt="" loading="lazy" className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-white/10" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{c.code}</span>
              {on && <Check className="h-4 w-4 text-ion" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TABS = ['Face', 'Skin', 'Hairstyle', 'Hair color'] as const;
type Tab = (typeof TABS)[number];

function Chip({ on, onClick, children, testId, label }: { on: boolean; onClick: () => void; children: React.ReactNode; testId: string; label?: string }) {
  const { blip } = usePrefs();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={() => {
        blip();
        onClick();
      }}
      className={cn('relative flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors', on ? 'border-ion bg-ion/10 text-foreground' : 'border-white/10 bg-white/[.02] text-muted-foreground hover:border-white/25 hover:text-foreground')}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** Live preview + tabbed controls. Fully controlled. */
export function AppearanceEditor({
  value,
  onChange,
  onRandomize,
  onReset,
  resetDisabled,
  previewSlot,
}: {
  value: CharacterAppearance;
  onChange: (a: CharacterAppearance) => void;
  onRandomize: () => void;
  onReset: () => void;
  resetDisabled?: boolean;
  previewSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('Face');
  const set = <K extends keyof CharacterAppearance>(k: K, v: CharacterAppearance[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">
      <div className="space-y-4">
        <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-xl ring-1 ring-ion/30">
          <motion.div key={`${value.avatarSeed}-${value.face}-${value.hairstyle}-${value.hairColor}-${value.skinTone}-${value.countryCode}`} initial={{ opacity: 0.6, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="h-full w-full">
            <CharacterAvatar appearance={value} title="Live preview" />
          </motion.div>
          <div className="scanline pointer-events-none absolute inset-0" />
          <span className="absolute left-3 top-3 font-mono text-[9px] uppercase tracking-[.25em] text-ion">Live preview</span>
        </div>
        <div className="mx-auto grid max-w-[300px] grid-cols-2 gap-2">
          <HudButton variant="ghost" onClick={onRandomize} className="px-3 text-xs" data-testid="button-randomize-appearance">
            <Shuffle className="h-4 w-4" /> Randomize
          </HudButton>
          <HudButton variant="ghost" onClick={onReset} disabled={resetDisabled} className="px-3 text-xs" data-testid="button-reset-appearance">
            <RotateCcw className="h-4 w-4" /> Reset
          </HudButton>
        </div>
        {previewSlot}
      </div>
      <div className="min-w-0">
        <div role="tablist" aria-label="Appearance" className="mb-5 grid grid-cols-2 gap-1 border-b border-white/10 sm:grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('relative min-h-11 min-w-0 px-2 font-display text-xs font-semibold uppercase tracking-[.14em] transition-colors sm:text-[10px]', tab === t ? 'text-ion' : 'text-muted-foreground hover:text-foreground')}
              data-testid={`tab-${t.toLowerCase().replace(' ', '-')}`}
            >
              {t}
              {tab === t && <motion.span layoutId="appearance-tab" className="absolute inset-x-2 -bottom-px h-0.5 bg-ion" />}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'Face' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FACES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={value.face === f.id}
                  onClick={() => set('face', f.id)}
                  className={cn('overflow-hidden rounded-lg border transition-colors', value.face === f.id ? 'border-ion ring-2 ring-ion/30' : 'border-white/10 hover:border-white/25')}
                  data-testid={`button-face-${f.id}`}
                >
                  <div className="aspect-square">
                    <CharacterAvatar appearance={{ ...value, face: f.id }} title={f.label} />
                  </div>
                  <div className="py-2 text-center text-xs font-semibold uppercase tracking-wider">{f.label}</div>
                </button>
              ))}
            </div>
          )}
          {tab === 'Skin' && (
            <div className="flex flex-wrap gap-3">
              {SKIN_TONES.map((s) => (
                <Chip key={s.id} on={value.skinTone === s.id} onClick={() => set('skinTone', s.id)} testId={`button-skin-${s.id}`}>
                  <span className="h-6 w-6 rounded-full ring-1 ring-white/20" style={{ background: `#${s.id}` }} />
                  {s.label}
                </Chip>
              ))}
            </div>
          )}
          {tab === 'Hairstyle' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {HAIRSTYLES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={value.hairstyle === h.id}
                  onClick={() => set('hairstyle', h.id)}
                  className={cn('overflow-hidden rounded-lg border transition-colors', value.hairstyle === h.id ? 'border-ion ring-2 ring-ion/30' : 'border-white/10 hover:border-white/25')}
                  data-testid={`button-hair-${h.id}`}
                >
                  <div className="aspect-square">
                    <CharacterAvatar appearance={{ ...value, hairstyle: h.id }} title={h.label} />
                  </div>
                  <div className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider">{h.label}</div>
                </button>
              ))}
            </div>
          )}
          {tab === 'Hair color' && (
            <div className="flex flex-wrap gap-3">
              {HAIR_COLORS.map((c) => (
                <Chip key={c.id} on={value.hairColor === c.id} onClick={() => set('hairColor', c.id)} testId={`button-haircolor-${c.id}`}>
                  <span className="h-6 w-6 rounded-full ring-1 ring-white/20" style={{ background: `#${c.id}` }} />
                  {c.label}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground">Uniform, insignia and flag patch are standard issue for every engineer.</p>
      </div>
    </div>
  );
}
