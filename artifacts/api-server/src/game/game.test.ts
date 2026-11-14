import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gameDb } from "./database";
import { seedGameContent, getCatalog } from "./content";
import { getAccount, savePlayer, getCareer } from "./players";
import { sendSessionMessage } from "./session-messages";
import { getSessionMessages } from "./session-history";
import { friendshipAction, socialState } from "./social";
import { createSession, sessionState, updateSession, reconcilePresence } from "./sessions";
import { inviteToSession, respondToInvite } from "./invitations";
import { markConnected, markDisconnected } from "./presence";
import { pool } from "@workspace/db";
import { completeAvatarUpload, getAvatarAsset, requestAvatarUpload } from "./avatars";
import { ObjectStorageService } from "../lib/objectStorage";
import { avatarFixture } from "./testing/avatar";
import { rocketCatalog, componentCategories, rocketOptions } from "./rocket-catalog";
import { rocketHulls } from "./rocket-builds";
import { scientificInstruments } from "./scientific-instruments";
import { fuelIncrement } from "./fuel-loads";
import { constructionMonths } from "./mission-flight-model";

test("fuel heartbeat caps offline time, quantity and available budget", () => {
  assert.equal(fuelIncrement(0,30000,100,1000000),150);
  assert.equal(fuelIncrement(0,30000,60000,1000000),2250);
  assert.equal(fuelIncrement(1000,1100,1000,1000000),100);
  assert.equal(fuelIncrement(0,30000,1000,19),2);
  assert.equal(fuelIncrement(0,30000,-1,1000000),0);
  assert.equal(fuelIncrement(30000,30000,1000,1000000),0);
});

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
      assert.equal(mission.title, "LUNA — Lunar Sample Return");
      assert.equal(mission.budget, 400000000);
      assert.equal(mission.developmentMonths, 36);
      assert.equal("operationalWeeks" in mission ? mission.operationalWeeks : undefined, 4);
      assert.equal(mission.difficulty, "Easy");
      assert.equal(mission.requirements.length, 0);
      assert.equal(mission.briefing.length, 2);
      assert.match(mission.briefing[0].text, /12 months[\s\S]*12 months[\s\S]*9 months[\s\S]*3 months/);
      assert.equal(mission.objectives.length, 4);
      assert.doesNotMatch(mission.description, /Earth Observer|Low Earth Orbit|risk|24 months|3 years/i);
    });
    await t.test("rocket hull choices synchronize, only Leader purchases, and retries charge exactly once", async () => {
      const [leader, crew, outsider] = await players(3);
      const session = await createSession(leader, "earth-observer", "crew");
      await respondToInvite(crew, await invite(leader, crew, session.id), "accept");
      await assert.rejects(updateSession(leader, session.id, { action: "build-next" }));
      await updateSession(crew, session.id, { action: "ready", ready: true });
      await updateSession(leader, session.id, { action: "start" });
      for (let scene = 0; scene < 5; scene++) await updateSession(leader, session.id, { action: "next", expectedScene: scene });
      await updateSession(crew, session.id, { action: "accept" });
      const initiated = (await updateSession(leader, session.id, { action: "initiate" })).session!;
      assert.equal(initiated.build.screen, "INTRO");
      assert.equal(initiated.build.elapsedMonths, 0);
      await assert.rejects(updateSession(crew, session.id, { action: "build-next" }));
      await updateSession(leader, session.id, { action: "build-next" });
      await updateSession(crew, session.id, { action: "choose-hull", hullId: "nova-prime" });
      const voted = await sessionState(session.id, leader);
      assert.deepEqual(voted.build.votes, [{ playerId: crew, hullId: "nova-prime" }]);
      assert.equal(voted.build.spent, 0);
      await assert.rejects(updateSession(outsider, session.id, { action: "choose-hull", hullId: "falcon-shadow" }));
      await assert.rejects(updateSession(crew, session.id, { action: "confirm-hull", hullId: "falcon-shadow" }));
      await assert.rejects(updateSession(leader, session.id, { action: "confirm-hull", hullId: "invalid" }));
      await updateSession(leader, session.id, { action: "choose-hull", hullId: "falcon-shadow" });
      await Promise.all([
        updateSession(leader, session.id, { action: "confirm-hull", hullId: "falcon-shadow" }),
        updateSession(leader, session.id, { action: "confirm-hull", hullId: "falcon-shadow" }),
      ]);
      const saved = await sessionState(session.id, crew);
      assert.equal(saved.build.screen, "HULL_CONFIRMED");
      assert.equal(saved.build.selectedHullId, "falcon-shadow");
      assert.equal(saved.build.spent, 50000000);
      assert.equal(400000000 - saved.build.spent, 350000000);
      assert.equal(saved.build.elapsedMonths, 0, "A hull choice does not complete 12 months of spacecraft design");
      await assert.rejects(updateSession(leader, session.id, { action: "confirm-hull", hullId: "nova-prime" }));
      await assert.rejects(createSession(leader, "earth-observer", "solo"), "Started build must remain resumable until explicitly left");
      assert.equal((await getAccount(leader)).activeSessionId, session.id);
      assert.equal((await getCareer(leader)).missionsInitiated, 1);
      await updateSession(leader, session.id, { action: "leave" });
      const transferred = await sessionState(session.id, crew);
      assert.equal(transferred.hostId, crew);
      assert.equal(transferred.build.spent, 50000000);
      assert.equal(transferred.build.votes.length, 1, "Departed members no longer count as voters");
    });
    await t.test("every hull price is deducted literally and an insufficient budget never purchases", async () => {
      for (const [hullId, price] of [["titan-explorer", 60000000], ["nova-prime", 90000000]] as const) {
        const [player] = await players(1);
        const session = await createSession(player, "earth-observer", "solo");
        assert.equal(session.status, "STORY");
        for (let scene = 0; scene < 5; scene++) await updateSession(player, session.id, { action: "next", expectedScene: scene });
        await updateSession(player, session.id, { action: "initiate" });
        await updateSession(player, session.id, { action: "build-next" });
        await gameDb.updateTable("game_session_builds").set({ spent: 399999999 })
          .where("session_id", "=", session.id).execute();
        await assert.rejects(updateSession(player, session.id, { action: "confirm-hull", hullId }));
        assert.equal((await sessionState(session.id, player)).build.screen, "HULL_SELECTION");
        await gameDb.updateTable("game_session_builds").set({ spent: 0 }).where("session_id", "=", session.id).execute();
        const purchased = (await updateSession(player, session.id, { action: "confirm-hull", hullId })).session!;
        assert.equal(purchased.build.spent, price);
        assert.equal(purchased.build.selectedHullId, hullId);
      }
    });
    await t.test("catalog retains all Excel categories, full details and only the three legacy hulls", async () => {
      assert.equal(rocketCatalog.length, 7);
      assert.equal(rocketCatalog.flatMap(s => s.categories).length, 28);
      assert.equal(rocketOptions.length, 119);
      assert.equal(new Set(rocketOptions.map(o => o.id)).size, 119);
      assert.deepEqual(rocketOptions.filter(o => o.categoryId === "rocket-body").map(o => o.price), [50000000,60000000,90000000]);
      for (const [id, hull] of Object.entries(rocketHulls)) assert.equal(rocketOptions.find(o=>o.id===id)?.price,hull.price);
      for (const option of rocketOptions) {
        assert.ok(option.name && option.description && option.parameters && option.source);
        assert.ok(Number.isFinite(option.price) && option.price >= 0);
      }
      assert.equal(rocketOptions.find(o => o.name === "Aerojet Rocketdyne RS-25")?.price,123000000);
      assert.equal(rocketOptions.find(o => o.name === "SpaceX Raptor 3")?.massKg,1525);
      const visibleStrings = rocketOptions.flatMap(o=>[o.name,o.description,o.parameters,o.originalCategory,o.source,o.qualityMethodology]);
      assert.doesNotMatch(visibleStrings.join("\n"),/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(?:Rakieta|Sonda|Miniaturowy|Spektrometr|Napęd|Konstrukcja)\b/);
      assert.equal(rocketOptions.find(o=>o.id==="scientific-instruments-langmuir-probe-sonda-langmuira")?.name,"Langmuir Probe");
      assert.match(rocketOptions.find(o=>o.id==="solar-panels-endurosat-solar-panel-3u-rozkadany")?.name??"",/Deployable/);
    });
    await t.test("full assembly preserves the hull, charges net changes once, and only finishes when complete", async () => {
      const [leader, crew, outsider] = await players(3);
      const session = await createSession(leader,"earth-observer","crew");
      await respondToInvite(crew,await invite(leader,crew,session.id),"accept");
      await updateSession(crew,session.id,{action:"ready",ready:true});
      await updateSession(leader,session.id,{action:"start"});
      for(let scene=0;scene<5;scene++) await updateSession(leader,session.id,{action:"next",expectedScene:scene});
      await updateSession(crew,session.id,{action:"accept"});
      await updateSession(leader,session.id,{action:"initiate"});
      const parts = componentCategories[0].options;
      const [cheap, expensive] = [...parts].sort((a,b)=>a.price-b.price);
      await assert.rejects(updateSession(leader,session.id,{action:"confirm-component",optionId:cheap.id}),/body first/);
      await updateSession(leader,session.id,{action:"build-next"});
      await updateSession(leader,session.id,{action:"confirm-hull",hullId:"falcon-shadow"});
      const legacy = await sessionState(session.id,leader);
      assert.equal(legacy.build.spent,50000000);
      assert.deepEqual(legacy.assembly.selections,[]);
      await assert.rejects(updateSession(leader,session.id,{action:"finish-rocket"}),/27 component/);
      await updateSession(crew,session.id,{action:"choose-component",optionId:expensive.id});
      assert.equal((await sessionState(session.id,leader)).build.spent,50000000);
      assert.equal((await sessionState(session.id,leader)).assembly.proposals[0].optionId,expensive.id);
      await assert.rejects(updateSession(crew,session.id,{action:"confirm-component",optionId:cheap.id}),/Leader/);
      await assert.rejects(updateSession(outsider,session.id,{action:"choose-component",optionId:cheap.id}));
      await assert.rejects(updateSession(leader,session.id,{action:"confirm-component",optionId:"fabricated"}));
      await Promise.all([1,2].map(()=>updateSession(leader,session.id,{action:"confirm-component",optionId:expensive.id})));
      assert.equal((await sessionState(session.id,crew)).build.spent,50000000+expensive.price);
      await updateSession(leader,session.id,{action:"confirm-component",optionId:cheap.id});
      assert.equal((await sessionState(session.id,crew)).build.spent,50000000+cheap.price,"Replacement refunds the previous component, not the hull.");
      await gameDb.updateTable("game_session_builds").set({spent:399999999}).where("session_id","=",session.id).execute();
      const another = componentCategories.find(c=>c.id!==cheap.categoryId)!.options[0];
      await assert.rejects(updateSession(leader,session.id,{action:"confirm-component",optionId:another.id}),/insufficient/);
      assert.equal((await sessionState(session.id,crew)).assembly.selections.length,1);
      await gameDb.updateTable("game_session_builds").set({spent:50000000+cheap.price}).where("session_id","=",session.id).execute();
      let expected = 50000000;
      for(const category of componentCategories) {
        const option = [...category.options].sort((a,b)=>a.price-b.price)[0];
        expected += option.price;
        await updateSession(leader,session.id,{action:"confirm-component",optionId:option.id});
      }
      const configured = await sessionState(session.id,crew);
      assert.equal(configured.assembly.selections.length,27);
      assert.equal(configured.build.spent,expected);
      assert.equal(configured.build.elapsedMonths,0);
      await assert.rejects(updateSession(crew,session.id,{action:"finish-rocket"}),/Leader/);
      await Promise.all([1,2].map(()=>updateSession(leader,session.id,{action:"finish-rocket"})));
      const finished = await sessionState(session.id,crew);
      assert.equal(finished.assembly.completed,true);
      assert.equal(finished.build.elapsedMonths,0,"Parts selection does not spend construction months.");
      assert.equal(finished.build.spent,expected);
      await assert.rejects(updateSession(leader,session.id,{action:"confirm-component",optionId:expensive.id}),/already built/);
      await assert.rejects(updateSession(crew,session.id,{action:"choose-component",optionId:cheap.id}),/already built/);
      // The new stage must not change prior purchases or preparation time.
      await assert.rejects(updateSession(crew,session.id,{action:"open-science"}),/Leader/);
      await assert.rejects(updateSession(outsider,session.id,{action:"open-science"}),/member/);
      await assert.rejects(updateSession(leader,session.id,{action:"purchase-instruments",instrumentIds:[]}),/Open Stage 2/);
      await updateSession(leader,session.id,{action:"open-science"});
      await updateSession(leader,session.id,{action:"open-science"});
      await updateSession(crew,session.id,{action:"propose-instruments",instrumentIds:[]});
      assert.deepEqual((await sessionState(session.id,leader)).science.proposals,[{playerId:crew,instrumentIds:[]}]);
      const ids = scientificInstruments.map(item=>item.id);
      await updateSession(crew,session.id,{action:"propose-instruments",instrumentIds:ids});
      await assert.rejects(updateSession(crew,session.id,{action:"purchase-instruments",instrumentIds:ids}),/Leader/);
      await assert.rejects(updateSession(leader,session.id,{action:"purchase-instruments",instrumentIds:["invented"]}),/valid/);
      await assert.rejects(updateSession(leader,session.id,{action:"purchase-instruments",instrumentIds:[ids[0],ids[0]]}),/unique/);
      await assert.rejects(updateSession(leader,session.id,{action:"purchase-instruments"}),/valid/);
      await gameDb.updateTable("game_session_builds").set({spent:399000000}).where("session_id","=",session.id).execute();
      await assert.rejects(updateSession(leader,session.id,{action:"purchase-instruments",instrumentIds:ids}),/insufficient/);
      let state = await sessionState(session.id,crew);
      assert.equal(state.science.completed,false);
      assert.equal(state.science.spent,0);
      assert.equal(state.build.spent,399000000);
      await gameDb.updateTable("game_session_builds").set({spent:expected}).where("session_id","=",session.id).execute();
      await Promise.all([1,2].map(()=>updateSession(leader,session.id,{action:"purchase-instruments",instrumentIds:[...ids].reverse()})));
      state = await sessionState(session.id,crew);
      assert.equal(state.science.completed,true);
      assert.deepEqual(state.science.instrumentIds,ids);
      assert.equal(state.science.spent,49000000);
      assert.equal(state.build.spent,expected+49000000);
      assert.equal(state.build.elapsedMonths,0);
      assert.deepEqual(state.assembly,finished.assembly);
      await assert.rejects(updateSession(leader,session.id,{action:"purchase-instruments",instrumentIds:[]}),/already purchased/);
      await assert.rejects(updateSession(crew,session.id,{action:"propose-instruments",instrumentIds:[]}),/already purchased/);
      assert.equal((await sessionState(session.id,leader)).build.spent,expected+49000000);
      // Stage 3: real persisted progress, private crew access and atomic fuel charges.
      await assert.rejects(updateSession(crew,session.id,{action:"open-fueling"}),/Leader/);
      await assert.rejects(updateSession(outsider,session.id,{action:"open-fueling"}),/member/);
      await assert.rejects(updateSession(leader,session.id,{action:"start-fueling"}),/Open Stage 3/);
      await updateSession(leader,session.id,{action:"open-fueling"});
      await updateSession(leader,session.id,{action:"open-fueling"});
      assert.equal((await sessionState(session.id,leader)).journey.construction.opened,true);
      await assert.rejects(updateSession(leader,session.id,{action:"start-fueling"}),/Open Stage 3/);
      await updateSession(leader,session.id,{action:"start-construction"});
      await updateSession(leader,session.id,{action:"start-construction"});
      await gameDb.updateTable("game_session_mission_journeys").set({construction_started_at:new Date(Date.now()-11000)}).where("session_id","=",session.id).execute();
      await Promise.all([1,2].map(()=>updateSession(leader,session.id,{action:"journey-tick"})));
      assert.equal((await sessionState(session.id,leader)).journey.construction.delivered,true);
      await assert.rejects(updateSession(leader,session.id,{action:"start-fueling"}),/Connect/);
      await assert.rejects(updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:30001}),/target/);
      await assert.rejects(updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:-1}),/target/);
      await assert.rejects(updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:1.5}),/target/);
      await updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:1500});
      await updateSession(leader,session.id,{action:"connect-fuel-hose"});
      await updateSession(leader,session.id,{action:"start-fueling"});
      await assert.rejects(updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:2000}),/Pause/);
      await gameDb.updateTable("game_session_fuel_loads").set({flowing_at:new Date(Date.now()-400)}).where("session_id","=",session.id).execute();
      await updateSession(leader,session.id,{action:"pause-fueling"});
      let fueled = await sessionState(session.id,crew);
      assert.ok(fueled.fueling.loadedKg >= 600 && fueled.fueling.loadedKg < 1500);
      assert.equal(fueled.fueling.loading,false);
      assert.equal(fueled.fueling.spent,fueled.fueling.loadedKg*8);
      assert.equal(fueled.build.spent,expected+49000000+fueled.fueling.spent);
      const pausedKg = fueled.fueling.loadedKg;
      await updateSession(leader,session.id,{action:"fuel-tick"});
      assert.equal((await sessionState(session.id,leader)).fueling.loadedKg,pausedKg);
      await assert.rejects(updateSession(leader,session.id,{action:"confirm-fuel"}),/selected fuel/);
      await assert.rejects(updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:0}),/target/);
      await updateSession(leader,session.id,{action:"start-fueling"});
      await gameDb.updateTable("game_session_fuel_loads").set({flowing_at:new Date(Date.now()-1000)}).where("session_id","=",session.id).execute();
      await Promise.all([1,2].map(()=>updateSession(leader,session.id,{action:"fuel-tick"})));
      fueled = await sessionState(session.id,crew);
      assert.equal(fueled.fueling.loadedKg,1500);
      assert.equal(fueled.fueling.spent,12000);
      assert.equal(fueled.fueling.loading,false);
      // Increase target after completion, pause on disconnect, budget stops flow exactly.
      await updateSession(leader,session.id,{action:"set-fuel-target",quantityKg:3000});
      await updateSession(leader,session.id,{action:"start-fueling"});
      await updateSession(leader,session.id,{action:"disconnect-fuel-hose"});
      assert.equal((await sessionState(session.id,leader)).fueling.connected,false);
      await updateSession(leader,session.id,{action:"connect-fuel-hose"});
      await gameDb.updateTable("game_session_builds").set({spent:399999984}).where("session_id","=",session.id).execute();
      const beforeBudget = (await sessionState(session.id,leader)).fueling.loadedKg;
      await updateSession(leader,session.id,{action:"start-fueling"});
      await gameDb.updateTable("game_session_fuel_loads").set({flowing_at:new Date(Date.now()-500)}).where("session_id","=",session.id).execute();
      await updateSession(leader,session.id,{action:"fuel-tick"});
      fueled = await sessionState(session.id,crew);
      assert.equal(fueled.fueling.loadedKg,beforeBudget+2);
      assert.equal(fueled.build.spent,400000000);
      assert.equal(fueled.fueling.loading,false);
      await assert.rejects(updateSession(leader,session.id,{action:"start-fueling"}),/insufficient/);
      // Restore only this fixture's funds and finish, including idempotent confirmation.
      await gameDb.updateTable("game_session_builds").set({spent:expected+49000000+fueled.fueling.spent}).where("session_id","=",session.id).execute();
      await updateSession(leader,session.id,{action:"start-fueling"});
      await gameDb.updateTable("game_session_fuel_loads").set({flowing_at:new Date(Date.now()-1000)}).where("session_id","=",session.id).execute();
      await updateSession(leader,session.id,{action:"pause-fueling"});
      await Promise.all([1,2].map(()=>updateSession(leader,session.id,{action:"confirm-fuel"})));
      fueled = await sessionState(session.id,crew);
      assert.equal(fueled.fueling.completed,true);
      assert.equal(fueled.fueling.loadedKg,3000);
      assert.equal(fueled.fueling.spent,24000);
      assert.equal(fueled.build.spent,expected+49000000+24000);
      assert.equal(fueled.build.elapsedMonths,constructionMonths(expected));
      assert.deepEqual(fueled.assembly,finished.assembly);
      await assert.rejects(updateSession(crew,session.id,{action:"confirm-fuel"}),/Leader/);
      await assert.rejects(updateSession(leader,session.id,{action:"start-fueling"}),/already confirmed/);
      await updateSession(leader,session.id,{action:"disconnect-fuel-hose"});
      assert.equal((await sessionState(session.id,leader)).fueling.connected,false);
      // Too little fuel has a persisted mission consequence, not a free Moon arrival.
      await assert.rejects(updateSession(crew,session.id,{action:"open-briefing"}),/Leader/);
      await updateSession(leader,session.id,{action:"open-briefing"});
      const briefing = await sessionState(session.id,leader);
      assert.equal(briefing.journey.plan!.routeId,"earth-moon-earth");
      assert.ok(briefing.journey.plan!.requiredOutboundKg>3000);
      await updateSession(leader,session.id,{action:"briefing-continue"});
      await updateSession(leader,session.id,{action:"confirm-briefing-date",briefingDate:briefing.journey.weather[0].date});
      await updateSession(leader,session.id,{action:"launch-flight"});
      await gameDb.updateTable("game_session_mission_journeys").set({flight_started_at:new Date(Date.now()-30000)}).where("session_id","=",session.id).execute();
      await updateSession(leader,session.id,{action:"journey-tick"});
      const failedFlight = await sessionState(session.id,crew);
      assert.equal(failedFlight.journey.phase,"FAILED");
      assert.equal(failedFlight.journey.flight.remainingFuelKg,0);
      assert.equal(failedFlight.journey.flight.consumptionKgPerSecond,0);
      await assert.rejects(updateSession(leader,session.id,{action:"check-instruments"}),/Reach the Moon/);
    });
    await t.test("Stage 2 catalog matches supplied game balance and an empty purchase advances for free", async () => {
      assert.deepEqual(scientificInstruments.map(item=>[item.price,item.massKg,item.powerW,item.quality,item.maxSciencePoints]),[
        [2000000,3,12,60,100],[5000000,5,20,75,180],[3000000,2,5,70,130],
        [4000000,3,8,80,160],[8000000,8,25,85,250],[12000000,15,60,90,320],[15000000,12,45,95,400],
      ]);
      assert.equal(scientificInstruments.reduce((n,item)=>n+item.massKg,0),48);
      assert.equal(scientificInstruments.reduce((n,item)=>n+item.powerW,0),175);
      assert.equal(scientificInstruments.reduce((n,item)=>n+item.maxSciencePoints,0),1540);
      const [player] = await players(1);
      const session = await createSession(player,"earth-observer","solo");
      await assert.rejects(updateSession(player,session.id,{action:"open-science"}),/Start the mission/);
      for(let scene=0;scene<5;scene++) await updateSession(player,session.id,{action:"next",expectedScene:scene});
      await updateSession(player,session.id,{action:"initiate"});
      await assert.rejects(updateSession(player,session.id,{action:"open-fueling"}),/Complete Stage 2/);
      await assert.rejects(updateSession(player,session.id,{action:"open-science"}),/Complete Stage 1/);
      assert.deepEqual((await sessionState(session.id,player)).science,{opened:false,completed:false,instrumentIds:[],spent:0,proposals:[]});
      // Isolated, disposable fixture: Stage 1 validation is covered by the test above.
      await gameDb.insertInto("game_session_rocket_assemblies").values({session_id:session.id,completed:true}).execute();
      await gameDb.insertInto("game_session_builds").values({session_id:session.id,selected_hull_id:"falcon-shadow",spent:50000000,elapsed_months:12}).execute();
      await updateSession(player,session.id,{action:"open-science"});
      await Promise.all([1,2].map(()=>updateSession(player,session.id,{action:"purchase-instruments",instrumentIds:[]})));
      const state = await sessionState(session.id,player);
      assert.equal(state.science.completed,true);
      assert.deepEqual(state.science.instrumentIds,[]);
      assert.equal(state.science.spent,0);
      assert.equal(state.build.spent,50000000);
      assert.equal(state.build.elapsedMonths,12);
    });
    await t.test("catalog repricing never retroactively charges a previously purchased hull", async () => {
      const [player] = await players(1);
      const session = await createSession(player,"earth-observer","solo");
      for(let scene=0;scene<5;scene++) await updateSession(player,session.id,{action:"next",expectedScene:scene});
      await updateSession(player,session.id,{action:"initiate"});
      await updateSession(player,session.id,{action:"build-next"});
      await updateSession(player,session.id,{action:"confirm-hull",hullId:"falcon-shadow"});
      await gameDb.updateTable("game_session_builds").set({spent:500}).where("session_id","=",session.id).execute();
      await updateSession(player,session.id,{action:"confirm-hull",hullId:"falcon-shadow"});
      const restored = await sessionState(session.id,player);
      assert.equal(restored.build.spent,500);
      assert.equal(restored.build.selectedHullId,"falcon-shadow");
    });
    await t.test("crew messages persist privately after notification expiry and successive sends", async () => {
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
      await gameDb.updateTable("game_session_messages").set({ expires_at: new Date(Date.now() - 1) })
        .where("session_id", "=", session.id).execute();
      assert.ok((await getSessionMessages(crew, session.id)).messages.some(m => m.id === bubble.id && m.text === "Welcome aboard!"));
      await assert.rejects(getSessionMessages(outsider, session.id));
      await gameDb.updateTable("game_session_players").set({
        last_message: { ...bubble, createdAt: new Date(Date.now() - 2000).toISOString() },
      }).where("session_id", "=", session.id).where("user_id", "=", leader).execute();
      const second = await sendSessionMessage(leader, session.id, { text: "Second entry" });
      assert.equal(second.chat.messages.filter(m => m.playerId === leader).length, 2);
      const afterReload = await sessionState(session.id, crew);
      assert.ok(afterReload.chat.messages.some(m => m.text === "Welcome aboard!"));
      assert.ok(afterReload.chat.messages.some(m => m.text === "Second entry"));
      await updateSession(crew, session.id, { action: "leave" });
      await assert.rejects(sendSessionMessage(crew, session.id, { text: "Already left" }));
      await assert.rejects(getSessionMessages(crew, session.id));
    });
    await t.test("chat pagination is complete, stable for equal timestamps, and rejects foreign cursors", async () => {
      const [a, b] = await players(2);
      const session = await createSession(a, "earth-observer", "solo");
      const other = await createSession(b, "earth-observer", "solo");
      const ids = Array.from({ length: 55 }, () => randomUUID()).sort();
      await gameDb.insertInto("game_session_messages").values(ids.map((id, i) => ({
        id, session_id: session.id, user_id: a, sender_name: "Saved engineer",
        text: `Entry ${i}`, created_at: new Date("2026-01-01T00:00:00Z"),
        expires_at: new Date("2026-01-01T00:00:12Z"),
      }))).execute();
      const first = await getSessionMessages(a, session.id);
      assert.equal(first.messages.length, 50);
      assert.equal(first.hasMore, true);
      const older = await getSessionMessages(a, session.id, first.messages[0].id);
      assert.equal(older.messages.length, 5);
      assert.equal(older.hasMore, false);
      assert.deepEqual([...older.messages, ...first.messages].map(m => m.id), ids);
      const foreign = await sendSessionMessage(b, other.id, { text: "Private other mission" });
      await assert.rejects(getSessionMessages(a, session.id, foreign.chat.messages[0].id));
      await assert.rejects(getSessionMessages(b, session.id));
      // Import the remaining old snapshot once, even after its notification expired.
      const legacyId = randomUUID();
      await gameDb.updateTable("game_session_players").set({ last_message: {
        id: legacyId, text: "Legacy transmission", createdAt: "2025-01-01T00:00:00Z",
        expiresAt: "2025-01-01T00:00:12Z",
      } }).where("session_id", "=", session.id).execute();
      await getSessionMessages(a, session.id);
      await getSessionMessages(a, session.id);
      const imported = await gameDb.selectFrom("game_session_messages").select("id").where("id", "=", legacyId).execute();
      assert.equal(imported.length, 1);
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
