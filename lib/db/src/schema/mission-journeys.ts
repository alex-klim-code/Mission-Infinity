import { pgTable, uuid, boolean, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { gameSessions } from "./game";

export const gameSessionMissionJourneys = pgTable("game_session_mission_journeys", {
  sessionId: uuid("session_id").primaryKey().references(() => gameSessions.id, { onDelete: "cascade" }),
  constructionOpened: boolean("construction_opened").notNull().default(false),
  constructionStartedAt: timestamp("construction_started_at", { withTimezone: true }),
  constructionMonths: integer("construction_months").notNull().default(12),
  constructionCost: integer("construction_cost").notNull().default(0),
  delivered: boolean("delivered").notNull().default(false),
  phase: text("phase").notNull().default("NONE"),
  weather: jsonb("weather").notNull().default([]),
  briefingDate: text("briefing_date"),
  plan: jsonb("plan"),
  flightStartedAt: timestamp("flight_started_at", { withTimezone: true }),
  diagnosticsStartedAt: timestamp("diagnostics_started_at", { withTimezone: true }),
  diagnostics: jsonb("diagnostics").notNull().default([]),
  operations: jsonb("operations"),
});
