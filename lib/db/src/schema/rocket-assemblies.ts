import { pgTable, uuid, jsonb, boolean } from "drizzle-orm/pg-core";
import { gameSessions } from "./game";

export const gameSessionRocketAssemblies = pgTable("game_session_rocket_assemblies", {
  sessionId: uuid("session_id").primaryKey().references(() => gameSessions.id, { onDelete: "cascade" }),
  selections: jsonb("selections").$type<Record<string,string>>().notNull().default({}),
  proposals: jsonb("proposals").$type<Record<string,Record<string,string>>>().notNull().default({}),
  completed: boolean("completed").notNull().default(false),
});
