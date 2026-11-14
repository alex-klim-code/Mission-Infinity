import { requireCondition } from "./database";

export const MAX_MODEL_BYTES = 20 * 1024 * 1024;
export const MAX_PORTRAIT_BYTES = 1024 * 1024;

export function avatarProjectUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.avaturn\.dev$/.test(url.hostname) ||
      url.hostname === "demo.avaturn.dev" || url.port || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function validateAvatarPng(bytes: Buffer) {
  requireCondition(bytes.length >= 33 && bytes.length <= MAX_PORTRAIT_BYTES, 400, "Portrait must be a PNG under 1 MiB.");
  requireCondition(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR", 400, "Invalid portrait PNG.");
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
  requireCondition(w > 0 && h > 0 && w <= 2048 && h <= 2048, 400, "Portrait dimensions must not exceed 2048 pixels.");
}

/** GLB2 only: bounded geometry metadata and no external URLs or linked resources. */
export function validateAvatarGlb(bytes: Buffer) {
  requireCondition(bytes.length >= 20 && bytes.length <= MAX_MODEL_BYTES, 400, "Model must be a GLB under 20 MiB.");
  requireCondition(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 &&
    bytes.readUInt32LE(8) === bytes.length, 400, "Invalid GLB 2.0 header.");
  let json: Record<string, unknown> | undefined;
  let bins = 0;
  let binaryLength = 0;
  for (let offset = 12; offset < bytes.length;) {
    requireCondition(offset + 8 <= bytes.length, 400, "Truncated GLB chunk.");
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    requireCondition(length > 0 && length % 4 === 0 && offset + 8 + length <= bytes.length, 400, "Invalid GLB chunk size.");
    if (type === 0x4e4f534a) {
      requireCondition(!json && offset === 12 && length <= 1024 * 1024, 400, "Invalid GLB JSON.");
      try { json = JSON.parse(bytes.toString("utf8", offset + 8, offset + 8 + length)); }
      catch { requireCondition(false, 400, "Invalid GLB JSON."); }
    } else {
      requireCondition(type === 0x004e4942 && ++bins === 1 && !!json, 400, "Unsupported GLB chunk.");
      binaryLength = length;
    }
    offset += 8 + length;
  }
  requireCondition(json && typeof json === "object" && !Array.isArray(json), 400, "Missing GLB scene.");
  const asset = json.asset as { version?: string } | undefined;
  requireCondition(asset?.version === "2.0", 400, "Only glTF 2.0 models are supported.");
  const arrays: Record<string, number> = { meshes: 256, nodes: 2048, materials: 64, images: 32, textures: 64, accessors: 4096, buffers: 1, bufferViews: 4096 };
  for (const [key, max] of Object.entries(arrays)) {
    const value = json[key];
    requireCondition(value === undefined || (Array.isArray(value) && value.length <= max), 400, `Model has too many ${key}.`);
  }
  requireCondition(Array.isArray(json.meshes) && json.meshes.length > 0, 400, "Model contains no mesh.");
  requireCondition(Array.isArray(json.scenes) && json.scenes.length > 0 && json.scenes.length <= 16 &&
    Array.isArray(json.nodes) && json.nodes.length > 0, 400, "Model contains no scene.");
  const buffers = json.buffers as { byteLength?: number; uri?: string }[] | undefined;
  requireCondition(bins === 1 && buffers?.length === 1 && buffers[0] && !buffers[0].uri &&
    Number.isSafeInteger(buffers[0].byteLength) && buffers[0].byteLength! > 0 &&
    buffers[0].byteLength! <= binaryLength, 400, "Model must include its binary buffer.");
  const views = (json.bufferViews ?? []) as { buffer?: number; byteLength?: number; byteOffset?: number }[];
  for (const view of views) {
    requireCondition(view && view.buffer === 0 && Number.isSafeInteger(view.byteLength) && view.byteLength! > 0 &&
      Number.isSafeInteger(view.byteOffset ?? 0) && (view.byteOffset ?? 0) >= 0 &&
      (view.byteOffset ?? 0) + view.byteLength! <= buffers[0].byteLength!, 400, "Invalid model buffer view.");
  }
  const accessors = (json.accessors ?? []) as { count?: number; type?: string; bufferView?: number }[];
  for (const mesh of json.meshes as { primitives?: { attributes?: { POSITION?: number } }[] }[]) {
    requireCondition(mesh && Array.isArray(mesh.primitives) && mesh.primitives.length > 0 && mesh.primitives.length <= 64, 400, "Model contains an invalid mesh.");
    for (const primitive of mesh.primitives) {
      const index = primitive?.attributes?.POSITION;
      requireCondition(Number.isInteger(index) && index! >= 0 && index! < accessors.length &&
        accessors[index!]?.type === "VEC3" && accessors[index!].count! >= 3, 400, "Model mesh has no usable positions.");
    }
  }
  // A URI anywhere can otherwise make a saved model load remote/tracking resources.
  function check(value: unknown, depth = 0): void {
    requireCondition(depth < 64, 400, "Model metadata is too deeply nested.");
    if (Array.isArray(value)) { for (const v of value) check(v, depth + 1); return; }
    if (value && typeof value === "object") {
      for (const [key, v] of Object.entries(value)) {
        if (key === "uri") requireCondition(typeof v === "string" &&
          /^data:(image\/(png|jpeg|webp)|application\/octet-stream);base64,[A-Za-z0-9+/=\s]+$/.test(v),
        400, "Model must be self-contained, without external image or buffer URLs.");
        check(v, depth + 1);
      }
    }
  }
  check(json);
  let elements = 0;
  for (const accessor of (json.accessors ?? []) as { count?: number }[]) {
    requireCondition(accessor && Number.isInteger(accessor.count) && accessor.count! >= 0, 400, "Invalid model accessor.");
    elements += accessor.count!;
  }
  requireCondition(elements <= 4_000_000, 400, "Model geometry is too complex for this pilot.");
  return json;
}
