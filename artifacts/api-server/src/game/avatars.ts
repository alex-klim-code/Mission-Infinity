import { randomUUID } from "node:crypto";
import type { Avatar3DInput, AvatarUploadInput } from "@workspace/api-zod";
import { gameDb, requireCondition } from "./database";
import { ObjectNotFoundError, ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { setObjectAclPolicy } from "../lib/objectAcl";
import { MAX_MODEL_BYTES, MAX_PORTRAIT_BYTES, avatarProjectUrl, validateAvatarGlb, validateAvatarPng } from "./avatar-validation";

const storage = new ObjectStorageService();
let processing = 0;
export const avatarAssetUrl = (id: string) => `/api/game/avatar-files/${id}`;

export function getAvatarConfig() {
  const editorUrl = avatarProjectUrl(process.env.AVATURN_PROJECT_URL);
  return { configured: !!editorUrl, editorUrl, maxModelBytes: MAX_MODEL_BYTES, maxPortraitBytes: MAX_PORTRAIT_BYTES, customUniformSupported: false as const };
}

export async function requestAvatarUpload(userId: string, input: AvatarUploadInput) {
  const max = input.kind === "model" ? MAX_MODEL_BYTES : MAX_PORTRAIT_BYTES;
  requireCondition(Number.isInteger(input.size) && input.size >= 20 && input.size <= max, 400, "Asset exceeds the upload limit.");
  const count = await gameDb.selectFrom("avatar_uploads").select(eb => eb.fn.countAll<string>().as("n"))
    .where("user_id", "=", userId).where("created_at", ">", new Date(Date.now() - 86400_000)).executeTakeFirstOrThrow();
  requireCondition(Number(count.n) < 40, 429, "Daily avatar upload limit reached. Please try tomorrow.");
  const uploadUrl = await storage.getObjectEntityUploadURL();
  const uploadPath = storage.normalizeObjectEntityPath(uploadUrl);
  requireCondition(uploadPath.startsWith("/objects/uploads/"), 503, "Avatar storage is not configured correctly.");
  const row = await gameDb.insertInto("avatar_uploads").values({
    user_id: userId, kind: input.kind, size: input.size, upload_path: uploadPath, asset_path: null, created_at: new Date(),
  }).returning("id").executeTakeFirstOrThrow();
  return { id: row.id, uploadUrl, contentType: input.kind === "model" ? "model/gltf-binary" as const : "image/png" as const };
}

export async function completeAvatarUpload(userId: string, id: string) {
  requireCondition(processing < 3, 429, "Avatar processing is busy. Please retry shortly.");
  processing++;
  try {
    return await gameDb.transaction().execute(async trx => {
      const upload = await trx.selectFrom("avatar_uploads").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
      requireCondition(upload && upload.user_id === userId, 404, "Avatar upload not found.");
      if (upload.asset_path) return { id, url: avatarAssetUrl(id), kind: upload.kind };
      requireCondition(new Date(upload.created_at).getTime() > Date.now() - 30 * 60_000, 410, "Upload expired. Export your avatar again.");
      let source;
      try { source = await storage.getObjectEntityFile(upload.upload_path); }
      catch (error) {
        if (error instanceof ObjectNotFoundError || (error as { code?: number }).code === 404) {
          requireCondition(false, 400, "File upload has not completed. Retry the upload.");
        }
        throw error;
      }
      const [metadata] = await source.getMetadata();
      requireCondition(!metadata.contentEncoding || metadata.contentEncoding === "identity", 400, "Compressed upload encodings are not supported. Upload the original GLB or PNG.");
      requireCondition(Number(metadata.size) === upload.size && Number(metadata.size) <=
        (upload.kind === "model" ? MAX_MODEL_BYTES : MAX_PORTRAIT_BYTES), 400, "Uploaded file size does not match.");
      // Pin the source generation: overwriting the signed upload URL cannot change a verified asset.
      const snapshot = source.bucket.file(source.name, { generation: metadata.generation });
      const [bytes] = await snapshot.download({ decompress: false });
      if (upload.kind === "model") validateAvatarGlb(bytes); else validateAvatarPng(bytes);
      const [bucket, ...parts] = storage.getPrivateObjectDir().split("/").filter(Boolean);
      const key = [...parts, "avatar-assets", randomUUID()].join("/");
      const target = objectStorageClient.bucket(bucket).file(key);
      await snapshot.copy(target, { preconditionOpts: { ifGenerationMatch: 0 } });
      await target.setMetadata({
        contentType: upload.kind === "model" ? "model/gltf-binary" : "image/png",
        contentDisposition: "inline",
        cacheControl: "private, max-age=86400",
      });
      await setObjectAclPolicy(target, { owner: userId, visibility: "private" });
      const assetPath = `/objects/avatar-assets/${key.split("/").at(-1)}`;
      await trx.updateTable("avatar_uploads").set({ asset_path: assetPath }).where("id", "=", id).execute();
      // The immutable copy is the only asset ever served. The signed upload target is never public.
      await source.delete({ ignoreNotFound: true }).catch(() => undefined);
      return { id, url: avatarAssetUrl(id), kind: upload.kind };
    });
  } finally { processing--; }
}

export async function resolveAvatar3D(userId: string, input: Avatar3DInput) {
  const model = await gameDb.selectFrom("avatar_uploads").selectAll().where("id", "=", input.modelUploadId).executeTakeFirst();
  requireCondition(model && model.user_id === userId && model.kind === "model" && model.asset_path, 400, "Save a completed model upload owned by your profile.");
  let portraitUrl: string | null = null;
  if (input.portraitUploadId) {
    const poster = await gameDb.selectFrom("avatar_uploads").selectAll().where("id", "=", input.portraitUploadId).executeTakeFirst();
    requireCondition(poster && poster.user_id === userId && poster.kind === "portrait" && poster.asset_path, 400, "Save a completed portrait upload owned by your profile.");
    portraitUrl = avatarAssetUrl(poster.id);
  }
  return { ...input, version: 1 as const, provider: "avaturn" as const, modelUrl: avatarAssetUrl(model.id), portraitUrl };
}

export async function getAvatarAsset(id: string) {
  const row = await gameDb.selectFrom("avatar_uploads").selectAll().where("id", "=", id).executeTakeFirst();
  requireCondition(row?.asset_path, 404, "Avatar asset not found.");
  // Draft uploads are owner-only; saved avatars are part of the signed-in player directory.
  const referenced = await gameDb.selectFrom("user_characters").select("user_id")
    .where(eb => eb.or([
      eb(eb.ref("avatar_3d", "->>").key("modelUploadId"), "=", id),
      eb(eb.ref("avatar_3d", "->>").key("portraitUploadId"), "=", id),
    ])).executeTakeFirst();
  return { row, referenced: !!referenced, file: await storage.getObjectEntityFile(row.asset_path) };
}
