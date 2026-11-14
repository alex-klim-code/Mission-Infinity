import { motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import type { CharacterPreset } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { imgUrl } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';

export type Gender = 'female' | 'male' | 'unspecified';
export const GENDERS: { id: Gender; label: string; note: string }[] = [
  { id: 'female', label: 'Female', note: 'She / her in crew comms' },
  { id: 'male', label: 'Male', note: 'He / him in crew comms' },
  { id: 'unspecified', label: 'Unspecified', note: 'Addressed by name only' },
];

export function GenderPicker({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  const { blip } = usePrefs();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {GENDERS.map((g, i) => {
        const on = value === g.id;
        return (
          <motion.button
            type="button"
            key={g.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => {
              blip();
              onChange(g.id);
            }}
            data-testid={`button-gender-${g.id}`}
            className={cn(
              'relative rounded-lg border p-5 text-left transition-colors',
              on ? 'border-ion bg-ion/10' : 'border-white/10 bg-white/[.02] hover:border-white/25',
            )}
          >
            <div className="font-display text-lg font-semibold uppercase tracking-wider">{g.label}</div>
            <div className="mt-1 text-sm text-muted-foreground">{g.note}</div>
            {on && <Check className="absolute right-4 top-4 h-4 w-4 text-ion" />}
          </motion.button>
        );
      })}
    </div>
  );
}

export function AgeControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(21, Math.min(60, n));
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-6">
        <button type="button" onClick={() => onChange(clamp(value - 1))} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 hover:border-ion" aria-label="Decrease age" data-testid="button-age-down">
          <Minus className="h-4 w-4" />
        </button>
        <motion.div key={value} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-32 text-center font-display text-7xl font-bold tabular-nums text-ion" data-testid="text-age">
          {value}
        </motion.div>
        <button type="button" onClick={() => onChange(clamp(value + 1))} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 hover:border-ion" aria-label="Increase age" data-testid="button-age-up">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <input
        type="range"
        min={21}
        max={60}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full max-w-md accent-[hsl(186_92%_56%)]"
        data-testid="input-age"
        aria-label="Age"
      />
      <div className="flex w-full max-w-md justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>21 Graduate</span>
        <span>40 Veteran</span>
        <span>60 Legend</span>
      </div>
    </div>
  );
}

export function PresetGrid({ presets, value, onChange }: { presets: CharacterPreset[]; value: string | null; onChange: (id: string) => void }) {
  const { blip } = usePrefs();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {presets.map((p, i) => {
        const on = value === p.id;
        return (
          <motion.button
            type="button"
            key={p.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.035 }}
            onClick={() => {
              blip();
              onChange(p.id);
            }}
            data-testid={`button-preset-${p.id}`}
            className={cn(
              'group relative aspect-[4/5] overflow-hidden rounded-lg border transition-all',
              on ? 'border-ion ring-2 ring-ion/40' : 'border-white/10 hover:border-white/30',
            )}
          >
            <img src={imgUrl(p.image)} alt={p.label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/70 to-transparent p-3 text-left">
              <div className="font-mono text-[9px] uppercase tracking-[.2em] text-ion">{p.id}</div>
              <div className="text-xs font-semibold">{p.label}</div>
            </div>
            {on && (
              <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ion text-void">
                <Check className="h-3.5 w-3.5" />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export function nameError(name: string): string | null {
  const t = name.trim();
  if (t.length < 3) return 'Name needs at least 3 characters.';
  if (t.length > 24) return 'Name can be at most 24 characters.';
  return null;
}
