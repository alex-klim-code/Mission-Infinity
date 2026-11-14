import { gameDb, requireCondition, type GameConnection } from "./database";

const requirements = [
  "Design a spacecraft capable of operating in the selected orbit.",
  "Select suitable Earth observation instruments.",
  "Remain within the approved budget.",
  "Maintain sufficient electrical power.",
  "Ensure reliable communication with ground stations.",
  "Select a compatible launch vehicle.",
  "Complete engineering verification and testing.",
  "Launch and deploy the satellite.",
  "Collect and transmit scientific data.",
  "Achieve the required mission objectives.",
];

export const missionDefinitions = [
  {
    id: "earth-observer", number: "001", title: "Earth Observer",
    subtitle: "Design and launch humanity's next Earth observation satellite.",
    description: "You have been selected to lead your first independent space mission. Your objective is to develop an Earth observation satellite capable of collecting valuable environmental data from orbit.",
    difficulty: "Beginner", enabled: true, budget: 150000000, developmentMonths: 24,
    operationalYears: 3, destination: "Low Earth Orbit", image: "/images/earth-orbit.png",
    objectives: ["Collect environmental data from low Earth orbit.", "Monitor our changing planet.", "Transmit reliable scientific observations to Earth."],
    requirements,
    briefing: [
      { title: "Mission background", text: "ASTERION AEROSPACE · MISSION DIRECTORATE · MISSION ASSIGNMENT 001\nProject: EARTH OBSERVER\nEarth's environment is changing. Reliable observations from orbit help scientists understand land use, vegetation, water and the atmosphere. Asterion Aerospace has appointed your team to lead a new uncrewed Earth observation satellite mission." },
      { title: "Mission objective", text: "Design, launch, and operate an Earth observation satellite capable of collecting environmental data from low Earth orbit." },
      { title: "Scientific objectives", text: "Acquire useful, repeatable environmental observations. Support long-term monitoring of vegetation, water and changing land cover. Return documented, scientifically interpretable data to ground stations." },
      { title: "Engineering requirements", text: requirements.map((text, i) => `${i + 1}. ${text}`).join("\n") },
      { title: "Financial constraints", text: "Approved mission budget: $150,000,000. All future spacecraft systems, scientific instruments, launch services, testing and operations must fit within this ceiling. Trade-offs and contingency reserves will matter in the next development phase." },
      { title: "Timeline", text: "Development deadline: 24 months from mission initiation. Planned operational lifetime: 3 years. Future planning will cover design reviews, integration, environmental testing, launch readiness and orbital commissioning." },
      { title: "Operational requirements", text: "Destination: Low Earth Orbit. Maintain sufficient electrical power throughout operations and reliable communication with ground stations. Establish procedures for commissioning, routine observation, data downlink and safe shutdown." },
      { title: "Risk considerations", text: "Consider mass and power margins, instrument compatibility, schedule delays, budget overruns, communication interruptions, environmental hazards and launch compatibility. Engineering and risk simulation are reserved for the next phase." },
      { title: "Success criteria", text: "Safely deploy the satellite into its intended orbit, demonstrate reliable power and communications, collect usable environmental observations, and return scientific data over the planned mission lifetime within the approved constraints." },
      { title: "Fictional simulation notice", text: "These are fictional educational game parameters, not actual NASA mission specifications. Asterion Aerospace and Aurora Institute are fictional. Phase 1 ends when the mission is initiated; spacecraft design and simulation are not included." },
    ],
  },
  ...[
    ["lunar-explorer", "002", "Lunar Explorer", "Return to our nearest world.", "The Moon", "/images/lunar.png"],
    ["mars-orbiter", "003", "Mars Orbiter", "A new perspective on the red planet.", "Mars Orbit", "/images/mars.png"],
    ["lunar-base", "004", "Lunar Base", "Build the foundations of a new frontier.", "Lunar Surface", "/images/lunar-base.png"],
  ].map(([id, number, title, subtitle, destination, image]) => ({
    id, number, title, subtitle, destination, image, description: subtitle,
    difficulty: "Coming Soon", enabled: false, budget: 0, developmentMonths: 0,
    operationalYears: 0, objectives: [] as string[], requirements: [] as string[],
    briefing: [] as { title: string; text: string }[],
  })),
];

export const presetDefinitions = Array.from({ length: 10 }, (_, i) => ({
  id: `engineer-${String(i + 1).padStart(2, "0")}`,
  label: ["Nova", "Orion", "Lyra", "Atlas", "Vega", "Leo", "Aria", "Kai", "Sage", "Alex"][i],
  image: `/images/portrait-${String(i + 1).padStart(2, "0")}.png`,
}));

function scene(id: number, title: string, label: string, speaker: string, paragraphs: string[], soloParagraphs: string[], image: string) {
  return { id, title, label, speaker, paragraphs, soloParagraphs, image: `/images/${image}.png` };
}
export const sceneDefinitions = [
  scene(0, "Graduation Day", "THREE YEARS AGO", "Narrator", [
    "Three years ago, you graduated from the prestigious Aurora Institute of Aerospace Engineering, earning some of the highest honors in your class.",
    "Your future was full of possibilities. But none of you could have imagined what was waiting ahead.",
  ], [
    "Three years ago, you graduated from the prestigious Aurora Institute of Aerospace Engineering, earning some of the highest honors in your class.",
    "Your future was full of possibilities. But you could not have imagined what was waiting ahead.",
  ], "graduation"),
  scene(1, "The First Opportunity", "ASTERION AEROSPACE", "Narrator", [
    "Your exceptional academic performance caught the attention of Asterion Aerospace, one of the world's leading aerospace engineering companies.",
    "You were offered internships, and within six months, you became full-time engineers.",
  ], [
    "Your exceptional academic performance caught the attention of Asterion Aerospace, one of the world's leading aerospace engineering companies.",
    "You were offered an internship, and within six months, you became a full-time engineer.",
  ], "headquarters"),
  scene(2, "Three Years of Experience", "KNOWLEDGE BECOMES CONFIDENCE", "Narrator", [
    "Over the past three years, you have supported ambitious aerospace projects and assisted experienced mission teams.",
    "You helped prepare spacecraft, analyze engineering data, and support critical mission operations.",
    "With every project, your knowledge and confidence grew.",
  ], [
    "Over the past three years, you have supported ambitious aerospace projects and assisted experienced mission teams.",
    "You helped prepare spacecraft, analyze engineering data, and support critical mission operations.",
    "With every project, your knowledge and confidence grew.",
  ], "laboratory"),
  scene(3, "The Promotion", "A NEW CHAPTER", "Director Elena Voss", [
    "Your dedication and exceptional work have not gone unnoticed.",
    "Our company is preparing a new space mission. And after careful consideration, we have decided that you are ready to take responsibility for it.",
    "This time, you will not be assisting another mission team. You will be leading your own.",
  ], [
    "Your dedication and exceptional work have not gone unnoticed.",
    "Our company is preparing a new space mission. And after careful consideration, we have decided that you are ready to take responsibility for it.",
    "This time, you will not be assisting another mission team. You will be leading your own.",
  ], "director-office"),
  scene(4, "Mission Assignment", "MISSION ASSIGNMENT 001", "Director Elena Voss", [
    "Your first assignment is Project Earth Observer.",
    "You will be responsible for planning, designing, preparing, and ultimately launching an Earth observation satellite.",
    "Your decisions will determine whether this mission succeeds or fails.",
  ], [
    "Your first assignment is Project Earth Observer.",
    "You will be responsible for planning, designing, preparing, and ultimately launching an Earth observation satellite.",
    "Your decisions will determine whether this mission succeeds or fails.",
  ], "briefing-room"),
  scene(5, "Mission Accepted", "DO YOU ACCEPT THIS MISSION?", "Director Elena Voss", [
    "The mission will not be easy.",
    "You will face engineering challenges, strict budgets, deadlines, and difficult decisions.",
    "But we believe you are ready.",
  ], [
    "The mission will not be easy.",
    "You will face engineering challenges, strict budgets, deadlines, and difficult decisions.",
    "But we believe you are ready.",
  ], "mission-control"),
];

// Only content upserts, never schema changes. Also seeds a newly published database.
export async function seedGameContent() {
  await gameDb.transaction().execute(async tx => {
    for (const p of presetDefinitions) {
      await tx.insertInto("character_presets").values(p).onConflict(o => o.column("id").doUpdateSet(p)).execute();
    }
    for (const m of missionDefinitions) {
      const definition = JSON.stringify({
        ...m,
        storyId: m.enabled ? "first-command" : null,
        story: m.enabled ? sceneDefinitions.map(s => ({
          ...s,
          stage: s.id === 4 ? "MISSION_BRIEFING" : s.id === 5 ? "MISSION_ACCEPTANCE" : "STORY",
        })) : [],
      });
      await tx.insertInto("missions").values({ id: m.id, definition })
        .onConflict(o => o.column("id").doUpdateSet({ definition })).execute();
    }
    for (const s of sceneDefinitions) {
      await tx.insertInto("story_scenes").values({ id: s.id, definition: JSON.stringify(s) })
        .onConflict(o => o.column("id").doUpdateSet({ definition: JSON.stringify(s) })).execute();
    }
  });
}

// Session rules read the assigned mission's story rather than assuming six scenes.
export async function getMissionStory(id: string, db: GameConnection = gameDb) {
  const mission = await db.selectFrom("missions").select("definition").where("id", "=", id).executeTakeFirst();
  const definition = mission?.definition as { story?: { id: number; stage: string }[] } | undefined;
  requireCondition(definition?.story?.length, 409, "This mission has no introduction configured.");
  return definition.story;
}

export async function getCatalog() {
  const [missions, presets, scenes] = await Promise.all([
    gameDb.selectFrom("missions").selectAll().orderBy("id").execute(),
    gameDb.selectFrom("character_presets").selectAll().orderBy("id").execute(),
    gameDb.selectFrom("story_scenes").selectAll().orderBy("id").execute(),
  ]);
  return {
    missions: missions.map(m => m.definition as typeof missionDefinitions[number]).sort((a, b) => a.number.localeCompare(b.number)),
    presets,
    scenes: scenes.map(s => s.definition as typeof sceneDefinitions[number]),
  };
}
