import imported from "./luna-catalog-data.json";
import translations from "./luna-catalog.en.json";

const definitions: [string, string, [string, string][]][] = [
  ["structure", "Rocket Structure", [["rocket-body","Rocket Body"],["rocket-stages","Rocket Stages"],["payload-fairing","Payload Fairing"],["stage-separation","Stage Separation"]]],
  ["propulsion", "Propulsion & Fuel", [["main-engines","Main Engines"],["upper-stage-engines","Upper Stage Engines"],["fuel-tanks","Fuel Tanks"],["orbital-maneuvering","Orbital Maneuvering"]]],
  ["avionics", "Avionics & Navigation", [["onboard-computer","Onboard Computer"],["navigation-sensors","Navigation & Sensors"],["attitude-control","Attitude Control"],["flight-sensors","Flight Sensors"]]],
  ["power", "Power & Communication", [["electrical-power-system","Electrical Power System"],["batteries","Batteries"],["solar-panels","Solar Panels"],["communication","Communication"]]],
  ["protection", "Protection & Integration", [["thermal-protection","Thermal Protection"],["payload-adapter","Payload Adapter"]]],
  ["lunar", "Lunar Exploration", [["lunar-lander","Lunar Lander"],["landing-legs","Landing Legs"],["lunar-descent-engine","Lunar Descent Engine"],["lunar-ascent-system","Lunar Ascent System"],["sample-collection","Sample Collection"],["scientific-instruments","Scientific Instruments"]]],
  ["return", "Earth Return", [["sample-container","Sample Container"],["return-capsule","Return Capsule"],["re-entry-heat-shield","Re-entry Heat Shield"],["recovery-system","Recovery System"]]],
];

// Hull mass/quality were never supplied; do not invent engineering specifications.
const hulls = [
  ["falcon-shadow", "Falcon Shadow", 50000000, "Black and white"],
  ["titan-explorer", "Titan Explorer", 60000000, "Orange and white"],
  ["nova-prime", "Nova Prime", 90000000, "White and blue"],
] as const;
export const rocketOptions = [
  ...hulls.map(([id,name,price,color]) => ({
    id, categoryId: "rocket-body", name, price, massKg: null, quality: null,
    parameters: color, description: `${color} Asterion Aerospace rocket body.`,
    dataStatus: "GAME", source: "Mission: Infinity", originalCategory: "Rocket Body",
    referenceUrl: "", qualityMethodology: "Body mass and game quality have not been specified.",
    fuel: null,
  })),
  ...imported.map(option => ({...option, ...(translations as Record<string, Partial<typeof option>>)[option.id]})),
].map(option => ({
  ...option,
  // Gameplay reliability only. The catalog's least expensive tier has Q55:
  // 50% damage risk; Q96 has 4%. Unspecified hull quality uses a 25% estimate.
  damageRisk: option.quality === null ? 25 : Math.max(2,Math.min(50,Math.round((100-option.quality)*50/45))),
}));
export const rocketCatalog = definitions.map(([id,name,categories]) => ({
  id, name, categories: categories.map(([id,name]) => ({
    id, name, options: rocketOptions.filter(option => option.categoryId === id),
  })),
}));
export const componentById = new Map(rocketOptions.map(option => [option.id, option]));
export const componentCategories = rocketCatalog.flatMap(s => s.categories).filter(c => c.id !== "rocket-body");
