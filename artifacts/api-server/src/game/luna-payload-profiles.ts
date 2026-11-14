import type { PayloadProfile } from "@workspace/mission-physics";

/** Keyed by selected rocket-stages option ID. Populate only from documented
 * LUNA stage assignments, loaded-fuel fractions and maneuver requirements.
 * The source catalog currently provides none: an empty registry is intentional,
 * not permission to derive performance from quality or guess a fuel split. */
export const lunaPayloadProfiles: Record<string, PayloadProfile> = {};
