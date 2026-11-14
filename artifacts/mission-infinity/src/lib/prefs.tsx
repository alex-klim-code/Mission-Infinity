import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { create } from 'zustand';

type Prefs = { sound: boolean; reducedMotion: boolean };
type Ctx = Prefs & { setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void; blip: (kind?: 'tap' | 'confirm' | 'alert') => void };

const KEY = 'mission-infinity:prefs';
const PrefsContext = createContext<Ctx | null>(null);

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { sound: true, reducedMotion: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { sound: true, reducedMotion: false };
}

const usePreferenceStore = create<Prefs>(() => load());
let audio: AudioContext | null = null;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const prefs = usePreferenceStore();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Device preferences remain usable if browser storage is unavailable.
    }
    document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion);
  }, [prefs]);

  const setPref = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => usePreferenceStore.setState({ [k]: v }), []);

  const blip = useCallback(
    (kind: 'tap' | 'confirm' | 'alert' = 'tap') => {
      if (!prefs.sound) return;
      try {
        audio = audio ?? new AudioContext();
        const ctx = audio;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = kind === 'confirm' ? [660, 990] : kind === 'alert' ? [440, 330] : [880, 880];
        o.type = 'sine';
        o.frequency.setValueAtTime(f[0], ctx.currentTime);
        o.frequency.linearRampToValueAtTime(f[1], ctx.currentTime + 0.12);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.2);
      } catch {
        /* audio unavailable */
      }
    },
    [prefs.sound],
  );

  const value = useMemo(() => ({ ...prefs, setPref, blip }), [prefs, setPref, blip]);
  return (
    <PrefsContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.reducedMotion ? 'always' : 'user'}>{children}</MotionConfig>
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const c = useContext(PrefsContext);
  if (!c) throw new Error('usePrefs outside provider');
  return c;
}
