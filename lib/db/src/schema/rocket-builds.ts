import { pgTable, uuid, text, integer, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gameSessions } from "./game";

export const gameSessionBuilds = pgTable("game_session_builds", {
  sessionId: uuid("session_id").primaryKey().references(() => gameSessions.id, { onDelete: "cascade" }),
  screen: text("screen").notNull().default("INTRO"),
  selectedHullId: text("selected_hull_id"),
  spent: integer("spent").notNull().default(0),
  elapsedMonths: integer("elapsed_months").notNull().default(0),
  votes: jsonb("votes").$type<Record<string, string>>().notNull().default({}),
}, t => [
  check("rocket_build_screen_valid", sql`${t.screen} in ('INTRO','HULL_SELECTION','HULL_CONFIRMED')`),
  check("rocket_build_spent_nonnegative", sql`${t.spent} >= 0`),
  check("rocket_build_elapsed_months_nonnegative", sql`${t.elapsedMonths} >= 0`),
]);
export const insertGameSessionBuildSchema = createInsertSchema(gameSessionBuilds);
export type InsertGameSessionBuild = z.infer<typeof insertGameSessionBuildSchema>;
export type GameSessionBuild = typeof gameSessionBuilds.$inferSelect;
