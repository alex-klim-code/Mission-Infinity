import { assessGameplayPayload, type PhysicalComponent, type PayloadProfile } from "@workspace/mission-physics";
import { componentById } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";
import { lunaPayloadProfiles } from "./luna-payload-profiles";
import { requireCondition, type GameConnection } from "./database";

interface PayloadCatalog {
  components: ReadonlyMap<string,PhysicalComponent>;
  profiles: Record<string,PayloadProfile>;
}
const defaultCatalog:PayloadCatalog={components:componentById,profiles:lunaPayloadProfiles};
export async function sessionPayloadCapacity(db: GameConnection, sessionId: string, overrides: { instrumentIds?: string[]; fuelKg?: number } = {}, catalog:PayloadCatalog=defaultCatalog) {
  const [assembly,build,science,fuel]=await Promise.all([
    db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",sessionId).executeTakeFirst(),
    db.selectFrom("game_session_builds").select("selected_hull_id").where("session_id","=",sessionId).executeTakeFirst(),
    db.selectFrom("game_session_science_loadouts").select("instrument_ids").where("session_id","=",sessionId).executeTakeFirst(),
    db.selectFrom("game_session_fuel_loads").select(["loaded_kg","opened"]).where("session_id","=",sessionId).executeTakeFirst(),
  ]);
  const selections=assembly?.selections??{};
  const ids=[...new Set([build?.selected_hull_id,...Object.values(selections)].filter((s):s is string=>!!s))];
  return assessGameplayPayload({
    components:ids.map(id=>catalog.components.get(id)??{id,name:id,categoryId:"unknown",massKg:null}),
    instruments:(overrides.instrumentIds??science?.instrument_ids??[]).map(id=>scientificInstruments.find(i=>i.id===id)??{id,massKg:null}),
    fuelKg:overrides.fuelKg??(fuel?.opened?fuel.loaded_kg:null),
    profile:catalog.profiles[selections["rocket-stages"]],
  });
}

/** Quality-based estimates are a reference, not a new purchase/launch gate.
 * Existing budget, compatibility and real mission-state checks still apply. */
export async function requireKnownPayloadFeasible(db: GameConnection, sessionId: string, overrides: { instrumentIds?: string[]; fuelKg?: number } = {}, catalog:PayloadCatalog=defaultCatalog) {
  const result=await sessionPayloadCapacity(db,sessionId,overrides,catalog);
  requireCondition(result.basis==="QUALITY" || result.status==="INCOMPLETE" || result.feasible===true,409,result.warnings.join(" · ") || "Payload configuration cannot fly.");
  return result;
}
