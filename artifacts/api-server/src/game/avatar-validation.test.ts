import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarProjectUrl, validateAvatarGlb, validateAvatarPng } from "./avatar-validation";
import { avatarFixture as fixture } from "./testing/avatar";

const model = { asset: { version: "2.0" } };

test("Avaturn project configuration accepts only a real HTTPS project origin", () => {
  assert.equal(avatarProjectUrl("https://missioninfinity.avaturn.dev"), "https://missioninfinity.avaturn.dev");
  for (const value of [undefined, "bad", "http://missioninfinity.avaturn.dev", "https://demo.avaturn.dev",
    "https://evil.avaturn.dev.evil.com", "https://user:pass@missioninfinity.avaturn.dev", "https://missioninfinity.avaturn.dev/x"]) {
    assert.equal(avatarProjectUrl(value), null);
  }
});
test("GLB validator accepts bounded embedded models and rejects URLs, malformed chunks and excessive geometry", () => {
  assert.doesNotThrow(() => validateAvatarGlb(fixture(model)));
  assert.throws(() => validateAvatarGlb(Buffer.from("not a GLB")));
  const truncated = fixture(model); truncated.writeUInt32LE(999999, 12);
  assert.throws(() => validateAvatarGlb(truncated));
  for (const uri of ["https://example.com/image.png", "//example.com/x", "file:///etc/passwd", "/api/game/me", "javascript:alert(1)"]) {
    assert.throws(() => validateAvatarGlb(fixture({ ...model, images: [{ uri }] })));
  }
  assert.throws(() => validateAvatarGlb(fixture({ ...model, accessors: [{ count: 4_000_001 }] })));
  assert.throws(() => validateAvatarGlb(fixture({ ...model, materials: Array(65).fill({}) })));
  assert.throws(() => validateAvatarGlb(fixture({ ...model, asset: { version: "1.0" } })));
  assert.throws(() => validateAvatarGlb(fixture({ meshes: [{ primitives: [] }] })));
  assert.throws(() => validateAvatarGlb(fixture({ bufferViews: [{ buffer: 0, byteLength: 99999999 }] })));
});
test("portrait validator rejects non-PNG and unbounded image dimensions", () => {
  assert.throws(() => validateAvatarPng(Buffer.alloc(40)));
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12); png.writeUInt32BE(512, 16); png.writeUInt32BE(512, 20);
  assert.doesNotThrow(() => validateAvatarPng(png));
  png.writeUInt32BE(10000, 16);
  assert.throws(() => validateAvatarPng(png));
});
