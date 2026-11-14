/** Synthetic triangle, not a human avatar. Only used by automated storage/validation tests. */
export function avatarFixture(overrides: Record<string, unknown> = {}) {
  const binary = Buffer.from(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0]).buffer);
  const doc = {
    asset: { version: "2.0", generator: "Mission Infinity test fixture" },
    scenes: [{ nodes: [0] }], scene: 0, nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-0.5, 0, 0], max: [0.5, 1, 0] }],
    ...overrides,
  };
  const text = JSON.stringify(doc);
  const json = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4, " "));
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binHeader, binary]);
}
