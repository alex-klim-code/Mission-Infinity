import { pgTable, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { gameSessions } from "./game";

export const gameSessionScienceLoadouts = pgTable("game_session_science_loadouts", {
  sessionId: uuid("session_id").primaryKey().references(() => gameSessions.id, { onDelete: "cascade" }),
  opened: boolean("opened").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  instrumentIds: jsonb("instrument_ids").$type<string[]>().notNull().default([]),
  proposals: jsonb("proposals").$type<Record<string, string[]>>().notNull().default({}),
  spent: integer("spent").notNull().default(0),
});
