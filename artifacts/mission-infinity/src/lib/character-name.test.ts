import assert from 'node:assert/strict';
import test from 'node:test';
import { nameError } from './character-name';

test('username accepts the same supported characters and trimmed boundaries as the API', () => {
  for (const name of ['Ada', '  Ada  ', 'Łucja Nowak', '日本の宇宙', "O'Neill", 'Crew_01', 'Anne-Marie', 'A’. 1', 'A'.repeat(24)]) {
    assert.equal(nameError(name), null, name);
  }
});

test('username explains invalid values before a character save can reach the API', () => {
  for (const name of ['', '  ', 'Ab', 'A'.repeat(25), '_Crew', '-Crew', 'Ada@crew', 'Crew🚀', '<script>', 'Ada\nCrew']) {
    assert.ok(nameError(name), name);
  }
});
