import type { ReactNode } from 'react';
export type CharacterPreset = { id: string; label: string; image: string };
export type PlayerAccount = { id: string; character: null | { name: string; age: number; gender: 'female' | 'male' | 'unspecified'; presetId: string }; activeSessionId: string | null };
export const cn = (...args: unknown[]) => args.filter(Boolean).join(' ');
export function imgUrl(path: string) { return path.replace('/images/', '/__mockup/images/mission-landing-before/'); }
export function portraitFor(id: string | undefined) { return `/images/portrait-${(id?.match(/\d+/)?.[0] ?? '1').padStart(2, '0')}.png`; }
export function usePrefs() { return { reducedMotion: true, blip: (..._args: unknown[]) => undefined }; }
export function useLocation() { return ['', (_path: string) => undefined] as const; }
export function useQueryClient() { return {}; }
export async function invalidateGame(_client: unknown) { }
export function errMsg(_error: unknown, fallback = 'Preview only') { return fallback; }
export function useSaveCharacter() { return { mutate: (..._args: unknown[]) => undefined, isPending: false, error: null }; }
export function useGetGameCatalog() {
  return { isLoading: false, error: null, refetch: () => undefined,
    data: { presets: Array.from({length: 10}, (_, i) => ({id: `engineer-${String(i+1).padStart(2,'0')}`, label: `Engineer ${i+1}`, image: `/images/portrait-${String(i+1).padStart(2,'0')}.png`})) } };
}
export function RequireCharacter({children}: {children: (account: PlayerAccount) => ReactNode; allowNoCharacter?: boolean}) {
  return <>{children({id:'preview', character:null, activeSessionId:null})}</>;
}
export function Wordmark({ small }: { small?: boolean }) {
  return <a href="#" onClick={e => e.preventDefault()} className="flex items-center gap-2.5" data-testid="link-home">
    <img src="/__mockup/images/mission-landing-before/logo.svg" alt="" className={small ? 'h-7 w-7' : 'h-9 w-9'} />
    <span className="font-display text-sm font-bold uppercase tracking-[.22em]">Mission<span className="text-burn">:</span> Infinity</span>
  </a>;
}
