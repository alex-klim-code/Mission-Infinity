import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarFileUrl, isSelfContainedGlb, metaFromExport, readExportBlob, withTimeout, type AvaturnExport } from './avatar3d';

const result: AvaturnExport = {
  avatarId: 'export-test', bodyId: 'body-test', gender: 'female',
  avatarSupportsFaceAnimations: true, sessionId: 'session-test', url: '', urlType: 'dataURL',
};
test('3D metadata persists supported export fields only, without URLs or provider sessions', () => {
  assert.deepEqual(metaFromExport(result), { avatarId: 'export-test', bodyId: 'body-test', gender: 'female', avatarSupportsFaceAnimations: true });
  assert.throws(() => metaFromExport({ ...result, gender: 'unknown' as 'female' }));
  assert.throws(() => metaFromExport({ ...result, avatarId: '' }));
});
test('export reader enforces the byte cap and valid GLB headers', async () => {
  const bytes = Buffer.alloc(20);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(20, 8);
  const url = `data:model/gltf-binary;base64,${bytes.toString('base64')}`;
  const blob = await readExportBlob({ ...result, url }, 100, new AbortController().signal);
  assert.equal(await isSelfContainedGlb(blob), true);
  await assert.rejects(readExportBlob({ ...result, url }, 8, new AbortController().signal));
  await assert.rejects(readExportBlob({ ...result, urlType: 'httpURL', url: 'http://example.com/x.glb' }, 100, new AbortController().signal));
  assert.equal(await isSelfContainedGlb(new Blob(['not GLB'])), false);
});
test('a cancelled transfer never starts and timed-out operations report an explicit error', async () => {
  const controller = new AbortController(); controller.abort();
  let started = false;
  await assert.rejects(withTimeout(controller.signal, 10, async () => { started = true; }));
  assert.equal(started, false);
  await assert.rejects(withTimeout(new AbortController().signal, 5, signal => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
  })), /timed out/);
});
test('saved asset paths never resolve to third-party or arbitrary application URLs', () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.equal(avatarFileUrl(`/api/game/avatar-files/${id}`), `/api/game/avatar-files/${id}`);
  for (const value of ['//evil.com/x.glb', 'https://evil.com/x.glb', '/api/game/me', '/other', 'data:xxx', '/api/game/avatar-files/../../secret']) {
    assert.equal(avatarFileUrl(value), null);
  }
});
