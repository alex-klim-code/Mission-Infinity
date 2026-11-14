import { Avatar, Style, type StyleOptions } from '@dicebear/core';
import definition from '@dicebear/styles/avataaars.json';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import type { CharacterAppearance } from '@workspace/api-client-react';

countries.registerLocale(en);

export type Base = CharacterAppearance['base'];
export type Face = CharacterAppearance['face'];
export type SkinTone = CharacterAppearance['skinTone'];
export type Hairstyle = CharacterAppearance['hairstyle'];
export type HairColor = CharacterAppearance['hairColor'];

export const FACES: {
  id: Face;
  label: string;
  eyes: keyof typeof definition.components.eyes.variants;
  mouth: keyof typeof definition.components.mouth.variants;
}[] = [
  { id: 'calm', label: 'Calm', eyes: 'default', mouth: 'default' },
  { id: 'focused', label: 'Focused', eyes: 'squint', mouth: 'serious' },
  { id: 'bright', label: 'Bright', eyes: 'happy', mouth: 'smile' },
  { id: 'confident', label: 'Confident', eyes: 'side', mouth: 'twinkle' },
];
export const SKIN_TONES: { id: SkinTone; label: string }[] = [
  { id: 'ffdbb4', label: 'Porcelain' },
  { id: 'edb98a', label: 'Sand' },
  { id: 'd08b5b', label: 'Amber' },
  { id: 'ae5d29', label: 'Copper' },
  { id: '614335', label: 'Umber' },
];
export const HAIRSTYLES: { id: Hairstyle; label: string }[] = [
  { id: 'bob', label: 'Bob' },
  { id: 'bun', label: 'Bun' },
  { id: 'straight01', label: 'Straight' },
  { id: 'longButNotTooLong', label: 'Long' },
  { id: 'curly', label: 'Curly' },
  { id: 'fro', label: 'Afro' },
  { id: 'shortFlat', label: 'Short flat' },
  { id: 'shortCurly', label: 'Short curly' },
  { id: 'theCaesar', label: 'Caesar' },
  { id: 'shavedSides', label: 'Shaved sides' },
];
export const HAIR_COLORS: { id: HairColor; label: string }[] = [
  { id: '2c1b18', label: 'Black' },
  { id: '4a312c', label: 'Dark brown' },
  { id: '724133', label: 'Brown' },
  { id: 'a55728', label: 'Auburn' },
  { id: 'b58143', label: 'Light brown' },
  { id: 'd6b370', label: 'Blonde' },
  { id: 'ecdcbf', label: 'Platinum' },
  { id: 'e8e1e1', label: 'Silver' },
];
const BASE_HAIR: Record<Base, Hairstyle[]> = {
  female: ['bob', 'bun', 'straight01', 'longButNotTooLong', 'curly'],
  male: ['shortFlat', 'theCaesar', 'shortCurly', 'shavedSides', 'fro'],
};
const BASE_BROWS: Record<Base, keyof typeof definition.components.eyebrows.variants> = {
  female: 'raisedExcitedNatural', male: 'defaultNatural',
};
export const UNIFORM_NAVY = '#10243b';

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seedFromAccount(accountId: string): string {
  const safe = accountId.replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 80);
  return `ast-${safe || hashString(accountId).toString(36)}`;
}

export function employeeIdFor(id: string): string {
  const h = hashString(`asterion:${id}`);
  return `AA-${String(h % 1000000).padStart(6, '0')}-ENG`;
}

export function baseDefaultHair(base: Base): Hairstyle {
  return BASE_HAIR[base][0];
}

/** Deterministic default appearance for an account. */
export function defaultAppearance(accountId: string, base: Base, countryCode = 'PL'): CharacterAppearance {
  const h = hashString(accountId);
  return {
    version: 1,
    base,
    face: FACES[h % FACES.length].id,
    skinTone: SKIN_TONES[(h >>> 3) % SKIN_TONES.length].id,
    hairstyle: BASE_HAIR[base][(h >>> 6) % BASE_HAIR[base].length],
    hairColor: HAIR_COLORS[(h >>> 9) % HAIR_COLORS.length].id,
    countryCode: countryCode.toUpperCase(),
    avatarSeed: seedFromAccount(accountId),
  };
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Only called from a click handler. */
export function randomAppearance(current: CharacterAppearance): CharacterAppearance {
  const pool = Math.random() < 0.75 ? BASE_HAIR[current.base] : HAIRSTYLES.map((h) => h.id);
  const root = current.avatarSeed.split('_random_')[0].slice(0, 75);
  return {
    ...current,
    face: pick(FACES).id,
    skinTone: pick(SKIN_TONES).id,
    hairstyle: pick(pool),
    hairColor: pick(HAIR_COLORS).id,
    avatarSeed: `${root}_random_${Math.floor(Math.random() * 1e8).toString(36)}`,
  };
}

/** Switching base swaps the hairstyle only when it still sits on the previous base default. */
export function withBase(a: CharacterAppearance, base: Base): CharacterAppearance {
  if (a.base === base) return a;
  const hairstyle = a.hairstyle === baseDefaultHair(a.base) ? baseDefaultHair(base) : a.hairstyle;
  return { ...a, base, hairstyle };
}

export function avatarOptions(a: CharacterAppearance): StyleOptions<typeof definition> {
  const face = FACES.find((f) => f.id === a.face) ?? FACES[0];
  return {
    seed: a.avatarSeed,
    eyesVariant: [face.eyes],
    mouthVariant: [face.mouth],
    eyebrowsVariant: [BASE_BROWS[a.base]],
    topVariant: [a.hairstyle],
    skinColor: [`#${a.skinTone}`],
    hairColor: [`#${a.hairColor}`],
    clothesVariant: ['shirtCrewNeck'],
    clothesColor: [UNIFORM_NAVY],
    accessoriesProbability: 0,
    facialHairProbability: 0,
    topProbability: 100,
    idRandomization: false,
  };
}

let style: Style<typeof definition> | null = null;
const cache = new Map<string, string>();
export function avatarDataUri(a: CharacterAppearance): string {
  const opts = avatarOptions(a);
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  style = style ?? new Style(definition);
  const uri = new Avatar(style, opts).toDataUri();
  if (cache.size > 300) cache.clear();
  cache.set(key, uri);
  return uri;
}

export function flagUrl(code: string | null | undefined): string {
  const c = (code ?? 'PL').toUpperCase();
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}/flags/${/^[A-Z]{2}$/.test(c) ? c : 'PL'}.svg`;
}

export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown';
  return countries.getName(code.toUpperCase(), 'en', { select: 'official' }) ?? code.toUpperCase();
}

export type Country = { code: string; name: string };
let list: Country[] | null = null;
export function countryList(): Country[] {
  if (list) return list;
  const names = countries.getNames('en', { select: 'official' });
  list = Object.entries(names)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

export function sameAppearance(a: CharacterAppearance | null | undefined, b: CharacterAppearance | null | undefined) {
  if (!a || !b) return a === b;
  return (['base', 'face', 'skinTone', 'hairstyle', 'hairColor', 'countryCode', 'avatarSeed'] as const).every((k) => a[k] === b[k]);
}
