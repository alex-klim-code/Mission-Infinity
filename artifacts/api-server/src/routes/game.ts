import Fastify, { type FastifyRequest } from "fastify";
import { getAuth } from "@clerk/express";
import type { Request } from "express";
import { z } from "zod";
import {
  GetGameCatalogResponse, GetPlayerResponse, SaveCharacterBody, SaveCharacterResponse,
  GetSocialQueryParams, GetSocialResponse, UpdateFriendshipBody, UpdateFriendshipResponse,
  CreateGameSessionBody, CreateGameSessionResponse, GetGameSessionResponse,
  UpdateGameSessionBody, UpdateGameSessionResponse, InvitePlayerBody, InvitePlayerResponse,
  RespondToInvitationBody, RespondToInvitationResponse, GetCareerResponse,
  GetAvatarConfigResponse, RequestAvatarUploadBody, RequestAvatarUploadResponse,
  CompleteAvatarUploadParams, CompleteAvatarUploadResponse, GetAvatarFileParams,
  SendSessionMessageBody, SendSessionMessageResponse, GetStoryImageParams,
  GetSessionMessagesQueryParams, GetSessionMessagesResponse,
} from "@workspace/api-zod";
import { getCatalog } from "../game/content";
import { getAccount, getCareer, resolveUser, savePlayer } from "../game/players";
import { friendshipAction, socialState } from "../game/social";
import { createSession, notifySession, sessionState, updateSession } from "../game/sessions";
import { consumeGameRate, gameRatePolicy } from "../game/rate-policy";
import { rocketCatalog } from "../game/rocket-catalog";
import { scientificInstruments } from "../game/scientific-instruments";
import { inviteToSession, respondToInvite } from "../game/invitations";
import { sendSessionMessage } from "../game/session-messages";
import { getSessionMessages } from "../game/session-history";
import { ObjectStorageService } from "../lib/objectStorage";
import { GameError, requireCondition } from "../game/database";
import { logger } from "../lib/logger";
import { notifyUsers } from "../game/presence";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { getAvatarConfig, requestAvatarUpload, completeAvatarUpload, getAvatarAsset } from "../game/avatars";

declare module "fastify" {
  interface FastifyRequest { playerId: string; }
}

export const gameApi = Fastify({ bodyLimit: 16 * 1024, disableRequestLogging: true });
gameApi.decorateRequest("playerId", "");

const windows = new Map<string, { count: number; until: number }>();
const cleanup = setInterval(() => {
  for (const [key, value] of windows) if (value.until < Date.now()) windows.delete(key);
}, 60_000);
cleanup.unref();

export function validateOrigin(req: {headers: import("node:http").IncomingHttpHeaders}) {
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { throw new GameError(403, "Invalid request origin."); }
  requireCondition(originHost === getClerkProxyHost(req), 403, "Cross-origin game requests are not allowed.");
}

function idParam(req: FastifyRequest) {
  return z.string().uuid().parse((req.params as {id: string}).id);
}

gameApi.addHook("onRequest", async request => {
  const route = request.url.split("?")[0];
  if (route === "/api/healthz" || route === "/api/game/catalog") return;
  validateOrigin(request.raw);
  const auth = getAuth(request.raw as Request);
  const authId = auth?.userId;
  requireCondition(authId, 401, "Sign in to access your mission.");
  const policy=gameRatePolicy(request.method,route);
  requireCondition(consumeGameRate(windows,`${authId}:${policy.bucket}`,policy.limit),429,"Too many requests. Please wait a moment.");
  request.playerId = await resolveUser(authId);
});

gameApi.setErrorHandler((error, _req, reply) => {
  const e = error as Error & {code?: string; statusCode?: number};
  if (e.name === "ZodError") return reply.code(400).send({ error: "Please check the submitted values." });
  if (e.code === "23505") return reply.code(409).send({ error: "That name or record already exists. Please choose another." });
  if (e.code === "22P02") return reply.code(400).send({ error: "Invalid identifier." });
  const status = e.statusCode ?? 500;
  if (status >= 500) logger.error({ err: e }, "Game request failed");
  return reply.code(status).send({ error: status >= 500 ? "Mission control encountered an error. Please try again." : e.message });
});

gameApi.get("/api/healthz", async () => ({ status: "ok" }));
gameApi.get("/api/game/catalog", async () => GetGameCatalogResponse.parse({...await getCatalog(), rocketCatalog, scientificInstruments}));
gameApi.get("/api/game/me", async req => GetPlayerResponse.parse(await getAccount(req.playerId)));
gameApi.get("/api/game/avatar-config", async () => GetAvatarConfigResponse.parse(getAvatarConfig()));
gameApi.post("/api/game/avatar-uploads", async (req, reply) => {
  const result = await requestAvatarUpload(req.playerId, RequestAvatarUploadBody.parse(req.body));
  return reply.code(201).send(RequestAvatarUploadResponse.parse(result));
});
gameApi.post("/api/game/avatar-uploads/:id/complete", async req => {
  const { id } = CompleteAvatarUploadParams.parse(req.params);
  return CompleteAvatarUploadResponse.parse(await completeAvatarUpload(req.playerId, id));
});
gameApi.get("/api/game/avatar-files/:id", async (req, reply) => {
  const { id } = GetAvatarFileParams.parse(req.params);
  const { row, file, referenced } = await getAvatarAsset(id);
  requireCondition(referenced || row.user_id === req.playerId, 404, "Avatar asset not found.");
  reply.header("Cache-Control", "private, max-age=86400, immutable").header("X-Content-Type-Options", "nosniff");
  reply.type(row.kind === "model" ? "model/gltf-binary" : "image/png");
  return reply.send(file.createReadStream());
});
gameApi.put("/api/game/character", async req => {
  const player = await savePlayer(req.playerId, SaveCharacterBody.parse(req.body));
  notifyUsers([req.playerId], "social:changed");
  const { activeSessionId } = await getAccount(req.playerId);
  if (activeSessionId) await notifySession(activeSessionId);
  return SaveCharacterResponse.parse(player);
});
gameApi.get("/api/game/social", async req => {
  const query = GetSocialQueryParams.parse(req.query);
  return GetSocialResponse.parse(await socialState(req.playerId, query.q ?? ""));
});
gameApi.post("/api/game/friend-actions", async req => {
  const body = UpdateFriendshipBody.parse(req.body);
  z.string().uuid().parse(body.targetId);
  return UpdateFriendshipResponse.parse(await friendshipAction(req.playerId, body.targetId, body.action));
});
gameApi.post("/api/game/sessions", async (req, reply) => {
  const body = CreateGameSessionBody.parse(req.body);
  const session = await createSession(req.playerId, body.missionId, body.mode);
  return reply.code(201).send(CreateGameSessionResponse.parse(session));
});
gameApi.get("/api/game/sessions/:id", async req => GetGameSessionResponse.parse(await sessionState(idParam(req), req.playerId)));
gameApi.post("/api/game/sessions/:id/actions", async req => {
  const result = await updateSession(req.playerId, idParam(req), UpdateGameSessionBody.parse(req.body));
  return UpdateGameSessionResponse.parse(result);
});
gameApi.get("/api/game/sessions/:id/messages", async req => {
  const { before } = GetSessionMessagesQueryParams.parse(req.query);
  return GetSessionMessagesResponse.parse(await getSessionMessages(req.playerId, idParam(req), before));
});
gameApi.post("/api/game/sessions/:id/messages", async req => {
  return SendSessionMessageResponse.parse(await sendSessionMessage(
    req.playerId, idParam(req), SendSessionMessageBody.parse(req.body),
  ));
});
gameApi.post("/api/game/sessions/:id/invitations", async req => {
  const body = InvitePlayerBody.parse(req.body);
  z.string().uuid().parse(body.userId);
  return InvitePlayerResponse.parse(await inviteToSession(req.playerId, idParam(req), body.userId));
});
gameApi.post("/api/game/invitations/:id", async req => {
  const body = RespondToInvitationBody.parse(req.body);
  return RespondToInvitationResponse.parse(await respondToInvite(req.playerId, idParam(req), body.action));
});
gameApi.get("/api/game/career", async req => GetCareerResponse.parse(await getCareer(req.playerId)));
gameApi.get("/api/game/story-images/:name", async (req, reply) => {
  const { name } = GetStoryImageParams.parse(req.params);
  const file = await new ObjectStorageService().searchPublicObject(`mission-story/v1/${name}`);
  requireCondition(file, 404, "Story illustration not found.");
  // These six allowlisted, optimized illustrations are small. Buffer them before
  // replying: aborting a browser request must not destroy the GCS 8 response
  // stream during its handshake (which can throw outside Fastify's handler).
  const [image] = await file.download();
  if (reply.raw.destroyed) return reply;
  reply.header("Cache-Control", "private, max-age=31536000, immutable").header("X-Content-Type-Options", "nosniff");
  return reply.type("image/webp").send(image);
});
