export type Availability = 'now' | 'planned';

export const HERO_FACTS = ['Ages 14+', 'No prior experience required', 'Solo or cooperative multiplayer', 'Beginner to advanced missions'];

export const STEPS: { n: string; t: string; d: string; status: Availability; note: string }[] = [
  { n: '01', t: 'Learn', d: 'Discover the foundations of spacecraft engineering, orbital mechanics, mission planning, and space science through interactive explanations.', status: 'planned', note: 'Interactive lessons planned' },
  { n: '02', t: 'Plan', d: 'Understand mission objectives, budgets, timelines, engineering requirements, and scientific goals.', status: 'now', note: 'Playable now: the Earth Observer briefing' },
  { n: '03', t: 'Design', d: 'Choose spacecraft systems, scientific instruments, power supplies, communications equipment, and launch options.', status: 'planned', note: 'Spacecraft design planned' },
  { n: '04', t: 'Decide', d: "Face realistic tradeoffs. Every decision affects your spacecraft's capabilities, cost, mass, power, and mission risk.", status: 'planned', note: 'Engineering tradeoffs planned' },
  { n: '05', t: 'Launch & Improve', d: 'Simulate your mission, analyze the results, understand what worked, and apply your knowledge to the next challenge.', status: 'planned', note: 'Mission simulation planned' },
];

export const STAGES = [
  { t: 'Rookie Engineer', d: 'Learn the fundamentals of space missions, spacecraft systems, and scientific objectives.' },
  { t: 'Mission Specialist', d: 'Understand budgets, technical requirements, mission planning, and engineering constraints.' },
  { t: 'Mission Commander', d: 'Coordinate a crew, evaluate tradeoffs, and make decisions that determine mission success.' },
  { t: 'Space Architect', d: 'Take on advanced missions involving complex spacecraft, interplanetary travel, and long-term exploration.' },
];

/** Marketing-only overrides keyed by mission number. Real data comes from the catalog API. */
export const MISSION_COPY: Record<string, { level: string; blurb: string }> = {
  '001': { level: 'Beginner', blurb: 'Learn how an Earth observation satellite is planned, designed, and prepared for launch.' },
  '002': { level: 'Intermediate', blurb: 'Explore the engineering challenges of reaching and landing on the Moon.' },
  '003': { level: 'Advanced', blurb: 'Discover interplanetary mission planning, communication delays, and orbital insertion.' },
  '004': { level: 'Expert', blurb: 'Plan the infrastructure and systems required to support a sustainable lunar presence.' },
};

export const MONTHLY = ['New destinations', 'New engineering challenges', 'New scientific discoveries', 'Increasing difficulty'];

export const COOP: { t: string; status: Availability }[] = [
  { t: 'Play solo or with up to three friends.', status: 'now' },
  { t: 'Create your own engineer character.', status: 'now' },
  { t: 'Invite friends to a private mission.', status: 'now' },
  { t: 'Experience synchronized story scenes.', status: 'now' },
  { t: 'Collaborate on future mission decisions.', status: 'planned' },
  { t: 'Learn together and solve problems as a team.', status: 'planned' },
];

export const DISCIPLINES = [
  { t: 'Aerospace & Engineering', d: 'Technical accuracy, spacecraft systems, and realistic mission challenges.' },
  { t: 'Game Design', d: 'Engaging gameplay, progression, and meaningful decisions.' },
  { t: 'Storytelling', d: 'Characters, missions, dialogue, and immersive narrative experiences.' },
  { t: 'Science & Education', d: 'Accessible explanations and educational content for different skill levels.' },
];

/** Verified advisers only. Add entries once names, roles and biographies are approved by the project owner. */
export const ADVISERS: { name: string; role: string; bio: string }[] = [];

export const CREW_PREVIEW = ['01', '04', '07', '10'].map((n) => `/images/portrait-${n}.png`);

const OPTIMIZED = new Set([
  'briefing-room', 'director-office', 'director', 'earth-orbit', 'graduation', 'headquarters', 'laboratory', 'lunar-base', 'lunar', 'mars', 'mission-control',
  ...Array.from({ length: 10 }, (_, i) => `portrait-${String(i + 1).padStart(2, '0')}`),
]);

/** Maps a known /images/<name>.png to its optimized landing WebP; unknown paths pass through unchanged. */
export function landingAsset(path: string): string {
  const m = /^\/images\/([a-z0-9-]+)\.png$/.exec(path);
  return m && OPTIMIZED.has(m[1]) ? `/images/landing/${m[1]}.webp` : path;
}
