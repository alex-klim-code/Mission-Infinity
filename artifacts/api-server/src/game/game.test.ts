import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gameDb } from "./database";
import { seedGameContent, getCatalog } from "./content";
import { getAccount, savePlayer, getCareer } from "./players";
import { sendSessionMessage } from "./session-messages";
import { friendshipAction, socialState } from "./social";
import { createSession, sessionState, updateSession, reconcilePresence } from "./sessions";
import { inviteToSession, respondToInvite } from "./invitations";
import { markConnected, markDisconnected } from "./presence";
import { pool } from "@workspace/db";
import { completeAvatarUpload, getAvatarAsset, requestAvatarUpload } from "./avatars";
import { ObjectStorageService } from "../lib/objectStorage";
import { avatarFixture } from "./testing/avatar";

// Domain/integration tests use disposable identities, never bypass browser auth.
test("Mission Infinity server-authoritative game rules", async t => {
  const fixtures: string[] = [];
  async function players(count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const user = await gameDb.insertInto("users").values({ auth_id: `test-only-${randomUUID()}` })
        .returning("id").executeTakeFirstOrThrow();
      fixtures.push(user.id);
      ids.push(user.id);
      await savePlayer(user.id, {
        name: `Test ${user.id.slice(0, 12)}`, age: 29, gender: "unspecified", presetId: "engineer-01",
      });
      markConnected(user.id, `test-${user.id}`);
    }
    return ids;
  }
  async function makeFriends(a: string, b: string) {
    await friendshipAction(a, b, "send");
    await friendshipAction(b, a, "accept");
  }
  async function invite(a: string, b: string, sessionId: string) {
    await makeFriends(a, b);
    await inviteToSession(a, sessionId, b);
    const state = await socialState(b);
    return state.invitations.find(i => i.sessionId === sessionId && i.direction === "incoming")!.id;
  }
  try {
    await seedGameContent();
    await t.test("catalog contains one enabled mission, ten presets, six scenes and a complete briefing", async () => {
      const catalog = await getCatalog();
      assert.equal(catalog.missions.filter(m => m.enabled).length, 1);
      assert.equal(catalog.presets.length, 10);
      assert.equal(catalog.scenes.length, 6);
      assert.deepEqual(catalog.scenes.slice(3).map(s => s.title), ["Get a Message", "Meet Your Crew", "Start Mission"]);
      assert.ok(catalog.scenes.slice(0, 3).every(s => s.image.startsWith("/api/game/story-images/") && s.image.endsWith(".webp")));
      const mission = catalog.missions.find(m => m.enabled)!;
      assert.equal(mission.budget, 150000000);
      assert.equal(mission.developmentMonths, 24);
      assert.equal(mission.operationalYears, 3);
      assert.equal(mission.requirements.length, 10);
      assert.equal(mission.briefing.length, 10);
    });
    await t.test("crew speech bubbles are private, bounded, rate-limited and expire without changing leadership", async () => {
      const [leader, crew, outsider] = await players(3);
      const mission = (await getCatalog()).missions.find(m => m.enabled)!;
      const session = await createSession(leader, mission.id, "crew");
      await respondToInvite(crew, await invite(leader, crew, session.id), "accept");
      await assert.rejects(sendSessionMessage(outsider, session.id, { text: "Not my channel" }));
      await assert.rejects(sendSessionMessage(leader, session.id, { text: "   " }));
      await assert.rejects(sendSessionMessage(leader, session.id, { text: "x".repeat(181) }));

      const posted = await sendSessionMessage(leader, session.id, { text: "  Welcome aboard!  " });
      const bubble = posted.players.find(p => p.player.id === leader)!.lastMessage!;
      assert.equal(bubble.text, "Welcome aboard!");
      assert.equal(Date.parse(bubble.expiresAt) - Date.parse(bubble.createdAt), 12_000);
      assert.equal(posted.hostId, leader);
      assert.equal(posted.scene, session.scene);
      await assert.rejects(sendSessionMessage(leader, session.id, { text: "Too fast" }),
        (error: unknown) => (error as { statusCode: number }).statusCode === 429);

      const attempts = await Promise.allSettled([
        sendSessionMessage(crew, session.id, { text: "Crew speaking" }),
        sendSessionMessage(crew, session.id, { text: "Duplicate burst" }),
      ]);
      assert.equal(attempts.filter(a => a.status === "fulfilled").length, 1);
      assert.equal(attempts.filter(a => a.status === "rejected").length, 1);
      const received = await sessionState(session.id, leader);
      assert.ok(received.players.find(p => p.player.id === crew)!.lastMessage);
      assert.equal(received.hostId, leader);
      await assert.rejects(sessionState(session.id, outsider));

      await gameDb.updateTable("game_session_players").set({
        last_message: { ...bubble, expiresAt: new Date(Date.now() - 1).toISOString() },
      }).where("session_id", "=", session.id).where("user_id", "=", leader).execute();
      assert.equal((await sessionState(session.id, crew)).players.find(p => p.player.id === leader)!.lastMessage, null);
      await updateSession(crew, session.id, { action: "leave" });
      await assert.rejects(sendSessionMessage(crew, session.id, { text: "Already left" }));
    });
    await t.test("character saves, reloads, edits and rejects unknown presets and duplicate names", async () => {
      const [a, b] = await players(2);
      await savePlayer(a, { name: `Engineer ${a.slice(0, 8)}`, age: 60, gender: "female", presetId: "engineer-10" });
      const account = await getAccount(a);
      assert.equal(account.character?.presetId, "engineer-10");
      assert.equal(account.character?.age, 60);
      await assert.rejects(savePlayer(a, { name: "Invalid", age: 30, gender: "male", presetId: "unknown" }));
      await assert.rejects(savePlayer(b, { name: account.character!.name.toUpperCase(), age: 30, gender: "male", presetId: "engineer-02" }));
    });
    await t.test("custom appearance persists exactly, supports ages 14–60, and preserves legacy edits", async () => {
      const [a] = await players(1);
      const before = (await getAccount(a)).character!;
      assert.equal(before.appearance, null);
      const appearance = {
        version: 1, base: "female", face: "bright", skinTone: "614335",
        hairstyle: "curly", hairColor: "d6b370", countryCode: "PL", avatarSeed: `avatar:${a}`,
      } as const;
      await savePlayer(a, { name: before.name, age: 14, gender: "female", countryCode: "PL", appearance });
      let saved = (await getAccount(a)).character!;
      assert.deepEqual(saved.appearance, appearance);
      assert.equal(saved.countryCode, "PL");
      assert.equal(saved.age, 14);
      assert.equal(saved.presetId, before.presetId);
      // Older clients omitting the new fields must not erase a customized character.
      await savePlayer(a, { name: before.name, age: 60, gender: "female", presetId: before.presetId });
      saved = (await getAccount(a)).character!;
      assert.deepEqual(saved.appearance, appearance);
      assert.equal(saved.countryCode, "PL");
      await assert.rejects(savePlayer(a, { name: before.name, age: 13, gender: "female" }));
      await assert.rejects(savePlayer(a, { name: before.name, age: 61, gender: "female" }));
      await assert.rejects(gameDb.updateTable("user_characters").set({ age: 13 }).where("user_id", "=", a).execute());
      // An explicit legacy restore remains possible without deleting profile or country.
      await savePlayer(a, { name: before.name, age: 20, gender: "female", appearance: null });
      assert.equal((await getAccount(a)).character!.appearance, null);
      assert.equal((await getAccount(a)).character!.presetId, before.presetId);
    });
    await t.test("appearance rejects unsupported controls, invalid countries and inconsistent flags or bases", async () => {
      const [a] = await players(1);
      const appearance = {
        version: 1, base: "male", face: "focused", skinTone: "edb98a",
        hairstyle: "theCaesar", hairColor: "2c1b18", countryCode: "DE", avatarSeed: `avatar:${a}`,
      } as const;
      const input = { name: `Custom ${a.slice(0, 8)}`, age: 20, gender: "male" as const, countryCode: "DE", appearance };
      await savePlayer(a, input);
      await assert.rejects(savePlayer(a, { ...input, countryCode: "PL" }));
      await assert.rejects(savePlayer(a, { ...input, gender: "female" }));
      await assert.rejects(savePlayer(a, { ...input, countryCode: "ZZ", appearance: { ...appearance, countryCode: "ZZ" } }));
      await assert.rejects(savePlayer(a, { ...input, appearance: { ...appearance, avatarSeed: "<svg-onload>" } }));
      await assert.rejects(savePlayer(a, { ...input, appearance: { ...appearance, face: "unsupported" as "focused" } }));
      await assert.rejects(savePlayer(a, { ...input, appearance: { ...appearance, hairstyle: "unsupported" as "theCaesar" } }));
      assert.deepEqual((await getAccount(a)).character!.appearance, appearance);
    });
    await t.test("3D uploads validate ownership, freeze their bytes, persist and preserve legacy data", async () => {
      const [a, b] = await players(2);
      const before = (await getAccount(a)).character!;
      const bytes = avatarFixture();
      const upload = await requestAvatarUpload(a, { kind: "model", size: bytes.length });
      const storage = new ObjectStorageService();
      try {
        await assert.rejects(completeAvatarUpload(b, upload.id));
        const put = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": upload.contentType }, body: bytes });
        assert.equal(put.status, 200);
        const asset = await completeAvatarUpload(a, upload.id).catch((error: Error) => {
          throw new Error(`${error.name}: ${error.message}`);
        });
        assert.equal(asset.kind, "model");
        assert.deepEqual(await completeAvatarUpload(a, upload.id), asset);
        const input = { modelUploadId: upload.id, avatarId: "integration-fixture", bodyId: "test-body",
          gender: "male" as const, avatarSupportsFaceAnimations: false };
        await assert.rejects(savePlayer(b, { name: `Other ${b.slice(0, 8)}`, age: 20, gender: "male", avatar3d: input }));
        await assert.rejects(savePlayer(a, { name: before.name, age: 20, gender: "female", avatar3d: input }));
        const saved = await savePlayer(a, { name: before.name, age: 20, gender: "male", avatar3d: input });
        assert.equal(saved!.avatar3d!.modelUrl, asset.url);
        assert.equal(saved!.presetId, before.presetId);
        assert.equal(saved!.appearance, before.appearance);
        const renamed = await savePlayer(a, { name: before.name, age: 21, gender: "male" });
        assert.deepEqual(renamed!.avatar3d, saved!.avatar3d);
        const tamper = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": upload.contentType }, body: Buffer.alloc(bytes.length) });
        assert.equal(tamper.status, 200);
        const stored = await getAvatarAsset(upload.id);
        assert.deepEqual((await stored.file.download())[0], bytes);
        await savePlayer(a, { name: before.name, age: 20, gender: "male", avatar3d: null });
        assert.equal((await getAccount(a)).character!.avatar3d, null);
      } finally {
        const record = await gameDb.selectFrom("avatar_uploads").selectAll().where("id", "=", upload.id).executeTakeFirstOrThrow();
        for (const path of [record.asset_path, record.upload_path]) if (path) {
          try { await (await storage.getObjectEntityFile(path)).delete({ ignoreNotFound: true }); } catch { /* fixture-only cleanup */ }
        }
      }
    });
    await t.test("saved custom appearances reach friends, invitations and both multiplayer clients unchanged", async () => {
      const [a, b] = await players(2);
      const appearance = {
        version: 1, base: "female", face: "confident", skinTone: "ae5d29",
        hairstyle: "bob", hairColor: "e8e1e1", countryCode: "JP", avatarSeed: `crew:${a}`,
      } as const;
      await savePlayer(a, { name: `Crew ${a.slice(0, 8)}`, age: 20, gender: "female", countryCode: "JP", appearance });
      const room = await createSession(a, "earth-observer", "crew");
      const invitationId = await invite(a, b, room.id);
      const recipientSocial = await socialState(b);
      assert.deepEqual(recipientSocial.friends.find(p => p.id === a)!.appearance, appearance);
      assert.deepEqual(recipientSocial.invitations.find(i => i.id === invitationId)!.from.appearance, appearance);
      await respondToInvite(b, invitationId, "accept");
      for (const viewer of [a, b]) {
        assert.deepEqual((await sessionState(room.id, viewer)).players.find(p => p.player.id === a)!.player.appearance, appearance);
      }
      const changed = { ...appearance, countryCode: "GB", face: "calm" as const };
      await savePlayer(a, { name: `Crew ${a.slice(0, 8)}`, age: 20, gender: "female", countryCode: "GB", appearance: changed });
      assert.deepEqual((await sessionState(room.id, b)).players.find(p => p.player.id === a)!.player.appearance, changed);
    });
    await t.test("friend requests prevent self, duplicate and unauthorized replies; accept and remove persist", async () => {
      const [a, b, outsider] = await players(3);
      await assert.rejects(friendshipAction(a, a, "send"));
      await friendshipAction(a, b, "send");
      await assert.rejects(friendshipAction(a, b, "send"));
      await assert.rejects(friendshipAction(b, a, "send"));
      await assert.rejects(friendshipAction(a, b, "accept"));
      await assert.rejects(friendshipAction(outsider, a, "accept"));
      assert.equal((await socialState(b)).incoming[0].id, a);
      await friendshipAction(b, a, "accept");
      assert.equal((await socialState(a)).friends[0].id, b);
      await friendshipAction(a, b, "remove");
      assert.equal((await socialState(b)).friends.length, 0);
    });
    await t.test("incoming requests can be rejected and outgoing requests cancelled", async () => {
      const [a, b] = await players(2);
      await friendshipAction(a, b, "send");
      await friendshipAction(b, a, "reject");
      assert.equal((await socialState(a)).sent.length, 0);
      await friendshipAction(a, b, "send");
      await friendshipAction(a, b, "cancel");
      assert.equal((await socialState(b)).incoming.length, 0);
    });
    await t.test("disabled missions and a second active session are rejected", async () => {
      const [a] = await players(1);
      await assert.rejects(createSession(a, "mars-orbiter", "solo"));
      const s = await createSession(a, "earth-observer", "crew");
      assert.equal((await getAccount(a)).activeSessionId, s.id);
      await assert.rejects(createSession(a, "earth-observer", "solo"));
    });
    await t.test("private sessions reject outsiders and non-friend invitations", async () => {
      const [a, b] = await players(2);
      const s = await createSession(a, "earth-observer", "crew");
      await assert.rejects(sessionState(s.id, b));
      await assert.rejects(inviteToSession(a, s.id, b));
      await assert.rejects(updateSession(b, s.id, { action: "start" }));
    });
    await t.test("invitations persist, decline, expire and cannot be accepted by another player", async () => {
      const [a, b, outsider] = await players(3);
      const s = await createSession(a, "earth-observer", "crew");
      const first = await invite(a, b, s.id);
      assert.equal((await socialState(b)).invitations[0].id, first);
      await assert.rejects(respondToInvite(outsider, first, "accept"));
      await respondToInvite(b, first, "decline");
      assert.equal((await socialState(b)).invitations.length, 0);
      await inviteToSession(a, s.id, b);
      const second = (await socialState(b)).invitations[0].id;
      await gameDb.updateTable("game_invitations").set({ expires_at: new Date(Date.now() - 1000) }).where("id", "=", second).execute();
      await assert.rejects(respondToInvite(b, second, "accept"));
    });
    await t.test("concurrent accepts respect four-player capacity and duplicate accepts are idempotent", async () => {
      const [a, ...others] = await players(5);
      const s = await createSession(a, "earth-observer", "crew");
      const invitations: string[] = [];
      for (const b of others) invitations.push(await invite(a, b, s.id));
      const results = await Promise.allSettled(others.map((b, i) => respondToInvite(b, invitations[i], "accept")));
      assert.equal(results.filter(r => r.status === "fulfilled").length, 3);
      assert.equal(results.filter(r => r.status === "rejected").length, 1);
      const state = await sessionState(s.id, a);
      assert.equal(state.players.length, 4);
      const joinedIndex = results.findIndex(r => r.status === "fulfilled");
      await respondToInvite(others[joinedIndex], invitations[joinedIndex], "accept");
      assert.equal((await sessionState(s.id, a)).players.length, 4);
    });
    await t.test("only host starts; crew readiness and host migration are enforced", async () => {
      const [a, b] = await players(2);
      const s = await createSession(a, "earth-observer", "crew");
      const invitation = await invite(a, b, s.id);
      await respondToInvite(b, invitation, "accept");
      await assert.rejects(updateSession(b, s.id, { action: "start" }));
      await assert.rejects(updateSession(a, s.id, { action: "start" }));
      await updateSession(b, s.id, { action: "ready", ready: true });
      assert.equal((await sessionState(s.id, a)).players.find(p => p.player.id === b)?.ready, true);
      await updateSession(a, s.id, { action: "leave" });
      assert.equal((await sessionState(s.id, b)).hostId, b);
      await updateSession(b, s.id, { action: "start" });
      assert.equal((await sessionState(s.id, b)).status, "STORY");
    });
    await t.test("only Leader launches from the final screen after connected crew signal ready", async () => {
      const [leader, crew] = await players(2);
      const session = await createSession(leader, "earth-observer", "crew");
      await respondToInvite(crew, await invite(leader, crew, session.id), "accept");
      await updateSession(crew, session.id, { action: "ready", ready: true });
      await updateSession(leader, session.id, { action: "start" });
      for (let scene = 0; scene < 5; scene++) {
        await updateSession(crew, session.id, { action: "continue-ready", ready: true });
        assert.equal((await sessionState(session.id, leader)).scene, scene);
        await updateSession(leader, session.id, { action: "next", expectedScene: scene });
      }
      await assert.rejects(updateSession(leader, session.id, { action: "initiate" }));
      assert.equal((await sessionState(session.id, leader)).players.find(p => p.player.id === leader)!.accepted, false);
      await updateSession(crew, session.id, { action: "accept" });
      assert.equal((await sessionState(session.id, leader)).status, "MISSION_ACCEPTANCE");
      await assert.rejects(updateSession(crew, session.id, { action: "initiate" }));
      await updateSession(leader, session.id, { action: "initiate" });
      const started = await sessionState(session.id, crew);
      assert.equal(started.status, "MISSION_STARTED");
      assert.equal(started.players.find(p => p.player.id === leader)!.accepted, true);
      await assert.rejects(updateSession(leader, session.id, { action: "initiate" }));

      const [solo] = await players(1);
      const single = await createSession(solo, "earth-observer", "solo");
      for (let scene = 0; scene < 5; scene++) {
        await updateSession(solo, single.id, { action: "next", expectedScene: scene });
      }
      await updateSession(solo, single.id, { action: "initiate" });
      assert.equal((await sessionState(single.id, solo)).status, "MISSION_STARTED");
    });
    await t.test("host can start with one player; story persists and concurrent scene clicks cannot skip", async () => {
      const [a] = await players(1);
      const s = await createSession(a, "earth-observer", "crew");
      await updateSession(a, s.id, { action: "start" });
      const attempts = await Promise.allSettled([
        updateSession(a, s.id, { action: "next", expectedScene: 0 }),
        updateSession(a, s.id, { action: "next", expectedScene: 0 }),
      ]);
      assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
      assert.equal((await sessionState(s.id, a)).scene, 1);
      markDisconnected(a, `test-${a}`);
      markConnected(a, `test-${a}`);
      await reconcilePresence(a);
      assert.equal((await sessionState(s.id, a)).scene, 1);
      await assert.rejects(updateSession(a, s.id, { action: "initiate" }));
    });
    await t.test("solo prologue reaches exactly MISSION_STARTED and records career without gameplay", async () => {
      const [a] = await players(1);
      const s = await createSession(a, "earth-observer", "solo");
      assert.equal(s.status, "STORY");
      for (let i = 0; i < 5; i++) await updateSession(a, s.id, { action: "next", expectedScene: i });
      assert.equal((await sessionState(s.id, a)).status, "MISSION_ACCEPTANCE");
      await updateSession(a, s.id, { action: "accept" });
      assert.equal((await sessionState(s.id, a)).status, "READY_TO_START");
      await updateSession(a, s.id, { action: "initiate" });
      assert.equal((await sessionState(s.id, a)).status, "MISSION_STARTED");
      assert.equal((await getCareer(a)).missionsInitiated, 1);
      await assert.rejects(updateSession(a, s.id, { action: "next", expectedScene: 5 }));
    });
    await t.test("multiplayer requires every connected player acceptance and prevents late joins", async () => {
      const [a, b, c] = await players(3);
      const s = await createSession(a, "earth-observer", "crew");
      const ib = await invite(a, b, s.id), ic = await invite(a, c, s.id);
      await respondToInvite(b, ib, "accept");
      await updateSession(b, s.id, { action: "ready", ready: true });
      await updateSession(a, s.id, { action: "start" });
      await assert.rejects(respondToInvite(c, ic, "accept"));
      await assert.rejects(updateSession(b, s.id, { action: "next", expectedScene: 0 }));
      await updateSession(b, s.id, { action: "continue-ready", ready: true });
      assert.equal((await sessionState(s.id, a)).players.find(p => p.player.id === b)?.continueReady, true);
      for (let i = 0; i < 5; i++) await updateSession(a, s.id, { action: "next", expectedScene: i });
      await updateSession(a, s.id, { action: "accept" });
      assert.equal((await sessionState(s.id, a)).status, "MISSION_ACCEPTANCE");
      await updateSession(b, s.id, { action: "accept" });
      assert.equal((await sessionState(s.id, a)).status, "READY_TO_START");
      await assert.rejects(updateSession(b, s.id, { action: "initiate" }));
      await updateSession(a, s.id, { action: "initiate" });
      assert.equal((await sessionState(s.id, b)).status, "MISSION_STARTED");
    });
    await t.test("disconnected host transfers to connected crew and reconnects without losing the scene", async () => {
      const [a, b] = await players(2);
      const s = await createSession(a, "earth-observer", "crew");
      await respondToInvite(b, await invite(a, b, s.id), "accept");
      await updateSession(b, s.id, { action: "ready", ready: true });
      await updateSession(a, s.id, { action: "start" });
      await updateSession(a, s.id, { action: "next", expectedScene: 0 });
      markDisconnected(a, `test-${a}`);
      await reconcilePresence(a, true);
      assert.equal((await sessionState(s.id, b)).hostId, b);
      markConnected(a, `test-${a}`);
      await reconcilePresence(a);
      const resumed = await sessionState(s.id, a);
      assert.equal(resumed.scene, 1);
      assert.equal(resumed.players.length, 2);
      assert.equal(resumed.hostId, b);
    });
  } finally {
    for (const id of fixtures) markDisconnected(id, `test-${id}`);
    if (fixtures.length) {
      await gameDb.deleteFrom("game_sessions").where("host_id", "in", fixtures).execute();
      await gameDb.deleteFrom("users").where("id", "in", fixtures).execute();
    }
    await pool.end();
  }
});
