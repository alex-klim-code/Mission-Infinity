import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Avatar, Style } from '@dicebear/core';
import definition from '@dicebear/styles/avataaars.json';
import {
  avatarDataUri, avatarOptions, countryList, defaultAppearance, employeeIdFor,
  FACES, flagUrl, HAIR_COLORS, HAIRSTYLES, randomAppearance, SKIN_TONES, withBase,
} from './avatar';

test('saved appearance renders identically in independently-created DiceBear clients', () => {
  const look = defaultAppearance('d3e67890-1234-4567-8910-123456789012', 'female', 'PL');
  const options = avatarOptions(look);
  const first = new Avatar(new Style(definition), options).toDataUri();
  const second = new Avatar(new Style(structuredClone(definition)), options).toDataUri();
  assert.equal(first, second);
  assert.equal(avatarDataUri(look), first);
  assert.equal(avatarDataUri(JSON.parse(JSON.stringify(look))), first);
  assert.equal(employeeIdFor('stable-account'), employeeIdFor('stable-account'));
});

test('every offered face, hairstyle and color changes the actual generated SVG', () => {
  const look = defaultAppearance('controls-test', 'male');
  for (const [property, values] of [
    ['face', FACES], ['hairstyle', HAIRSTYLES], ['skinTone', SKIN_TONES], ['hairColor', HAIR_COLORS],
  ] as const) {
    const images = new Set(values.map(v => avatarDataUri({ ...look, [property]: v.id })));
    assert.equal(images.size, values.length, `${property} options must all affect the image`);
  }
  assert.notEqual(avatarDataUri(look), avatarDataUri(withBase(look, 'female')));
});

test('randomize keeps identity and country, and produces only persistable bounded seeds', () => {
  let look = defaultAppearance('seed-validation', 'female', 'JP');
  for (let i = 0; i < 100; i++) {
    look = randomAppearance(look);
    assert.match(look.avatarSeed, /^[A-Za-z0-9:_-]{1,100}$/);
    assert.equal(look.countryCode, 'JP');
    assert.equal(look.base, 'female');
    assert.ok(HAIRSTYLES.some(o => o.id === look.hairstyle));
    assert.ok(avatarDataUri(look).startsWith('data:image/svg+xml'));
  }
});

test('country selector includes Poland and uses local deterministic ISO flag paths', () => {
  assert.ok(countryList().length >= 249);
  assert.equal(countryList().find(c => c.code === 'PL')?.name, 'Poland');
  assert.equal(flagUrl('pl'), '/flags/PL.svg');
  assert.equal(flagUrl('JP'), '/flags/JP.svg');
  assert.equal(flagUrl('../unsafe'), '/flags/PL.svg');
});

test('first identity selection gets defaults from the selected base, without restricting custom hairstyles', () => {
  const maleDefaults = ['shortFlat', 'theCaesar', 'shortCurly', 'shavedSides', 'fro'];
  const femaleDefaults = ['bob', 'bun', 'straight01', 'longButNotTooLong', 'curly'];
  for (let i = 0; i < 100; i++) {
    const account = `new-account-${i}`;
    assert.ok(maleDefaults.includes(defaultAppearance(account, 'male').hairstyle));
    assert.ok(femaleDefaults.includes(defaultAppearance(account, 'female').hairstyle));
  }
  const custom = { ...defaultAppearance('deliberate-custom-look', 'female'), hairstyle: 'bun' as const };
  assert.equal(withBase(custom, 'male').hairstyle, 'bun');
});
