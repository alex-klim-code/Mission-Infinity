import { scientificInstruments } from "./scientific-instruments";

/** Shared by the Stage 8 report and the catalog used for Stage 2 forecasts. */
export const missionObjectiveWeights = {
  moon: 10, landing: 20, samples: 20, science: 10,
  return: 20, entry: 10, recovery: 10,
} as const;

export const scienceScoring = {
  maxSciencePoints: scientificInstruments.reduce((sum, i) => sum + i.maxSciencePoints, 0),
  objectiveWeight: missionObjectiveWeights.science,
  totalMissionWeight: Object.values(missionObjectiveWeights).reduce((sum, weight) => sum + weight, 0),
};
