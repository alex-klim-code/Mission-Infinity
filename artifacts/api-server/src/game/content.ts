import { gameDb, requireCondition, type GameConnection } from "./database";

const preparationSchedule = [
  "Rocket & Spacecraft Design — 12 months",
  "Manufacturing & Assembly — 12 months",
  "Testing & Certification — 9 months",
  "Launch Preparation — 3 months",
];
const lunarJourney = [
  "Launch and journey to the Moon",
  "Lunar orbit, landing, and sample collection",
  "Departure from the Moon and return journey",
  "Earth re-entry and sample recovery",
];
const lunaDescription = [
  "LUNA — Lunar Sample Return", "Total Budget", "$400M", "Difficulty", "Easy",
  "Preparation Time", "36 months", "Mission Duration", "4 weeks", "",
  "Proponowany harmonogram", ...preparationSchedule, "", "4-week space mission",
  ...lunarJourney.map((text, i) => `${i + 1}. ${text}`),
].join("\n");

export const missionDefinitions = [
  {
    // Preserve the existing ID so saved rooms, memberships and history keep working.
    id: "earth-observer", number: "001", title: "LUNA — Lunar Sample Return",
    subtitle: "Lunar Sample Return",
    description: lunaDescription,
    difficulty: "Easy", enabled: true, budget: 400000000, developmentMonths: 36,
    operationalYears: 0, operationalWeeks: 4, destination: "The Moon", image: "/images/lunar.png",
    objectives: lunarJourney,
    requirements: [] as string[],
    briefing: [
      { title: "Proponowany harmonogram", text: preparationSchedule.join("\n") },
      { title: "4-week space mission", text: lunarJourney.map((text, i) => `${i + 1}. ${text}`).join("\n") },
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
  return { id, title, label, speaker, paragraphs, soloParagraphs, image: id < 3 ? `/api/game/story-images/${["graduation-warsaw", "nasa-internship", "nasa-engineering"][id]}.webp` : `/images/${image}.png` };
}
export const sceneDefinitions = [
  scene(0, "Graduation Day", "THREE YEARS AGO", "Narrator", [
    "Three years ago, you graduated from Warsaw University of Technology, ready to put your aerospace engineering knowledge to work.",
    "Your future was full of possibilities. But none of you could have imagined what was waiting ahead.",
  ], [
    "Three years ago, you graduated from Warsaw University of Technology, ready to put your aerospace engineering knowledge to work.",
    "Your future was full of possibilities. But you could not have imagined what was waiting ahead.",
  ], "graduation"),
  scene(1, "The First Opportunity", "NASA INTERNSHIP", "Narrator", [
    "Your academic work opened the door to an aerospace engineering internship at NASA.",
    "Working alongside experienced engineers, your crew began turning classroom knowledge into real mission experience.",
  ], [
    "Your academic work opened the door to an aerospace engineering internship at NASA.",
    "Working alongside experienced engineers, you began turning classroom knowledge into real mission experience.",
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
  scene(3, "Get a Message", "INCOMING MISSION TRANSMISSION", "Director Elena Voss", [
    missionDefinitions[0].description,
  ], [
    missionDefinitions[0].description,
  ], "director-office"),
  scene(4, "Meet Your Crew", "MISSION ASSIGNMENT 001", "Director Elena Voss", [
    lunaDescription,
  ], [
    lunaDescription,
  ], "briefing-room"),
  scene(5, "Start Mission", "AWAITING LEADER AUTHORIZATION", "Director Elena Voss", [
    "LUNA — Lunar Sample Return",
  ], [
    "LUNA — Lunar Sample Return",
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
