import { pgTable, uuid, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { gameSessions } from "./game";

export const gameSessionFuelLoads = pgTable("game_session_fuel_loads", {
  sessionId: uuid("session_id").primaryKey().references(() => gameSessions.id, { onDelete: "cascade" }),
  opened: boolean("opened").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  connected: boolean("connected").notNull().default(false),
  targetKg: integer("target_kg").notNull().default(30000),
  loadedKg: integer("loaded_kg").notNull().default(0),
  spent: integer("spent").notNull().default(0),
  flowingAt: timestamp("flowing_at", { withTimezone: true }),
});
